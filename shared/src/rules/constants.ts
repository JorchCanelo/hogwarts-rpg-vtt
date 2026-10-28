// Todo el contenido específico de Hogwarts RPG vive en esta carpeta (rules/).
// El resto de la app solo lee estas constantes, así el contenido es intercambiable.

export const STATS = ["valentia", "astucia", "intelecto", "lealtad", "magia"] as const;
export type Stat = (typeof STATS)[number];

export const STAT_LABEL: Record<Stat, string> = {
  valentia: "Valentía",
  astucia: "Astucia",
  intelecto: "Intelecto",
  lealtad: "Lealtad",
  magia: "Magia",
};

/** Rango de las estadísticas BASE. Las efectivas pueden salir de este rango por condiciones. */
export const STAT_MIN = -3;
export const STAT_MAX = 3;

export const HOUSES = ["gryffindor", "hufflepuff", "ravenclaw", "slytherin"] as const;
export type House = (typeof HOUSES)[number];

export const HOUSE_LABEL: Record<House, string> = {
  gryffindor: "Gryffindor",
  hufflepuff: "Hufflepuff",
  ravenclaw: "Ravenclaw",
  slytherin: "Slytherin",
};

/** Estadística que determina la casa al crear el personaje. */
export const HOUSE_STAT: Record<House, Stat> = {
  gryffindor: "valentia",
  hufflepuff: "lealtad",
  ravenclaw: "intelecto",
  slytherin: "astucia",
};

export const COURSES = [1, 2, 3, 4, 5, 6, 7] as const;
export const ELECTIVE_MIN_COURSE = 3;

export const ANCESTRIES = ["muggle", "mestizo", "purasangre"] as const;
export type Ancestry = (typeof ANCESTRIES)[number];

export const ANCESTRY_INFO: Record<Ancestry, { label: string; spells: number; xp: number }> = {
  muggle: { label: "Nacido de Muggles", spells: 1, xp: 3 },
  mestizo: { label: "Mestizo", spells: 2, xp: 2 },
  purasangre: { label: "Sangre Pura", spells: 3, xp: 1 },
};

export const CORE_SUBJECTS = [
  "Encantamientos",
  "Herbología",
  "Pociones",
  "Defensa contra las Artes Oscuras",
  "Historia de la Magia",
  "Transfiguración",
] as const;

/** Solo alumnos de 3ro a 7mo. */
export const ELECTIVE_SUBJECTS = [
  "Aritmancia",
  "Cuidado de Criaturas Mágicas",
  "Estudios Muggles",
  "Astronomía",
  "Adivinación",
  "Quidditch",
] as const;

export const SPELL_TYPES = [
  "Encantamiento",
  "Sanación",
  "Maldición",
  "Hechizo",
  "Defensa",
  "Poción",
  "Transfiguración",
  "Maldición Imperdonable",
] as const;
export type SpellType = (typeof SPELL_TYPES)[number];

export const MAX_LUCK = 3;
export const MAX_XP = 4;

export const CONDITION_IDS = [
  "asustado",
  "enfadado",
  "estresado",
  "celoso",
  "avergonzado",
  "herido",
  "hechizado",
  "inconsciente",
] as const;
export type ConditionId = (typeof CONDITION_IDS)[number];

export interface ConditionInfo {
  label: string;
  /** Modificadores fijos por estadística. */
  mods: Partial<Record<Stat, number>>;
  /** Hechizado: -1 a un rasgo elegido al obtener la condición. */
  needsStat?: { amount: number };
  /** Inconsciente: incapaz de actuar. */
  blocksActing?: boolean;
}

export const CONDITIONS: Record<ConditionId, ConditionInfo> = {
  asustado: { label: "Asustado", mods: { valentia: -2 } },
  enfadado: { label: "Enfadado", mods: { astucia: -2 } },
  estresado: { label: "Estresado", mods: { intelecto: -2 } },
  celoso: { label: "Celoso", mods: { lealtad: -2 } },
  avergonzado: { label: "Avergonzado", mods: { magia: -2 } },
  herido: { label: "Herido", mods: { valentia: -1, astucia: -1, intelecto: -1, lealtad: -1, magia: -1 } },
  hechizado: { label: "Hechizado", mods: {}, needsStat: { amount: -1 } },
  inconsciente: { label: "Inconsciente", mods: {}, blocksActing: true },
};

/** Dados que el Narrador puede tirar libremente. */
export const DICE_SIDES = [2, 4, 6, 8, 10, 12, 20, 100] as const;
export type DiceSides = (typeof DICE_SIDES)[number];
