"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BOWL, HEART, PALETTE, SIT, SIT_EYES, SLEEP_CURL, STRETCH, WALK_A, WALK_B } from "./cat";
import { closeAudio, lap, purr } from "@/lib/audio";
import s from "./pet.module.css";

const TAU = Math.PI * 2;
const PX = 5; // sprite pixel size

type State = "walk" | "run" | "idle" | "sit" | "sleep" | "dizzy" | "pet" | "drink" | "stretch";
type Task = null | "water" | "sleep";

interface Heart {
  x: number;
  y: number;
  life: number;
}

interface Pet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  step: number;
  idle: number;
  dizzy: number;
  blink: number;
  petting: number;
  drinking: number;
  stretching: number;
  /** How loved it feels. Grows with attention, and it stays closer. */
  love: number;
  state: State;
}

const HALF_W = (SIT[0].length * PX) / 2;
const FULL_H = SIT.length * PX;

/**
 * 002 — CURSOR PET
 *
 * A cat that lives on the page. It reads your cursor as intent: drift and
 * it strolls after you, dash and it runs, scribble and it gets dizzy,
 * leave it be and it sits, then sleeps.
 *
 * You can also just look after it — stroke it, put water down, tell it to
 * nap or stretch. The more you fuss over it the closer it stays, which is
 * the only reward on offer and the only one it needs.
 */
