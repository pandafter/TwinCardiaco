/** Respuesta del motor a cada intervención. Verifica que el gráfico
    "antes / después" refleja fisiología y no una curva dibujada a mano. */
import { Engine } from "../src/lib/engine";

for (const key of ["none", "inotrope", "vasopressor"]) {
  console.log(`\n=== ${key} (aplicada en t=100) ===`);
  for (const t of [100, 115, 130, 145, 160]) {
    const e = new Engine(t, key === "none" ? undefined : { at: 100, key });
    const v = e.step(0.25).vitals;
    console.log(
      `  t=${t}  HR=${v.hr.toFixed(0).padStart(3)}  MAP=${v.map.toFixed(0).padStart(3)}  ` +
        `SpO2=${v.spo2.toFixed(0)}  Lac=${v.lactate.toFixed(1)}  CO=${v.co.toFixed(1)}  ` +
        `PI=${v.perfusion_index.toFixed(2)}`,
    );
  }
}
