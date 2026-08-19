"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { click, closeAudio } from "@/lib/audio";

const TAU = Math.PI * 2;
const PITCH = 34;
const R = 13;

interface Bubble {
  x: number;
  y: number;
  popped: boolean;
  /** Squash while it resists, then the pop animation. */
  press: number;
  age: number;
  seed: number;
}

/**
 * 009 — BUBBLE WRAP
 *
 * The whole screen is a sheet of bubble wrap. Click one, or hold the
 * button down and drag through them. Each bubble is its own — it bulges
 * under the cursor before it goes, and once gone it stays a flat wrinkled
 * disc. When you have finished, take another sheet.
 */
export default function BubbleWrap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [sheet, setSheet] = useState(0);

  const build = useCallback(() => {
    const cols = Math.ceil(window.innerWidth / PITCH) + 1;
    const rows = Math.ceil(window.innerHeight / PITCH) + 1;
    const next: Bubble[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        next.push({
          // offset every other row, the way a real sheet is laid out
          x: c * PITCH + (r % 2 ? PITCH / 2 : 0),
          y: r * PITCH + PITCH / 2,
          popped: false,
          press: 0,
          age: 0,
          seed: Math.random(),
        });
      }
    }
    bubblesRef.current = next;
    setRemaining(next.length);
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
    build();

    const onResize = () => {
      resize();
      build();
    };
    window.addEventListener("resize", onResize);

    let down = false;
    const popAt = (x: number, y: number) => {
      let popped = 0;
      for (const b of bubblesRef.current) {
        if (b.popped) continue;
        if (Math.hypot(b.x - x, b.y - y) > R) continue;
        b.popped = true;
        b.age = 0;
        popped++;
        click({
          freq: 900 + Math.random() * 1600,
          gain: 0.2,
          decay: 0.035,
          q: 2.6,
        });
      }
      if (popped) setRemaining((n) => n - popped);
    };

    const onDown = (e: PointerEvent) => {
      down = true;
      canvas.setPointerCapture(e.pointerId);
      popAt(e.clientX, e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      // bulge under the cursor even when you aren't popping
      for (const b of bubblesRef.current) {
        if (b.popped) continue;
        b.press = Math.hypot(b.x - e.clientX, b.y - e.clientY) < R + 5 ? 1 : 0;
      }
      if (down) popAt(e.clientX, e.clientY);
    };
    const onUp = () => {
      down = false;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, width, height);

      for (const b of bubblesRef.current) {
        if (b.x < -R || b.x > width + R || b.y < -R || b.y > height + R) continue;

        if (b.popped) {
          b.age = Math.min(1, b.age + dt * 5);
          // a flat, creased disc where the bubble used to be
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = "rgba(214, 209, 201, 0.22)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, R * 0.9, 0, TAU);
          ctx.stroke();
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const a = b.seed * TAU + (i * TAU) / 3;
            ctx.moveTo(Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75);
            ctx.lineTo(Math.cos(a + 2.4) * R * 0.55, Math.sin(a + 2.4) * R * 0.55);
          }
          ctx.stroke();
          ctx.restore();
          continue;
        }

        const bulge = 1 + b.press * 0.14;
        const grad = ctx.createRadialGradient(
          b.x - R * 0.32,
          b.y - R * 0.36,
          R * 0.12,
          b.x,
          b.y,
          R * bulge,
        );
        grad.addColorStop(0, "rgba(236, 240, 244, 0.5)");
        grad.addColorStop(0.45, "rgba(168, 178, 188, 0.2)");
        grad.addColorStop(1, "rgba(120, 130, 140, 0.07)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, R * bulge, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = "rgba(226, 232, 238, 0.16)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.beginPath();
        ctx.ellipse(
          b.x - R * 0.3,
          b.y - R * 0.36,
          R * 0.2,
          R * 0.13,
          -0.6,
          0,
          TAU,
        );
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      closeAudio();
    };
  }, [build, sheet]);

  return (
    <div style={{ position: "fixed", inset: 0, cursor: "pointer" }}>
      <canvas ref={canvasRef} style={{ display: "block", touchAction: "none" }} />
      <button
        onClick={() => setSheet((n) => n + 1)}
        style={{
          position: "fixed",
          bottom: "clamp(1.25rem, 3vw, 2rem)",
          left: "50%",
          transform: "translateX(-50%)",
          appearance: "none",
          border: "1px solid var(--line)",
          background: "transparent",
          color: "var(--text-dim)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: "0.62rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          padding: "0.6rem 1.1rem",
          borderRadius: 2,
          cursor: "pointer",
        }}
      >
        New sheet{remaining === 0 ? "" : ` · ${remaining} left`}
      </button>
    </div>
  );
}
