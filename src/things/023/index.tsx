"use client";

import { useEffect, useRef, useState } from "react";

const TAU = Math.PI * 2;
/** Seconds of movement remembered, and replayed by the ghosts. */
const MEMORY = 4;
const BURY_AFTER = 1.4;

interface Step {
  x: number;
  y: number;
}

interface Grave {
  x: number;
  y: number;
  time: string;
  epitaph: string;
  /** How long the cursor lay there. Decides the size of the stone. */
  rest: number;
  /** Seconds since burial — stones weather. */
  age: number;
  risen: number;
  seed: number;
  /** The last few seconds before it stopped. The ghost walks this. */
  path: Step[];
}

interface Ghost {
  path: Step[];
  t: number;
  life: number;
}

const EPITAPHS: [number, string[]][] = [
  [3, ["went quickly", "barely stopped", "a brief hesitation"]],
  [8, ["paused to think", "was reading something", "lost the thread"]],
  [20, ["waited", "was called away", "meant to come back"]],
  [Infinity, ["gave up here", "forgot entirely", "rests at last", "is still waiting"]],
];

function epitaphFor(rest: number, seed: number) {
  for (const [limit, options] of EPITAPHS) {
    if (rest < limit) return options[Math.floor(seed * options.length)];
  }
  return "rests";
}

/**
 * 023 — CURSOR CEMETERY
 *
 * Whenever the cursor stops for long enough it is buried where it fell,
 * and the stone grows the longer it lay there.
 *
 * Each grave keeps the last few seconds of movement before that death,
 * and every so often lets it go again — so the cemetery slowly fills with
 * faint ghosts retracing paths you took minutes ago. Hover a stone to
 * read it. Click one to wake whatever is under it.
 */
