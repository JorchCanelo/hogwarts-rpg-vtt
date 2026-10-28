import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CreatePjBody,
  FreeRollBody,
  IDLE_MUSIC,
  MoveRollBody,
  RuleError,
  SheetSchema,
  applyProgress,
  availableProgress,
  canAct,
  canAddSpellDirectly,
  can,
  canSeeRoll,
  checkPjPatch,
  effectiveStat,
  houseFromStats,
  isValidStatDistribution,
  musicPositionMs,
  outcomeOf,
  reduceMusic,
  rollHouse,
  rollMove,
  rollTable,
  secureDie,
  toggleCondition,
  validateCreation,
  TABLAS,
  applyHouseBonus,
  removeHouseBonus,
  rollPatronus,
  mascotaNota,
  PATRONUS_TABLA,
  PATRONUS_TIPOS,
  canSeeMessage,
  type Actor,
  type Sheet,
} from "../src/index";

const sheet = (over: Partial<Sheet> = {}): Sheet => ({
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
    { id: "a", nombre: "Lumos", descripcion: "", tipo: "Encantamiento", curso: 1 },
    { id: "b", nombre: "Expelliarmus", descripcion: "", tipo: "Defensa", curso: 2 },
  ],
  ...over,
});

const fixedDie = (...values: number[]) => {
  let i = 0;
  return () => values[i++] as number;
};

// --- estadísticas efectivas -------------------------------------------------

test("estadística efectiva: base + condiciones, sin tope inferior", () => {
  let s = sheet();
  assert.equal(effectiveStat(s, "valentia"), 2);
  s = toggleCondition(s, { id: "asustado" }); // -2 valentía
  assert.equal(effectiveStat(s, "valentia"), 0);
  s = toggleCondition(s, { id: "herido" }); // -1 a todas, se acumula
  assert.equal(effectiveStat(s, "valentia"), -1);
  s = toggleCondition(s, { id: "hechizado", stat: "valentia" }); // -1 al rasgo elegido
  assert.equal(effectiveStat(s, "valentia"), -2);
  assert.equal(effectiveStat(s, "magia"), 1); // hechizado no toca magia (2 base, -1 herido)
  // intelecto: -1 base, estresado -2, herido -1 → -4 (por debajo de -3)
  s = toggleCondition(s, { id: "estresado" });
  assert.equal(effectiveStat(s, "intelecto"), -4);
});

test("toggleCondition activa y desactiva; inconsciente impide actuar", () => {
  let s = sheet();
  assert.equal(canAct(s), true);
  s = toggleCondition(s, { id: "inconsciente" });
  assert.equal(canAct(s), false);
  s = toggleCondition(s, { id: "inconsciente" });
  assert.equal(canAct(s), true);
  assert.equal(s.condiciones.length, 0);
});

test("hechizado exige rasgo; las demás condiciones no lo admiten", () => {
  assert.equal(SheetSchema.safeParse(sheet({ condiciones: [{ id: "hechizado" }] })).success, false);
  assert.equal(SheetSchema.safeParse(sheet({ condiciones: [{ id: "asustado", stat: "magia" }] })).success, false);
  assert.equal(SheetSchema.safeParse(sheet({ condiciones: [{ id: "hechizado", stat: "magia" }] })).success, true);
});

// --- tiradas ----------------------------------------------------------------

test("resultado: 10+ éxito, 7-9 parcial, 6- fallo", () => {
  assert.deepEqual([12, 10, 9, 7, 6, 2, -1].map(outcomeOf), ["exito", "exito", "parcial", "parcial", "fallo", "fallo", "fallo"]);
});

test("rollMove: 2d6 + estadística efectiva (negativa resta)", () => {
  const s = sheet(); // intelecto -1
  const r = rollMove(s, "intelecto", fixedDie(4, 5));
  assert.deepEqual(r.dice, [4, 5]);
  assert.equal(r.modifier, -1);
  assert.equal(r.total, 8);
  assert.equal(r.outcome, "parcial");
  const hurt = toggleCondition(s, { id: "herido" });
  assert.equal(rollMove(hurt, "valentia", fixedDie(6, 6)).total, 12 + 1); // 2 base -1 herido
});

