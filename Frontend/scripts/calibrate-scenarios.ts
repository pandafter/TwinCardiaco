/** Las tres ramas del "mismo paciente, distinta decisión". */
import { simulateScenarios, SCENARIO_META } from "../src/lib/scenarios";

for (const r of simulateScenarios()) {
  const m = SCENARIO_META[r.key];
  const at = (min: number) =>
    r.points.reduce((a, p) => (Math.abs(p.min - min) < Math.abs(a.min - min) ? p : a));
  console.log(
    `\n${m.sub} — ${m.title}  [${r.finalStatus}]  ttc=${
      r.timeToCritical === null ? ">horizonte" : (r.timeToCritical / 60).toFixed(2) + " min"
    }`,
  );
  for (const min of [0, 5, 10, 20, 30]) {
    const p = at(min);
    console.log(
      `  +${String(min).padStart(2)}min  idx=${p.index.toFixed(2).padStart(5)}  ` +
        `MAP=${p.map.toFixed(0).padStart(3)}  HR=${p.hr.toFixed(0).padStart(3)}  ` +
        `SpO2=${p.spo2.toFixed(0)}  Lac=${p.lactate.toFixed(1)}`,
    );
  }
  const d = r.deltas;
  console.log(`  deltas: HR ${d.hr.toFixed(0)}  MAP ${d.map.toFixed(0)}  SpO2 ${d.spo2.toFixed(0)}  Lac ${d.lactate.toFixed(1)}`);
}
