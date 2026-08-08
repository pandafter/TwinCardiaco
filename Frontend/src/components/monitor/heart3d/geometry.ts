/**
 * Geometría procedural del corazón.
 *
 * POR QUÉ NO UNA MALLA ANATÓMICA REAL
 * -----------------------------------
 * BodyParts3D y compañía traen decenas de MB, nomenclatura opaca y cero
 * control sobre la topología. Aquí necesitamos deformar la malla latido a
 * latido en el vertex shader, y para eso hace falta saber qué vértice es el
 * ápex y cuál la base. Generándola nosotros, cada vértice trae su altura
 * normalizada (`aH`) como atributo y la deformación es exacta.
 *
 * Además pesa ~200 kB en vez de 40 MB y no hay que atribuir nada.
 *
 * Convenio de ejes: +Y hacia la base (arriba), −Y hacia el ápex (abajo),
 * +Z hacia delante (hacia el observador), −X hacia la izquierda del paciente.
 */

import * as THREE from "three";

/** Distancia angular mínima entre dos ángulos, en radianes. */
function angDist(a: number, b: number) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/**
 * Perfil radial del ventrículo en función de la altura normalizada.
 * 0 = ápex (puntiagudo), 1 = base (ancha). El máximo cae en el tercio
 * medio-superior, como en el corazón real.
 */
function profile(h: number) {
  const a = Math.pow(h, 0.62); // sube rápido desde el ápex
  const b = 1 - 0.42 * Math.pow(h, 2.2); // se estrecha hacia la base
  return a * b;
}

/**
 * Radio del miocardio en (ángulo, altura). Recoge tres rasgos anatómicos:
 *
 * 1. El ventrículo izquierdo es más grueso y redondo que el derecho.
 * 2. Los surcos interventriculares (anterior y posterior) son hendiduras.
 * 3. El corazón está aplanado en sentido antero-posterior, no es un cilindro.
 */
function radiusAt(theta: number, h: number) {
  let r = profile(h);

  // masa del VI hacia −X
  r *= 1 + 0.17 * Math.cos(theta - Math.PI * 0.85);

  // surco interventricular anterior (por donde baja la descendente anterior)
  const gA = Math.exp(-Math.pow(angDist(theta, Math.PI * 0.28) / 0.22, 2));
  // y el posterior, en el lado opuesto
  const gP = Math.exp(-Math.pow(angDist(theta, Math.PI * 1.32) / 0.26, 2));
  r *= 1 - (gA * 0.17 + gP * 0.115) * Math.min(1, h * 2.2);

  // surco auriculoventricular: el anillo que separa aurículas de ventrículos
  const av = Math.exp(-Math.pow((h - 0.88) / 0.06, 2));
  r *= 1 - av * 0.12;

  return r;
}

/** Punto de la superficie ventricular. Compartido con las coronarias. */
export function surfacePoint(theta: number, h: number, inflate = 0): THREE.Vector3 {
  const r = radiusAt(theta, h) + inflate;
  const y = -1.05 + h * 1.95;

  // el ápex se desvía hacia delante y a la izquierda: es el eje cardíaco
  const lean = Math.pow(1 - h, 1.7);

  return new THREE.Vector3(
    Math.cos(theta) * r - 0.2 * lean,
    y,
    Math.sin(theta) * r * 0.84 + 0.12 * lean, // aplanamiento antero-posterior
  );
}

/**
 * Miocardio ventricular.
 *
 * Devuelve además el atributo `aH` (0 ápex → 1 base) que el vertex shader usa
 * para anclar el ápex, hacer descender la base y aplicar la torsión.
 */
export function buildVentricles(segU = 128, segV = 96) {
  const pos: number[] = [];
  const nrm: number[] = [];
  const hAttr: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];

  for (let j = 0; j <= segV; j++) {
    const h = j / segV;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      const theta = u * Math.PI * 2;
      const p = surfacePoint(theta, h);
      pos.push(p.x, p.y, p.z);
      nrm.push(0, 0, 0); // se calculan al final
      hAttr.push(h);
      uv.push(u, h);
    }
  }

  const row = segU + 1;
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * row + i;
      const b = a + row;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  // tapa de la base: un abanico hacia el centro, para que no se vea el hueco
  const center = pos.length / 3;
  pos.push(-0.05, 0.9, 0.03);
  nrm.push(0, 0, 0);
  hAttr.push(1);
  uv.push(0.5, 1);
  const top = segV * row;
  for (let i = 0; i < segU; i++) idx.push(center, top + i + 1, top + i);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("aH", new THREE.Float32BufferAttribute(hAttr, 1));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Aurículas: dos sacos sobre la base. Se animan aparte porque se contraen
 * ANTES que los ventrículos — y en fibrilación no se contraen en absoluto.
 */
