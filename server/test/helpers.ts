import { DatabaseSync } from "node:sqlite";
import type { FichaDto, MensajeDto, MusicDto, Sheet, StateScope, TiradaDto } from "@vtt/shared";
import type { Ctx, Notifier, ServerActor } from "../src/ctx";
import { migrate, type Db } from "../src/db";
import * as svc from "../src/services";

export interface Recorded {
  changed: { partidaId: string; scopes: StateScope[] }[];
  tiradas: TiradaDto[];
  mensajes: MensajeDto[];
  fichas: { f: FichaDto; soloNarradores: boolean }[];
  musica: MusicDto[];
  cerradas: string[];
}

/** Contexto de pruebas: SQLite en memoria (node:sqlite), reloj controlable y dados predecibles. */
export function makeCtx() {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  const db = raw as unknown as Db;
  migrate(db);

  const rec: Recorded = { changed: [], tiradas: [], mensajes: [], fichas: [], musica: [], cerradas: [] };
  const notify: Notifier = {
    changed: (partidaId, scopes) => rec.changed.push({ partidaId, scopes }),
    tirada: (_p, t) => rec.tiradas.push(t),
    mensaje: (_p, m) => rec.mensajes.push(m),
    ficha: (_p, f, soloNarradores) => rec.fichas.push({ f, soloNarradores }),
    musica: (_p, m) => rec.musica.push(m),
    partidaCerrada: (p) => rec.cerradas.push(p),
  };

  const clock = { t: 1_700_000_000_000 };
  const dice: number[] = [];
  const ctx: Ctx = {
    db,
    notify,
    now: () => clock.t,
    die: (sides) => dice.shift() ?? Math.min(sides, 3),
    secret: Buffer.alloc(32, 7),
    dataDir: "/tmp/vtt-test",
    connected: () => [],
  };
  return { ctx, rec, clock, dice };
}

export const validSheet = (over: Partial<Sheet> = {}): Sheet => ({
  nombre: "Harry",
  casa: "gryffindor",
  curso: 3,
  apariencia: { piel: "Pálida", pelo: "Moreno", complexion: "Delgado", descripcion: "" },
  varita: { ambicion: "Logros (Arce)", apariencia: "Lisa", nucleo: "Fénix" },
  ascendencia: "mestizo",
  mascota: null,
  patronus: "Ciervo",
  stats: { valentia: 2, astucia: 0, intelecto: -1, lealtad: 1, magia: 2 },
  condiciones: [],
  suerte: 3,
  experiencia: 2,
  asignaturasFavoritas: ["Pociones"],
  asignaturaProgresoUsada: false,
  objetosMagicos: [],
  hechizos: [
    { id: "s1", nombre: "Lumos", descripcion: "Luz", tipo: "Encantamiento", curso: 1 },
    { id: "s2", nombre: "Expelliarmus", descripcion: "", tipo: "Defensa", curso: 2 },
  ],
  ...over,
});

/** Partida activa con: Narrador anfitrión, un segundo Narrador, y los jugadores Ana y Beto. */
export async function setup(ctx: Ctx) {
  const partida = svc.createPartida(ctx, { nombre: "Curso 1", descripcion: "", anfitrionNombre: "Dumbledore" });
  svc.setActiva(ctx, partida.id, true);
  const host = ctx.db.prepare("SELECT * FROM usuarios WHERE partida_id = ? AND es_anfitrion = 1").get(partida.id) as Record<string, unknown>;
  const narrador: ServerActor = { id: String(host.id), rol: "narrador", partidaId: partida.id, nombre: "Dumbledore" };
  const mk = async (nombre: string, rol: "narrador" | "jugador"): Promise<ServerActor> => {
    const u = await svc.createUser(ctx, narrador, { nombre, password: "secreto1", rol });
    return { id: u.id, rol, partidaId: partida.id, nombre };
  };
  const ana = await mk("Ana", "jugador");
  const beto = await mk("Beto", "jugador");
  const mcgonagall = await mk("McGonagall", "narrador");
  return { partida, narrador, ana, beto, mcgonagall };
}
