"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./booth.module.css";

const SHOTS = 4;
const FRAME_W = 460;
const FRAME_H = 345;

type Phase = "idle" | "live" | "shooting" | "strip";

/**
 * 003 — FOUR FRAMES
 *
 * A working photo booth. Camera access is only ever requested after you
 * press the button, every frame is processed in this tab, and nothing
 * leaves the machine — the strip is drawn on a canvas and handed
 * straight back to you.
 */
export default function FourFrames() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aliveRef = useRef(true);

  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(0);
  const [strip, setStrip] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

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
      setPhase("live");
    } catch {
      setError("no camera. permission denied, or nothing to see.");
    }
  }, []);

  const grab = useCallback(() => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    const ctx = canvas.getContext("2d");
    if (!video || !ctx) return canvas;

    // cover-crop the feed into the frame, mirrored to match the preview
    const vw = video.videoWidth || FRAME_W;
    const vh = video.videoHeight || FRAME_H;
    const scale = Math.max(FRAME_W / vw, FRAME_H / vh);
    const dw = vw * scale;
    const dh = vh * scale;

    ctx.save();
    ctx.translate(FRAME_W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, (FRAME_W - dw) / 2, (FRAME_H - dh) / 2, dw, dh);
    ctx.restore();

    // every frame is exposed a little differently, like a real booth
    vintage(ctx, FRAME_W, FRAME_H, 0.94 + Math.random() * 0.14);
    return canvas;
  }, []);

  const shoot = useCallback(async () => {
    setPhase("shooting");
    const frames: HTMLCanvasElement[] = [];

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    for (let i = 0; i < SHOTS; i++) {
      for (let n = 3; n > 0; n--) {
        if (!aliveRef.current) return;
        setCount(n);
        await wait(750);
      }
      if (!aliveRef.current) return;
      setCount(0);
      setFlash((f) => f + 1);
      await wait(60);
      frames.push(grab());
      await wait(650);
    }

    if (!aliveRef.current) return;
    setStrip(compose(frames).toDataURL("image/jpeg", 0.92));
    setPhase("strip");
    stopCamera();
  }, [grab, stopCamera]);

  const retake = useCallback(() => {
    setStrip(null);
    setPhase("idle");
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        {phase === "strip" && strip ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={s.strip} src={strip} alt="photo strip" />
            <div className={s.row}>
              <a className={s.button} href={strip} download="four-frames.jpg">
                Download strip
              </a>
              <button className={s.button} onClick={retake}>
                Again
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={s.viewport}>
              <video ref={videoRef} className={s.video} muted playsInline />
              {count > 0 ? <div className={s.count}>{count}</div> : null}
              <div key={flash} className={`${s.flash} ${flash ? s.flashOn : ""}`} />
            </div>

            {phase === "idle" ? (
              <>
                <button className={s.button} onClick={enable}>
                  Enable camera
                </button>
                <p className={s.note}>
                  four photos, one strip. the camera only turns on when you press
                  the button, and every frame is processed here on your machine.
                </p>
              </>
            ) : null}

            {phase === "live" ? (
              <button className={s.button} onClick={shoot}>
                Take photos
              </button>
            ) : null}

            {phase === "shooting" ? (
              <p className={s.note}>hold still</p>
            ) : null}

            {error ? <p className={`${s.note} ${s.error}`}>{error}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Faded colour, warm cast, grain and a little dust. */
function vintage(ctx: CanvasRenderingContext2D, w: number, h: number, exposure: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * exposure;
    let g = d[i + 1] * exposure;
    let b = d[i + 2] * exposure;

    // lift the blacks — cheap prints never reach true black
    r = r * 0.84 + 28;
    g = g * 0.84 + 24;
    b = b * 0.84 + 21;

    // warm it, and pull a little life out of the colour
    r *= 1.06;
    b *= 0.93;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = r * 0.84 + lum * 0.16;
    g = g * 0.84 + lum * 0.16;
    b = b * 0.84 + lum * 0.16;

    const noise = (Math.random() - 0.5) * 20;
    d[i] = clamp(r + noise);
    d[i + 1] = clamp(g + noise);
    d[i + 2] = clamp(b + noise);
  }
  ctx.putImageData(img, 0, 0);

  // vignette
  const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.78);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(20,14,8,0.34)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // dust
  ctx.fillStyle = "rgba(255,250,240,0.5)";
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 2 + 0.5, Math.random() * 2 + 0.5);
  }

  // a soft bloom, so it isn't digitally sharp
  ctx.globalAlpha = 0.16;
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = "blur(5px)";
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/** Stack the frames onto a paper strip with a date at the foot. */
function compose(frames: HTMLCanvasElement[]): HTMLCanvasElement {
  const pad = 22;
  const gap = 12;
  const foot = 62;
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_W + pad * 2;
  canvas.height = pad + frames.length * FRAME_H + (frames.length - 1) * gap + foot;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#efe6d5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  frames.forEach((frame, i) => {
    const y = pad + i * (FRAME_H + gap);
    ctx.drawImage(frame, pad, y);
    ctx.strokeStyle = "rgba(60,48,34,0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pad + 0.5, y + 0.5, FRAME_W - 1, FRAME_H - 1);
  });

  const now = new Date();
  const date = [
    String(now.getDate()).padStart(2, "0"),
    String(now.getMonth() + 1).padStart(2, "0"),
    now.getFullYear(),
  ].join(".");

  ctx.fillStyle = "#8a7a62";
  ctx.font = "500 18px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(date, canvas.width / 2, canvas.height - foot / 2 + 4);

  // paper grain over the whole strip
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 9;
    d[i] = clamp(d[i] + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);

  return canvas;
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