export default function CursorPet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const petRef = useRef<Pet | null>(null);
  const bowlRef = useRef<{ x: number; y: number; left: number } | null>(null);
  const heartsRef = useRef<Heart[]>([]);
  const taskRef = useRef<Task>(null);

  const [task, setTask] = useState<Task>(null);
  const [love, setLove] = useState(0);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  /** Stroke it — hearts, a purr, and it settles wherever it is. */
  const stroke = useCallback((x?: number, y?: number) => {
    const pet = petRef.current;
    if (!pet) return;
    pet.petting = 1.9;
    pet.idle = 0;
    pet.dizzy = 0;
    pet.love = Math.min(1, pet.love + 0.09);
    setLove(pet.love);
    purr(1.8);
    for (let i = 0; i < 3; i++) {
      heartsRef.current.push({
        x: (x ?? pet.x) + (Math.random() - 0.5) * 44,
        y: (y ?? pet.y) - FULL_H - 6 - Math.random() * 14,
        life: 1,
      });
    }
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
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener("resize", resize);

    const pet: Pet = {
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      facing: 1,
      step: 0,
      idle: 0,
      dizzy: 0,
      blink: 2 + Math.random() * 3,
      petting: 0,
      drinking: 0,
      stretching: 0,
      love: 0,
      state: "sit",
    };
    petRef.current = pet;

    const mouse = { x: width / 2, y: height / 2, seen: false };
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
    let lapAt = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const bowl = bowlRef.current;

      flips = flips.filter((t) => t > now - 700);
      if (flips.length >= 5 && pet.dizzy <= 0 && pet.petting <= 0) {
        pet.dizzy = 2.4;
        flips = [];
      }
      if (pet.dizzy > 0) pet.dizzy -= dt;
      if (pet.petting > 0) pet.petting -= dt;
      if (pet.stretching > 0) pet.stretching -= dt;
      if (pet.drinking > 0) pet.drinking -= dt;

      // affection fades slowly if you ignore it
      pet.love = Math.max(0, pet.love - dt * 0.004);

      // deliberate tasks win over instinct
      if (pet.petting > 0) {
        pet.state = "pet";
        pet.vx *= 0.75;
        pet.vy *= 0.75;
      } else if (pet.stretching > 0) {
        pet.state = "stretch";
        pet.vx *= 0.75;
        pet.vy *= 0.75;
      } else if (pet.drinking > 0) {
        pet.state = "drink";
        pet.vx *= 0.8;
        pet.vy *= 0.8;
        if (now - lapAt > 480) {
          lapAt = now;
          lap();
          if (bowl) bowl.left = Math.max(0, bowl.left - 0.13);
        }
      } else if (taskRef.current === "water" && bowl && bowl.left > 0) {
        // head for the bowl instead of the cursor
        const dx = bowl.x - pet.x;
        const dy = bowl.y - 12 - pet.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 36) {
          pet.drinking = 4.2;
          if (dx !== 0) pet.facing = Math.sign(dx);
        } else {
          const speed = Math.min(dist * 2.4, 300);
          pet.vx += ((dx / dist) * speed - pet.vx) * Math.min(dt * 7, 1);
          pet.vy += ((dy / dist) * speed - pet.vy) * Math.min(dt * 7, 1);
          pet.state = "walk";
          if (Math.abs(pet.vx) > 8) pet.facing = Math.sign(pet.vx);
        }
      } else if (taskRef.current === "sleep") {
        pet.vx *= 0.8;
        pet.vy *= 0.8;
        pet.state = "sleep";
      } else if (pet.dizzy > 0) {
        pet.state = "dizzy";
        pet.vx *= 0.9;
        pet.vy *= 0.9;
      } else {
        // a well-loved cat keeps closer company
        const near = 66 - pet.love * 30;
        const dx = mouse.x - pet.x;
        const dy = mouse.y - pet.y;
        const dist = Math.hypot(dx, dy);

        if (dist > near && mouse.seen) {
          pet.idle = 0;
          const speed = Math.min(dist * 2.3, 430);
          pet.vx += ((dx / dist) * speed - pet.vx) * Math.min(dt * 7, 1);
          pet.vy += ((dy / dist) * speed - pet.vy) * Math.min(dt * 7, 1);
          pet.state = speed > 200 ? "run" : "walk";
          if (Math.abs(pet.vx) > 8) pet.facing = Math.sign(pet.vx);
        } else {
          pet.vx *= 0.84;
          pet.vy *= 0.84;
          pet.idle += dt;
          pet.state = pet.idle > 8 ? "sleep" : pet.idle > 2.2 ? "sit" : "idle";
        }
      }

      pet.x += pet.vx * dt;
      pet.y += pet.vy * dt;
      pet.x = Math.max(40, Math.min(width - 40, pet.x));
      pet.y = Math.max(50, Math.min(height - 30, pet.y));

      const moving = pet.state === "walk" || pet.state === "run";
      if (moving) pet.step += dt * (pet.state === "run" ? 15 : 8);

      pet.blink -= dt;
      if (pet.blink < -0.13) pet.blink = 2.5 + Math.random() * 3.5;

      for (const h of heartsRef.current) {
        h.life -= dt * 0.75;
        h.y -= dt * 26;
      }
      heartsRef.current = heartsRef.current.filter((h) => h.life > 0);

      ctx.clearRect(0, 0, width, height);
      if (bowl && bowl.left > 0) blitAt(ctx, BOWL, bowl.x, bowl.y);
      draw(ctx, pet, mouse, now);
      for (const h of heartsRef.current) {
        ctx.globalAlpha = Math.min(1, h.life);
        blitAt(ctx, HEART, h.x, h.y);
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      petRef.current = null;
      closeAudio();
    };
  }, []);

  /** Clicking the cat itself is the same as stroking it. */
  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pet = petRef.current;
      if (!pet) return;
      const near = Math.hypot(e.clientX - pet.x, e.clientY - pet.y + FULL_H / 2) < HALF_W + 30;
      if (near) {
        setTask(null);
        stroke(e.clientX, e.clientY);
      }
    },
    [stroke],
  );

  const water = useCallback(() => {
    const pet = petRef.current;
    if (!pet) return;
    // put the bowl down somewhere it has to walk to
    bowlRef.current = {
      x: Math.max(90, Math.min(window.innerWidth - 90, pet.x + (pet.facing > 0 ? -240 : 240))),
      y: Math.min(window.innerHeight - 70, pet.y + 40),
      left: 1,
    };
    pet.petting = 0;
    setTask("water");
  }, []);

  const nap = useCallback(() => {
    const pet = petRef.current;
    if (pet) pet.petting = 0;
    setTask((t) => (t === "sleep" ? null : "sleep"));
  }, []);

  const doStretch = useCallback(() => {
    const pet = petRef.current;
    if (!pet) return;
    setTask(null);
    pet.petting = 0;
    pet.stretching = 1.7;
  }, []);

  // the bowl empties, and then it goes back to following you
  useEffect(() => {
    if (task !== "water") return;
    const timer = window.setInterval(() => {
      if (bowlRef.current && bowlRef.current.left <= 0) {
        setTask(null);
        window.setTimeout(() => {
          bowlRef.current = null;
        }, 1500);
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, [task]);

  return (
    <div className={s.stage}>
      <canvas ref={canvasRef} className={s.canvas} onPointerDown={onCanvasPointerDown} />

      <span className={s.love} style={{ opacity: love > 0.02 ? 1 : 0 }}>
        <span className={s.loveFill}>{"♥".repeat(Math.max(1, Math.round(love * 5)))}</span>
      </span>

      <div className={s.controls}>
        <button className={s.button} onClick={() => stroke()}>
          Pet
        </button>
        <button className={s.button} data-active={task === "water"} onClick={water}>
          Water
        </button>
        <button className={s.button} data-active={task === "sleep"} onClick={nap}>
          Sleep
        </button>
        <button className={s.button} onClick={doStretch}>
          Stretch
        </button>
      </div>
    </div>
  );
}

/** Paint a sprite grid centred on (0,0) at its feet. */
function blit(ctx: CanvasRenderingContext2D, rows: string[]) {
  const ox = -(rows[0].length * PX) / 2;
  const oy = -(rows.length * PX);
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === ".") continue;
      ctx.fillStyle = PALETTE[ch];
      ctx.fillRect(ox + c * PX, oy + r * PX, PX, PX);
    }
  }
}

