"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { click, closeAudio } from "@/lib/audio";
import s from "./fishing.module.css";

const TAU = Math.PI * 2;

/** What is down there. Rarer things are further down the list. */
const CATCH = [
  { name: "a small fish", weight: 26, draw: "fish" },
  { name: "a boot", weight: 14, draw: "boot" },
  { name: "a tin can", weight: 12, draw: "can" },
  { name: "a banana", weight: 10, draw: "banana" },
  { name: "someone else's cursor", weight: 9, draw: "cursor" },
  { name: "a floppy disk", weight: 8, draw: "floppy" },
  { name: "a key to nothing", weight: 7, draw: "key" },
  { name: "a very old fish", weight: 6, draw: "fish" },
  { name: "the moon, somehow", weight: 3, draw: "moon" },
  { name: "a message, unread", weight: 3, draw: "bottle" },
  { name: "nothing at all", weight: 12, draw: "none" },
] as const;

type Phase = "idle" | "casting" | "waiting" | "bite" | "reeling" | "caught";

function pick() {
  const total = CATCH.reduce((s, c) => s + c.weight, 0);
  let roll = Math.random() * total;
  for (const c of CATCH) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }
  return CATCH[0];
}

/**
 * 033 — MOUSE FISHING
 *
 * Your cursor is a hook. Click to cast it into the dark, and then wait —
 * anywhere from a few seconds to the better part of a minute.
 *
 * When the line twitches you have about a second to strike. Miss it and
 * whatever it was goes back to whatever it was doing. Most of what is
 * down there is rubbish; occasionally it is the moon.
 */
export default function MouseFishing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("idle");
  const hookRef = useRef({ x: 0, y: 0, targetY: 0 });
  const timerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [caught, setCaught] = useState<(typeof CATCH)[number] | null>(null);
  const [book, setBook] = useState<string[]>([]);

  const to = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const strike = useCallback(() => {
    const now = phaseRef.current;
    if (now === "idle" || now === "caught") return;

    if (now === "bite") {
      clearTimer();
      const got = pick();
      setCaught(got);
      to("caught");
      click({ freq: 1100, gain: 0.24, decay: 0.14, q: 3 });
      if (got.draw !== "none") setBook((b) => (b.includes(got.name) ? b : [...b, got.name]));
      return;
    }

    // struck too early, or gave up
    clearTimer();
    to("idle");
    click({ freq: 300, gain: 0.14, decay: 0.1 });
  }, [clearTimer, to]);

  const cast = useCallback(
    (x: number) => {
      clearTimer();
      setCaught(null);
      hookRef.current.x = x;
      hookRef.current.y = window.innerHeight * 0.3;
      hookRef.current.targetY = window.innerHeight * 0.62 + Math.random() * window.innerHeight * 0.2;
      to("casting");
      click({ freq: 600, gain: 0.18, decay: 0.12 });

      timerRef.current = window.setTimeout(() => {
        to("waiting");
        // the wait is the point, so it is a long and unfair one
        timerRef.current = window.setTimeout(
          () => {
            to("bite");
            click({ freq: 420, gain: 0.22, decay: 0.09 });
            // about a second to react
            timerRef.current = window.setTimeout(() => {
              to("idle");
            }, 1100);
          },
          2500 + Math.random() * 26000,
        );
      }, 900);
    },
    [clearTimer, to],
  );

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

    const pointer = { x: width / 2, y: height * 0.2 };
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const state = phaseRef.current;
      const hook = hookRef.current;

      if (state === "idle") {
        hook.x = pointer.x;
        hook.y = pointer.y;
      } else if (state === "casting") {
        hook.y += (hook.targetY - hook.y) * Math.min(1, dt * 4);
      } else if (state === "caught") {
        hook.y += (height * 0.32 - hook.y) * Math.min(1, dt * 3);
      }

      ctx.clearRect(0, 0, width, height);

      // the water
      const surface = height * 0.3;
      const deep = ctx.createLinearGradient(0, surface, 0, height);
      deep.addColorStop(0, "rgba(38, 58, 74, 0.5)");
      deep.addColorStop(1, "rgba(6, 10, 14, 0.95)");
      ctx.fillStyle = deep;
      ctx.fillRect(0, surface, width, height - surface);

      ctx.strokeStyle = "rgba(150, 190, 214, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 8) {
        const y = surface + Math.sin(x / 90 + now / 900) * 3 + Math.sin(x / 33 - now / 1400) * 1.6;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // things moving about down there, out of reach
      ctx.fillStyle = "rgba(150, 190, 214, 0.07)";
      for (let i = 0; i < 9; i++) {
        const fx = ((i * 211 + now * 0.012 * (1 + (i % 3))) % (width + 120)) - 60;
        const fy = surface + 80 + ((i * 137) % (height - surface - 120));
        ctx.beginPath();
        ctx.ellipse(fx, fy + Math.sin(now / 700 + i) * 5, 9, 3.5, 0, 0, TAU);
        ctx.fill();
      }

      // the line, from the top of the screen to the hook
      if (state !== "idle") {
        ctx.strokeStyle = "rgba(214, 209, 201, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hook.x, 0);
        const sway = state === "bite" ? Math.sin(now / 45) * 5 : Math.sin(now / 700) * 2;
        ctx.quadraticCurveTo(hook.x + sway, hook.y * 0.55, hook.x, hook.y);
        ctx.stroke();
      }

      // the hook, and whatever is on it
      const bobbing = state === "waiting" ? Math.sin(now / 620) * 3 : 0;
      const hy = hook.y + bobbing + (state === "bite" ? Math.sin(now / 40) * 4 : 0);
      ctx.strokeStyle = state === "bite" ? "#e9c4a0" : "rgba(214, 209, 201, 0.6)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(hook.x, hy, 5, Math.PI * 0.15, Math.PI * 1.25);
      ctx.stroke();

      if (state === "bite") {
        ctx.strokeStyle = `rgba(201, 135, 92, ${0.4 + Math.sin(now / 60) * 0.3})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(hook.x, hy, 16 + Math.sin(now / 90) * 3, 0, TAU);
        ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  useEffect(() => () => {
    clearTimer();
    closeAudio();
  }, [clearTimer]);

  return (
    <div
      className={s.stage}
      onPointerDown={(e) => {
        if (phaseRef.current === "idle" || phaseRef.current === "caught") cast(e.clientX);
        else strike();
      }}
    >
      <canvas ref={canvasRef} className={s.canvas} />

      <div className={s.hud}>
        <span className={s.state}>
          {phase === "idle"
            ? "click to cast"
            : phase === "casting"
              ? "…"
              : phase === "waiting"
                ? "waiting"
                : phase === "bite"
                  ? "now"
                  : caught
                    ? caught.name
                    : ""}
        </span>
        {book.length ? (
          <span className={s.book}>
            {book.length} {book.length === 1 ? "thing" : "things"} caught
          </span>
        ) : null}
      </div>
    </div>
  );
}
