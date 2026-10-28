import { z } from "zod";
import {
  ANCESTRIES,
  CONDITIONS,
  CONDITION_IDS,
  COURSES,
  HOUSES,
  MAX_LUCK,
  MAX_XP,
  SPELL_TYPES,
  STATS,
  STAT_MAX,
  STAT_MIN,
  type ConditionId,
  type Stat,
} from "./constants";

const text = (max: number) => z.string().trim().max(max);

export const SpellSchema = z.object({
  id: z.string().min(1).max(64),
  nombre: text(80).min(1),
  descripcion: text(2000).default(""),
  tipo: z.enum(SPELL_TYPES),
  curso: z.number().int().min(1).max(7),
});
export type Spell = z.infer<typeof SpellSchema>;

export const MagicItemSchema = z.object({
  id: z.string().min(1).max(64),
  nombre: text(80).min(1),
  descripcion: text(2000).default(""),
});
export type MagicItem = z.infer<typeof MagicItemSchema>;

export const ActiveConditionSchema = z
  .object({
    id: z.enum(CONDITION_IDS),
    /** Solo para "hechizado": el rasgo afectado. */
    stat: z.enum(STATS).optional(),
  })
  .refine((c) => (CONDITIONS[c.id].needsStat ? c.stat !== undefined : c.stat === undefined), {
    message: "stat es obligatorio solo para condiciones que lo requieren (hechizado)",
  });
export type ActiveCondition = z.infer<typeof ActiveConditionSchema>;

const statValue = z.number().int().min(STAT_MIN).max(STAT_MAX);

export const SheetSchema = z.object({
  nombre: text(80).min(1),
  casa: z.enum(HOUSES),
  curso: z.number().int().refine((n) => (COURSES as readonly number[]).includes(n), "curso 1-7"),
  apariencia: z.object({
    piel: text(60),
    pelo: text(60),
    complexion: text(60),
    /** Descripción libre y más larga del aspecto del personaje. */
    descripcion: text(4000).default(""),
  }),
  varita: z.object({ ambicion: text(60), apariencia: text(60), nucleo: text(60) }),
  ascendencia: z.enum(ANCESTRIES),
  /** Mascota opcional (lechuza, rata, gato u otra escrita a mano). */
  mascota: z.object({ tipo: text(60).min(1), nombre: text(60).default("") }).nullable().default(null),
  /** Animal del Patronus. */
  patronus: text(60).default(""),
  stats: z.object({
    valentia: statValue,
    astucia: statValue,
    intelecto: statValue,
    lealtad: statValue,
    magia: statValue,
  }),
  condiciones: z.array(ActiveConditionSchema).max(20),
  suerte: z.number().int().min(0).max(MAX_LUCK),
  experiencia: z.number().int().min(0).max(MAX_XP),
  asignaturasFavoritas: z.array(text(80)).max(20),
  /** "Ganar una asignatura favorita" como progreso solo puede usarse una vez. */
  asignaturaProgresoUsada: z.boolean().default(false),
  objetosMagicos: z.array(MagicItemSchema).max(100),
  hechizos: z.array(SpellSchema).max(300),
});
export type Sheet = z.infer<typeof SheetSchema>;

// ---------------------------------------------------------------------------
// Estadísticas efectivas (se calculan, nunca se guardan)
// ---------------------------------------------------------------------------

export function conditionModifier(cond: ActiveCondition, stat: Stat): number {
  const info = CONDITIONS[cond.id];
  let mod = info.mods[stat] ?? 0;
  if (info.needsStat && cond.stat === stat) mod += info.needsStat.amount;
  return mod;
}

/** Base + modificadores de condiciones. Puede quedar por debajo de -3 o por encima de 3. */
export function effectiveStat(sheet: Pick<Sheet, "stats" | "condiciones">, stat: Stat): number {
  return sheet.stats[stat] + sheet.condiciones.reduce((acc, c) => acc + conditionModifier(c, stat), 0);
}

export function hasCondition(sheet: Pick<Sheet, "condiciones">, id: ConditionId): boolean {
  return sheet.condiciones.some((c) => c.id === id);
}

/** Inconsciente = incapaz de actuar. */
export function canAct(sheet: Pick<Sheet, "condiciones">): boolean {
  return !sheet.condiciones.some((c) => CONDITIONS[c.id].blocksActing);
}

/** Activa/desactiva una condición. Las condiciones son únicas por id (hechizado: por id+stat). */
export function toggleCondition(sheet: Sheet, cond: ActiveCondition): Sheet {
  const same = (c: ActiveCondition) => c.id === cond.id && c.stat === cond.stat;
  const condiciones = sheet.condiciones.some(same)
    ? sheet.condiciones.filter((c) => !same(c))
    : [...sheet.condiciones, cond];
  return { ...sheet, condiciones };
}

// ---------------------------------------------------------------------------
// Experiencia y progreso
// ---------------------------------------------------------------------------

export const ProgressChoiceSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("estadistica"), stat: z.enum(STATS) }),
  z.object({ tipo: z.literal("asignatura"), nombre: text(80).min(1) }),
  z.object({ tipo: z.literal("hechizo"), hechizo: SpellSchema }),
  z.object({ tipo: z.literal("objeto"), objeto: MagicItemSchema }),
  z.object({ tipo: z.literal("suerte") }),
]);
export type ProgressChoice = z.infer<typeof ProgressChoiceSchema>;

/** Qué progresos están disponibles ahora mismo (para deshabilitar opciones en la UI). */
export function availableProgress(sheet: Sheet): Record<ProgressChoice["tipo"], boolean> {
  return {
    estadistica: STATS.some((s) => sheet.stats[s] < STAT_MAX),
    asignatura: !sheet.asignaturaProgresoUsada,
    hechizo: true,
    objeto: true,
    suerte: sheet.suerte < MAX_LUCK,
  };
}

export class RuleError extends Error {}

/** Aplica un progreso. Exige 4 de experiencia y la devuelve a 0. */
export function applyProgress(sheet: Sheet, choice: ProgressChoice): Sheet {
  if (sheet.experiencia < MAX_XP) throw new RuleError("Se necesitan 4 puntos de experiencia para progresar");
  const next: Sheet = { ...sheet, experiencia: 0 };
  switch (choice.tipo) {
    case "estadistica":
      if (sheet.stats[choice.stat] >= STAT_MAX) throw new RuleError("Una estadística no puede subir de 3");
      next.stats = { ...sheet.stats, [choice.stat]: sheet.stats[choice.stat] + 1 };
      break;
    case "asignatura":
      if (sheet.asignaturaProgresoUsada) throw new RuleError("La asignatura favorita solo se gana una vez como progreso");
      if (sheet.asignaturasFavoritas.includes(choice.nombre)) throw new RuleError("Ya tiene esa asignatura favorita");
      next.asignaturasFavoritas = [...sheet.asignaturasFavoritas, choice.nombre];
      next.asignaturaProgresoUsada = true;
      break;
    case "hechizo":
      next.hechizos = [...sheet.hechizos, choice.hechizo];
      break;
    case "objeto":
      next.objetosMagicos = [...sheet.objetosMagicos, choice.objeto];
      break;
    case "suerte":
      if (sheet.suerte >= MAX_LUCK) throw new RuleError("La suerte ya está al máximo");
      next.suerte = sheet.suerte + 1;
      break;
  }
  return next;
}
