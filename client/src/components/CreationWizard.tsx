import { useMemo, useState } from "react";
import {
  ANCESTRIES,
  ANCESTRY_INFO,
  COURSES,
  HOUSES,
  HOUSE_LABEL,
  HOUSE_STAT,
  INITIAL_LUCK,
  PATRONUS_ANIMALES,
  PATRONUS_TABLA,
  PATRONUS_TIPOS,
  STATS,
  STAT_LABEL,
  STAT_POOL,
  TABLAS,
  allowedFavoriteSubjects,
  applyHouseBonus,
  houseFromStats,
  initialSpellCount,
  initialXp,
  isValidStatDistribution,
  mascotaNota,
  rollHouse,
  rollPatronus,
  rollTable,
  secureDie,
  validateCreation,
  type Ancestry,
  type House,
  type PatronusRoll,
  type PjDto,
  type Sheet,
  type Spell,
  type Stat,
} from "@vtt/shared";
import { post, upload } from "../api";
import { run } from "../store";
import { Button, Card, Field, HouseBadge, Input, Modal, Select, Textarea, cx } from "../ui";
import { signed, useMe } from "../util";
import { SpellFields, emptySpell, spellValid } from "./SpellFields";

interface Draft {
  curso: number;
  piel: string;
  pelo: string;
  complexion: string;
  descripcion: string;
  ambicion: string;
  varitaApariencia: string;
  nucleo: string;
  ascendencia: Ancestry | null;
  asignatura: string;
  hechizos: Spell[];
  stats: Record<Stat, number | null>;
  nombre: string;
  mascotaTipo: string;
  mascotaNombre: string;
  casa: House | null;
  patronus: string;
  imagen: string | null;
  duenoId: string | null;
}

const STEPS = ["Curso", "Apariencia", "Varita y ambición", "Ascendencia", "Asignatura favorita", "Hechizos", "Estadísticas", "Nombre", "Mascota", "Casa", "Patronus"] as const;

/** Atajo para "tirar 1d6 sobre esta tabla o escribir a libertad". */
function RollField({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  const listId = `opts-${label.replace(/\W+/g, "-")}`;
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Escribe o tira el dado" />
        <datalist id={listId}>
          {options.map((o) => <option key={o} value={o} />)}
        </datalist>
        <Button onClick={() => onChange(rollTable(options))} aria-label={`Tirar d6 para ${label}`}>🎲 d6</Button>
      </div>
    </Field>
  );
}

const shuffle = <T,>(xs: readonly T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureDie(i + 1) - 1;
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
};

