import { useState } from "react";
import { STATS, STAT_LABEL, STAT_MAX, allowedFavoriteSubjects, availableProgress, type PjDto, type ProgressChoice, type Spell } from "@vtt/shared";
import { post } from "../api";
import { run } from "../store";
import { Button, Field, Input, Modal, Select, Textarea, cx } from "../ui";
import { newId, useSnap } from "../util";
import { SpellFields, emptySpell, spellValid } from "./SpellFields";

const OPTIONS: { tipo: ProgressChoice["tipo"]; label: string; help: string }[] = [
  { tipo: "estadistica", label: "+1 a una estadística", help: "Ninguna puede pasar de +3." },
  { tipo: "asignatura", label: "Asignatura favorita", help: "Solo una vez como progreso." },
  { tipo: "hechizo", label: "Aprender un hechizo", help: "Se añade a tu lista y al catálogo de la Partida." },
  { tipo: "objeto", label: "Adquirir un objeto mágico", help: "Se añade a tu lista de objetos." },
  { tipo: "suerte", label: "Recuperar un punto de suerte", help: "Si no la tienes al máximo." },
];

/** Al llegar a 4 puntos de experiencia: elige un progreso. La experiencia vuelve a 0. */
export function ProgressDialog({ pj, onClose }: { pj: PjDto; onClose: () => void }) {
  const snap = useSnap();
  const s = pj.sheet;
  const avail = availableProgress(s);
  const [tipo, setTipo] = useState<ProgressChoice["tipo"] | null>(null);
  const [stat, setStat] = useState(STATS.find((x) => s.stats[x] < STAT_MAX) ?? STATS[0]);
  const subjects = allowedFavoriteSubjects(s.curso).filter((x) => !s.asignaturasFavoritas.includes(x));
  const [subject, setSubject] = useState(subjects[0] ?? "");
  const [spell, setSpell] = useState<Spell>(() => emptySpell(s.curso));
  const [itemName, setItemName] = useState("");
  const [itemDesc, setItemDesc] = useState("");

  const build = (): ProgressChoice | null => {
    switch (tipo) {
      case "estadistica": return { tipo, stat };
      case "asignatura": return subject ? { tipo, nombre: subject } : null;
      case "hechizo": return spellValid(spell) ? { tipo, hechizo: spell } : null;
      case "objeto": return itemName.trim() ? { tipo, objeto: { id: newId(), nombre: itemName.trim(), descripcion: itemDesc } } : null;
      case "suerte": return { tipo };
      default: return null;
    }
  };
  const choice = build();

  return (
    <Modal title="¡Progreso disponible!" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Has marcado 4 puntos de experiencia. Elige una mejora; la experiencia volverá a 0.</p>
      <div className="grid gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.tipo}
            disabled={!avail[o.tipo] || (o.tipo === "asignatura" && subjects.length === 0)}
            onClick={() => setTipo(o.tipo)}
            className={cx("rounded-lg border p-2.5 text-left transition disabled:opacity-40", tipo === o.tipo ? "border-gold bg-gold/10" : "border-line hover:border-gold-dim")}
          >
            <span className="block text-sm font-semibold">{o.label}</span>
            <span className="text-xs text-muted">{o.help}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {tipo === "estadistica" && (
          <Field label="Estadística">
            <Select value={stat} onChange={(e) => setStat(e.target.value as typeof stat)}>
              {STATS.filter((x) => s.stats[x] < STAT_MAX).map((x) => (
                <option key={x} value={x}>
                  {STAT_LABEL[x]} ({s.stats[x]} → {s.stats[x] + 1})
                </option>
              ))}
            </Select>
          </Field>
        )}
        {tipo === "asignatura" && (
          <Field label="Asignatura">
            <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjects.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
        )}
        {tipo === "hechizo" && <SpellFields value={spell} onChange={setSpell} catalog={snap.hechizosCatalogo} maxCurso={s.curso} />}
        {tipo === "objeto" && (
          <>
            <Field label="Nombre del objeto">
              <Input value={itemName} onChange={(e) => setItemName(e.target.value)} />
            </Field>
            <Field label="Descripción">
              <Textarea value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
            </Field>
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Después</Button>
        <Button
          variant="primary"
          disabled={!choice}
          onClick={async () => choice && (await run(() => post(`/api/pjs/${pj.id}/progreso`, choice))) && onClose()}
        >
          Aplicar progreso
        </Button>
      </div>
    </Modal>
  );
}
