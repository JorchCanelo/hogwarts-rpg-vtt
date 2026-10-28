import { OUTCOME_LABEL, STAT_LABEL, type Outcome, type TiradaDto } from "@vtt/shared";
import { cx } from "../ui";
import { signed } from "../util";

const outcomeStyle: Record<Outcome, string> = {
  exito: "bg-ok/20 text-ok border-ok/50",
  parcial: "bg-gold/15 text-gold border-gold/50",
  fallo: "bg-danger/20 text-danger border-danger/50",
};

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return <span className={cx("rounded-full border px-2 py-0.5 text-xs font-semibold", outcomeStyle[outcome])}>{OUTCOME_LABEL[outcome]}</span>;
}

export function Die({ n, sides }: { n: number; sides: number }) {
  return (
    <span className="inline-grid min-w-7 place-items-center rounded-md border border-line bg-night/70 px-1 py-0.5 font-mono text-sm" title={`d${sides}`}>
      {n}
    </span>
  );
}

export function RollCard({ t, compact }: { t: TiradaDto; compact?: boolean }) {
  const hora = new Date(t.creadaEn).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return (
    <article className={cx("rounded-lg border border-line bg-night/40 p-2.5", t.visibilidad !== "publica" && "border-dashed")} aria-label="Tirada">
      <header className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-muted">
        <span>
          <strong className="text-ink">{t.pjNombre ?? t.autorNombre}</strong>
          {t.pjNombre && t.pjNombre !== t.autorNombre && ` · ${t.autorNombre}`}
        </span>
        <span>
          {t.visibilidad === "narradores" && "🔒 solo Narradores · "}
          {t.visibilidad === "autor_narradores" && "🔒 privada · "}
          {hora}
        </span>
      </header>
      {t.tipo === "movimiento" ? (
        <p className="mt-1 text-sm">
          {t.movimientoNombre}
          {t.detalle && <em className="text-muted"> — {t.detalle}</em>}
          {t.stat && <span className="text-muted"> ({STAT_LABEL[t.stat]})</span>}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Tirada de {t.detalle}</p>
      )}
      {!compact && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {t.dados.map((d, i) => (
            <Die key={i} n={d} sides={t.caras} />
          ))}
          {t.tipo === "movimiento" && <span className="text-sm text-muted">{signed(t.modificador)}</span>}
          <span className="text-sm text-muted">=</span>
          <strong className="text-xl text-gold">{t.total}</strong>
          {t.resultado && <OutcomeBadge outcome={t.resultado} />}
        </div>
      )}
    </article>
  );
}

