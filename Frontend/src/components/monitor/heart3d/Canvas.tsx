"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { HeartScene, type HeartSceneProps } from "./Scene";

/**
 * Lienzo WebGL del corazón. Se carga con `dynamic(ssr:false)` desde
 * `Heart3DView`: three.js toca `window` al construirse y no sobrevive al
 * prerender del servidor.
 *
 * Sin tone mapping: la iluminación del miocardio está calibrada a mano en el
 * fragment shader contra el fondo del monitor. ACES la lavaría.
 */
export default function HeartCanvas(props: HeartSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0.25, 0.3, 5.3], fov: 30 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.NoToneMapping,
      }}
      style={{ background: "transparent" }}
    >
      <HeartScene {...props} />
    </Canvas>
  );
}
