import { useEffect, useRef, useState } from "react";
import { DICE_SIDES, STATS, STAT_LABEL, canAct, effectiveStat, type MensajeDto, type Stat, type TiradaDto } from "@vtt/shared";
import { del, post } from "../api";
import { run, useStore } from "../store";
import { Button, Card, ConfirmButton, Empty, Field, Input, Select, cx } from "../ui";
import { signed, useMe } from "../util";
import { RollCard } from "./RollView";

type FeedItem = { kind: "tirada"; t: TiradaDto; at: number } | { kind: "mensaje"; m: MensajeDto; at: number };

export function RollsPanel() {
  const { snap, narrator } = useMe();
  const feed: FeedItem[] = [
    ...snap.tiradas.map((t): FeedItem => ({ kind: "tirada", t, at: t.creadaEn })),
    ...snap.mensajes.map((m): FeedItem => ({ kind: "mensaje", m, at: m.creadaEn })),
  ].sort((a, b) => a.at - b.at);

  // Siempre mostrar lo más reciente (abajo, como un chat).
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [feed.length]);

  return (
    <div className="space-y-3">
      {narrator ? <DicePanel /> : <QuickRoll />}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg text-gold">Tiradas y chat</h2>
        {narrator && (
          <ConfirmButton small variant="ghost" message="¿Borrar tiradas y chat para todos?" onConfirm={() => void run(() => del("/api/registro"))}>
            Limpiar registro
          </ConfirmButton>
        )}
      </div>
      <div className="max-h-[50vh] min-h-32 space-y-2 overflow-y-auto rounded-lg border border-line p-2" aria-live="polite" aria-label="Registro de tiradas y chat">
        {feed.length === 0 && <Empty>Aún no hay tiradas ni mensajes.</Empty>}
        {feed.map((it) => (it.kind === "tirada" ? <RollCard key={`t${it.t.id}`} t={it.t} /> : <MessageCard key={`m${it.m.id}`} m={it.m} />))}
        <div ref={endRef} />
      </div>
      <Composer />
    </div>
  );
}

function MessageCard({ m }: { m: MensajeDto }) {
  const { me } = useMe();
  const hora = new Date(m.creadaEn).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const whisper = m.destinatarioId !== null;
  const mine = m.autorId === me.id;
  return (
    <article className={cx("rounded-lg border p-2.5", whisper ? "border-dashed border-gold-dim bg-gold/5" : "border-line bg-night/40")} aria-label={whisper ? "Susurro" : "Mensaje"}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-muted">
        <span>
          <strong className="text-ink">{m.remitenteNombre}</strong>
          {m.remitenteNombre !== m.autorNombre && ` · ${m.autorNombre}`}
          {whisper && <span className="text-gold"> · 🤫 {mine ? `susurro para ${m.destinatarioNombre}` : "susurro para ti"}</span>}
        </span>
        <span>{hora}</span>
      </header>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.texto}</p>
    </article>
  );
}

/** Escribir como tu usuario o como un PJ (el Narrador, como cualquiera), en público o susurrando a una persona. */
function Composer() {
  const { snap, me } = useMe();
  const [texto, setTexto] = useState("");
  const [pjId, setPjId] = useState("");
  const [dest, setDest] = useState("");
  const [sending, setSending] = useState(false);
  const pjs = snap.pjs;
  const others = snap.usuarios.filter((u) => u.id !== me.id);
  const validPj = pjs.some((p) => p.id === pjId) ? pjId : "";
  const validDest = others.some((u) => u.id === dest) ? dest : "";

  const send = async () => {
    const t = texto.trim();
    if (!t || sending) return;
    setSending(true);
    const m = await run(() => post<MensajeDto>("/api/chat", { texto: t, pjId: validPj || null, destinatarioId: validDest || null }));
    setSending(false);
    if (m) {
      setTexto("");
      useStore.getState().pushMensaje(m);
    }
  };

  return (
    <Card>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Enviar como">
          <Select value={validPj} onChange={(e) => setPjId(e.target.value)}>
            <option value="">{me.nombre} (usuario)</option>
            {pjs.map((p) => <option key={p.id} value={p.id}>{p.sheet.nombre}</option>)}
          </Select>
        </Field>
        <Field label="Para">
          <Select value={validDest} onChange={(e) => setDest(e.target.value)}>
            <option value="">Todos (público)</option>
            {others.map((u) => <option key={u.id} value={u.id}>🤫 Susurrar a {u.nombre}{u.rol === "narrador" ? " (Narrador)" : ""}</option>)}
          </Select>
        </Field>
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input value={texto} maxLength={2000} onChange={(e) => setTexto(e.target.value)} placeholder={validDest ? "Escribe un susurro…" : "Escribe un mensaje…"} aria-label="Mensaje" />
        <Button type="submit" variant="primary" disabled={!texto.trim() || sending}>{validDest ? "Susurrar" : "Enviar"}</Button>
      </form>
    </Card>
  );
}

/** Tirada libre del Narrador: n dados de d2, d4, d6, d8, d10, d12, d20 o d100. */
function DicePanel() {
  const [cantidad, setCantidad] = useState(1);
  const [caras, setCaras] = useState(20);
  const [privada, setPrivada] = useState(true);
  return (
    <Card title="Dados del Narrador">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-20">
          <Field label="Cantidad">
            <Input type="number" min={1} max={50} value={cantidad} onChange={(e) => setCantidad(Math.max(1, Math.min(50, Math.round(Number(e.target.value) || 1))))} />
          </Field>
        </div>
        <div className="w-24">
          <Field label="Dado">
            <Select value={caras} onChange={(e) => setCaras(Number(e.target.value))}>
              {DICE_SIDES.map((d) => (
                <option key={d} value={d}>d{d}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Button variant="primary" onClick={() => void run(() => post("/api/tiradas/libre", { cantidad, caras, privada }))}>
          Tirar {cantidad}d{caras}
        </Button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={privada} onChange={(e) => setPrivada(e.target.checked)} /> Privada (solo Narradores)
      </label>
    </Card>
  );
}

/** Atajo del jugador: «Hacer una tirada» con la estadística que elija. El resto de movimientos están en la hoja. */
function QuickRoll() {
  const { snap } = useMe();
  const [pjId, setPjId] = useState(snap.pjs[0]?.id ?? "");
  const [stat, setStat] = useState<Stat>("valentia");
  const [privada, setPrivada] = useState(false);
  const pj = snap.pjs.find((p) => p.id === pjId) ?? snap.pjs[0];
  if (!pj) return <Empty>Crea un personaje para poder tirar.</Empty>;
  return (
    <Card title="Hacer una tirada">
      <div className="grid gap-2 sm:grid-cols-2">
        {snap.pjs.length > 1 && (
          <Field label="Personaje">
            <Select value={pj.id} onChange={(e) => setPjId(e.target.value)}>
              {snap.pjs.map((p) => <option key={p.id} value={p.id}>{p.sheet.nombre}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Estadística">
          <Select value={stat} onChange={(e) => setStat(e.target.value as Stat)}>
            {STATS.map((s) => <option key={s} value={s}>{STAT_LABEL[s]} ({signed(effectiveStat(pj.sheet, s))})</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={privada} onChange={(e) => setPrivada(e.target.checked)} /> Tirada privada
        </label>
        <Button variant="primary" disabled={!canAct(pj.sheet)} onClick={() => void run(() => post("/api/tiradas/movimiento", { pjId: pj.id, movimientoId: "libre", stat, privada }))}>
          Tirar 2d6
        </Button>
      </div>
    </Card>
  );
}
