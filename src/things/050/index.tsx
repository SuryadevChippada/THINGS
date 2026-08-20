"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { click, closeAudio } from "@/lib/audio";
import s from "./slow.module.css";

const W = 640;
const H = 480;

/**
 * 050 — SLOW CAMERA
 *
 * Press the shutter and the photograph is taken somewhere between two and
 * eight seconds later. You are not told when.
 *
 * You cannot pose for it, because posing for eight seconds is impossible
 * and everyone gives up at about four. What you get is whatever you were
 * doing when you stopped trying, which is generally a better photograph
 * than the one you were arranging.
 */
export default function SlowCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const aliveRef = useRef(true);

  const [live, setLive] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [shots, setShots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      stop();
      closeAudio();
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
  }, [live]);

  const press = useCallback(() => {
    if (waiting) return;
    setWaiting(true);
    click({ freq: 700, gain: 0.2, decay: 0.06 });

    // somewhere between two and eight seconds. you are not told which.
    const delay = 2000 + Math.random() * 6000;
    timerRef.current = window.setTimeout(() => {
      if (!aliveRef.current) return;
      const canvas = previewRef.current;
      if (canvas) {
        const shot = document.createElement("canvas");
        shot.width = W;
        shot.height = H;
        const ctx = shot.getContext("2d");
        if (ctx) {
          ctx.drawImage(canvas, 0, 0);
          // a slight grain, so it reads as a photograph rather than a frame
          const img = ctx.getImageData(0, 0, W, H);
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 16;
            d[i] = clamp(d[i] * 0.96 + 8 + n);
            d[i + 1] = clamp(d[i + 1] * 0.96 + 7 + n);
            d[i + 2] = clamp(d[i + 2] * 0.96 + 6 + n);
          }
          ctx.putImageData(img, 0, 0);
          setShots((prev) => [shot.toDataURL("image/jpeg", 0.9), ...prev].slice(0, 12));
        }
      }
      click({ freq: 2400, gain: 0.3, decay: 0.05 });
      setWaiting(false);
    }, delay);
  }, [waiting]);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={`${s.viewport} ${waiting ? s.armed : ""}`}>
          <canvas ref={previewRef} className={s.preview} />
          {!live ? <div className={s.off}>shutter closed</div> : null}
          {waiting ? <span className={s.armedLabel}>at some point</span> : null}
        </div>

        <video ref={videoRef} muted playsInline className={s.hidden} />

        {!live ? (
          <>
            <button className={s.button} onClick={enable}>
              Enable camera
            </button>
            <p className={s.note}>nothing leaves this machine.</p>
          </>
        ) : (
          <>
            <button className={s.button} onClick={press} disabled={waiting}>
              {waiting ? "…" : "take a photograph"}
            </button>
            <p className={s.note}>
              it will happen between two and eight seconds from now. you will not
              be warned.
            </p>
          </>
        )}

        {shots.length ? (
          <div className={s.strip}>
            {shots.map((src, i) => (
              <a key={i} className={s.thumb} href={src} download={`slow-${shots.length - i}.jpg`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`photograph ${shots.length - i}`} />
              </a>
            ))}
          </div>
        ) : null}

        {error ? <p className={`${s.note} ${s.error}`}>{error}</p> : null}
      </div>
    </div>
  );
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
