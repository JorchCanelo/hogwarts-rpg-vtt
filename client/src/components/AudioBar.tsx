import { useEffect, useRef, useState } from "react";
import { musicPositionMs } from "@vtt/shared";
import { fileUrl } from "../api";
import { useStore } from "../store";
import { Button } from "../ui";
import { remember } from "../util";

/**
 * Música sincronizada: el servidor guarda {pista, reproduciendo, posición, instante}; cada cliente calcula
 * la posición actual con su desfase de reloj y corrige si se aleja más de 0.5 s.
 * Los navegadores exigen un gesto del usuario antes de reproducir audio → botón "Activar audio".
 */
export function AudioBar() {
  const musica = useStore((s) => s.snap?.musica);
  const offset = useStore((s) => s.clockOffset);
  const audio = useRef<HTMLAudioElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(() => Number(remember("vtt.volume") ?? "0.7"));
  const [blocked, setBlocked] = useState(false);

  const sync = () => {
    const el = audio.current;
    if (!el || !musica) return;
    const src = fileUrl(musica.pista?.archivo);
    if (!src || !musica.reproduciendo || !enabled) {
      el.pause();
      if (src && el.getAttribute("data-src") !== src) {
        el.setAttribute("data-src", src);
        el.src = src;
      }
      return;
    }
    if (el.getAttribute("data-src") !== src) {
      el.setAttribute("data-src", src);
      el.src = src;
    }
    const target = musicPositionMs(musica, Date.now() + offset) / 1000;
    const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null;
    const pos = dur ? target % dur : target; // las pistas se repiten en bucle
    if (Math.abs(el.currentTime - pos) > 0.5) el.currentTime = pos;
    el.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  };

  useEffect(sync, [musica, enabled, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(sync, 5000); // corrección de deriva
    return () => clearInterval(t);
  }, [musica, enabled, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
    remember("vtt.volume", String(volume));
  }, [volume]);

  const playing = !!musica?.pista && musica.reproduciendo;
  return (
    <div className="flex items-center gap-2 text-xs">
      <audio ref={audio} loop preload="auto" onLoadedMetadata={sync} />
      {playing && <span className="hidden max-w-40 truncate text-muted sm:inline">♪ {musica?.pista?.nombre}</span>}
      <Button small variant={enabled && !blocked ? "subtle" : "primary"} onClick={() => (setEnabled((e) => (blocked ? true : !e)), setBlocked(false))} aria-pressed={enabled}>
        {enabled && !blocked ? "🔊 Audio" : "🔇 Activar audio"}
      </Button>
      <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-20 accent-[var(--color-gold)]" aria-label="Volumen" />
    </div>
  );
}