test("secureDie produce 1..n con distribución plausible", () => {
  const counts = new Array(6).fill(0);
  for (let i = 0; i < 6000; i++) counts[secureDie(6) - 1]++;
  for (const c of counts) assert.ok(c > 800 && c < 1200, `conteo fuera de rango: ${c}`);
  assert.throws(() => secureDie(1));
});

// --- creación ---------------------------------------------------------------

test("reparto de estadísticas: exactamente -1, 0, 1, 1, 2", () => {
  assert.equal(isValidStatDistribution({ valentia: 2, astucia: 0, intelecto: -1, lealtad: 1, magia: 1 }), true);
  assert.equal(isValidStatDistribution({ valentia: 2, astucia: 2, intelecto: -1, lealtad: 1, magia: 1 }), false);
  assert.equal(isValidStatDistribution({ valentia: 0, astucia: 0, intelecto: 0, lealtad: 0, magia: 0 }), false);
});

test("casa según estadística más alta", () => {
  assert.equal(houseFromStats({ valentia: 2, astucia: 0, intelecto: -1, lealtad: 1, magia: 1 }), "gryffindor");
  assert.equal(houseFromStats({ valentia: 0, astucia: 2, intelecto: -1, lealtad: 1, magia: 1 }), "slytherin");
  assert.equal(houseFromStats({ valentia: 0, astucia: 1, intelecto: 2, lealtad: 1, magia: -1 }), "ravenclaw");
  assert.equal(houseFromStats({ valentia: 0, astucia: 1, intelecto: -1, lealtad: 2, magia: 1 }), "hufflepuff");
});

test("casa por tirada: 1-4 mapea, 5-6 se repite", () => {
  assert.equal(rollHouse(fixedDie(6, 5, 6, 3)), "ravenclaw");
  assert.equal(rollHouse(fixedDie(1)), "gryffindor");
  assert.equal(rollHouse(fixedDie(4)), "slytherin");
});

test("tablas d6", () => {
  assert.equal(rollTable(TABLAS.varitaNucleo, fixedDie(1)), "Dragón");
  assert.equal(rollTable(TABLAS.varitaNucleo, fixedDie(4)), "Fénix");
  assert.equal(rollTable(TABLAS.varitaNucleo, fixedDie(6)), "Unicornio");
  assert.equal(rollTable(TABLAS.ascendencia, fixedDie(2)), "muggle");
  assert.equal(rollTable(TABLAS.ascendencia, fixedDie(3)), "mestizo");
  assert.equal(rollTable(TABLAS.ascendencia, fixedDie(5)), "purasangre");
  for (const t of [TABLAS.piel, TABLAS.pelo, TABLAS.complexion, TABLAS.varitaAmbicion, TABLAS.varitaApariencia, TABLAS.asignaturaFavorita])
    assert.equal(t.length, 6);
});

test("validateCreation: hechizos y experiencia según ascendencia", () => {
  assert.deepEqual(validateCreation(sheet()), []);
  assert.ok(validateCreation(sheet({ hechizos: [] })).length > 0); // mestizo = 2 hechizos
  assert.ok(validateCreation(sheet({ experiencia: 3 })).length > 0); // mestizo = 2 xp
  assert.ok(validateCreation(sheet({ ascendencia: "muggle" })).length > 0); // 1 hechizo / 3 xp
  assert.ok(validateCreation(sheet({ asignaturasFavoritas: ["Quidditch"], curso: 2 })).length > 0); // optativa solo 3ro+
  assert.deepEqual(validateCreation(sheet({ asignaturasFavoritas: ["Quidditch"], curso: 3 })), []);
  assert.ok(validateCreation(sheet({ stats: { valentia: 1, astucia: 1, intelecto: 1, lealtad: 1, magia: 1 } })).length > 0);
});

// --- progreso ---------------------------------------------------------------

test("progreso: exige 4 xp, vuelve a 0 y respeta topes", () => {
  assert.throws(() => applyProgress(sheet({ experiencia: 3 }), { tipo: "suerte" }), RuleError);
  const s4 = sheet({ experiencia: 4, suerte: 1 });
  const up = applyProgress(s4, { tipo: "estadistica", stat: "astucia" });
  assert.equal(up.stats.astucia, 1);
  assert.equal(up.experiencia, 0);
  assert.equal(applyProgress(s4, { tipo: "suerte" }).suerte, 2);
  // estadística en 3 no sube más
  const maxed = sheet({ experiencia: 4, stats: { valentia: 3, astucia: 0, intelecto: -1, lealtad: 1, magia: 1 } });
  assert.throws(() => applyProgress(maxed, { tipo: "estadistica", stat: "valentia" }), RuleError);
  // suerte al máximo
  assert.throws(() => applyProgress(sheet({ experiencia: 4, suerte: 3 }), { tipo: "suerte" }), RuleError);
  assert.equal(availableProgress(sheet({ suerte: 3 })).suerte, false);
});

