/**
 * ¿Cuándo para el corazón, y cuánto lo retrasa cada decisión?
 *
 *   node scripts/calibrate-arrest.ts
 *
 * Sin esto, el estado terminal es una afirmación. Con esto es una tabla.
 */
import { Engine } from "../src/lib/engine";

const HORIZON = 900; // 15 min de simulación

function run(label: string, at: number | null, key: string) {
  const e = new Engine(0);
  let arrestAt: number | null = null;
  let criticalAt: number | null = null;

  for (let s = 0; s < HORIZON; s += 1) {
    if (at !== null && Math.abs(e.t - at) < 0.5 && !e.arrested)
      e.applyIntervention(key);
    const f = e.step(1);
    if (criticalAt === null && f.assess.status === "critical") criticalAt = e.t;
    if (f.assess.status === "arrest") {
      arrestAt = e.t;
      break;
    }
  }

  const mmss = (v: number | null) =>
    v === null
      ? "  —  "
      : `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(Math.round(v % 60)).padStart(2, "0")}`;

  console.log(
    `${label.padEnd(34)} crítico ${mmss(criticalAt)}   paro ${mmss(arrestAt)}`,
  );
}

console.log("\nHorizonte de 15 min. Intervención aplicada al minuto 2:30.\n");
run("sin intervenir", null, "none");
run("reforzar la bomba (inotrópico)", 150, "inotrope");
run("subir la presión (vasopresor)", 150, "vasopressor");
run("dar volumen", 150, "fluid");

console.log("\nLa misma decisión, tomada tarde (minuto 5):\n");
run("reforzar la bomba", 300, "inotrope");
run("subir la presión", 300, "vasopressor");

console.log("");
