import { useRef, useState } from "react";
import {
  ANCESTRIES,
  ANCESTRY_INFO,
  CONDITIONS,
  CONDITION_IDS,
  COURSES,
  HOUSES,
  HOUSE_LABEL,
  MAX_LUCK,
  MAX_XP,
  MOVES,
  STATS,
  STAT_LABEL,
  STAT_MAX,
  STAT_MIN,
  canAct,
  effectiveStat,
  hasCondition,
  mascotaNota,
  toggleCondition,
  type Move,
  type PjDto,
  type Sheet,
  type Spell,
  type Stat,
  type TiradaDto,
} from "@vtt/shared";
import { fileUrl, patch, post, upload, del } from "../api";
import { run } from "../store";
import { Button, Card, ConfirmButton, Empty, Field, HouseBadge, Input, Modal, Pips, Select, Textarea, cx, houseHex } from "../ui";
import { newId, signed, useMe, userName } from "../util";
import { ProgressDialog } from "./ProgressDialog";
import { RollCard } from "./RollView";
import { SpellFields, emptySpell, spellValid } from "./SpellFields";

/** Hoja de personaje. Lo que se puede editar depende del rol y de la «edición libre» del PJ (ver permissions.ts). */
export function SheetView({ pj, onBack }: { pj: PjDto; onBack: () => void }) {
  const { snap, me, narrator } = useMe();
  const s = pj.sheet;
  const isOwner = pj.duenoId === me.id;
  const canFull = narrator || (isOwner && pj.edicionLibre); // todo, como el Narrador
  const canTouch = narrator || isOwner; // condiciones, suerte, experiencia y objetos mágicos
  const [privada, setPrivada] = useState(false);
  const [last, setLast] = useState<TiradaDto | null>(null);
  const [rolling, setRolling] = useState<Move | null>(null);
  const [dialog, setDialog] = useState<"progreso" | "hechizo" | "objeto" | "editar" | null>(null);
  const [hechizadoStat, setHechizadoStat] = useState<Stat>("magia");
  const avatarInput = useRef<HTMLInputElement>(null);

  const save = (sheet: Partial<Sheet>) => run(() => patch<PjDto>(`/api/pjs/${pj.id}`, { sheet }));
  const acts = narrator || canAct(s);

  const roll = async (move: Move, stat: Stat, detalle?: string) => {
    const t = await run(() => post<TiradaDto>("/api/tiradas/movimiento", { pjId: pj.id, movimientoId: move.id, stat, detalle: detalle || undefined, privada }));
    if (t) setLast(t);
    return t;
  };
  const startMove = (m: Move) => (m.stats.length === 1 && !m.detalle ? void roll(m, m.stats[0] as Stat) : setRolling(m));

  const spellsByCourse = COURSES.map((c) => ({ curso: c, list: s.hechizos.filter((x) => x.curso === c) })).filter((g) => g.list.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button small variant="ghost" onClick={onBack}>← Volver</Button>
        <div className="flex gap-2">
          {canFull && <Button small onClick={() => setDialog("editar")}>Editar hoja</Button>}
        </div>
      </div>

      {/* Encabezado */}
      <Card>
        <div className="flex items-center gap-3">
          <button
            disabled={!canFull}
            onClick={() => avatarInput.current?.click()}
            className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 text-2xl font-bold disabled:cursor-default"
            style={{ borderColor: houseHex[s.casa], background: houseHex[s.casa] + "33" }}
            aria-label={canFull ? "Cambiar imagen" : undefined}
          >
            {pj.imagen ? <img src={fileUrl(pj.imagen) as string} alt="" className="h-full w-full object-cover" /> : s.nombre[0]?.toUpperCase()}
          </button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const up = await run(() => upload(f));
              if (up) await run(() => patch(`/api/pjs/${pj.id}`, { imagen: up.archivo }));
            }}
          />
          <div className="min-w-0">
            <h2 className="truncate text-xl text-gold">{s.nombre}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <HouseBadge house={s.casa} />
              <span>{s.curso}º curso</span>
              <span>· {ANCESTRY_INFO[s.ascendencia].label}</span>
              {narrator && <span>· de {userName(snap, pj.duenoId)}</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2" role="list" aria-label="Estadísticas">
        {STATS.map((st) => {
          const eff = effectiveStat(s, st);
          const base = s.stats[st];
          return (
            <div key={st} role="listitem" className="rounded-lg border border-line bg-panel p-2 text-center">
              <div className="truncate text-[0.65rem] uppercase tracking-wide text-muted sm:text-xs">{STAT_LABEL[st]}</div>
              <div className={cx("font-display text-2xl", eff < base ? "text-danger" : eff > base ? "text-ok" : "text-ink")}>{signed(eff)}</div>
              {eff !== base && <div className="text-[0.65rem] text-muted">base {signed(base)}</div>}
            </div>
          );
        })}
      </div>

      {/* Condiciones */}
      <Card title="Condiciones">
        <div className="flex flex-wrap gap-1.5">
          {CONDITION_IDS.filter((id) => id !== "hechizado").map((id) => {
            const on = hasCondition(s, id);
            return (
              <button
                key={id}
                disabled={!canTouch}
                aria-pressed={on}
                onClick={() => save({ condiciones: toggleCondition(s, { id }).condiciones })}
                className={cx("rounded-full border px-2.5 py-1 text-xs transition disabled:cursor-default", on ? "border-danger bg-danger/20 text-danger" : "border-line text-muted hover:border-gold-dim")}
              >
                {CONDITIONS[id].label}
              </button>
            );
          })}
          {s.condiciones
            .filter((c) => c.id === "hechizado")
            .map((c) => (
              <button key={c.stat} disabled={!canTouch} onClick={() => save({ condiciones: toggleCondition(s, c).condiciones })} className="rounded-full border border-danger bg-danger/20 px-2.5 py-1 text-xs text-danger" aria-label={`Quitar hechizado (${c.stat})`}>
                Hechizado · {c.stat ? STAT_LABEL[c.stat] : ""} ✕
              </button>
            ))}
        </div>
        {canTouch && (
          <div className="mt-2 flex items-center gap-2">
            <Select value={hechizadoStat} onChange={(e) => setHechizadoStat(e.target.value as Stat)} className="w-auto" aria-label="Rasgo afectado por Hechizado">
              {STATS.map((x) => (
                <option key={x} value={x}>{STAT_LABEL[x]}</option>
              ))}
            </Select>
            <Button small disabled={s.condiciones.some((c) => c.id === "hechizado" && c.stat === hechizadoStat)} onClick={() => save({ condiciones: toggleCondition(s, { id: "hechizado", stat: hechizadoStat }).condiciones })}>
              + Hechizado (−1)
            </Button>
          </div>
        )}
        {!acts && <p className="mt-2 text-sm text-danger">Inconsciente: no puede actuar.</p>}
      </Card>

      {/* Suerte y experiencia */}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted">Suerte</div>
            <Pips label="Suerte" value={s.suerte} max={MAX_LUCK} color="bg-ok" onChange={canTouch ? (n) => void save({ suerte: n }) : undefined} />
          </div>
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted">Experiencia</div>
            <div className="flex items-center gap-3">
              <Pips label="Experiencia" value={s.experiencia} max={MAX_XP} onChange={canTouch ? (n) => void save({ experiencia: n }) : undefined} />
              {s.experiencia === MAX_XP && canTouch && <Button small variant="primary" onClick={() => setDialog("progreso")}>¡Progresar!</Button>}
            </div>
          </div>
        </div>
      </Card>

      {/* Movimientos */}
      <Card
        title="Movimientos"
        actions={
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={privada} onChange={(e) => setPrivada(e.target.checked)} /> Tirada privada
          </label>
        }
      >
        {!canTouch ? (
          <Empty>Solo el dueño o un Narrador pueden tirar con este personaje.</Empty>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {MOVES.map((m) => (
              <Button key={m.id} disabled={!acts} onClick={() => startMove(m)} className="text-left">
                <span className="block">{m.nombre}</span>
                <span className="text-xs text-muted">2d6 {m.stats.length > 2 ? "+ elige" : "+ " + m.stats.map((x) => STAT_LABEL[x]).join(" o ")}</span>
              </Button>
            ))}
          </div>
        )}
        {last && (
          <div className="mt-3">
            <RollCard t={last} />
          </div>
        )}
      </Card>

      {/* Hechizos */}
      <Card title="Hechizos" actions={canFull && <Button small onClick={() => setDialog("hechizo")}>+ Añadir</Button>}>
        {spellsByCourse.length === 0 && <Empty>Sin hechizos.</Empty>}
        {spellsByCourse.map((g) => (
          <div key={g.curso} className="mb-3 last:mb-0">
            <h4 className="mb-1 text-xs uppercase tracking-wide text-muted">{g.curso}º curso</h4>
            <ul className="space-y-1">
              {g.list.map((sp) => (
                <li key={sp.id} className="flex items-start justify-between gap-2 rounded-md bg-night/40 px-2 py-1.5">
                  <span>
                    <span className="text-sm font-semibold">{sp.nombre}</span> <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[0.7rem] text-muted">{sp.tipo}</span>
                    {sp.descripcion && <span className="block text-xs text-muted">{sp.descripcion}</span>}
                  </span>
                  {canFull && <button className="text-muted hover:text-danger" aria-label={`Quitar ${sp.nombre}`} onClick={() => void save({ hechizos: s.hechizos.filter((x) => x.id !== sp.id) })}>✕</button>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      {/* Objetos mágicos */}
      <Card title="Objetos mágicos" actions={canTouch && <Button small onClick={() => setDialog("objeto")}>+ Añadir</Button>}>
        {s.objetosMagicos.length === 0 ? (
          <Empty>Sin objetos mágicos.</Empty>
        ) : (
          <ul className="space-y-1">
            {s.objetosMagicos.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-2 rounded-md bg-night/40 px-2 py-1.5">
                <span>
                  <span className="text-sm font-semibold">{o.nombre}</span>
                  {o.descripcion && <span className="block text-xs text-muted">{o.descripcion}</span>}
                </span>
                {canTouch && <button className="text-muted hover:text-danger" aria-label={`Quitar ${o.nombre}`} onClick={() => void save({ objetosMagicos: s.objetosMagicos.filter((x) => x.id !== o.id) })}>✕</button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Datos */}
      <Card title="Datos">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">Asignaturas favoritas</dt>
          <dd>{s.asignaturasFavoritas.join(", ") || "—"}</dd>
          <dt className="text-muted">Apariencia</dt>
          <dd>{[s.apariencia.piel && `Piel ${s.apariencia.piel.toLowerCase()}`, s.apariencia.pelo && `pelo ${s.apariencia.pelo.toLowerCase()}`, s.apariencia.complexion && s.apariencia.complexion.toLowerCase()].filter(Boolean).join(", ") || "—"}</dd>
          {s.apariencia.descripcion && (
            <>
              <dt className="text-muted">Descripción</dt>
              <dd className="whitespace-pre-wrap">{s.apariencia.descripcion}</dd>
            </>
          )}
          <dt className="text-muted">Varita</dt>
          <dd>{[s.varita.ambicion, s.varita.apariencia, s.varita.nucleo && `núcleo de ${s.varita.nucleo.toLowerCase()}`].filter(Boolean).join(" · ") || "—"}</dd>
          <dt className="text-muted">Mascota</dt>
          <dd>
            {s.mascota ? (
              <>
                {s.mascota.tipo}
                {s.mascota.nombre && ` «${s.mascota.nombre}»`}
                {mascotaNota(s.mascota.tipo) && <span className="block text-xs text-muted">{mascotaNota(s.mascota.tipo)}</span>}
              </>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-muted">Patronus</dt>
          <dd>{s.patronus || "—"}</dd>
        </dl>
      </Card>

      {narrator && (
        <Card title="Ajustes del Narrador">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pj.edicionLibre} onChange={(e) => void run(() => patch(`/api/pjs/${pj.id}`, { edicionLibre: e.target.checked }))} />
              Edición libre: el jugador edita su hoja como un Narrador (estadísticas, casa, curso, hechizos…)
            </label>
            <Field label="Dueño">
              <Select value={pj.duenoId ?? ""} onChange={(e) => void run(() => patch(`/api/pjs/${pj.id}`, { duenoId: e.target.value || null }))}>
                <option value="">Sin dueño</option>
                {snap.usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
                ))}
              </Select>
            </Field>
            <ConfirmButton variant="ghost" message="Eliminar personaje, ¿seguro?" onConfirm={async () => (await run(() => del(`/api/pjs/${pj.id}`))) && onBack()}>
              Eliminar personaje
            </ConfirmButton>
          </div>
        </Card>
      )}

      {rolling && <RollDialog move={rolling} sheet={s} narrator={narrator} onClose={() => setRolling(null)} onRoll={async (st, d) => ((await roll(rolling, st, d)) ? setRolling(null) : undefined)} />}
      {dialog === "progreso" && <ProgressDialog pj={pj} onClose={() => setDialog(null)} />}
      {dialog === "hechizo" && <AddSpellDialog onClose={() => setDialog(null)} onAdd={(sp) => save({ hechizos: [...s.hechizos, sp] })} curso={s.curso} />}
      {dialog === "objeto" && <AddItemDialog onClose={() => setDialog(null)} onAdd={(o) => save({ objetosMagicos: [...s.objetosMagicos, o] })} />}
      {dialog === "editar" && <SheetEditor sheet={s} onClose={() => setDialog(null)} onSave={(patchSheet) => save(patchSheet)} />}
    </div>
  );
}

function RollDialog({ move, sheet, narrator, onClose, onRoll }: { move: Move; sheet: Sheet; narrator: boolean; onClose: () => void; onRoll: (stat: Stat, detalle?: string) => void }) {
  const [stat, setStat] = useState<Stat>(move.stats[0] as Stat);
  const options = move.detalle === "hechizo" ? sheet.hechizos.map((h) => h.nombre) : move.detalle === "objeto" ? sheet.objetosMagicos.map((o) => o.nombre) : [];
  const [detalle, setDetalle] = useState(options[0] ?? "");
  const needsDetail = !!move.detalle && !narrator;
  return (
    <Modal title={move.nombre} onClose={onClose}>
      <div className="space-y-3">
        {move.stats.length > 1 && (
          <Field label="Estadística">
            <Select value={stat} onChange={(e) => setStat(e.target.value as Stat)}>
              {move.stats.map((x) => (
                <option key={x} value={x}>
                  {STAT_LABEL[x]} ({signed(effectiveStat(sheet, x))})
                </option>
              ))}
            </Select>
          </Field>
        )}
        {move.detalle && (
          <Field label={move.detalle === "hechizo" ? "Hechizo" : "Objeto mágico"}>
            {options.length > 0 ? (
              <Select value={detalle} onChange={(e) => setDetalle(e.target.value)}>
                {narrator && <option value="">(sin especificar)</option>}
                {options.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Select>
            ) : (
              <p className="text-sm text-muted">{narrator ? "Este personaje no tiene ninguno; puedes tirar sin especificar." : "No tienes ninguno todavía."}</p>
            )}
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={needsDetail && !detalle} onClick={() => onRoll(stat, detalle)}>
            Tirar 2d6
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddSpellDialog({ curso, onClose, onAdd }: { curso: number; onClose: () => void; onAdd: (s: Spell) => unknown }) {
  const { snap } = useMe();
  const [sp, setSp] = useState(() => emptySpell(curso));
  return (
    <Modal title="Añadir hechizo" onClose={onClose}>
      <SpellFields value={sp} onChange={setSp} catalog={snap.hechizosCatalogo} />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!spellValid(sp)} onClick={async () => (await onAdd(sp)) && onClose()}>Añadir</Button>
      </div>
    </Modal>
  );
}

function AddItemDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (o: { id: string; nombre: string; descripcion: string }) => unknown }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  return (
    <Modal title="Añadir objeto mágico" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
        <Field label="Descripción"><Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!nombre.trim()} onClick={async () => (await onAdd({ id: newId(), nombre: nombre.trim(), descripcion })) && onClose()}>Añadir</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Edición completa de la hoja (Narrador, o jugador con edición libre). */
function SheetEditor({ sheet, onClose, onSave }: { sheet: Sheet; onClose: () => void; onSave: (s: Partial<Sheet>) => unknown }) {
  const [d, setD] = useState<Sheet>(sheet);
  const [subjects, setSubjects] = useState(sheet.asignaturasFavoritas.join(", "));
  const set = <K extends keyof Sheet>(k: K, v: Sheet[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Modal title="Editar hoja" onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre"><Input value={d.nombre} onChange={(e) => set("nombre", e.target.value)} /></Field>
        <Field label="Casa" hint="Cambiarla aquí no ajusta el +1 de estadística.">
          <Select value={d.casa} onChange={(e) => set("casa", e.target.value as Sheet["casa"])}>
            {HOUSES.map((h) => <option key={h} value={h}>{HOUSE_LABEL[h]}</option>)}
          </Select>
        </Field>
        <Field label="Curso">
          <Select value={d.curso} onChange={(e) => set("curso", Number(e.target.value))}>
            {COURSES.map((c) => <option key={c} value={c}>{c}º</option>)}
          </Select>
        </Field>
        <Field label="Ascendencia">
          <Select value={d.ascendencia} onChange={(e) => set("ascendencia", e.target.value as Sheet["ascendencia"])}>
            {ANCESTRIES.map((a) => <option key={a} value={a}>{ANCESTRY_INFO[a].label}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <div className="mb-1 text-xs uppercase tracking-wide text-muted">Estadísticas base ({STAT_MIN} a {STAT_MAX})</div>
          <div className="grid grid-cols-5 gap-2">
            {STATS.map((st) => (
              <Field key={st} label={STAT_LABEL[st]}>
                <Input type="number" min={STAT_MIN} max={STAT_MAX} value={d.stats[st]} onChange={(e) => set("stats", { ...d.stats, [st]: Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(Number(e.target.value) || 0))) })} />
              </Field>
            ))}
          </div>
        </div>
        <Field label="Piel"><Input value={d.apariencia.piel} onChange={(e) => set("apariencia", { ...d.apariencia, piel: e.target.value })} /></Field>
        <Field label="Pelo"><Input value={d.apariencia.pelo} onChange={(e) => set("apariencia", { ...d.apariencia, pelo: e.target.value })} /></Field>
        <Field label="Complexión"><Input value={d.apariencia.complexion} onChange={(e) => set("apariencia", { ...d.apariencia, complexion: e.target.value })} /></Field>
        <Field label="Ambición / madera"><Input value={d.varita.ambicion} onChange={(e) => set("varita", { ...d.varita, ambicion: e.target.value })} /></Field>
        <Field label="Apariencia de la varita"><Input value={d.varita.apariencia} onChange={(e) => set("varita", { ...d.varita, apariencia: e.target.value })} /></Field>
        <Field label="Núcleo"><Input value={d.varita.nucleo} onChange={(e) => set("varita", { ...d.varita, nucleo: e.target.value })} /></Field>
        <div className="sm:col-span-2">
          <Field label="Descripción detallada">
            <Textarea className="min-h-24" value={d.apariencia.descripcion} onChange={(e) => set("apariencia", { ...d.apariencia, descripcion: e.target.value })} />
          </Field>
        </div>
        <Field label="Mascota" hint="Vacío = sin mascota.">
          <Input
            value={d.mascota?.tipo ?? ""}
            onChange={(e) => set("mascota", e.target.value.trim() ? { tipo: e.target.value, nombre: d.mascota?.nombre ?? "" } : null)}
          />
        </Field>
        <Field label="Nombre de la mascota">
          <Input disabled={!d.mascota} value={d.mascota?.nombre ?? ""} onChange={(e) => d.mascota && set("mascota", { ...d.mascota, nombre: e.target.value })} />
        </Field>
        <Field label="Patronus"><Input value={d.patronus} onChange={(e) => set("patronus", e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <Field label="Asignaturas favoritas" hint="Separadas por comas.">
            <Input value={subjects} onChange={(e) => setSubjects(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          disabled={!d.nombre.trim()}
          onClick={async () =>
            (await onSave({
              nombre: d.nombre.trim(),
              casa: d.casa,
              curso: d.curso,
              ascendencia: d.ascendencia,
              stats: d.stats,
              apariencia: d.apariencia,
              varita: d.varita,
              mascota: d.mascota && d.mascota.tipo.trim() ? { tipo: d.mascota.tipo.trim(), nombre: d.mascota.nombre.trim() } : null,
              patronus: d.patronus.trim(),
              asignaturasFavoritas: subjects.split(",").map((x) => x.trim()).filter(Boolean),
            })) && onClose()
          }
        >
          Guardar
        </Button>
      </div>
    </Modal>
  );
}