test("progreso: asignatura favorita solo una vez; hechizo y objeto se añaden", () => {
  const s = sheet({ experiencia: 4 });
  const a = applyProgress(s, { tipo: "asignatura", nombre: "Herbología" });
  assert.deepEqual(a.asignaturasFavoritas, ["Pociones", "Herbología"]);
  assert.equal(a.asignaturaProgresoUsada, true);
  assert.throws(() => applyProgress({ ...a, experiencia: 4 }, { tipo: "asignatura", nombre: "Astronomía" }), RuleError);
  assert.equal(availableProgress(a).asignatura, false);
  const h = applyProgress(s, { tipo: "hechizo", hechizo: { id: "z", nombre: "Accio", descripcion: "", tipo: "Encantamiento", curso: 3 } });
  assert.equal(h.hechizos.length, 3);
  const o = applyProgress(s, { tipo: "objeto", objeto: { id: "o", nombre: "Mapa", descripcion: "" } });
  assert.equal(o.objetosMagicos.length, 1);
});

// --- permisos ---------------------------------------------------------------

const narrador: Actor = { id: "n1", rol: "narrador" };
const ana: Actor = { id: "p1", rol: "jugador" };
const beto: Actor = { id: "p2", rol: "jugador" };

test("PJ: un jugador solo ve y edita los suyos", () => {
  const pj = { kind: "pj", ownerId: "p1", edicionLibre: false } as const;
  assert.equal(can(ana, "view", pj), true);
  assert.equal(can(beto, "view", pj), false);
  assert.equal(can(beto, "edit", pj), false);
  assert.equal(can(narrador, "view", pj), true);
  assert.equal(can(ana, "delete", pj), false);
  assert.equal(can(ana, "create", pj), true);
});

test("checkPjPatch: sin edición libre solo campos seguros; con edición libre toda la hoja", () => {
  const locked = { ownerId: "p1", edicionLibre: false };
  const free = { ownerId: "p1", edicionLibre: true };
  assert.equal(checkPjPatch(ana, locked, { sheetKeys: ["condiciones", "suerte", "experiencia", "objetosMagicos"] }), null);
  assert.match(checkPjPatch(ana, locked, { sheetKeys: ["stats"] }) ?? "", /stats/);
  assert.match(checkPjPatch(ana, locked, { sheetKeys: ["hechizos"] }) ?? "", /hechizos/);
  assert.match(checkPjPatch(ana, locked, { sheetKeys: [], imagen: true }) ?? "", /imagen/);
  assert.equal(checkPjPatch(ana, free, { sheetKeys: ["stats", "casa", "curso", "hechizos"], imagen: true }), null);
  assert.ok(checkPjPatch(ana, free, { sheetKeys: [], duenoId: true }));
  assert.ok(checkPjPatch(ana, free, { sheetKeys: [], edicionLibre: true }));
  assert.ok(checkPjPatch(beto, free, { sheetKeys: ["suerte"] }));
  assert.equal(checkPjPatch(narrador, locked, { sheetKeys: ["stats"], duenoId: true, edicionLibre: true }), null);
});

test("hechizos directos: Narrador siempre; jugador solo con edición libre", () => {
  assert.equal(canAddSpellDirectly(narrador, { ownerId: "p1", edicionLibre: false }), true);
  assert.equal(canAddSpellDirectly(ana, { ownerId: "p1", edicionLibre: false }), false);
  assert.equal(canAddSpellDirectly(ana, { ownerId: "p1", edicionLibre: true }), true);
  assert.equal(canAddSpellDirectly(beto, { ownerId: "p1", edicionLibre: true }), false);
});

