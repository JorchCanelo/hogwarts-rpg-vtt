import { SPELL_TYPES, COURSES, type HechizoCatalogoDto, type Spell } from "@vtt/shared";
import { Field, Input, Select, Textarea } from "../ui";
import { newId } from "../util";

export const emptySpell = (curso: number): Spell => ({ id: newId(), nombre: "", descripcion: "", tipo: "Hechizo", curso });
export const spellValid = (s: Spell) => s.nombre.trim().length > 0;

/** Campos de un hechizo con autocompletado desde el catálogo de la Partida (los de todos los PJs). */
export function SpellFields({ value, onChange, catalog, maxCurso = 7 }: { value: Spell; onChange: (s: Spell) => void; catalog: HechizoCatalogoDto[]; maxCurso?: number }) {
  const listId = `spells-${value.id}`;
  const setName = (nombre: string) => {
    const known = catalog.find((c) => c.nombre.toLowerCase() === nombre.trim().toLowerCase());
    onChange(known ? { ...value, nombre, descripcion: known.descripcion, tipo: known.tipo as Spell["tipo"], curso: Math.min(known.curso, maxCurso) } : { ...value, nombre });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Nombre">
          <Input list={listId} value={value.nombre} onChange={(e) => setName(e.target.value)} placeholder="Wingardium Leviosa" />
        </Field>
        <datalist id={listId}>
          {catalog.map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>
      </div>
      <Field label="Tipo">
        <Select value={value.tipo} onChange={(e) => onChange({ ...value, tipo: e.target.value as Spell["tipo"] })}>
          {SPELL_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Curso en que se aprendió">
        <Select value={value.curso} onChange={(e) => onChange({ ...value, curso: Number(e.target.value) })}>
          {COURSES.filter((c) => c <= maxCurso).map((c) => (
            <option key={c} value={c}>
              {c}º
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Descripción">
          <Textarea value={value.descripcion} onChange={(e) => onChange({ ...value, descripcion: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
