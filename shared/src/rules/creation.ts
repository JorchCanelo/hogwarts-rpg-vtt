import {
  ANCESTRIES,
  ANCESTRY_INFO,
  CORE_SUBJECTS,
  ELECTIVE_MIN_COURSE,
  ELECTIVE_SUBJECTS,
  HOUSES,
  HOUSE_STAT,
  MAX_LUCK,
  STATS,
  type Ancestry,
  type House,
  type Stat,
} from "./constants";
import { secureDie, type Die } from "./dice";
import type { Sheet } from "./character";

/** Tablas del proceso de creación. Cada una tiene 6 entradas (d6) salvo las de pares. */
export const TABLAS = {
  piel: ["Oscura", "Con pecas", "Morena", "Pálida", "Rojiza", "Oliva"],
  pelo: ["Moreno", "Rubio", "Pelirrojo", "Castaño", "Tapado", "Teñido"],
  complexion: ["Delgado", "Grande", "Atlético", "Robusto", "Pequeño", "Alto"],
  /** Ambición ↔ madera de la varita. */
  varitaAmbicion: [
    "Logros (Arce)",
    "Diversión (Abeto)",
    "Poder (Tejo)",
    "Sabiduría (Nogal)",
    "Amistad (Cedro)",
    "Estatus (Olmo)",
  ],
  varitaApariencia: ["Flexible", "Larga", "Lisa", "Segunda Mano", "Corta", "Decorada"],
  /** 1-2 Dragón, 3-4 Fénix, 5-6 Unicornio */
  varitaNucleo: ["Dragón", "Dragón", "Fénix", "Fénix", "Unicornio", "Unicornio"],
  /** 1-2 Nacido de Muggles, 3-4 Mestizo, 5-6 Sangre Pura */
  ascendencia: ["muggle", "muggle", "mestizo", "mestizo", "purasangre", "purasangre"] as Ancestry[],
  asignaturaFavorita: [...CORE_SUBJECTS],
  /** 1-2 Lechuza, 3-4 Rata, 5-6 Gato */
  mascota: ["Lechuza", "Lechuza", "Rata", "Rata", "Gato", "Gato"],
} as const;

/** Notas que acompañan a ciertas mascotas. */
export const MASCOTA_NOTAS: Record<string, string> = {
  lechuza: "Puede recibir correo.",
};
export const mascotaNota = (tipo: string): string | null => MASCOTA_NOTAS[tipo.trim().toLowerCase()] ?? null;

/** Patronus: el primer d6 elige el tipo de animal (columna) y el segundo el animal (fila). */
export const PATRONUS_TIPOS = ["Aves de presa", "Otras aves", "Carnívoros", "Herbívoros", "Domésticos", "Animales raros"] as const;
export const PATRONUS_TABLA: readonly (readonly string[])[] = [
  ["Gaviota", "Águila", "Halcón", "Garza", "Gavilán", "Águila real"],
  ["Mirlo", "Cuervo", "Petirrojo", "Colibrí", "Gorrión", "Faisán"],
  ["Tejón", "Oso", "León", "Lobo", "Serpiente", "Jabalí"],
  ["Armadillo", "Cierva/o", "Erizo", "Ratón", "Salmón", "Ardilla"],
  ["Perro", "Gato", "Caballo", "Conejo", "Rata", "Cisne"],
  ["Dragón", "Hipogrifo", "Búho", "Fénix", "Unicornio", "Caballo alado"],
];
export const PATRONUS_ANIMALES: readonly string[] = PATRONUS_TABLA.flat();

export interface PatronusRoll {
  /** Los dos d6: [tipo, animal]. */
  dados: [number, number];
  tipo: (typeof PATRONUS_TIPOS)[number];
  animal: string;
}

/** Tira 2d6: el primero elige la lista y el segundo el animal dentro de ella. */
export function rollPatronus(die: Die = secureDie): PatronusRoll {
  const a = die(6);
  const b = die(6);
  return { dados: [a, b], tipo: PATRONUS_TIPOS[a - 1] as PatronusRoll["tipo"], animal: (PATRONUS_TABLA[a - 1] as readonly string[])[b - 1] as string };
}

/** Tira 1d6 sobre una tabla de 6 entradas. */
export function rollTable<T>(table: readonly T[], die: Die = secureDie): T {
  return table[die(6) - 1] as T;
}

