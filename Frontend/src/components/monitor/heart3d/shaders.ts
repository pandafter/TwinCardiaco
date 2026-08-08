/**
 * Shaders del miocardio.
 *
 * LA DEFORMACIÓN, QUE ES LO QUE IMPORTA
 * -------------------------------------
 * Un corazón que solo escala se ve como un globo. El corazón real hace tres
 * cosas a la vez, y las tres están aquí:
 *
 *   1. El ápex está ANCLADO. Lo que se mueve es la base, que desciende hacia
 *      él. Si escalas desde el centro, el ápex sube y el ojo lo lee como falso.
 *   2. Se estrecha radialmente, más en el tercio medio que en la base.
 *   3. Se RETUERCE. El ápex gira en un sentido y la base en el contrario —
 *      el movimiento de escurrir un trapo. Es el detalle que hace que alguien
 *      que ha visto un ecocardiograma diga "esto está bien hecho".
 *
 * Las normales se recalculan por derivadas de pantalla en el fragment shader,
 * así que la iluminación sigue la deformación sin recalcular la malla en CPU.
 */

export const MYOCARDIUM_VERT = /* glsl */ `
  attribute float aH;          // 0 = ápex, 1 = base

  uniform float uVent;         // contracción ventricular 0..1
  uniform float uAtrial;       // contracción auricular 0..1
  uniform float uAmp;          // amplitud ∝ volumen sistólico
  uniform float uFib;          // 0..1 fibrilación auricular
  uniform float uTime;
  uniform float uIsAtrium;     // 1 en las aurículas, 0 en los ventrículos

  varying vec3 vPosV;
  varying vec3 vPosO;
  varying float vH;
  varying float vFib;

  void main() {
    vec3 p = position;
    float c = uVent * uAmp;

    if (uIsAtrium < 0.5) {
      // ---- ventrículos ----
      // 1. la base desciende hacia el ápex anclado
      p.y -= c * 0.15 * aH;

      // 2. estrechamiento radial, máximo pasado el ápex
      float radial = 1.0 - c * 0.175 * smoothstep(0.0, 0.32, aH);
      p.xz *= radial;

      // 3. torsión opuesta entre ápex y base
      float ang = c * (0.22 * (1.0 - aH) - 0.11 * aH);
      float sa = sin(ang), ca = cos(ang);
      p.xz = vec2(p.x * ca - p.z * sa, p.x * sa + p.z * ca);
    } else {
      // ---- aurículas ----
      // se vacían con su propia patada, 0.16 s antes que el ventrículo
      float a = uAtrial * uAmp;
      p.xz *= 1.0 - a * 0.13;
      p.y -= a * 0.05;

      // en fibrilación no se contraen: tiemblan a ~400/min sin mover sangre
      float tremor = sin(uTime * 41.0 + p.x * 22.0 + p.z * 17.0)
                   * sin(uTime * 33.0 + p.y * 19.0);
      p += normal * tremor * uFib * 0.018;

      // y se distienden, porque la sangre que no expulsan se les queda dentro
      p.xz *= 1.0 + uFib * 0.07;
    }

    vFib = uFib;
    vH = aH;
    vPosO = p;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vPosV = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

export const MYOCARDIUM_FRAG = /* glsl */ `
  precision highp float;

  uniform vec3  uOxy;        // color del músculo bien perfundido
  uniform vec3  uHypoxic;    // color del músculo hipóxico
  uniform float uPerfusion;  // 0..1
  uniform float uVent;
  uniform float uTime;
  uniform float uIschemia;   // 0..1, oscurecimiento regional

  varying vec3 vPosV;
  varying vec3 vPosO;
  varying float vH;
  varying float vFib;

  // ruido de valor 3D, barato y suficiente para fibras y moteado
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    return noise(p) * 0.55 + noise(p * 2.1) * 0.28 + noise(p * 4.3) * 0.17;
  }

  void main() {
    // normal geométrica exacta, derivada de la posición ya deformada
    vec3 N = normalize(cross(dFdx(vPosV), dFdy(vPosV)));
    vec3 V = normalize(-vPosV);
    if (dot(N, V) < 0.0) N = -N;

    // RELIEVE. Sin esto el miocardio se ve de plástico: la malla es lisa y
    // solo el color varía. Perturbando la normal con el gradiente del ruido
    // aparecen los haces musculares y la grasa, sin subdividir la geometría.
    // una sola octava basta: el relieve fino ya lo aporta la escala, y esto se
    // evalúa cuatro veces por píxel — con fbm el coste se dobla sin ganancia
    {
      vec3 q = vPosO * 11.0;
      float e = 0.06;
      float n0 = noise(q);
      vec3 grad = vec3(
        noise(q + vec3(e, 0.0, 0.0)) - n0,
        noise(q + vec3(0.0, e, 0.0)) - n0,
        noise(q + vec3(0.0, 0.0, e)) - n0
      ) / e;
      // el gradiente tangencial: la componente normal no aporta relieve
      grad -= N * dot(grad, N);
      N = normalize(N - grad * 0.075);
    }

    // luces fijas en espacio de vista: la iluminación no gira con el modelo
    vec3 L1 = normalize(vec3(-0.45,  0.75,  0.62));   // principal, cálida
    vec3 L2 = normalize(vec3( 0.72,  0.15,  0.35));   // relleno frío
    vec3 L3 = normalize(vec3( 0.10, -0.55, -0.70));   // contra, azul

    // el miocardio es translúcido: iluminación envolvente, no Lambert seco
    float w1 = max(0.0, (dot(N, L1) + 0.45) / 1.45);
    float w2 = max(0.0, (dot(N, L2) + 0.55) / 1.55);
    float w3 = max(0.0, dot(N, L3));

    // fibras miocárdicas: recorren el músculo en hélice
    vec3 fp = vPosO * vec3(3.4, 2.2, 3.4);
    float helix = fbm(fp + vec3(vPosO.y * 5.5, 0.0, 0.0));
    float fiber = fbm(vPosO * 14.0 + helix * 1.8) * 0.5 + 0.5;

    // moteado grueso de grasa epicárdica
    float fat = smoothstep(0.62, 0.86, fbm(vPosO * 5.2 + 11.0));

    // La perfusión clínicamente interesante vive entre 0.35 y 0.95: por debajo
    // de 0.35 el paciente ya está en shock. Estirar ese tramo a todo el rango
    // de color hace que el músculo vire de verdad cuando importa, en vez de
    // quedarse rojo hasta que ya no hay nada que decidir.
    float pf = smoothstep(0.35, 0.95, clamp(uPerfusion, 0.0, 1.0));
    vec3 base = mix(uHypoxic, uOxy, pf);
    base *= 0.70 + fiber * 0.54;
    base = mix(base, base * vec3(1.22, 1.12, 0.84), fat * 0.45);

    // isquemia: el músculo mal irrigado se apaga y vira a violáceo
    base = mix(base, base * vec3(0.44, 0.36, 0.52), uIschemia * 0.85);

    // durante la sístole el músculo se comprime y se ve más oscuro y saturado
    base *= 1.0 - uVent * 0.12;

    vec3 col = base * (w1 * 0.85 + w2 * 0.34) + base * w3 * 0.16;

    // subsurface: la luz que atraviesa el músculo delgado sale roja
    float sss = pow(max(0.0, dot(V, -L1)), 2.6);
    col += uOxy * sss * 0.30 * (0.25 + pf * 0.75);

    // brillo húmedo del pericardio. Contenido a propósito: un specular fuerte
    // sobre una superficie lisa es exactamente el aspecto de "juguete de
    // plástico". El relieve de arriba lo rompe en manchas irregulares.
    vec3 H1 = normalize(L1 + V);
    float spec = pow(max(0.0, dot(N, H1)), 26.0);
    col += vec3(1.0, 0.93, 0.90) * spec * 0.26 * (0.35 + fiber * 0.65);

    // rim frío, para que recorte contra el fondo azul del monitor
    float fres = pow(1.0 - max(0.0, dot(N, V)), 2.8);
    col += vec3(0.36, 0.68, 1.0) * fres * 0.34;

    // pulso de rubor con cada sístole
    col += uOxy * uVent * 0.09;

    // el ápex queda algo más oscuro, como en el corazón real
    col *= 0.86 + vH * 0.14;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Vasos y coronarias: mismo esqueleto, pero emisivos y con pulso propio. */
export const VESSEL_VERT = /* glsl */ `
  attribute float aH;
  uniform float uVent;
  uniform float uAmp;
  uniform float uPulse;      // distensión con la onda de presión
  uniform float uAttached;   // 1 = sigue al miocardio (coronarias), 0 = anclado

  varying vec3 vPosV;
  varying vec3 vPosO;

  void main() {
    vec3 p = position;

    if (uAttached > 0.5) {
      // las coronarias van montadas sobre el músculo: repiten su deformación
      float c = uVent * uAmp;
      float h = clamp((p.y + 1.05) / 1.95, 0.0, 1.0);
      p.y -= c * 0.15 * h;
      p.xz *= 1.0 - c * 0.175 * smoothstep(0.0, 0.32, h);
      float ang = c * (0.22 * (1.0 - h) - 0.11 * h);
      float sa = sin(ang), ca = cos(ang);
      p.xz = vec2(p.x * ca - p.z * sa, p.x * sa + p.z * ca);
    } else {
      // los grandes vasos solo se distienden con el pulso
      p *= 1.0 + uPulse * 0.022;
    }

    vPosO = p;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vPosV = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

export const VESSEL_FRAG = /* glsl */ `
  precision highp float;

  uniform vec3  uColor;
  uniform float uFlow;       // 0..1 flujo (coronarias: máximo en diástole)
  uniform float uEmissive;
  uniform float uTime;

  varying vec3 vPosV;
  varying vec3 vPosO;

  void main() {
    vec3 N = normalize(cross(dFdx(vPosV), dFdy(vPosV)));
    vec3 V = normalize(-vPosV);
    if (dot(N, V) < 0.0) N = -N;

    vec3 L = normalize(vec3(-0.45, 0.75, 0.62));
    float d = max(0.0, (dot(N, L) + 0.4) / 1.4);
    float fres = pow(1.0 - max(0.0, dot(N, V)), 2.2);

    vec3 col = uColor * (0.34 + d * 0.72);

    // onda de flujo viajando a lo largo del vaso
    float wave = sin(vPosO.y * 9.0 - uTime * 5.0) * 0.5 + 0.5;
    col += uColor * uEmissive * uFlow * (0.45 + wave * 0.55);
    col += vec3(0.4, 0.7, 1.0) * fres * 0.3;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;
