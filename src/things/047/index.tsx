"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./rocket.module.css";

const TAU = Math.PI * 2;

/**
 * 047 — SCREAM POWERED ROCKET
 *
 * The microphone is the throttle. Say nothing and it falls out of the
 * sky. Talk and it holds. Shout and it climbs. Scream and it stops being
 * a rocket and becomes a decision you have made.
 *
 * Thrust comes from the average loudness of the signal, so a steady note
 * lifts better than a short shriek — which means the only way up is to
 * keep going, and the run ends when you run out of breath.
 */
export default function ScreamRocket() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const aliveRef = useRef(true);

  const [live, setLive] = useState(false);
  const [altitude, setAltitude] = useState(0);
  const [best, setBest] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    contextRef.current?.close();
    contextRef.current = null;
    analyserRef.current = null;
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!aliveRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      // its own context: this one only ever listens
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error("no audio");
      const ac = new Ctor();
      contextRef.current = ac;
      const source = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      setLive(true);
    } catch {
      setError("no microphone. permission denied, or nothing to hear.");
    }
  }, []);

  useEffect(() => {
    if (!live) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const bins = new Uint8Array(analyserRef.current?.frequencyBinCount ?? 512);
    const rocket = { y: 0, vy: 0, tilt: 0 };
    const flames: { x: number; y: number; life: number; heat: number }[] = [];
    let loud = 0;
    let raf = 0;
    let last = performance.now();
    let peak = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const analyser = analyserRef.current;
      if (analyser) {
        analyser.getByteTimeDomainData(bins);
        // RMS is a fairer measure of "how much noise" than a peak
        let sum = 0;
        for (let i = 0; i < bins.length; i++) {
          const v = (bins[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / bins.length);
        loud += (rms - loud) * Math.min(1, dt * 12);
      }

      // below the threshold it just falls
      const thrust = Math.max(0, loud - 0.03) * 190;
      rocket.vy += (thrust - 26) * dt;
      rocket.vy = Math.max(-46, Math.min(80, rocket.vy));
      rocket.y = Math.max(0, rocket.y + rocket.vy * dt);
      rocket.tilt = Math.sin(now / 260) * Math.min(0.22, loud * 1.4);

      if (rocket.y > peak) {
        peak = rocket.y;
        setBest(Math.round(peak));
      }
      setAltitude(Math.round(rocket.y));

      // --- draw ---------------------------------------------------
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      const high = Math.min(1, rocket.y / 900);
      sky.addColorStop(0, `rgb(${13 + high * 4}, ${13 + high * 6}, ${16 + high * 22})`);
      sky.addColorStop(1, "#0d0d0d");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // stars, once it is high enough for them
      if (high > 0.25) {
        ctx.fillStyle = `rgba(214,209,201,${(high - 0.25) * 0.7})`;
        for (let i = 0; i < 70; i++) {
          const sx = (i * 137.5) % width;
          const sy = ((i * 313.7) % height) - ((rocket.y * 0.12) % height);
          ctx.fillRect(sx, sy < 0 ? sy + height : sy, 1.4, 1.4);
        }
      }

      // the ground, dropping away
      const groundY = height * 0.78 + rocket.y * 1.6;
      if (groundY < height + 40) {
        ctx.fillStyle = "#1a1b18";
        ctx.fillRect(0, groundY, width, height - groundY + 40);
        ctx.strokeStyle = "rgba(214,209,201,0.12)";
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(width, groundY);
        ctx.stroke();
      }

      // the rocket sits still; the world moves instead
      const rx = width / 2;
      const ry = height * 0.52;

      if (thrust > 4) {
        for (let i = 0; i < 3; i++) {
          flames.push({
            x: rx + (Math.random() - 0.5) * 8,
            y: ry + 26,
            life: 1,
            heat: Math.min(1, loud * 3),
          });
        }
      }
      for (let i = flames.length - 1; i >= 0; i--) {
        const f = flames[i];
        f.life -= dt * 2.6;
        f.y += 160 * dt;
        f.x += (Math.random() - 0.5) * 30 * dt;
        if (f.life <= 0) {
          flames.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(255, ${Math.round(120 + f.heat * 110)}, 60, ${f.life * 0.7})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 3 + f.life * 7 * f.heat, 0, TAU);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(rocket.tilt);
      ctx.fillStyle = "#d6d1c9";
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(11, 6);
      ctx.lineTo(11, 22);
      ctx.lineTo(-11, 22);
      ctx.lineTo(-11, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c9875c";
      ctx.beginPath();
      ctx.moveTo(11, 12);
      ctx.lineTo(22, 26);
      ctx.lineTo(11, 26);
      ctx.closePath();
      ctx.moveTo(-11, 12);
      ctx.lineTo(-22, 26);
      ctx.lineTo(-11, 26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#3f4a56";
      ctx.beginPath();
      ctx.arc(0, -6, 5, 0, TAU);
      ctx.fill();
      ctx.restore();

      // the throttle, as a bar
      ctx.fillStyle = "rgba(214,209,201,0.1)";
      ctx.fillRect(30, height - 60, 160, 4);
      ctx.fillStyle = loud > 0.24 ? "#e0653f" : "#c9875c";
      ctx.fillRect(30, height - 60, Math.min(160, loud * 420), 4);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [live]);

  return (
    <div className={s.stage}>
      <canvas ref={canvasRef} className={s.canvas} />

      {!live ? (
        <div className={s.panel}>
          <button className={s.button} onClick={enable}>
            Allow the microphone
          </button>
          <p className={s.note}>
            the microphone is the throttle. nothing is recorded or sent
            anywhere — it is only measured for loudness.
          </p>
          {error ? <p className={`${s.note} ${s.error}`}>{error}</p> : null}
        </div>
      ) : (
        <div className={s.hud}>
          <span className={s.alt}>{altitude} m</span>
          <span className={s.best}>best {best} m</span>
        </div>
      )}
    </div>
  );
}