/** Casa por tirada: 1-4 → una de las cuatro casas, 5-6 se vuelve a tirar. */
export function rollHouse(die: Die = secureDie): House {
  for (;;) {
    const r = die(6);
    if (r <= 4) return HOUSES[r - 1] as House;
  }
}

/** Casa según la estadística base más alta (en el reparto inicial nunca hay empate: solo hay un 2). */
export function houseFromStats(stats: Record<Stat, number>): House {
  const best = [...STATS].sort((a, b) => stats[b] - stats[a])[0] as Stat;
  return HOUSES.find((h) => HOUSE_STAT[h] === best) as House;
}

export const STAT_POOL = [-1, 0, 1, 1, 2] as const;

/** Al elegir casa se obtiene +1 a su estadística (Gryffindor: Valentía, Slytherin: Astucia, Ravenclaw: Intelecto, Hufflepuff: Lealtad). */
export function applyHouseBonus(stats: Record<Stat, number>, casa: House): Record<Stat, number> {
  return { ...stats, [HOUSE_STAT[casa]]: stats[HOUSE_STAT[casa]] + 1 };
}
/** Inverso de `applyHouseBonus`: el reparto inicial antes del bonus de casa. */
export function removeHouseBonus(stats: Record<Stat, number>, casa: House): Record<Stat, number> {
  return { ...stats, [HOUSE_STAT[casa]]: stats[HOUSE_STAT[casa]] - 1 };
}

/** El reparto inicial usa exactamente -1, 0, 1, 1, 2, uno por estadística. */
export function isValidStatDistribution(stats: Record<Stat, number>): boolean {
  const got = STATS.map((s) => stats[s]).sort((a, b) => a - b);
  const want = [...STAT_POOL].sort((a, b) => a - b);
  return got.length === want.length && got.every((v, i) => v === want[i]);
}

export const initialSpellCount = (a: Ancestry) => ANCESTRY_INFO[a].spells;
export const initialXp = (a: Ancestry) => ANCESTRY_INFO[a].xp;
/** Valor inicial asumido para la suerte (el documento no lo especifica): al máximo. */
export const INITIAL_LUCK = MAX_LUCK;

export function allowedFavoriteSubjects(curso: number): string[] {
  return curso >= ELECTIVE_MIN_COURSE ? [...CORE_SUBJECTS, ...ELECTIVE_SUBJECTS] : [...CORE_SUBJECTS];
}

/**
 * Valida una hoja recién creada contra las reglas de creación (para jugadores).
 * Los Narradores pueden saltarse esto: editan a libertad.
 */
export function validateCreation(sheet: Sheet): string[] {
  const errors: string[] = [];
  if (!(ANCESTRIES as readonly string[]).includes(sheet.ascendencia)) errors.push("Ascendencia inválida");
  if (!(HOUSES as readonly string[]).includes(sheet.casa)) errors.push("Casa inválida");
  else if (!isValidStatDistribution(removeHouseBonus(sheet.stats, sheet.casa)))
    errors.push("Las estadísticas deben repartirse como -1, 0, 1, 1, 2, más el +1 de tu casa");
  if (sheet.patronus.trim() === "") errors.push("El Patronus es obligatorio");
  if (sheet.hechizos.length !== initialSpellCount(sheet.ascendencia))
    errors.push(`Debe tener exactamente ${initialSpellCount(sheet.ascendencia)} hechizo(s) por su ascendencia`);
  if (sheet.experiencia !== initialXp(sheet.ascendencia))
    errors.push(`La experiencia inicial es ${initialXp(sheet.ascendencia)} por su ascendencia`);
  if (sheet.asignaturasFavoritas.length !== 1) errors.push("Debe tener exactamente 1 asignatura favorita");
  else if (!allowedFavoriteSubjects(sheet.curso).includes(sheet.asignaturasFavoritas[0] as string))
    errors.push("Asignatura favorita no permitida para ese curso");
  if (sheet.condiciones.length > 0) errors.push("Un personaje nuevo no tiene condiciones");
  if (sheet.objetosMagicos.length > 0) errors.push("Un personaje nuevo no tiene objetos mágicos");
  if (sheet.asignaturaProgresoUsada) errors.push("Un personaje nuevo no ha usado progresos");
  return errors;
}