/** Creación paso a paso (11 pasos). Cada paso permite tirar el d6 o elegir/escribir a libertad. */
export function CreationWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (pj: PjDto) => void }) {
  const { snap, me, narrator } = useMe();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<Draft>({
    curso: 1, piel: "", pelo: "", complexion: "", descripcion: "", ambicion: "", varitaApariencia: "", nucleo: "",
    ascendencia: null, asignatura: "", hechizos: [], stats: { valentia: null, astucia: null, intelecto: null, lealtad: null, magia: null },
    nombre: "", mascotaTipo: "", mascotaNombre: "", casa: null, patronus: "", imagen: null, duenoId: me.id,
  });
  const [patronusRoll, setPatronusRoll] = useState<PatronusRoll | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const spellCount = d.ascendencia ? initialSpellCount(d.ascendencia) : 0;
  const filledStats = STATS.every((s) => d.stats[s] !== null);
  const statsOk = filledStats && isValidStatDistribution(d.stats as Record<Stat, number>);
  const subjects = allowedFavoriteSubjects(d.curso);
  const suggested = statsOk ? houseFromStats(d.stats as Record<Stat, number>) : null;

  const valid = [
    true,
    true,
    true,
    d.ascendencia !== null,
    d.asignatura !== "",
    d.ascendencia !== null && d.hechizos.length === spellCount && d.hechizos.every(spellValid),
    statsOk,
    d.nombre.trim().length > 0,
    true, // la mascota es opcional
    d.casa !== null,
    d.patronus.trim().length > 0,
  ];

  const sheet = useMemo<Sheet | null>(() => {
    if (!d.ascendencia || !d.casa || !statsOk) return null;
    return {
      nombre: d.nombre.trim(),
      casa: d.casa,
      curso: d.curso,
      apariencia: { piel: d.piel, pelo: d.pelo, complexion: d.complexion, descripcion: d.descripcion.trim() },
      varita: { ambicion: d.ambicion, apariencia: d.varitaApariencia, nucleo: d.nucleo },
      ascendencia: d.ascendencia,
      mascota: d.mascotaTipo.trim() ? { tipo: d.mascotaTipo.trim(), nombre: d.mascotaNombre.trim() } : null,
      patronus: d.patronus.trim(),
      stats: applyHouseBonus(d.stats as Record<Stat, number>, d.casa), // +1 a la estadística de la casa
      condiciones: [],
      suerte: INITIAL_LUCK,
      experiencia: initialXp(d.ascendencia),
      asignaturasFavoritas: [d.asignatura],
      asignaturaProgresoUsada: false,
      objetosMagicos: [],
      hechizos: d.hechizos.map((h) => ({ ...h, nombre: h.nombre.trim() })),
    };
  }, [d, statsOk]);
  const errors = sheet ? validateCreation(sheet) : [];
  const last = step === STEPS.length - 1;

  const create = async () => {
    if (!sheet) return;
    setBusy(true);
    const pj = await run(() => post<PjDto>("/api/pjs", { sheet, imagen: d.imagen ?? undefined, duenoId: narrator ? d.duenoId : undefined }));
    setBusy(false);
    if (pj) {
      onCreated(pj);
      onClose();
    }
  };

  return (
    <Modal title={`Nuevo personaje · ${step + 1}/${STEPS.length} · ${STEPS[step]}`} onClose={onClose} wide>
      <ol className="mb-4 flex gap-1" aria-label="Progreso">
        {STEPS.map((s, i) => (
          <li key={s} className={cx("h-1.5 flex-1 rounded-full", i < step ? "bg-gold" : i === step ? "bg-gold/60" : "bg-line")} title={s} />
        ))}
      </ol>

      <div className="min-h-64 space-y-4">
        {step === 0 && (
          <Field label="¿En qué curso estás?" hint="Las asignaturas optativas se desbloquean desde 3º.">
            <Select value={d.curso} onChange={(e) => set("curso", Number(e.target.value))}>
              {COURSES.map((c) => <option key={c} value={c}>{c}º curso</option>)}
            </Select>
          </Field>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <RollField label="Piel" options={TABLAS.piel} value={d.piel} onChange={(v) => set("piel", v)} />
              <RollField label="Pelo" options={TABLAS.pelo} value={d.pelo} onChange={(v) => set("pelo", v)} />
              <RollField label="Complexión" options={TABLAS.complexion} value={d.complexion} onChange={(v) => set("complexion", v)} />
            </div>
            <Field label="Descripción detallada" hint="Opcional: cuenta con más detalle cómo luce tu personaje.">
              <Textarea className="min-h-28" maxLength={4000} value={d.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3 sm:grid-cols-3">
            <RollField label="Ambición (madera)" options={TABLAS.varitaAmbicion} value={d.ambicion} onChange={(v) => set("ambicion", v)} />
            <RollField label="Apariencia de la varita" options={TABLAS.varitaApariencia} value={d.varitaApariencia} onChange={(v) => set("varitaApariencia", v)} />
            <RollField label="Núcleo" options={["Dragón", "Fénix", "Unicornio"]} value={d.nucleo} onChange={(v) => set("nucleo", v)} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {ANCESTRIES.map((a) => (
                <button key={a} onClick={() => set("ascendencia", a)} className={cx("rounded-lg border p-3 text-left transition", d.ascendencia === a ? "border-gold bg-gold/10" : "border-line hover:border-gold-dim")}>
                  <span className="block font-semibold">{ANCESTRY_INFO[a].label}</span>
                  <span className="text-xs text-muted">{ANCESTRY_INFO[a].spells} hechizo(s) · {ANCESTRY_INFO[a].xp} de experiencia</span>
                </button>
              ))}
            </div>
            <Button onClick={() => { set("ascendencia", rollTable(TABLAS.ascendencia)); set("hechizos", []); }}>🎲 Tirar d6 (1-2 Muggle · 3-4 Mestizo · 5-6 Sangre Pura)</Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <Field label="Asignatura favorita" hint={d.curso >= 3 ? "Puedes elegir también una optativa." : "Las optativas están disponibles desde 3º curso."}>
              <Select value={d.asignatura} onChange={(e) => set("asignatura", e.target.value)}>
                <option value="">Elige…</option>
                {subjects.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Button onClick={() => set("asignatura", rollTable(TABLAS.asignaturaFavorita))}>🎲 Tirar d6 (asignaturas principales)</Button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {d.ascendencia ? `${ANCESTRY_INFO[d.ascendencia].label}: empiezas con ${spellCount} hechizo(s).` : "Elige primero tu ascendencia."}
            </p>
            {Array.from({ length: spellCount }, (_, i) => {
              const sp = d.hechizos[i] ?? emptySpell(d.curso);
              return (
                <Card key={i} title={`Hechizo ${i + 1}`}>
                  <SpellFields value={sp} catalog={snap.hechizosCatalogo} maxCurso={d.curso} onChange={(v) => set("hechizos", Array.from({ length: spellCount }, (_, k) => (k === i ? v : (d.hechizos[k] ?? emptySpell(d.curso)))))} />
                </Card>
              );
            })}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Reparte estos valores, uno por estadística: <strong>{STAT_POOL.map(signed).join(", ")}</strong>. Al elegir tu casa recibirás además +1 a su estadística.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {STATS.map((s) => (
                <Field key={s} label={STAT_LABEL[s]}>
                  <Select value={d.stats[s] ?? ""} onChange={(e) => set("stats", { ...d.stats, [s]: e.target.value === "" ? null : Number(e.target.value) })}>
                    <option value="">—</option>
                    {[-1, 0, 1, 2].map((v) => <option key={v} value={v}>{signed(v)}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => { const v = shuffle(STAT_POOL); set("stats", Object.fromEntries(STATS.map((s, i) => [s, v[i] as number])) as Draft["stats"]); }}>🎲 Repartir al azar</Button>
              {filledStats && !statsOk && <span className="text-sm text-danger">Debe usar exactamente {STAT_POOL.map(signed).join(", ")}.</span>}
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-3">
            <Field label="Nombre del personaje"><Input autoFocus value={d.nombre} onChange={(e) => set("nombre", e.target.value)} /></Field>
            <Field label="Imagen (opcional)" hint="PNG, JPG, WebP o GIF.">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const up = await run(() => upload(f)); if (up) set("imagen", up.archivo); } }} />
            </Field>
            {d.imagen && <p className="text-xs text-ok">Imagen subida ✓</p>}
            {narrator && (
              <Field label="Dueño del personaje">
                <Select value={d.duenoId ?? ""} onChange={(e) => set("duenoId", e.target.value || null)}>
                  <option value="">Sin dueño</option>
                  {snap.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
                </Select>
              </Field>
            )}
          </div>
        )}

        {step === 8 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">¿Llevas una mascota a Hogwarts? Es opcional: tira 1d6 (1-2 Lechuza · 3-4 Rata · 5-6 Gato), escribe la que quieras o salta este paso.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => set("mascotaTipo", rollTable(TABLAS.mascota))}>🎲 Tirar d6</Button>
              {d.mascotaTipo && <Button variant="ghost" onClick={() => setD((x) => ({ ...x, mascotaTipo: "", mascotaNombre: "" }))}>Sin mascota</Button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mascota">
                <Input list="opts-mascota" value={d.mascotaTipo} onChange={(e) => set("mascotaTipo", e.target.value)} placeholder="Lechuza, rata, gato…" />
                <datalist id="opts-mascota">
                  {["Lechuza", "Rata", "Gato"].map((o) => <option key={o} value={o} />)}
                </datalist>
              </Field>
              <Field label="Nombre de la mascota (opcional)">
                <Input disabled={!d.mascotaTipo.trim()} value={d.mascotaNombre} onChange={(e) => set("mascotaNombre", e.target.value)} />
              </Field>
            </div>
            {mascotaNota(d.mascotaTipo) && <p className="text-sm text-gold">🦉 {mascotaNota(d.mascotaTipo)}</p>}
          </div>
        )}

        {step === 9 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Tu casa depende de tu estadística más alta, o puedes tirar 1d6 (1-4 una casa; 5-6 se repite). Recibirás +1 a la estadística de tu casa.</p>
            <div className="flex flex-wrap gap-2">
              {suggested && <Button onClick={() => set("casa", suggested)}>Usar la sugerida: {HOUSE_LABEL[suggested]}</Button>}
              <Button onClick={() => set("casa", rollHouse())}>🎲 Tirar d6</Button>
            </div>
            <Field label="Casa">
              <Select value={d.casa ?? ""} onChange={(e) => set("casa", (e.target.value || null) as House | null)}>
                <option value="">Elige…</option>
                {HOUSES.map((h) => <option key={h} value={h}>{HOUSE_LABEL[h]} (+1 {STAT_LABEL[HOUSE_STAT[h]]})</option>)}
              </Select>
            </Field>
            {d.casa && statsOk && (
              <p className="text-sm">
                <HouseBadge house={d.casa} /> <span className="text-gold">+1 {STAT_LABEL[HOUSE_STAT[d.casa]]}</span>
                <span className="text-muted"> → {STATS.map((st) => `${STAT_LABEL[st]} ${signed(applyHouseBonus(d.stats as Record<Stat, number>, d.casa as House)[st])}`).join(" · ")}</span>
              </p>
            )}
          </div>
        )}

        {step === 10 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">¿Cuál es tu Patronus?</p>
            <p className="text-sm text-muted">Tira 2d6: el primero elige la lista y el segundo el animal. También puedes escribirlo tú. Es obligatorio.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => {
                  const r = rollPatronus();
                  setPatronusRoll(r);
                  set("patronus", r.animal);
                }}
              >
                🎲 Tirar 2d6
              </Button>
              {patronusRoll && (
                <span className="text-sm">
                  Sacaste <strong>{patronusRoll.dados[0]}</strong> y <strong>{patronusRoll.dados[1]}</strong>: {patronusRoll.tipo} → <strong className="text-gold">{patronusRoll.animal}</strong>
                </span>
              )}
            </div>
            <Field label="Patronus">
              <Input list="opts-patronus" value={d.patronus} onChange={(e) => set("patronus", e.target.value)} placeholder="Tira el dado o escríbelo" />
              <datalist id="opts-patronus">
                {PATRONUS_ANIMALES.map((o) => <option key={o} value={o} />)}
              </datalist>
            </Field>
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">Ver la tabla de Patronus</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="p-1" />
                      {PATRONUS_TIPOS.map((t, i) => <th key={t} className="p-1">{i + 1}. {t}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4, 5].map((row) => (
                      <tr key={row} className="border-t border-line">
                        <th className="p-1">{row + 1}</th>
                        {PATRONUS_TABLA.map((col, i) => <td key={i} className="p-1">{col[row]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            {d.casa && (
              <Card title="Resumen">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <strong>{d.nombre}</strong> <HouseBadge house={d.casa} /> {d.curso}º curso · {d.ascendencia && ANCESTRY_INFO[d.ascendencia].label}
                </p>
                <p className="mt-1 text-sm text-muted">{sheet ? STATS.map((st) => `${STAT_LABEL[st]} ${signed(sheet.stats[st])}`).join(" · ") : ""}</p>
                <p className="mt-1 text-sm text-muted">
                  {d.mascotaTipo.trim() ? `Mascota: ${d.mascotaTipo}${d.mascotaNombre ? ` «${d.mascotaNombre}»` : ""}` : "Sin mascota"} · Patronus: {d.patronus || "—"}
                </p>
                {errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-danger">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
              </Card>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-between gap-2">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← Atrás</Button>
        {last ? (
          <Button variant="primary" disabled={!valid[step] || errors.length > 0 || busy} onClick={() => void create()}>{busy ? "Creando…" : "Crear personaje"}</Button>
        ) : (
          <Button variant="primary" disabled={!valid[step]} onClick={() => setStep((s) => s + 1)}>Siguiente →</Button>
        )}
      </div>
    </Modal>
  );
}
