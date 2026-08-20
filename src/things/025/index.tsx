"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./ghost.module.css";

const W = 720;
const H = 900; // portrait, because these are portraits

type Blend = "screen" | "lighten" | "average";

/**
 * 025 — GHOST EXPOSURE
 *
 * Two portraits on one frame, the way it happened when a film advance
 * jammed. Sit for the first, move somewhere else, sit for the second, and
 * whatever the two have in common comes out solid while everything else
 * turns to vapour.
 *
 * Leave a gap between them and change something — the angle of your head,
 * the side of the frame you're on. Two identical portraits just make one
 * slightly brighter portrait.
 */
export default function GhostExposure() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const plateRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shotsRef = useRef<HTMLCanvasElement[]>([]);
  const aliveRef = useRef(true);

  const [live, setLive] = useState(false);
  const [taken, setTaken] = useState(0);
  const [blend, setBlend] = useState<Blend>("screen");
  const [mix, setMix] = useState(0.5);
  const [countdown, setCountdown] = useState(0);
  const [result, setResult] = useState<string | null>(null);
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

  // live preview
  useEffect(() => {
    if (!live || result) return;
    const canvas = previewRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;

    let raf = 0;
    const frame = () => {
      if (video.videoWidth) {
        const scale = Math.max(W / video.videoWidth, H / video.videoHeight);
        const dw = video.videoWidth * scale;
        const dh = video.videoHeight * scale;
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live, result]);

  const grab = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const scale = Math.max(W / video.videoWidth, H / video.videoHeight);
    const dw = video.videoWidth * scale;
    const dh = video.videoHeight * scale;
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
    // black-and-white: colour makes a double exposure read as a mistake
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }, []);

  const expose = useCallback(async () => {
    for (let n = 3; n > 0; n--) {
      if (!aliveRef.current) return;
      setCountdown(n);
      await new Promise((r) => setTimeout(r, 800));
    }
    if (!aliveRef.current) return;
    setCountdown(0);
    const shot = grab();
    if (!shot) return;
    shotsRef.current.push(shot);
    setTaken(shotsRef.current.length);
  }, [grab]);

  /** Lay the two exposures over each other. */
  const compose = useCallback(() => {
    const [a, b] = shotsRef.current;
    const plate = plateRef.current;
    if (!a || !b || !plate) return;
    plate.width = W;
    plate.height = H;
    const ctx = plate.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    if (blend === "average") {
      ctx.globalAlpha = 1 - mix;
      ctx.drawImage(a, 0, 0);
      ctx.globalAlpha = mix;
      ctx.drawImage(b, 0, 0);
    } else {
      ctx.globalAlpha = 1;
      ctx.drawImage(a, 0, 0);
      ctx.globalCompositeOperation = blend;
      ctx.globalAlpha = mix * 1.6;
      ctx.drawImage(b, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // film, not video
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      d[i] = clamp(d[i] * 0.92 + 12 + n);
      d[i + 1] = clamp(d[i + 1] * 0.92 + 11 + n);
      d[i + 2] = clamp(d[i + 2] * 0.92 + 9 + n);
    }
    ctx.putImageData(img, 0, 0);

    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    setResult(plate.toDataURL("image/jpeg", 0.92));
  }, [blend, mix]);

  // once both are taken, keep the composite in step with the controls
  useEffect(() => {
    if (taken >= 2) compose();
  }, [taken, compose]);

  const reset = useCallback(() => {
    shotsRef.current = [];
    setTaken(0);
    setResult(null);
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={s.frame}>
          {result ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={s.plate} src={result} alt="double exposure" />
          ) : (
            <canvas ref={previewRef} className={s.plate} />
          )}
          {countdown > 0 ? <div className={s.count}>{countdown}</div> : null}
          {!live ? <div className={s.off}>unexposed</div> : null}
        </div>

        <canvas ref={plateRef} className={s.hidden} />
        <video ref={videoRef} muted playsInline className={s.hidden} />

        {!live ? (
          <>
            <button className={s.button} onClick={enable}>
              Load the film
            </button>
            <p className={s.note}>two portraits, one frame. nothing leaves this machine.</p>
          </>
        ) : taken < 2 ? (
          <>
            <button className={s.button} onClick={expose} disabled={countdown > 0}>
              {taken === 0 ? "First exposure" : "Second exposure"}
            </button>
            <p className={s.note}>
              {taken === 0
                ? "sit still for the first"
                : "now move — somewhere else in the frame"}
            </p>
          </>
        ) : (
          <>
            <div className={s.row}>
              {(["screen", "lighten", "average"] as Blend[]).map((b) => (
                <button
                  key={b}
                  className={`${s.chip} ${blend === b ? s.chipOn : ""}`}
                  onClick={() => setBlend(b)}
                >
                  {b}
                </button>
              ))}
            </div>

            <label className={s.slider}>
              second exposure
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={mix}
                onChange={(e) => setMix(Number(e.target.value))}
              />
            </label>

            <div className={s.row}>
              <a className={s.button} href={result ?? "#"} download="ghost-exposure.jpg">
                Download
              </a>
              <button className={s.button} onClick={reset}>
                New frame
              </button>
            </div>
          </>
        )}

        {error ? <p className={`${s.note} ${s.error}`}>{error}</p> : null}
      </div>
    </div>
  );
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
