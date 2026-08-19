"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TAU = Math.PI * 2;

interface Fish {
  char: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  hue: number;
  fins: number;
  /** 0 fish, 1 jellyfish, 2 eel — decided by what you typed. */
  kind: number;
  wobble: number;
  phase: number;
  /** Seconds lived, accumulated from frame deltas. */
  age: number;
}

/**
 * 016 — KEYBOARD AQUARIUM
 *
 * Every key you press becomes a creature. The letter decides what it is —
 * vowels come out round and slow, consonants long and quick, digits turn
 * into jellyfish, punctuation into eels — so a word always produces the
 * same little shoal, and a sentence produces an ecosystem you can read.
 *
 * Backspace removes the last thing you made, which it will not enjoy.
 */
export default function KeyboardAquarium() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishRef = useRef<Fish[]>([]);
  const [typed, setTyped] = useState("");

  const spawn = useCallback((char: string, width: number, height: number) => {
    const code = char.toLowerCase().charCodeAt(0);
    const vowel = "aeiou".includes(char.toLowerCase());
    const digit = /[0-9]/.test(char);
    const punct = /[^a-z0-9]/i.test(char);

    fishRef.current.push({
      char,
      // born in view, so you actually see the thing you just made
      x: 90 + Math.random() * Math.max(1, width - 180),
      y: 90 + Math.random() * Math.max(1, height - 220),
      angle: Math.random() * TAU,
      // the same letter always makes the same creature
      speed: (vowel ? 16 : 30) + (code % 17) * 1.6,
      size: (vowel ? 15 : 11) + (code % 11),
      hue: (code * 37) % 360,
      fins: 1 + (code % 3),
      kind: digit ? 1 : punct ? 2 : 0,
      wobble: 1.6 + (code % 7) * 0.4,
      phase: Math.random() * TAU,
      age: 0,
    });
  }, []);

  useEffect(() => {
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

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        fishRef.current.pop();
        setTyped((s) => s.slice(0, -1));
        return;
      }
      if (e.key.length !== 1) return;
      if (e.key === " ") {
        // a space is a breath, not a creature
        setTyped((s) => `${s} `);
        return;
      }
      spawn(e.key, width, height);
      setTyped((s) => (s + e.key).slice(-48));
    };
    window.addEventListener("keydown", onKey);

    const mouse = { x: -999, y: -999 };
    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, width, height);

      // a few motes of drifting silt, so the water isn't empty
      ctx.fillStyle = "rgba(214, 209, 201, 0.05)";
      for (let i = 0; i < 40; i++) {
        const x = ((i * 137.5 + now * 0.004 * (1 + (i % 3))) % (width + 40)) - 20;
        const y = (i * 97.3) % height;
        ctx.fillRect(x, y + Math.sin(now / 1400 + i) * 6, 1.6, 1.6);
      }

      for (const f of fishRef.current) {
        // wander, and keep a polite distance from the cursor
        f.age += dt;
        f.phase += dt * f.wobble;
        const dx = f.x - mouse.x;
        const dy = f.y - mouse.y;
        const near = Math.hypot(dx, dy);
        if (near < 110) {
          f.angle = Math.atan2(dy, dx);
        } else {
          f.angle += Math.sin(now / 900 + f.phase) * dt * 1.4;
        }

        f.x += Math.cos(f.angle) * f.speed * dt;
        f.y += Math.sin(f.angle) * f.speed * dt + Math.sin(f.phase * 2) * 0.35;

        // the tank wraps, which is kinder than a wall
        if (f.x < -60) f.x = width + 50;
        if (f.x > width + 60) f.x = -50;
        f.y = Math.max(40, Math.min(height - 40, f.y));

        drawCreature(ctx, f);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
    };
  }, [spawn]);

  return (
    <div style={{ position: "fixed", inset: 0, cursor: "crosshair" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <span
        style={{
          position: "fixed",
          bottom: "clamp(1.25rem, 3vw, 2rem)",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: "0.66rem",
          letterSpacing: "0.24em",
          color: "var(--text-dim)",
          pointerEvents: "none",
          whiteSpace: "pre",
        }}
      >
        {typed || "type something"}
      </span>
    </div>
  );
}

function drawCreature(ctx: CanvasRenderingContext2D, f: Fish) {
  // Age is accumulated from frame deltas rather than compared against a
  // spawn timestamp: the rAF clock and performance.now() are not the same
  // clock, and in a throttled tab they drift far enough apart to make a
  // creature either invisible or a negative radius, which canvas throws on.
  const grown = Math.min(1, f.age / 0.6);
  const size = f.size * grown;
  const body = `hsl(${f.hue} 42% 62%)`;
  const dark = `hsl(${f.hue} 44% 38%)`;

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.angle);
  // swimming is mostly a tail, so face the direction of travel
  if (Math.cos(f.angle) < 0) ctx.scale(1, -1);

  if (f.kind === 1) {
    // jellyfish: a bell and some trailing threads
    ctx.fillStyle = body;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(0, 0, size, Math.PI, TAU);
    ctx.fill();
    ctx.strokeStyle = body;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const ox = -size + (i * size * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.quadraticCurveTo(
        ox + Math.sin(f.phase + i) * 5,
        size * 1.1,
        ox + Math.sin(f.phase + i) * 9,
        size * 2,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (f.kind === 2) {
    // eel: one long ribbon
    ctx.strokeStyle = body;
    ctx.lineWidth = size * 0.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = -size * 2.4 + t * size * 4.8;
      const y = Math.sin(f.phase * 2 + t * 5) * size * 0.5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    // fish: tail, fins, body, one eye
    ctx.fillStyle = dark;
    ctx.beginPath();
    const swish = Math.sin(f.phase * 3) * size * 0.42;
    ctx.moveTo(-size * 0.9, 0);
    ctx.lineTo(-size * 1.9, swish - size * 0.55);
    ctx.lineTo(-size * 1.9, swish + size * 0.55);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < f.fins; i++) {
      ctx.beginPath();
      const fx = -size * 0.3 + i * size * 0.4;
      ctx.moveTo(fx, -size * 0.35);
      ctx.lineTo(fx - size * 0.3, -size * 0.95 - i * 2);
      ctx.lineTo(fx + size * 0.25, -size * 0.35);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.25, size * 0.62, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#12100e";
    ctx.beginPath();
    ctx.arc(size * 0.62, -size * 0.12, size * 0.13, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}