export default function CursorCemetery() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);

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

    const graves: Grave[] = [];
    const ghosts: Ghost[] = [];
    /** Rolling record of where the cursor has just been. */
    let trail: Step[] = [];

    const cursor = { x: -999, y: -999 };
    let stillFor = 0;
    let buried = false;
    let hovered: Grave | null = null;
    let nextHaunt = 6;

    const graveAt = (x: number, y: number) => {
      for (let i = graves.length - 1; i >= 0; i--) {
        const g = graves[i];
        const size = stoneSize(g);
        if (Math.abs(x - g.x) < size * 0.6 && Math.abs(y - g.y) < size * 0.7) return g;
      }
      return null;
    };

    const raise = (g: Grave) => {
      if (g.path.length < 4) return;
      ghosts.push({ path: g.path, t: 0, life: 1 });
      g.risen = 1;
    };

    const onMove = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - cursor.x, e.clientY - cursor.y) > 6) {
        stillFor = 0;
        buried = false;
      }
      cursor.x = e.clientX;
      cursor.y = e.clientY;
      trail.push({ x: cursor.x, y: cursor.y });
      hovered = graveAt(cursor.x, cursor.y);
    };

    const onDown = () => {
      const g = graveAt(cursor.x, cursor.y);
      if (g) raise(g);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // the trail only remembers the last few seconds
      const cap = Math.round(MEMORY * 60);
      if (trail.length > cap) trail = trail.slice(-cap);

      if (cursor.x > -100) {
        stillFor += dt;
        if (!buried && stillFor > BURY_AFTER) {
          buried = true;
          const at = new Date();
          const seed = Math.random();
          graves.push({
            x: cursor.x,
            y: cursor.y,
            time: [at.getHours(), at.getMinutes(), at.getSeconds()]
              .map((n) => String(n).padStart(2, "0"))
              .join(":"),
            epitaph: epitaphFor(0, seed),
            rest: 0,
            age: 0,
            risen: 0,
            seed,
            // it is buried with everywhere it went just before
            path: trail.slice(),
          });
          setCount(graves.length);
        }
        if (buried && graves.length) {
          const g = graves[graves.length - 1];
          g.rest += dt;
          g.epitaph = epitaphFor(g.rest, g.seed);
        }
      }

      // every so often, one of them gets out
      nextHaunt -= dt;
      if (nextHaunt <= 0 && graves.length) {
        nextHaunt = 4 + Math.random() * 7;
        raise(graves[Math.floor(Math.random() * graves.length)]);
      }

      ctx.clearRect(0, 0, width, height);

      const fog = ctx.createLinearGradient(0, height * 0.35, 0, height);
      fog.addColorStop(0, "rgba(214, 209, 201, 0)");
      fog.addColorStop(1, "rgba(214, 209, 201, 0.04)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, height * 0.35, width, height * 0.65);

      for (const g of graves) {
        g.age += dt;
        g.risen = Math.max(0, g.risen - dt * 0.7);
        drawGrave(ctx, g, g === hovered);
      }

      // ghosts retrace what the cursor was doing before it died
      for (let i = ghosts.length - 1; i >= 0; i--) {
        const gh = ghosts[i];
        gh.t += dt * 26;
        if (gh.t >= gh.path.length) gh.life -= dt * 1.2;
        if (gh.life <= 0) {
          ghosts.splice(i, 1);
          continue;
        }
        drawGhost(ctx, gh);
      }

      // you, currently dying
      if (cursor.x > -100 && !buried) {
        const ready = Math.min(1, stillFor / BURY_AFTER);
        if (ready > 0.12) {
          ctx.strokeStyle = `rgba(201, 135, 92, ${0.2 + ready * 0.5})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(cursor.x, cursor.y, 13 - ready * 5, -TAU / 4, -TAU / 4 + ready * TAU);
          ctx.stroke();
        }
      }

      if (hovered) drawEpitaph(ctx, hovered, width);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

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
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          pointerEvents: "none",
        }}
      >
        {count === 0
          ? "keep still"
          : `${count} resting here · hover to read, click to wake`}
      </span>
    </div>
  );
}

function stoneSize(g: Grave) {
  return 12 + Math.min(20, g.rest * 2.2);
}

function drawGrave(ctx: CanvasRenderingContext2D, g: Grave, lit: boolean) {
  const size = stoneSize(g);
  // stones weather, sink and lean as they get older
  const weather = Math.min(1, g.age / 90);
  const sink = weather * size * 0.16;
  const alpha = (lit ? 0.95 : 0.7 - weather * 0.28) + g.risen * 0.3;

  ctx.save();
  ctx.translate(g.x, g.y + sink);
  ctx.rotate((g.seed - 0.5) * 0.1 * (1 + weather * 2.2));
  ctx.globalAlpha = Math.max(0.2, alpha);

  ctx.fillStyle = "rgba(214, 209, 201, 0.05)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.55, size * 0.9, size * 0.22, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = lit ? "#5d5852" : "#4a4642";
  ctx.beginPath();
  ctx.moveTo(-size * 0.44, size * 0.5);
  ctx.lineTo(-size * 0.44, -size * 0.15);
  ctx.arc(0, -size * 0.15, size * 0.44, Math.PI, 0);
  ctx.lineTo(size * 0.44, size * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = lit ? "rgba(201, 135, 92, 0.5)" : "rgba(214, 209, 201, 0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // moss, once it has been there a while
  if (weather > 0.25) {
    ctx.fillStyle = `rgba(120, 138, 96, ${weather * 0.3})`;
    for (let i = 0; i < 5; i++) {
      const a = g.seed * TAU + i * 1.7;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * size * 0.3, size * 0.3 + Math.sin(a) * size * 0.14, 1.6, 0, TAU);
      ctx.fill();
    }
  }

  ctx.fillStyle = g.risen > 0.1 ? "rgba(201, 135, 92, 0.85)" : "rgba(214, 209, 201, 0.55)";
  ctx.font = `${Math.max(7, size * 0.32)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.fillText("†", 0, -size * 0.08);

  if (size > 16) {
    ctx.fillStyle = "rgba(214, 209, 201, 0.32)";
    ctx.font = `${Math.max(6, size * 0.19)}px ui-monospace, monospace`;
    ctx.fillText(g.time, 0, size * 0.3);
  }

  ctx.restore();
}

function drawGhost(ctx: CanvasRenderingContext2D, gh: Ghost) {
  const head = Math.min(gh.path.length - 1, Math.floor(gh.t));
  const tail = Math.max(0, head - 30);

  ctx.save();
  ctx.globalAlpha = gh.life;
  ctx.strokeStyle = "rgba(190, 200, 214, 0.16)";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = tail; i <= head; i++) {
    const p = gh.path[i];
    if (i === tail) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  const p = gh.path[head];
  if (p) {
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
    glow.addColorStop(0, "rgba(206, 216, 228, 0.4)");
    glow.addColorStop(1, "rgba(206, 216, 228, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawEpitaph(ctx: CanvasRenderingContext2D, g: Grave, width: number) {
  const size = stoneSize(g);
  const lines = [g.time, g.epitaph, `${g.rest.toFixed(1)}s`];
  ctx.save();
  ctx.font = "9px ui-monospace, monospace";
  ctx.textAlign = g.x > width - 160 ? "right" : "left";
  const x = g.x + (g.x > width - 160 ? -size : size);
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 1 ? "rgba(201, 135, 92, 0.8)" : "rgba(214, 209, 201, 0.45)";
    ctx.fillText(line, x, g.y - size * 0.5 + i * 12);
  });
  ctx.restore();
}