test("fichas: el jugador mueve solo las de sus PJs, en la escena proyectada y no ocultas", () => {
  const base = { kind: "ficha", pjOwnerId: "p1", oculta: false, proyectada: true } as const;
  assert.equal(can(ana, "move", base), true);
  assert.equal(can(beto, "move", base), false);
  assert.equal(can(ana, "move", { ...base, proyectada: false }), false);
  assert.equal(can(ana, "move", { ...base, oculta: true }), false);
  assert.equal(can(ana, "delete", base), false);
  assert.equal(can(narrador, "move", { ...base, pjOwnerId: null }), true);
});

test("tiradas: visibilidad pública / narradores / autor+narradores", () => {
  const pub = { autorId: "p1", visibilidad: "publica" } as const;
  const narr = { autorId: "n1", visibilidad: "narradores" } as const;
  const priv = { autorId: "p1", visibilidad: "autor_narradores" } as const;
  assert.equal(canSeeRoll(beto, pub), true);
  assert.equal(canSeeRoll(beto, narr), false);
  assert.equal(canSeeRoll(ana, narr), false);
  assert.equal(canSeeRoll(ana, priv), true);
  assert.equal(canSeeRoll(beto, priv), false);
  assert.equal(canSeeRoll(narrador, priv), true);
  assert.equal(canSeeRoll(narrador, narr), true);
});

test("materiales: creador, acceso asignado, visible a todos, edición solo de notas", () => {
  const base = { kind: "material", tipo: "nota", creadorId: "p1", seccion: "grupo", visibleATodos: false, acceso: [] } as const;
  assert.equal(can(ana, "view", base), true);
  assert.equal(can(beto, "view", base), false);
  assert.equal(can(beto, "view", { ...base, visibleATodos: true }), true);
  assert.equal(can(beto, "view", { ...base, acceso: [{ usuarioId: "p2", nivel: "ver" }] }), true);
  assert.equal(can(beto, "edit", { ...base, acceso: [{ usuarioId: "p2", nivel: "ver" }] }), false);
  assert.equal(can(beto, "edit", { ...base, acceso: [{ usuarioId: "p2", nivel: "editar" }] }), true);
  assert.equal(can(ana, "edit", { ...base, tipo: "pdf" }), false); // pdf: solo subir
  assert.equal(can(beto, "changeAccess", base), false);
  assert.equal(can(ana, "changeAccess", base), true);
  assert.equal(can(ana, "create", { ...base, seccion: "narrador" }), false);
  assert.equal(can(narrador, "delete", base), true);
});

test("recursos exclusivos del Narrador", () => {
  for (const kind of ["npc", "escena", "usuario", "playlist", "musica"] as const) {
    assert.equal(can(ana, "view", { kind }), false, kind);
    assert.equal(can(narrador, "edit", { kind }), true, kind);
  }
});

// --- esquemas de API --------------------------------------------------------

test("esquemas de API validan dados y datos de entrada", () => {
  assert.equal(FreeRollBody.safeParse({ cantidad: 3, caras: 20 }).success, true);
  assert.equal(FreeRollBody.safeParse({ cantidad: 3, caras: 7 }).success, false);
  assert.equal(FreeRollBody.safeParse({ cantidad: 0, caras: 6 }).success, false);
  assert.equal(MoveRollBody.safeParse({ pjId: "x", movimientoId: "hechizo", stat: "magia" }).success, true);
  assert.equal(MoveRollBody.safeParse({ pjId: "x", movimientoId: "nada", stat: "magia" }).success, false);
  assert.equal(CreatePjBody.safeParse({ sheet: sheet() }).success, true);
  assert.equal(CreatePjBody.safeParse({ sheet: sheet({ suerte: 9 }) }).success, false);
  assert.equal(CreatePjBody.safeParse({ sheet: sheet(), imagen: "../etc/passwd" }).success, false);
});

// --- música sincronizada ----------------------------------------------------

