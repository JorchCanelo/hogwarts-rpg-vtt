import { z } from "zod";
import { DICE_SIDES } from "./rules/constants";
import { SheetSchema, SpellSchema } from "./rules/character";
import { MOVE_IDS } from "./rules/moves";
import { STATS } from "./rules/constants";

type NoDefaults<T extends z.ZodRawShape> = { [K in keyof T]: T[K] extends z.ZodDefault<infer I> ? I : T[K] };

/**
 * Versión "PATCH" de un objeto: todos los campos opcionales y SIN valores por defecto.
 * (En Zod 4 un `.default()` dentro de `.optional()` se aplica, y un PATCH vacío pisaría datos existentes.)
 */
export function patchOf<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([k, f]) => [k, f instanceof z.ZodDefault ? f.unwrap() : f]),
  ) as NoDefaults<T>;
  return z.object(shape).partial();
}

const name = z.string().trim().min(1).max(80);
const longText = z.string().max(20_000);
const archivo = z.string().regex(/^[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/).nullable();

export const LoginBody = z.object({ partidaId: z.string().min(1), nombre: z.string().min(1).max(80), password: z.string().min(1).max(200) });
export const HostExchangeBody = z.object({ token: z.string().min(10).max(200) });

export const CreatePartidaBody = z.object({
  nombre: name,
  descripcion: z.string().max(2000).default(""),
  /** Nombre del Narrador anfitrión (entra sin contraseña). */
  anfitrionNombre: name,
});
export const PatchPartidaBody = z.object({
  nombre: name.optional(),
  descripcion: z.string().max(2000).optional(),
  imagen: archivo.optional(),
  edicionLibreDefault: z.boolean().optional(),
});

export const CreateUserBody = z.object({
  nombre: name,
  password: z.string().min(4).max(200),
  rol: z.enum(["narrador", "jugador"]),
});

export const CreatePjBody = z.object({
  sheet: SheetSchema,
  imagen: archivo.optional(),
  /** Solo el Narrador puede asignar dueño. */
  duenoId: z.string().nullable().optional(),
});
export const PatchPjBody = z.object({
  sheet: patchOf(SheetSchema).optional(),
  imagen: archivo.optional(),
  duenoId: z.string().nullable().optional(),
  edicionLibre: z.boolean().optional(),
});

export const NpcBody = z.object({
  nombre: name,
  imagen: archivo.optional(),
  notas: longText.default(""),
  oculto: z.boolean().default(false),
});
export const PatchNpcBody = patchOf(NpcBody);

export const EscenaBody = z.object({
  nombre: name,
  tipo: z.enum(["imagen", "cuadricula"]),
  imagen: archivo.optional(),
  filas: z.number().int().min(1).max(200).default(10),
  columnas: z.number().int().min(1).max(200).default(10),
  abierta: z.boolean().default(true),
});
export const PatchEscenaBody = patchOf(EscenaBody).extend({ orden: z.number().int().optional() });

export const CreateFichaBody = z.object({
  ref: z.object({ tipo: z.enum(["pj", "npc"]), id: z.string() }),
  x: z.number(),
  y: z.number(),
  oculta: z.boolean().default(false),
});
export const PatchFichaBody = z.object({ x: z.number().optional(), y: z.number().optional(), oculta: z.boolean().optional() });

export const MoveRollBody = z.object({
  pjId: z.string(),
  movimientoId: z.enum(MOVE_IDS),
  stat: z.enum(STATS),
  detalle: z.string().trim().max(120).optional(),
  privada: z.boolean().default(false),
});
export const FreeRollBody = z.object({
  cantidad: z.number().int().min(1).max(50),
  caras: z.number().int().refine((n) => (DICE_SIDES as readonly number[]).includes(n), "dado no permitido"),
  privada: z.boolean().default(true),
});

export const ChatBody = z.object({
  texto: z.string().trim().min(1).max(2000),
  /** PJ con el que se habla; null/omitido = el nombre de usuario. */
  pjId: z.string().nullable().optional(),
  /** Susurro para esta persona; null/omitido = mensaje público. */
  destinatarioId: z.string().nullable().optional(),
});

export const HechizoCatalogoBody = SpellSchema.omit({ id: true });

export const MaterialBody = z.object({
  tipo: z.enum(["nota", "imagen", "pdf"]),
  titulo: name,
  contenido: longText.default(""),
  archivo: archivo.optional(),
  seccion: z.enum(["narrador", "grupo"]),
  /** Si se omite: las Notas de grupo son visibles para todos; las del Narrador, solo para quien se asigne. */
  visibleATodos: z.boolean().optional(),
  acceso: z.array(z.object({ usuarioId: z.string(), nivel: z.enum(["ver", "editar"]) })).default([]),
});
export const PatchMaterialBody = z.object({
  titulo: name.optional(),
  contenido: longText.optional(),
  visibleATodos: z.boolean().optional(),
  acceso: MaterialBody.shape.acceso.optional(),
});

export const PlaylistBody = z.object({ nombre: name });
export const PistaBody = z.object({ nombre: name, archivo: z.string().regex(/^[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/) });
export const MusicBody = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("play"), pistaId: z.string().optional(), posicionMs: z.number().min(0).optional() }),
  z.object({ accion: z.literal("pause") }),
  z.object({ accion: z.literal("seek"), posicionMs: z.number().min(0) }),
  z.object({ accion: z.literal("stop") }),
]);
