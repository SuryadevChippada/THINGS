"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import s from "./bananas.module.css";

type Dir = "down" | "up" | "left" | "right";
const GRAVITY: Record<Dir, [number, number]> = {
  down: [0, 1],
  up: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * 049 — BANANA PHYSICS
 *
 * Bananas. As many as you like. Throw them, stack them, tie them together
 * with springs, and turn gravity sideways to ruin all of it.
 *
 * A banana is a bad shape for a physics engine — it will not stack, it
 * rolls off everything, and a chain of them behaves like a rope having an
 * argument. That is the reason it is bananas.
 */
export default function BananaPhysics() {
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bananasRef = useRef<Matter.Body[]>([]);

  const [count, setCount] = useState(0);
  const [dir, setDir] = useState<Dir>("down");

  /** A banana, as three overlapping parts — which is why it won't stack. */
  const makeBanana = useCallback((x: number, y: number) => {
    const parts = [
      Matter.Bodies.rectangle(x - 16, y - 6, 22, 13, { chamfer: { radius: 6 } }),
      Matter.Bodies.rectangle(x, y + 4, 26, 13, { chamfer: { radius: 6 } }),
      Matter.Bodies.rectangle(x + 16, y - 6, 22, 13, { chamfer: { radius: 6 } }),
    ];
    const banana = Matter.Body.create({
      parts,
      restitution: 0.36,
      friction: 0.28,
      frictionAir: 0.01,
    });
    Matter.Body.setAngle(banana, Math.random() * Math.PI);
    Matter.Body.setAngularVelocity(banana, (Math.random() - 0.5) * 0.2);
    return banana;
  }, []);

  const spawn = useCallback(
    (x?: number, y?: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      const banana = makeBanana(
        x ?? window.innerWidth / 2 + (Math.random() - 0.5) * 200,
        y ?? 90,
      );
      Matter.Composite.add(engine.world, banana);
      bananasRef.current.push(banana);
      setCount(bananasRef.current.length);
    },
    [makeBanana],
  );

  /** Tie every banana to the next one, which never ends well. */
  const chain = useCallback(() => {
    const engine = engineRef.current;
    const list = bananasRef.current;
    if (!engine || list.length < 2) return;
    for (let i = 0; i < list.length - 1; i++) {
      Matter.Composite.add(
        engine.world,
        Matter.Constraint.create({
          bodyA: list[i],
          bodyB: list[i + 1],
          length: 70,
          stiffness: 0.02,
          damping: 0.06,
        }),
      );
    }
  }, []);

  const clear = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    Matter.Composite.clear(engine.world, false);
    bananasRef.current = [];
    setCount(0);
    // put the walls back
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const T = 400;
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(vw / 2, vh + T / 2, vw * 3, T, { isStatic: true }),
      Matter.Bodies.rectangle(vw / 2, -T / 2, vw * 3, T, { isStatic: true }),
      Matter.Bodies.rectangle(-T / 2, vh / 2, T, vh * 3, { isStatic: true }),
      Matter.Bodies.rectangle(vw + T / 2, vh / 2, T, vh * 3, { isStatic: true }),
    ]);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const engine = Matter.Engine.create();
    engine.gravity.y = 1;
    engineRef.current = engine;

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

    const T = 400;
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(width / 2, height + T / 2, width * 3, T, { isStatic: true }),
      Matter.Bodies.rectangle(width / 2, -T / 2, width * 3, T, { isStatic: true }),
      Matter.Bodies.rectangle(-T / 2, height / 2, T, height * 3, { isStatic: true }),
      Matter.Bodies.rectangle(width + T / 2, height / 2, T, height * 3, { isStatic: true }),
    ]);

    const mouse = Matter.Mouse.create(canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.14, damping: 0.05, render: { visible: false } },
    });
    Matter.Composite.add(engine.world, mouseConstraint);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(now - last, 32);
      last = now;
      Matter.Engine.update(engine, dt);

      ctx.clearRect(0, 0, width, height);

      // the constraints, drawn behind
      ctx.strokeStyle = "rgba(214,209,201,0.18)";
      ctx.lineWidth = 1;
      for (const c of Matter.Composite.allConstraints(engine.world)) {
        if (!c.bodyA || !c.bodyB) continue;
        ctx.beginPath();
        ctx.moveTo(c.bodyA.position.x, c.bodyA.position.y);
        ctx.lineTo(c.bodyB.position.x, c.bodyB.position.y);
        ctx.stroke();
      }

      for (const banana of bananasRef.current) {
        ctx.save();
        ctx.translate(banana.position.x, banana.position.y);
        ctx.rotate(banana.angle);

        ctx.fillStyle = "#e6c34a";
        ctx.beginPath();
        ctx.moveTo(-30, -4);
        ctx.quadraticCurveTo(0, 22, 30, -4);
        ctx.quadraticCurveTo(0, 12, -30, -4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#5d4a1f";
        ctx.fillRect(-33, -7, 6, 6);
        ctx.fillRect(28, -7, 6, 6);
        ctx.restore();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
      Matter.Mouse.clearSourceEvents(mouse);
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const [gx, gy] = GRAVITY[dir];
    engine.gravity.x = gx;
    engine.gravity.y = gy;
  }, [dir]);

  return (
    <div className={s.stage} ref={stageRef}>
      <canvas
        ref={canvasRef}
        className={s.canvas}
        onDoubleClick={(e) => spawn(e.clientX, e.clientY)}
      />

      <div className={s.controls}>
        <button className={s.button} onClick={() => spawn()}>
          banana
        </button>
        <button
          className={s.button}
          onClick={() => {
            for (let i = 0; i < 12; i++) spawn();
          }}
        >
          twelve
        </button>
        <button className={s.button} onClick={chain} disabled={count < 2}>
          tie together
        </button>
        <div className={s.row}>
          {(Object.keys(GRAVITY) as Dir[]).map((d) => (
            <button
              key={d}
              className={`${s.chip} ${dir === d ? s.chipOn : ""}`}
              onClick={() => setDir(d)}
            >
              {d === "down" ? "↓" : d === "up" ? "↑" : d === "left" ? "←" : "→"}
            </button>
          ))}
        </div>
        <button className={s.button} onClick={clear}>
          clear
        </button>
        <span className={s.count}>{count}</span>
      </div>
    </div>
  );
}
