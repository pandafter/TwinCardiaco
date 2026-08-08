"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

import type { Rhythm } from "@/lib/engine";
import {
  BeatSequencer,
  PR_S,
  atrialContraction,
  coronaryFlow,
  isIrregular,
  ventricularContraction,
} from "@/lib/cardiacCycle";
import {
  buildAtria,
  buildCoronaries,
  buildVentricles,
  buildVessels,
} from "./geometry";
import {
  MYOCARDIUM_FRAG,
  MYOCARDIUM_VERT,
  VESSEL_FRAG,
  VESSEL_VERT,
} from "./shaders";

export type HeartSceneProps = {
  hr: number;
  rhythm: Rhythm;
  /** volumen sistólico en mL. Manda la amplitud de la contracción. */
  strokeVolume: number;
  /** 0–1. Manda el color: rojo arterial → violáceo hipóxico. */
  perfusion: number;
  /** 0–1. Oscurecimiento isquémico del miocardio. */
  ischemia?: number;
};

function myocardiumMaterial(isAtrium: boolean) {
  return new THREE.ShaderMaterial({
    vertexShader: MYOCARDIUM_VERT,
    fragmentShader: MYOCARDIUM_FRAG,
    uniforms: {
      uVent: { value: 0 },
      uAtrial: { value: 0 },
      uAmp: { value: 1 },
      uFib: { value: 0 },
      uTime: { value: 0 },
      uIsAtrium: { value: isAtrium ? 1 : 0 },
      uPerfusion: { value: 1 },
      uIschemia: { value: 0 },
      uOxy: { value: new THREE.Color("#cf2634") },
      uHypoxic: { value: new THREE.Color("#4a2450") },
    },
  });
}

function vesselMaterial(color: string, attached: boolean, emissive: number) {
  return new THREE.ShaderMaterial({
    vertexShader: VESSEL_VERT,
    fragmentShader: VESSEL_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uFlow: { value: 0 },
      uEmissive: { value: emissive },
      uTime: { value: 0 },
      uVent: { value: 0 },
      uAmp: { value: 1 },
      uPulse: { value: 0 },
      uAttached: { value: attached ? 1 : 0 },
    },
  });
}

