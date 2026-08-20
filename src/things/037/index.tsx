"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./civ.module.css";

const TAU = Math.PI * 2;
const STORAGE = "things:037:world";
const W = 160;
const H = 100;
const CELL = 6;

interface Person {
  x: number;
  y: number;
  tx: number;
  ty: number;
  age: number;
  home: number;
}

interface World {
  /** Trodden-ness per cell. Paths are just where people keep walking. */
  wear: number[];
  houses: { x: number; y: number; age: number }[];
  people: Person[];
  year: number;
}

function blank(): World {
  return {
    wear: new Array(W * H).fill(0),
    houses: [],
    people: [
      { x: W / 2 - 3, y: H / 2, tx: W / 2 - 3, ty: H / 2, age: 0, home: -1 },
      { x: W / 2 + 3, y: H / 2, tx: W / 2 + 3, ty: H / 2, age: 0, home: -1 },
    ],
    year: 0,
  };
}

/**
 * 037 — TINY CIVILIZATION
 *
 * Two people. Leave them alone and see what happens.
 *
 * There is no planner here and no agent doing any thinking. Everyone
 * walks to somewhere they want to be, and walking wears the ground down;
 * worn ground is easier to walk on, so people use it more, so it wears
 * further. The paths between the houses aren't designed — they are just
 * where everyone kept going.
 *
 * It keeps its world in this browser, so it is still going when you
 * come back.
 */
export default function TinyCivilization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>(blank());
  const [stats, setStats] = useState({ people: 2, houses: 0, year: 0 });

  const save = useCallback(() => {
    const w = worldRef.current;
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({
          wear: w.wear.map((v) => Math.round(v * 100) / 100),
          houses: w.houses,
          people: w.people,
          year: w.year,
        }),
      );
    } catch {
      // a full quota is not worth a crash
    }
  }, []);

  const reset = useCallback(() => {
    worldRef.current = blank();
    localStorage.removeItem(STORAGE);
    setStats({ people: 2, houses: 0, year: 0 });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as World;
        if (parsed.wear?.length === W * H) worldRef.current = parsed;
      } catch {
        // start again rather than argue with it
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W * CELL;
    canvas.height = H * CELL;

    let raf = 0;
    let last = performance.now();
    let sinceSave = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const world = worldRef.current;
      world.year += dt * 0.4;
      sinceSave += dt;

      for (const p of world.people) {
        p.age += dt;

        // pick somewhere to be: home, a neighbour, or nowhere in particular
        if (Math.hypot(p.tx - p.x, p.ty - p.y) < 1.2) {
          const roll = Math.random();
          if (world.houses.length && roll < 0.6) {
            const h = world.houses[Math.floor(Math.random() * world.houses.length)];
            p.tx = h.x + (Math.random() - 0.5) * 4;
            p.ty = h.y + (Math.random() - 0.5) * 4;
          } else {
            p.tx = Math.max(4, Math.min(W - 4, p.x + (Math.random() - 0.5) * 40));
            p.ty = Math.max(4, Math.min(H - 4, p.y + (Math.random() - 0.5) * 30));
          }
        }

        // walk, and prefer ground that is already worn
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        let stepX = dx / dist;
        let stepY = dy / dist;

        const look = (ox: number, oy: number) => {
          const gx = Math.round(p.x + ox);
          const gy = Math.round(p.y + oy);
          if (gx < 0 || gx >= W || gy < 0 || gy >= H) return 0;
          return world.wear[gy * W + gx];
        };
        const straight = look(stepX * 2, stepY * 2);
        const leftward = look(-stepY * 2, stepX * 2);
        const rightward = look(stepY * 2, -stepX * 2);
        // rotate toward the worn side — via temporaries, or the second
        // line would use the already-rotated first one
        if (leftward > straight + 0.15) {
          const rx = stepX * 0.7 - stepY * 0.7;
          const ry = stepY * 0.7 + stepX * 0.7;
          stepX = rx;
          stepY = ry;
        } else if (rightward > straight + 0.15) {
          const rx = stepX * 0.7 + stepY * 0.7;
          const ry = stepY * 0.7 - stepX * 0.7;
          stepX = rx;
          stepY = ry;
        }

        const speed = 7 * dt;
        p.x = Math.max(2, Math.min(W - 2, p.x + stepX * speed));
        p.y = Math.max(2, Math.min(H - 2, p.y + stepY * speed));

        // walking wears the ground
        const gi = Math.round(p.y) * W + Math.round(p.x);
        world.wear[gi] = Math.min(1, world.wear[gi] + dt * 0.55);
      }

      // grass grows back where nobody goes
      if (Math.random() < 0.3) {
        for (let i = 0; i < 240; i++) {
          const k = Math.floor(Math.random() * world.wear.length);
          world.wear[k] = Math.max(0, world.wear[k] - 0.004);
        }
      }

      // once somewhere is well trodden, somebody builds on it
      if (world.houses.length < 40 && Math.random() < 0.02) {
        const p = world.people[Math.floor(Math.random() * world.people.length)];
        const gx = Math.round(p.x);
        const gy = Math.round(p.y);
        const worn = world.wear[gy * W + gx];
        const clear = world.houses.every((h) => Math.hypot(h.x - gx, h.y - gy) > 7);
        if (worn > 0.55 && clear) {
          world.houses.push({ x: gx, y: gy, age: 0 });
        }
      }

      // and where there are houses, there are eventually more people
      if (world.people.length < 60 && world.houses.length > 0 && Math.random() < 0.006) {
        const h = world.houses[Math.floor(Math.random() * world.houses.length)];
        world.people.push({ x: h.x, y: h.y, tx: h.x, ty: h.y, age: 0, home: 0 });
      }

      for (const h of world.houses) h.age += dt;

      // --- draw ----------------------------------------------------
      ctx.fillStyle = "#171a15";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const wear = world.wear[y * W + x];
          if (wear < 0.04) continue;
          const v = Math.min(1, wear);
          ctx.fillStyle = `rgba(${120 + v * 60}, ${104 + v * 40}, ${78 + v * 20}, ${v * 0.75})`;
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }

      for (const h of world.houses) {
        const grown = Math.min(1, h.age / 6);
        const size = CELL * (1.6 + grown * 1.2);
        ctx.fillStyle = "#8a6a4a";
        ctx.fillRect(h.x * CELL - size / 2, h.y * CELL - size / 2, size, size);
        ctx.fillStyle = "#c98a5c";
        ctx.fillRect(h.x * CELL - size / 2, h.y * CELL - size / 2, size, size * 0.36);
      }

      ctx.fillStyle = "#e8e2d6";
      for (const p of world.people) {
        ctx.beginPath();
        ctx.arc(p.x * CELL, p.y * CELL, 2.1, 0, TAU);
        ctx.fill();
      }

      if (sinceSave > 5) {
        sinceSave = 0;
        save();
        setStats({
          people: world.people.length,
          houses: world.houses.length,
          year: Math.floor(world.year),
        });
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onHide = () => save();
    window.addEventListener("pagehide", onHide);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pagehide", onHide);
      save();
    };
  }, [save]);

  return (
    <div className={s.stage}>
      <canvas ref={canvasRef} className={s.world} />
      <div className={s.hud}>
        <span>
          year {stats.year} · {stats.people} people · {stats.houses} houses
        </span>
        <button className={s.button} onClick={reset}>
          start again
        </button>
      </div>
    </div>
  );
}
