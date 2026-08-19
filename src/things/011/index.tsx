"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import s from "./words.module.css";

/**
 * 011 — FALLING WORDS
 *
 * Type a sentence and press enter. The words stop being text and start
 * being objects: they drop out of the field, land on whatever you said
 * before, and pile up. You can pick any of them back up and throw it.
 *
 * The words are real DOM nodes driven by the physics, so they stay
 * properly typeset all the way down.
 */
export default function FallingWords() {
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const pairsRef = useRef<{ body: Matter.Body; el: HTMLElement; w: number; h: number }[]>([]);
  const [text, setText] = useState("");
  const [count, setCount] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const engine = Matter.Engine.create();
    engine.gravity.y = 1.15;
    engineRef.current = engine;

    const T = 400;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const wall = (x: number, y: number, w: number, h: number) =>
      Matter.Bodies.rectangle(x, y, w, h, { isStatic: true });
    Matter.Composite.add(engine.world, [
      wall(vw / 2, vh + T / 2 - 4, vw * 3, T),
      wall(-T / 2, vh / 2, T, vh * 4),
      wall(vw + T / 2, vh / 2, T, vh * 4),
    ]);

    const mouse = Matter.Mouse.create(stage);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, damping: 0.06, render: { visible: false } },
    });
    Matter.Composite.add(engine.world, mouseConstraint);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 32);
      last = now;
      Matter.Engine.update(engine, dt);
      for (const { body, el, w, h } of pairsRef.current) {
        el.style.transform =
          `translate(${body.position.x - w / 2}px, ${body.position.y - h / 2}px) ` +
          `rotate(${body.angle}rad)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
      Matter.Mouse.clearSourceEvents(mouse);
      pairsRef.current.forEach(({ el }) => el.remove());
      pairsRef.current = [];
      engineRef.current = null;
    };
  }, []);

  const drop = useCallback(() => {
    const stage = stageRef.current;
    const engine = engineRef.current;
    if (!stage || !engine) return;
    const said = text.trim();
    if (!said) return;

    const parts = said.split(/\s+/);
    // measure each word by laying it out for a moment
    parts.forEach((word, i) => {
      const el = document.createElement("span");
      el.className = s.word;
      el.textContent = word;
      el.style.visibility = "hidden";
      stage.appendChild(el);
      const rect = el.getBoundingClientRect();
      el.style.visibility = "";

      const x = window.innerWidth / 2 + (i - parts.length / 2) * (rect.width + 14);
      const y = -40 - Math.random() * 120;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;

      const body = Matter.Bodies.rectangle(x, y, rect.width, rect.height, {
        restitution: 0.32,
        friction: 0.5,
        frictionAir: 0.006,
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.1);
      Matter.Composite.add(engine.world, body);
      pairsRef.current.push({ body, el, w: rect.width, h: rect.height });
    });

    setCount((c) => c + parts.length);
    setText("");
  }, [text]);

  const clear = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    pairsRef.current.forEach(({ body, el }) => {
      Matter.Composite.remove(engine.world, body);
      el.remove();
    });
    pairsRef.current = [];
    setCount(0);
  }, []);

  return (
    <div className={s.stage} ref={stageRef}>
      <div className={s.field}>
        <input
          className={s.input}
          value={text}
          placeholder="say something"
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") drop();
          }}
        />
        {count > 0 ? (
          <button className={s.clear} onClick={clear}>
            Sweep up
          </button>
        ) : null}
      </div>
    </div>
  );
}