export function buildAtria() {
  const mk = (
    cx: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    rot: number,
  ) => {
    const g = new THREE.SphereGeometry(1, 48, 32);
    g.scale(rx, ry, rz);
    g.rotateZ(rot);
    g.translate(cx, 0.78, cz);
    // las aurículas son todo "base": aH = 1 en toda la malla
    const n = g.attributes.position.count;
    g.setAttribute("aH", new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1));
    return g;
  };

  // izquierda (hacia −X, algo más atrás) y derecha (hacia +X, más adelante)
  return [
    mk(-0.34, -0.14, 0.42, 0.3, 0.34, 0.22),
    mk(0.36, 0.08, 0.38, 0.28, 0.32, -0.18),
  ];
}

/** Un vaso: tubo a lo largo de una curva suave. */
function tube(points: number[][], r0: number, r1: number, seg = 64, rad = 18) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  const g = new THREE.TubeGeometry(curve, seg, 1, rad, false);

  // afinado progresivo: los vasos no son tubos de radio constante
  const p = g.attributes.position as THREE.BufferAttribute;
  const base = new THREE.TubeGeometry(curve, seg, 0, rad, false);
  const bp = base.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const t = Math.floor(i / (rad + 1)) / seg;
    const r = r0 + (r1 - r0) * t;
    p.setXYZ(
      i,
      bp.getX(i) + (p.getX(i) - bp.getX(i)) * r,
      bp.getY(i) + (p.getY(i) - bp.getY(i)) * r,
      bp.getZ(i) + (p.getZ(i) - bp.getZ(i)) * r,
    );
  }
  base.dispose();
  p.needsUpdate = true;
  g.computeVertexNormals();

  const n = p.count;
  g.setAttribute("aH", new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1));
  return g;
}

/**
 * Grandes vasos. No se contraen con el miocardio (son la parte anclada del
 * corazón), pero la aorta sí se distiende con el pulso.
 */
export function buildVessels() {
  return {
    // aorta ascendente + arco, saliendo del centro de la base hacia atrás-derecha
    aorta: tube(
      [
        [-0.12, 0.72, -0.02],
        [-0.1, 1.05, -0.05],
        [-0.02, 1.34, -0.12],
        [0.22, 1.5, -0.26],
        [0.5, 1.42, -0.4],
        [0.62, 1.18, -0.46],
      ],
      0.17,
      0.13,
    ),
    // tronco pulmonar, cruzando por delante hacia la izquierda
    pulmonary: tube(
      [
        [0.1, 0.7, 0.24],
        [0.02, 1.0, 0.28],
        [-0.2, 1.24, 0.2],
        [-0.48, 1.34, 0.02],
        [-0.68, 1.3, -0.16],
      ],
      0.155,
      0.115,
    ),
    // cava superior entrando a la aurícula derecha
    cava: tube(
      [
        [0.5, 0.72, 0.1],
        [0.56, 1.06, 0.04],
        [0.6, 1.4, 0.0],
      ],
      0.11,
      0.095,
    ),
  };
}

/**
 * Coronarias, pegadas a la superficie ventricular.
 *
 * Se generan con la MISMA función de superficie que el miocardio y un pequeño
 * inflado, así que siguen la forma exactamente en vez de flotar sobre ella.
 * Son lo que más comunica: se encienden en diástole, que es cuando el corazón
 * realmente se irriga.
 */
export function buildCoronaries() {
  const along = (
    theta: (t: number) => number,
    hFrom: number,
    hTo: number,
    n = 30,
  ) => {
    const pts: number[][] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const h = hFrom + (hTo - hFrom) * t;
      const p = surfacePoint(theta(t), h, 0.022);
      pts.push([p.x, p.y, p.z]);
    }
    return pts;
  };

  return {
    // descendente anterior: baja por el surco anterior hasta el ápex
    lad: tube(along((t) => Math.PI * 0.28 + t * 0.1, 0.92, 0.05), 0.032, 0.014, 48, 10),
    // circunfleja: rodea la base por la izquierda
    circumflex: tube(
      along((t) => Math.PI * 0.28 - t * 1.5, 0.9, 0.52, 26),
      0.03,
      0.016,
      40,
      10,
    ),
    // coronaria derecha: rodea por la derecha y baja al surco posterior
    rca: tube(
      along((t) => Math.PI * 0.28 + 0.15 + t * 1.75, 0.91, 0.4, 28),
      0.031,
      0.015,
      44,
      10,
    ),
  };
}
