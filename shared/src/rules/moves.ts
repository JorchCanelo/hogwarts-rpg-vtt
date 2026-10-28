import { STATS, type Stat } from "./constants";
import { effectiveStat, type Sheet } from "./character";
import { outcomeOf, rollDice, secureDie, sum, type Die, type Outcome } from "./dice";

export const MOVE_IDS = [
  "enfrentarse",
  "conocimiento",
  "travesura",
  "conseguir",
  "ayudar",
  "libre",
  "hechizo",
  "objeto",
  "duelo",
] as const;
export type MoveId = (typeof MOVE_IDS)[number];

export interface Move {
  id: MoveId;
  nombre: string;
  /** Estadísticas entre las que se puede elegir (la primera es la predeterminada). */
  stats: readonly Stat[];
  /** La tirada pide elegir un hechizo / objeto para dejarlo en el registro. */
  detalle?: "hechizo" | "objeto";
}

export const MOVES: readonly Move[] = [
  { id: "enfrentarse", nombre: "Enfrentarse al peligro", stats: ["valentia"] },
  { id: "conocimiento", nombre: "Ganar conocimiento", stats: ["intelecto"] },
  { id: "travesura", nombre: "Esto es una travesura", stats: ["astucia"] },
  { id: "conseguir", nombre: "Obtener lo que quieres conseguir", stats: ["valentia", "astucia"] },
  { id: "ayudar", nombre: "Ayudar o interferir", stats: ["lealtad"] },
  { id: "libre", nombre: "Hacer una tirada", stats: STATS },
  { id: "hechizo", nombre: "Lanzar un hechizo", stats: ["magia"], detalle: "hechizo" },
  { id: "objeto", nombre: "Usar un objeto mágico", stats: ["magia"], detalle: "objeto" },
  { id: "duelo", nombre: "Batirse en duelo", stats: ["magia"] },
];

export const getMove = (id: MoveId): Move => MOVES.find((m) => m.id === id) as Move;

export interface MoveRoll {
  dice: number[];
  stat: Stat;
  modifier: number;
  total: number;
  outcome: Outcome;
}

/** 2d6 + estadística efectiva. */
export function rollMove(sheet: Pick<Sheet, "stats" | "condiciones">, stat: Stat, die: Die = secureDie): MoveRoll {
  const dice = rollDice(2, 6, die);
  const modifier = effectiveStat(sheet, stat);
  const total = sum(dice) + modifier;
  return { dice, stat, modifier, total, outcome: outcomeOf(total) };
}