export function HeartScene({
  hr,
  rhythm,
  strokeVolume,
  perfusion,
  ischemia = 0,
}: HeartSceneProps) {
  const group = useRef<THREE.Group>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const idleSince = useRef(0);

  // El scheduler lee de una ref: el motor emite a 4 Hz y reconstruirlo en cada
  // tick abortaría el latido en curso. Se actualiza en un efecto, no durante el
  // render — un frame de desfase a 4 Hz no lo ve nadie.
  const live = useRef({ hr, irregular: isIrregular(rhythm), sv: strokeVolume });
  useEffect(() => {
    live.current = { hr, irregular: isIrregular(rhythm), sv: strokeVolume };
  }, [hr, rhythm, strokeVolume]);

  const geo = useMemo(
    () => ({
      ventricles: buildVentricles(),
      atria: buildAtria(),
      vessels: buildVessels(),
      coronaries: buildCoronaries(),
    }),
    [],
  );

  const mat = useMemo(
    () => ({
      myo: myocardiumMaterial(false),
      atria: myocardiumMaterial(true),
      aorta: vesselMaterial("#c94b52", false, 0.35),
      pulmonary: vesselMaterial("#4a7fb5", false, 0.3),
      cava: vesselMaterial("#3f6fa0", false, 0.25),
      coronary: vesselMaterial("#ff6b70", true, 1.1),
    }),
    [],
  );

  // se construye en el primer frame, no en el render: leer una ref durante el
  // render es justo lo que React 19 desaconseja
  const seqRef = useRef<BeatSequencer | null>(null);

  // liberar GPU al desmontar: el monitor se monta y desmonta al navegar
  useEffect(() => {
    const g = geo;
    const m = mat;
    return () => {
      g.ventricles.dispose();
      g.atria.forEach((x) => x.dispose());
      Object.values(g.vessels).forEach((x) => x.dispose());
      Object.values(g.coronaries).forEach((x) => x.dispose());
      Object.values(m).forEach((x) => x.dispose());
    };
  }, [geo, mat]);

  const { invalidate } = useThree();
  useEffect(() => invalidate(), [invalidate]);

  useFrame((state) => {
    const seq = (seqRef.current ??= new BeatSequencer(() => live.current));
    const now = state.clock.elapsedTime;
    const dt = seq.advance(now);
    const rr = seq.rr;

    // el QRS va PR_S después del inicio del ciclo (la onda P)
    const vent = ventricularContraction(dt - PR_S, rr);
    const atrial = live.current.irregular ? 0 : atrialContraction(dt);
    const flow = coronaryFlow(dt - PR_S, rr);

    // amplitud proporcional al volumen sistólico: la bomba débil se contrae
    // menos, y eso se tiene que ver sin leer un número
    const amp = THREE.MathUtils.clamp(live.current.sv / 95, 0.3, 1.05);
    const fib = live.current.irregular ? 1 : 0;

    const shared = { vent, atrial, amp, fib, now, flow };
    applyUniforms(mat, shared, perfusion, ischemia);

    // el corazón cuelga: cada sístole lo balancea un poco
    if (group.current) {
      group.current.rotation.z = -0.06 + vent * amp * 0.022;
      group.current.position.y = vent * amp * -0.03;
    }

    // el autogiro se reanuda 4 s después de soltar el ratón
    const c = controls.current;
    if (c) c.autoRotate = now - idleSince.current > 4;
  });

  return (
    <>
      <group
        ref={group}
        rotation={[0.06, 0.5, -0.06]}
        position={[0, -0.22, 0]}
        scale={0.85}
      >
        <mesh geometry={geo.ventricles} material={mat.myo} />
        {geo.atria.map((g, i) => (
          <mesh key={i} geometry={g} material={mat.atria} />
        ))}

        <mesh geometry={geo.vessels.aorta} material={mat.aorta} />
        <mesh geometry={geo.vessels.pulmonary} material={mat.pulmonary} />
        <mesh geometry={geo.vessels.cava} material={mat.cava} />

        <mesh geometry={geo.coronaries.lad} material={mat.coronary} />
        <mesh geometry={geo.coronaries.circumflex} material={mat.coronary} />
        <mesh geometry={geo.coronaries.rca} material={mat.coronary} />
      </group>

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableZoom
        minDistance={2.6}
        maxDistance={7}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI - 0.35}
        rotateSpeed={0.8}
        zoomSpeed={0.6}
        autoRotate
        autoRotateSpeed={0.55}
        enableDamping
        dampingFactor={0.08}
        onStart={() => {
          idleSince.current = Number.POSITIVE_INFINITY;
        }}
        onEnd={() => {
          idleSince.current = performance.now() / 1000;
        }}
      />
    </>
  );
}

type Shared = {
  vent: number;
  atrial: number;
  amp: number;
  fib: number;
  now: number;
  flow: number;
};

function applyUniforms(
  mat: Record<string, THREE.ShaderMaterial>,
  s: Shared,
  perfusion: number,
  ischemia: number,
) {
  const p = THREE.MathUtils.clamp(perfusion, 0, 1);

  for (const m of [mat.myo, mat.atria]) {
    m.uniforms.uVent.value = s.vent;
    m.uniforms.uAtrial.value = s.atrial;
    m.uniforms.uAmp.value = s.amp;
    m.uniforms.uFib.value = s.fib;
    m.uniforms.uTime.value = s.now;
    m.uniforms.uPerfusion.value = p;
    m.uniforms.uIschemia.value = THREE.MathUtils.clamp(ischemia, 0, 1);
  }

  for (const m of [mat.aorta, mat.pulmonary, mat.cava, mat.coronary]) {
    m.uniforms.uTime.value = s.now;
    m.uniforms.uVent.value = s.vent;
    m.uniforms.uAmp.value = s.amp;
    m.uniforms.uPulse.value = s.vent;
  }

  // los grandes vasos reciben sangre en sístole...
  mat.aorta.uniforms.uFlow.value = s.vent;
  mat.pulmonary.uniforms.uFlow.value = s.vent;
  mat.cava.uniforms.uFlow.value = 1 - s.vent * 0.5;

  // ...pero las coronarias se llenan en DIÁSTOLE, y su brillo cae con la
  // perfusión: es el canal visual de "el músculo se está quedando sin oxígeno"
  mat.coronary.uniforms.uFlow.value = s.flow * (0.25 + p * 0.75);
}
