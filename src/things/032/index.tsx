"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { click, closeAudio } from "@/lib/audio";
import s from "./disposable.module.css";

const ROLL = 27;
const W = 600;
const H = 400;

type Phase = "idle" | "loaded" | "developing" | "developed";

/**
 * 032 — 27 EXPOSURES
 *
 * A disposable camera. Twenty-seven shots, no screen on the back, and no
 * way to check what you got.
 *
 * You wind on, you press the button, the counter goes down, and that is
 * the entire interface. Everything you took is held until the roll is
 * finished, then developed all at once — grain, colour shifts, sprocket
 * holes and the odd light leak included, because the camera is cheap and
 * so is the lab.
 */
export default function TwentySevenExposures() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shotsRef = useRef<HTMLCanvasElement[]>([]);
  const aliveRef = useRef(true);

  const [phase, setPhase] = useState<Phase>("idle");
  const [left, setLeft] = useState(ROLL);
  const [flash, setFlash] = useState(0);
  const [scans, setScans] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stop();
      closeAudio();
    };
  }, [stop]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "environment" },
        audio: false,
      });
      if (!aliveRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("loaded");
    } catch {
      setError("no camera. permission denied, or nothing to see.");
    }
  }, []);

  const shoot = useCallback(() => {
    const video = videoRef.current;
    if (!video || left <= 0) return;

    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const scale = Math.max(W / video.videoWidth, H / video.videoHeight);
    ctx.drawImage(
      video,
      (W - video.videoWidth * scale) / 2,
      (H - video.videoHeight * scale) / 2,
      video.videoWidth * scale,
      video.videoHeight * scale,
    );
    shotsRef.current.push(c);

    setFlash((f) => f + 1);
    click({ freq: 2200, gain: 0.3, decay: 0.05 });
    // the wind-on, which is most of the pleasure
    window.setTimeout(() => click({ freq: 420, gain: 0.16, decay: 0.18, q: 1.2 }), 260);
    setLeft((n) => n - 1);
  }, [left]);

  const develop = useCallback(async () => {
    setPhase("developing");
    stop();
    // the lab takes its time
    await new Promise((r) => setTimeout(r, 2600));
    if (!aliveRef.current) return;

    const out = shotsRef.current.map((shot, i) => {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      if (!ctx) return "";
      ctx.drawImage(shot, 0, 0);
      film(ctx, W, H, i);
      return c.toDataURL("image/jpeg", 0.86);
    });
    setScans(out.filter(Boolean));
    setPhase("developed");
  }, [stop]);

  /** Everything on one sheet, the way the lab hands it back. */
  const contactSheet = useCallback(() => {
    const cols = 5;
    const rows = Math.ceil(scans.length / cols);
    const cw = 300;
    const ch = 200;
    const pad = 18;
    const out = document.createElement("canvas");
    out.width = cols * cw + pad * (cols + 1);
    out.height = rows * ch + pad * (rows + 1) + 60;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#15161a";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.fillStyle = "#c9c3b8";
    ctx.font = "600 20px ui-monospace, monospace";
    ctx.fillText(`27 EXPOSURES · ${new Date().toLocaleDateString()}`, pad, 38);

    let loaded = 0;
    scans.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        const x = pad + (i % cols) * (cw + pad);
        const y = 60 + pad + Math.floor(i / cols) * (ch + pad);
        ctx.drawImage(img, x, y, cw, ch);
        ctx.fillStyle = "#c9c3b8";
        ctx.font = "11px ui-monospace, monospace";
        ctx.fillText(String(i + 1).padStart(2, "0"), x + 2, y + ch + 13);
        loaded++;
        if (loaded === scans.length) {
          const link = document.createElement("a");
          link.download = "contact-sheet.jpg";
          link.href = out.toDataURL("image/jpeg", 0.9);
          link.click();
        }
      };
      img.src = src;
    });
  }, [scans]);

  const reload = useCallback(() => {
    shotsRef.current = [];
    setScans([]);
    setLeft(ROLL);
    setPhase("idle");
  }, []);

  return (
    <div className={s.stage}>
      {phase === "developed" ? (
        <div className={s.roll}>
          <p className={s.rollHead}>{scans.length} exposures</p>
          <div className={s.grid}>
            {scans.map((src, i) => (
              <a key={i} className={s.frame} href={src} download={`exposure-${i + 1}.jpg`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`exposure ${i + 1}`} />
                <span>{String(i + 1).padStart(2, "0")}</span>
              </a>
            ))}
          </div>
          <div className={s.row}>
            <button className={s.button} onClick={contactSheet}>
              Contact sheet
            </button>
            <button className={s.button} onClick={reload}>
              New roll
            </button>
          </div>
        </div>
      ) : (
        <div className={s.camera}>
          <div className={s.body}>
            <div className={s.top}>
              <span className={s.brand}>27 EXPOSURES</span>
              <span className={s.counter}>{String(left).padStart(2, "0")}</span>
            </div>

            <div className={s.finder}>
              {/* deliberately not a preview — you get a window, not a screen */}
              <div className={s.crosshair} />
              <div key={flash} className={flash ? s.flashOn : undefined} />
            </div>

            <div className={s.lens}>
              <span className={s.glass} />
            </div>

            <button
              className={s.shutter}
              onClick={phase === "loaded" ? shoot : load}
              disabled={phase === "developing" || (phase === "loaded" && left === 0)}
              aria-label="shutter"
            />
          </div>

          <video ref={videoRef} muted playsInline className={s.hidden} />

          <p className={s.note}>
            {phase === "idle"
              ? "press the button to load a film"
              : phase === "developing"
                ? "developing…"
                : left > 0
                  ? `${left} left · you will not see them until the roll is done`
                  : "roll finished"}
          </p>

          {phase === "loaded" && left === 0 ? (
            <button className={s.button} onClick={develop}>
              Develop film
            </button>
          ) : null}

          {error ? <p className={`${s.note} ${s.error}`}>{error}</p> : null}
        </div>
      )}
    </div>
  );
}

/** Cheap film, cheap lab. */
function film(ctx: CanvasRenderingContext2D, w: number, h: number, index: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // a different colour cast every few frames, as the roll ages
  const warm = 1 + Math.sin(index * 1.7) * 0.06;
  const cool = 1 - Math.sin(index * 1.7) * 0.05;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 24;
    d[i] = clamp(d[i] * warm * 0.92 + 16 + n);
    d[i + 1] = clamp(d[i + 1] * 0.92 + 14 + n);
    d[i + 2] = clamp(d[i + 2] * cool * 0.92 + 18 + n);
  }
  ctx.putImageData(img, 0, 0);

  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(20,12,6,0.42)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // the odd light leak, down one edge
  if (index % 7 === 3) {
    const leak = ctx.createLinearGradient(w, 0, w * 0.6, 0);
    leak.addColorStop(0, "rgba(255, 120, 60, 0.32)");
    leak.addColorStop(1, "rgba(255, 120, 60, 0)");
    ctx.fillStyle = leak;
    ctx.fillRect(0, 0, w, h);
  }
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
