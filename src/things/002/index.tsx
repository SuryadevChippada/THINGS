"use client";

import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;

type State = "walk" | "run" | "idle" | "sit" | "sleep" | "dizzy";

/**
 * 002 — CURSOR PET
 *
 * A small creature that lives on the page. It reads your cursor as
 * intent: drift and it strolls after you, dash and it sprints, scribble
 * and it gets dizzy, leave it alone and it sits down, then falls asleep.
 * The personality is all in the lag — it is always a beat behind you.
 */
export default function CursorPet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const pet = {
      x: width / 2,
      y: height / 2 + 40,
      vx: 0,
      vy: 0,
      facing: 1,
      legPhase: 0,
      tilt: 0,
      idle: 0,
      dizzy: 0,
      blink: 2 + Math.random() * 3,
      state: "idle" as State,
    };

    const mouse = { x: width / 2, y: height / 2, seen: false };
    /** Recent horizontal directions, for detecting a shaken cursor. */
    let flips: number[] = [];
    let lastDir = 0;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - mouse.x;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.seen = true;

      if (Math.abs(dx) > 6) {
        const dir = Math.sign(dx);
        if (lastDir && dir !== lastDir) flips.push(performance.now());
        lastDir = dir;
      }
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // --- decide what it is doing -----------------------------------
      const cutoff = now - 700;
      flips = flips.filter((t) => t > cutoff);
      if (flips.length >= 5 && pet.dizzy <= 0) {
        pet.dizzy = 2.4;
        flips = [];
      }
      if (pet.dizzy > 0) pet.dizzy -= dt;

      const dx = mouse.x - pet.x;
      const dy = mouse.y - pet.y - 14;
      const dist = Math.hypot(dx, dy);

      if (pet.dizzy > 0) {
        pet.state = "dizzy";
        pet.vx *= 0.9;
        pet.vy *= 0.9;
        pet.tilt = Math.sin(now / 90) * 0.28;
      } else if (dist > 58 && mouse.seen) {
        pet.idle = 0;
        // Speed scales with how far it has been left behind.
        const speed = Math.min(dist * 2.4, 430);
        pet.vx += ((dx / dist) * speed - pet.vx) * Math.min(dt * 7, 1);
        pet.vy += ((dy / dist) * speed - pet.vy) * Math.min(dt * 7, 1);
        pet.state = speed > 195 ? "run" : "walk";
        if (Math.abs(pet.vx) > 8) pet.facing = Math.sign(pet.vx);
        pet.tilt = (pet.vx / 900) * (pet.state === "run" ? 1.6 : 1);
      } else {
        pet.vx *= 0.86;
        pet.vy *= 0.86;
        pet.idle += dt;
        pet.tilt += (0 - pet.tilt) * Math.min(dt * 6, 1);
        pet.state = pet.idle > 8 ? "sleep" : pet.idle > 2.2 ? "sit" : "idle";
      }

      pet.x += pet.vx * dt;
      pet.y += pet.vy * dt;
      pet.x = Math.max(30, Math.min(width - 30, pet.x));
      pet.y = Math.max(34, Math.min(height - 24, pet.y));

      const moving = pet.state === "walk" || pet.state === "run";
      pet.legPhase += moving ? dt * (pet.state === "run" ? 21 : 11) : 0;

      pet.blink -= dt;
      if (pet.blink < -0.13) pet.blink = 2.5 + Math.random() * 3.5;

      // --- draw -------------------------------------------------------
      ctx.clearRect(0, 0, width, height);
      draw(ctx, pet, mouse, now);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(120% 90% at 50% 30%, #f4eee2, #e4dbcb 75%)",
        cursor: "crosshair",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

type Pet = {
  x: number;
  y: number;
  vx: number;
  facing: number;
  legPhase: number;
  tilt: number;
  blink: number;
  state: State;
};

const INK = "#2b241d";

function draw(
  ctx: CanvasRenderingContext2D,
  pet: Pet,
  mouse: { x: number; y: number },
  now: number,
) {
  const moving = pet.state === "walk" || pet.state === "run";
  const sitting = pet.state === "sit" || pet.state === "sleep";
  const speed = Math.abs(pet.vx);

  // squash and stretch, so running reads as effort
  const stretch = 1 + Math.min(speed / 1400, 0.22);
  const squash = 1 / stretch;
  const breathe = pet.state === "sleep" ? Math.sin(now / 700) * 0.035 : 0;
  const drop = sitting ? 5 : 0;

  ctx.save();
  ctx.translate(pet.x, pet.y);

  // contact shadow
  ctx.fillStyle = "rgba(50, 40, 30, 0.12)";
  ctx.beginPath();
  ctx.ellipse(0, 22, 21 - drop * 0.5, 4.5, 0, 0, TAU);
  ctx.fill();

  ctx.rotate(pet.tilt);
  ctx.scale(pet.facing * stretch, squash * (1 + breathe));
  ctx.translate(0, drop);

  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // feet — alternating when moving, tucked forward when sitting
  const lift = moving ? Math.sin(pet.legPhase) * 4 : 0;
  for (const [i, sign] of [-1, 1].entries()) {
    const fy = moving ? (i === 0 ? lift : -lift) : 0;
    ctx.beginPath();
    ctx.ellipse(sign * 7, 17 - Math.abs(fy) + (sitting ? 2 : 0), 5.5, 4, 0, 0, TAU);
    ctx.fill();
  }

  // tail
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-15, 6);
  const wag = moving ? Math.sin(pet.legPhase * 0.9) * 6 : Math.sin(now / 900) * 2.5;
  ctx.quadraticCurveTo(-26, 2 + wag, -24, -8 + wag);
  ctx.stroke();

  // ears
  ctx.beginPath();
  ctx.moveTo(-9, -13);
  ctx.lineTo(-13, -25);
  ctx.lineTo(-3, -17);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, -13);
  ctx.lineTo(12, -25);
  ctx.lineTo(2, -17);
  ctx.closePath();
  ctx.fill();

  // body
  ctx.beginPath();
  ctx.ellipse(0, 2, 19, 16, 0, 0, TAU);
  ctx.fill();

  // face
  ctx.save();
  ctx.scale(pet.facing, 1); // keep eyes readable regardless of facing
  const look = Math.max(-1.6, Math.min(1.6, (mouse.x - pet.x) / 90));
  const lookY = Math.max(-1.2, Math.min(1.2, (mouse.y - pet.y) / 90));

  if (pet.state === "sleep") {
    ctx.strokeStyle = "#f4eee2";
    ctx.lineWidth = 1.6;
    for (const ex of [-6.5, 6.5]) {
      ctx.beginPath();
      ctx.arc(ex * pet.facing, -1, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  } else if (pet.state === "dizzy") {
    ctx.strokeStyle = "#f4eee2";
    ctx.lineWidth = 1.4;
    for (const ex of [-6.5, 6.5]) {
      ctx.beginPath();
      for (let a = 0; a < TAU * 1.6; a += 0.25) {
        const r = a * 0.62;
        const px = ex * pet.facing + Math.cos(a + now / 140) * r;
        const py = -1 + Math.sin(a + now / 140) * r;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  } else if (pet.blink < 0) {
    ctx.strokeStyle = "#f4eee2";
    ctx.lineWidth = 1.6;
    for (const ex of [-6.5, 6.5]) {
      ctx.beginPath();
      ctx.moveTo(ex * pet.facing - 2.6, -1);
      ctx.lineTo(ex * pet.facing + 2.6, -1);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#f4eee2";
    for (const ex of [-6.5, 6.5]) {
      ctx.beginPath();
      ctx.arc(ex * pet.facing, -1, 3.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = INK;
    for (const ex of [-6.5, 6.5]) {
      ctx.beginPath();
      ctx.arc(ex * pet.facing + look, -1 + lookY, 1.7, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.restore();

  // floating extras drawn upright, outside the body transform
  if (pet.state === "sleep") {
    ctx.fillStyle = "rgba(43, 36, 29, 0.55)";
    ctx.font = "600 13px ui-monospace, monospace";
    for (let i = 0; i < 3; i++) {
      const p = ((now / 1900 + i * 0.33) % 1);
      ctx.globalAlpha = 0.55 * (1 - p);
      ctx.fillText("z", pet.x + 16 + p * 16, pet.y - 22 - p * 30);
    }
    ctx.globalAlpha = 1;
  }

  if (pet.state === "dizzy") {
    ctx.fillStyle = "rgba(43, 36, 29, 0.6)";
    for (let i = 0; i < 3; i++) {
      const a = now / 260 + (i * TAU) / 3;
      ctx.beginPath();
      ctx.arc(pet.x + Math.cos(a) * 20, pet.y - 30 + Math.sin(a) * 6, 2, 0, TAU);
      ctx.fill();
    }
  }
}
