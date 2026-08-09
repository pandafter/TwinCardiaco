/**
 * La sala: el estado compartido entre las personas que miran el mismo paciente.
 *
 * QUÉ HACE ÚTIL EL MULTIUSUARIO
 * -----------------------------
 * Ver los mismos números a la vez no vale nada — para eso basta con mirar
 * la misma pantalla. Lo que sí cambia algo es que una persona PROPONGA una
 * intervención y otra la apruebe o la vete antes de que se aplique. Eso es
 * como se decide de verdad en una unidad: alguien plantea, alguien
 * responde, y queda registrado quién decidió qué.
 *
 * Toda acción de un cliente es una PROPUESTA, nunca estado. El servidor es
 * el único que la convierte en hecho. Es la misma regla que el
 * ARQUITECTURA.md del backend fija para Portal.
 *
 * SOBRE PORTAL
 * ------------
 * El transporte es propio (SSE + POST en este mismo Next) y no useportal.co,
 * por una razón concreta: su wire protocol de WebSocket no está en el
 * OpenAPI y `PUBLISH_PATH` en `Backend/cardiotwin/sync.py` sigue siendo un
 * TODO sin confirmar. Construir contra una especificación que no se tiene
 * es cómo se pierde una demo.
 *
 * Lo que SÍ se hizo es respetar la partición de canales que el backend ya
 * definió para Portal — vitals / events / agents / actions — y dejar la
 * lógica detrás de una interfaz de publicar/suscribir. Enchufar Portal
 * después es sustituir el transporte, no reescribir la funcionalidad.
 *
 * LÍMITE CONOCIDO: el estado vive en memoria del proceso. Con `next start`
 * (un solo proceso) funciona. En un despliegue serverless con varias
 * instancias haría falta un backend compartido — y ahí es exactamente donde
 * Portal encajaría.
 */

export type Member = {
  id: string;
  name: string;
  /** epoch ms del último latido; se usa para expirar a quien se fue */
  seen: number;
};

export type Proposal = {
  id: string;
  /** quién la propone */
  byId: string;
  byName: string;
  intervention: string;
  /** nombre humano de la intervención, para no traducirlo en dos sitios */
  human: string;
  /** por qué, en palabras del que propone */
  note: string;
  at: number;
  status: "pending" | "approved" | "vetoed";
  /** quién resolvió, cuando ya está resuelta */
  byWhom?: string;
  /** motivo del veto */
  reason?: string;
};

export type RoomEvent =
  | { type: "presence"; members: Member[] }
  | { type: "proposal"; proposal: Proposal }
  | { type: "resolved"; proposal: Proposal }
  | { type: "applied"; intervention: string; byName: string };

type Listener = (e: RoomEvent) => void;

/** Tras 15 s sin latido se considera que esa persona cerró la pestaña. */
const STALE_MS = 15_000;

class Room {
  members = new Map<string, Member>();
  proposals: Proposal[] = [];
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(e: RoomEvent) {
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch {
        /* un suscriptor muerto no puede tumbar a los demás */
      }
    }
  }

  /**
   * Latido de presencia. Devuelve la lista viva.
   *
   * Emite SOLO cuando alguien entra o se cambia el nombre. Un latido cada
   * 5 s por persona no puede generar un evento cada vez — pero tampoco
   * puede callarse cuando llega alguien nuevo: sin esto, el primero en
   * entrar nunca se enteraba del segundo y la sala parecía vacía para
   * ambos.
   */
  heartbeat(id: string, name: string): Member[] {
    const before = this.members.get(id);
    this.members.set(id, { id, name, seen: Date.now() });
    const joined = !before || before.name !== name;
    const list = this.prune();
    if (joined)
      this.emit({ type: "presence", members: [...this.members.values()] });
    return list;
  }

  leave(id: string) {
    this.members.delete(id);
    this.emit({ type: "presence", members: [...this.members.values()] });
  }

  /** Quita a quien lleva demasiado tiempo sin dar señales. */
  prune(): Member[] {
    const now = Date.now();
    let changed = false;
    for (const [id, m] of this.members)
      if (now - m.seen > STALE_MS) {
        this.members.delete(id);
        changed = true;
      }
    const list = [...this.members.values()];
    if (changed) this.emit({ type: "presence", members: list });
    return list;
  }

  propose(p: Omit<Proposal, "id" | "at" | "status">): Proposal {
    const proposal: Proposal = {
      ...p,
      id: `p${this.proposals.length + 1}-${p.byId.slice(0, 4)}`,
      at: Date.now(),
      status: "pending",
    };
    this.proposals.push(proposal);
    this.emit({ type: "proposal", proposal });
    return proposal;
  }

  /**
   * Aprobar o vetar.
   *
   * Nadie resuelve su propia propuesta: si pudiera, "proponer" sería un
   * clic más antes de hacer lo mismo, y todo el mecanismo sobra.
   */
  resolve(
    id: string,
    verdict: "approved" | "vetoed",
    byId: string,
    byName: string,
    reason?: string,
  ): { ok: true; proposal: Proposal } | { ok: false; error: string } {
    const p = this.proposals.find((x) => x.id === id);
    if (!p) return { ok: false, error: "no-such-proposal" };
    if (p.status !== "pending") return { ok: false, error: "already-resolved" };
    if (p.byId === byId) return { ok: false, error: "self-resolve" };

    p.status = verdict;
    p.byWhom = byName;
    p.reason = reason;
    this.emit({ type: "resolved", proposal: p });
    if (verdict === "approved")
      this.emit({
        type: "applied",
        intervention: p.intervention,
        byName: p.byName,
      });
    return { ok: true, proposal: p };
  }

  snapshot(): RoomEvent[] {
    return [
      { type: "presence", members: this.prune() },
      ...this.proposals
        .slice(-8)
        .map((p) => ({ type: "proposal" as const, proposal: p })),
    ];
  }
}

/**
 * Las salas viven en un global y no en un módulo: en desarrollo, el hot
 * reload recarga el módulo y se perderían todas las sesiones abiertas.
 */
const g = globalThis as unknown as { __rooms?: Map<string, Room> };
const rooms = (g.__rooms ??= new Map<string, Room>());

export function room(id: string): Room {
  let r = rooms.get(id);
  if (!r) {
    r = new Room();
    rooms.set(id, r);
  }
  return r;
}