test("música: play/pause/seek calculan la posición con el reloj del servidor", () => {
  let m = reduceMusic(IDLE_MUSIC, { accion: "play", pistaId: "t1" }, 1_000);
  assert.deepEqual(m, { pistaId: "t1", reproduciendo: true, posicionMs: 0, actualizadoEn: 1_000 });
  assert.equal(musicPositionMs(m, 4_500), 3_500);
  m = reduceMusic(m, { accion: "pause" }, 4_500);
  assert.equal(m.posicionMs, 3_500);
  assert.equal(musicPositionMs(m, 99_999), 3_500); // en pausa no avanza
  m = reduceMusic(m, { accion: "play" }, 10_000); // reanuda donde estaba
  assert.equal(m.posicionMs, 3_500);
  assert.equal(musicPositionMs(m, 12_000), 5_500);
  m = reduceMusic(m, { accion: "seek", posicionMs: 60_000 }, 12_000);
  assert.equal(musicPositionMs(m, 13_000), 61_000);
  m = reduceMusic(m, { accion: "play", pistaId: "t2" }, 20_000); // otra pista empieza en 0
  assert.equal(m.posicionMs, 0);
  assert.equal(reduceMusic(IDLE_MUSIC, { accion: "play" }, 5).reproduciendo, false); // sin pista no hace nada
  m = reduceMusic(m, { accion: "stop" }, 30_000);
  assert.equal(m.pistaId, null);
});

// --- bonus de casa, mascota y Patronus --------------------------------------

test("bonus de casa: +1 a la estadística de la casa y se puede deshacer", () => {
  const base = { valentia: 1, astucia: 0, intelecto: 2, lealtad: 1, magia: -1 };
  assert.equal(applyHouseBonus(base, "ravenclaw").intelecto, 3);
  assert.equal(applyHouseBonus(base, "gryffindor").valentia, 2);
  assert.equal(applyHouseBonus(base, "slytherin").astucia, 1);
  assert.equal(applyHouseBonus(base, "hufflepuff").lealtad, 2);
  assert.deepEqual(removeHouseBonus(applyHouseBonus(base, "ravenclaw"), "ravenclaw"), base);
  assert.equal(base.intelecto, 2); // no muta
});

test("validateCreation: el reparto se valida sin el +1 de casa y el Patronus es obligatorio", () => {
  assert.deepEqual(validateCreation(sheet()), []);
  // sin aplicar el bonus (valentía 1 en lugar de 2) el reparto sería inválido para Gryffindor
  assert.ok(validateCreation(sheet({ stats: { valentia: 1, astucia: 0, intelecto: -1, lealtad: 1, magia: 2 } })).length > 0);
  assert.ok(validateCreation(sheet({ patronus: "  " })).some((e) => e.includes("Patronus")));
});

test("Patronus: 2d6, el primero elige la lista y el segundo el animal", () => {
  assert.equal(PATRONUS_TIPOS.length, 6);
  assert.ok(PATRONUS_TABLA.every((fila) => fila.length === 6));
  const r = rollPatronus(fixedDie(3, 4));
  assert.deepEqual(r.dados, [3, 4]);
  assert.equal(r.tipo, "Carnívoros");
  assert.equal(r.animal, "Lobo");
  assert.equal(rollPatronus(fixedDie(1, 1)).animal, "Gaviota");
  assert.equal(rollPatronus(fixedDie(6, 6)).animal, "Caballo alado");
  assert.equal(rollPatronus(fixedDie(4, 2)).animal, "Cierva/o");
});

test("mascota: 1-2 Lechuza, 3-4 Rata, 5-6 Gato; la lechuza puede recibir correo", () => {
  assert.deepEqual([...TABLAS.mascota], ["Lechuza", "Lechuza", "Rata", "Rata", "Gato", "Gato"]);
  assert.match(mascotaNota("Lechuza") ?? "", /correo/);
  assert.match(mascotaNota("  lechuza ") ?? "", /correo/);
  assert.equal(mascotaNota("Gato"), null);
});

test("chat: los susurros solo los ven autor y destinatario (los Narradores ajenos no)", () => {
  const ana: Actor = { id: "ana", rol: "jugador" };
  const beto: Actor = { id: "beto", rol: "jugador" };
  const gm: Actor = { id: "gm", rol: "narrador" };
  const publico = { autorId: "ana", destinatarioId: null };
  const susurroABeto = { autorId: "ana", destinatarioId: "beto" };
  for (const a of [ana, beto, gm]) assert.equal(canSeeMessage(a, publico), true);
  assert.equal(canSeeMessage(ana, susurroABeto), true);
  assert.equal(canSeeMessage(beto, susurroABeto), true);
  assert.equal(canSeeMessage(gm, susurroABeto), false);
  assert.equal(canSeeMessage(gm, { autorId: "ana", destinatarioId: "gm" }), true); // susurro al Narrador
  assert.equal(canSeeMessage(gm, { autorId: "gm", destinatarioId: "ana" }), true);
});