function blitAt(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  blit(ctx, rows);
  ctx.restore();
}

function draw(
  ctx: CanvasRenderingContext2D,
  pet: Pet,
  mouse: { x: number; y: number },
  now: number,
) {
  const moving = pet.state === "walk" || pet.state === "run";
  const curled = pet.state === "sleep";
  const stretching = pet.state === "stretch";
  const drinking = pet.state === "drink";
  const sideways = moving || stretching || drinking;

  const rows = curled
    ? SLEEP_CURL
    : stretching
      ? STRETCH
      : drinking
        ? WALK_A
        : moving
          ? Math.floor(pet.step) % 2
            ? WALK_B
            : WALK_A
          : SIT;

  ctx.save();
  ctx.translate(Math.round(pet.x), Math.round(pet.y));

  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 2, sideways || curled ? 32 : 26, 5, 0, 0, TAU);
  ctx.fill();

  if (pet.state === "dizzy") ctx.rotate(Math.sin(now / 95) * 0.12);
  if (pet.state === "run") ctx.rotate(pet.facing * 0.07);
  if (moving) ctx.translate(0, -Math.round(Math.abs(Math.sin(pet.step * Math.PI)) * 2));
  if (curled) ctx.translate(0, Math.round(Math.sin(now / 800) * 1.5));
  if (pet.state === "pet") ctx.translate(0, Math.round(Math.sin(now / 150) * 1.5));
  // head dips to the bowl, and bobs while it laps
  if (drinking) {
    ctx.rotate(pet.facing * 0.2);
    ctx.translate(0, Math.round(Math.abs(Math.sin(now / 240)) * 3));
  }

  if (sideways || curled) ctx.scale(pet.facing, 1);
  blit(ctx, rows);

  if (rows === SIT) {
    const ox = -(SIT[0].length * PX) / 2;
    const oy = -(SIT.length * PX);
    const socket = (c: number, r: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(ox + c * PX, oy + r * PX, PX * 2, PX * 2);
    };

    if (pet.state === "pet") {
      // eyes squeezed shut, thoroughly pleased
      for (const [c, r] of SIT_EYES) {
        socket(c, r, PALETTE.d);
        ctx.fillStyle = PALETTE.k;
        ctx.fillRect(ox + c * PX, oy + r * PX, PX, PX);
        ctx.fillRect(ox + (c + 1) * PX, oy + (r + 1) * PX, PX, PX);
      }
    } else if (pet.blink < 0) {
      for (const [c, r] of SIT_EYES) {
        socket(c, r, PALETTE.d);
        ctx.fillStyle = PALETTE.k;
        ctx.fillRect(ox + c * PX, oy + (r + 1) * PX, PX * 2, PX);
      }
    } else if (pet.state === "dizzy") {
      for (const [c, r] of SIT_EYES) {
        socket(c, r, PALETTE.e);
        ctx.fillStyle = PALETTE.k;
        ctx.fillRect(ox + c * PX, oy + r * PX, PX, PX);
        ctx.fillRect(ox + (c + 1) * PX, oy + (r + 1) * PX, PX, PX);
      }
    } else {
      const lx = (mouse.x - pet.x) / 120;
      const ly = (mouse.y - pet.y) / 200;
      for (const [c, r] of SIT_EYES) {
        socket(c, r, PALETTE.e);
        ctx.fillStyle = PALETTE.k;
        ctx.fillRect(ox + (c + (lx > 0.3 ? 1 : 0)) * PX, oy + (r + (ly > 0.3 ? 1 : 0)) * PX, PX, PX);
      }
    }
  }

  ctx.restore();

  if (curled) {
    ctx.fillStyle = "rgba(214, 209, 201, 0.5)";
    ctx.font = "600 13px ui-monospace, monospace";
    for (let i = 0; i < 3; i++) {
      const p = (now / 1900 + i * 0.33) % 1;
      ctx.globalAlpha = 0.5 * (1 - p);
      ctx.fillText("z", pet.x + 30 + p * 16, pet.y - 60 - p * 30);
    }
    ctx.globalAlpha = 1;
  }

  if (pet.state === "dizzy") {
    ctx.fillStyle = "rgba(201, 135, 92, 0.75)";
    for (let i = 0; i < 3; i++) {
      const a = now / 260 + (i * TAU) / 3;
      ctx.fillRect(pet.x + Math.cos(a) * 22 - 2, pet.y - 108 + Math.sin(a) * 6 - 2, 4, 4);
    }
  }
}
