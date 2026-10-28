import type { Sheet } from "./rules/character";
import type { Outcome } from "./rules/dice";
import type { MoveId } from "./rules/moves";
import type { Stat } from "./rules/constants";

export type Role = "narrador" | "jugador";

export interface PartidaDto {
  id: string;
  nombre: string;
  descripcion: string;
  imagen: string | null;
  activa: boolean;
  edicionLibreDefault: boolean;
}

export interface UsuarioDto {
  id: string;
  nombre: string;
  rol: Role;
  esAnfitrion: boolean;
}

export interface PjDto {
  id: string;
  duenoId: string | null;
  imagen: string | null;
  /** Si es true, el jugador dueño edita su hoja igual que el Narrador. */
  edicionLibre: boolean;
  sheet: Sheet;
}

export interface NpcDto {
  id: string;
  nombre: string;
  imagen: string | null;
  notas: string;
  oculto: boolean;
}

export type SceneType = "imagen" | "cuadricula";

export interface EscenaDto {
  id: string;
  nombre: string;
  tipo: SceneType;
  imagen: string | null;
  filas: number;
  columnas: number;
  /** "Abierta" = en las pestañas del Narrador. Los jugadores solo ven la proyectada. */
  abierta: boolean;
  orden: number;
}

export interface FichaDto {
  id: string;
  escenaId: string;
  ref: { tipo: "pj" | "npc"; id: string };
  nombre: string;
  imagen: string | null;
  /** Escena libre: 0..1 sobre la imagen. Cuadrícula: índice de columna (entero). */
  x: number;
  /** Escena libre: 0..1 sobre la imagen. Cuadrícula: índice de fila (entero). */
  y: number;
  oculta: boolean;
}

export interface HechizoCatalogoDto {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  curso: number;
}

export type Visibilidad = "publica" | "narradores" | "autor_narradores";

export interface TiradaDto {
  id: string;
  autorId: string;
  autorNombre: string;
  pjId: string | null;
  pjNombre: string | null;
  tipo: "movimiento" | "libre";
  movimientoId: MoveId | null;
  movimientoNombre: string | null;
  /** Hechizo u objeto elegido (texto libre para el registro). */
  detalle: string | null;
  stat: Stat | null;
  caras: number;
  dados: number[];
  modificador: number;
  total: number;
  resultado: Outcome | null;
  visibilidad: Visibilidad;
  creadaEn: number;
}

/** Mensaje del chat. Si tiene destinatario es un susurro: solo lo ven su autor y su destinatario (ni siquiera los Narradores). */
export interface MensajeDto {
  id: string;
  autorId: string;
  /** Nombre de usuario del autor. */
  autorNombre: string;
  /** Nombre con el que se muestra: el del PJ elegido o, si no, el nombre de usuario. */
  remitenteNombre: string;
  pjId: string | null;
  destinatarioId: string | null;
  destinatarioNombre: string | null;
  texto: string;
  creadaEn: number;
}

export interface PistaDto {
  id: string;
  nombre: string;
  archivo: string;
}

export interface PlaylistDto {
  id: string;
  nombre: string;
  pistas: PistaDto[];
}

export interface MusicState {
  pistaId: string | null;
  reproduciendo: boolean;
  /** Posición en el instante `actualizadoEn`. */
  posicionMs: number;
  /** Reloj del servidor (ms epoch) al fijar el estado. */
  actualizadoEn: number;
}

export interface MusicDto extends MusicState {
  pista: PistaDto | null;
}

export type MaterialType = "nota" | "imagen" | "pdf";
export type MaterialSection = "narrador" | "grupo";

export interface MaterialAcceso {
  usuarioId: string;
  nivel: "ver" | "editar";
}

export interface MaterialDto {
  id: string;
  tipo: MaterialType;
  titulo: string;
  contenido: string;
  archivo: string | null;
  creadorId: string;
  seccion: MaterialSection;
  visibleATodos: boolean;
  acceso: MaterialAcceso[];
}

/** Estado completo filtrado por rol. Fuente de verdad para (re)conexión. */
export interface Snapshot {
  yo: UsuarioDto;
  partida: PartidaDto;
  usuarios: UsuarioDto[];
  conectados: string[];
  pjs: PjDto[];
  npcs: NpcDto[];
  /** Narrador: todas las abiertas. Jugador: solo la proyectada. */
  escenas: EscenaDto[];
  escenaProyectadaId: string | null;
  fichas: FichaDto[];
  /** Tokens de PJs ajenos: solo nombre/imagen, nunca la hoja. */
  hechizosCatalogo: HechizoCatalogoDto[];
  tiradas: TiradaDto[];
  /** Chat visible para este usuario (público + susurros enviados o recibidos), cronológico. */
  mensajes: MensajeDto[];
  playlists: PlaylistDto[];
  musica: MusicDto;
  materiales: MaterialDto[];
  serverNow: number;
}
