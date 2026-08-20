"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./reflection.module.css";

const W = 640;
const H = 480;
/** Seconds of past held in memory. */
const HISTORY = 42;

type Glitch = "none" | "delay" | "afterimage" | "smear" | "freeze";

/**
 * 021 — WRONG REFLECTION
 *
 * A mirror that is mostly honest. It keeps the last second or so of you
 * in memory, and every now and then it reaches for the wrong frame — it
 * lags a beat behind, or holds still while you move, or smears you down
 * the glass one scanline at a time.
 *
 * It always comes back. That is what makes it unsettling rather than
 * broken: for most of the time it really is just a mirror.
 */
export default function WrongReflection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aliveRef = useRef(true);

  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glitch, setGlitch] = useState<Glitch>("none");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stop();
    };
  }, [stop]);

  const enable = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" },
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
      setLive(true);
    } catch {
      setError("no camera. permission denied, or nothing to see.");
    }
  }, []);

  useEffect(() => {
    if (!live) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = W;
    canvas.height = H;

    // a rolling memory of recent frames
    const history: HTMLCanvasElement[] = Array.from({ length: HISTORY }, () => {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      return c;
    });
    let cursor = 0;
    let filled = 0;

    let mode: Glitch = "none";
    let until = 0;
    let nextAt = performance.now() + 3000 + Math.random() * 5000;

    const at = (framesAgo: number) => history[(cursor - framesAgo + HISTORY * 2) % HISTORY];

    let raf = 0;
    const frame = (now: number) => {
      if (video.videoWidth) {
        // record the present, mirrored
        const store = history[cursor];
        const sctx = store.getContext("2d");
        if (sctx) {
          const scale = Math.max(W / video.videoWidth, H / video.videoHeight);
          const dw = video.videoWidth * scale;
          const dh = video.videoHeight * scale;
          sctx.save();
          sctx.translate(W, 0);
          sctx.scale(-1, 1);
          sctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
          sctx.restore();
        }
        cursor = (cursor + 1) % HISTORY;
        filled = Math.min(HISTORY, filled + 1);

        // decide whether the mirror is behaving
        if (now > until && mode !== "none") {
          mode = "none";
          setGlitch("none");
          nextAt = now + 3500 + Math.random() * 6000;
        }
        if (now > nextAt && filled >= HISTORY) {
          const pick: Glitch[] = ["delay", "afterimage", "smear", "freeze"];
          mode = pick[Math.floor(Math.random() * pick.length)];
          setGlitch(mode);
          until = now + 900 + Math.random() * 1800;
        }

        ctx.clearRect(0, 0, W, H);

        if (mode === "delay") {
          // a beat behind, which you only notice when you move
          ctx.drawImage(at(Math.min(filled - 1, 14)), 0, 0);
        } else if (mode === "freeze") {
          // it stopped watching for a second
          ctx.drawImage(at(Math.min(filled - 1, 30)), 0, 0);
        } else if (mode === "afterimage") {
          ctx.drawImage(at(1), 0, 0);
          ctx.globalAlpha = 0.42;
          ctx.drawImage(at(Math.min(filled - 1, 12)), 0, 0);
          ctx.globalAlpha = 0.22;
          ctx.drawImage(at(Math.min(filled - 1, 24)), 0, 0);
          ctx.globalAlpha = 1;
        } else if (mode === "smear") {
          // each strip of the glass is a different moment
          const strips = 48;
          for (let i = 0; i < strips; i++) {
            const y = Math.round((i / strips) * H);
            const h = Math.ceil(H / strips) + 1;
            const back = Math.min(filled - 1, Math.round((i / strips) * 30));
            ctx.drawImage(at(back), 0, y, W, h, 0, y, W, h);
          }
        } else {
          ctx.drawImage(at(1), 0, 0);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={s.glass}>
          <canvas ref={canvasRef} className={s.mirror} />
          {!live ? <div className={s.off}>the glass is empty</div> : null}
          {glitch !== "none" ? <span className={s.tell}>{glitch}</span> : null}
        </div>

        <video ref={videoRef} muted playsInline className={s.hidden} />

        {!live ? (
          <>
            <button className={s.button} onClick={enable}>
              Look
            </button>
            <p className={s.note}>
              a mirror that is mostly honest. nothing leaves this machine.
            </p>
          </>
        ) : (
          <p className={s.note}>stand still for a while, then move suddenly</p>
        )}

        {error ? <p className={`${s.note} ${s.error}`}>{error}</p> : null}
      </div>
    </div>
  );
}
