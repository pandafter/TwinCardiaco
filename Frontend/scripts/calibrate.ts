/** Tabla del guion del deterioro. Sirve para calibrar el motor sin abrir la UI. */
import { Engine } from "../src/lib/engine";

for (const t of [10, 30, 60, 90, 120, 130, 150, 180]) {
  const e = new Engine(t);
  const f = e.step(0.25);
  const v = f.vitals;
  console.log(
    `t=${String(t).padStart(3)}  HR=${v.hr.toFixed(0).padStart(3)}  ` +
      `BP=${v.sbp.toFixed(0)}/${v.dbp.toFixed(0)}  MAP=${v.map.toFixed(0).padStart(3)}  ` +
      `SpO2=${v.spo2.toFixed(0)}  FR=${v.rr.toFixed(0)}  Lac=${v.lactate.toFixed(1)}  ` +
      `CO=${v.co.toFixed(1)}  CI=${v.ci.toFixed(1)}  risk=${f.assess.deterioration_risk}  ` +
      `ttc=${f.assess.time_to_critical_s === null ? "--" : (f.assess.time_to_critical_s / 60).toFixed(1) + "m"}  ${f.assess.status}`,
  );
}
