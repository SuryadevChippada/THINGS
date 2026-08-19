"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { click as thud, closeAudio } from "@/lib/audio";
import s from "./gravity.module.css";

const HEADLINE = "Everything is fine.";

const BODY_1 =
  "Nothing about this page is unusual. It has a heading, some body copy, a call to action, and a form nobody will ever fill in.";
const BODY_2 =
  "It was laid out very carefully. Every margin was argued over at length. Please do not press the button.";

type Phase = "intact" | "weightless" | "fallen";

/** Split into words so the copy comes apart properly, not as slabs. */
function words(text: string) {
  return text.split(" ");
}

/**
 * 004 — GRAVITY
 *
 * An ordinary, slightly boring website with one button on it.
 *
 * Press it and the page does what the button actually says: it stops
 * being held down. Every heading, link and individual word lets go of the
 * layout and drifts, and you can shove the whole paragraph around the
 * room. Turn gravity back on and it all comes down at once.
 *
 * The things you are throwing are the real DOM nodes, so it stays
 * unmistakably the page you were just reading.
 */
export default function Gravity() {
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    engine: Matter.Engine;
    stop: () => void;
  } | null>(null);
  const [phase, setPhase] = useState<Phase>("intact");

  const restore = useCallback(() => {
    sceneRef.current?.stop();
    sceneRef.current = null;
    setPhase("intact");
  }, []);

  const letGo = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || sceneRef.current) return;

    const parts = Array.from(stage.querySelectorAll<HTMLElement>("[data-part]"));
    if (!parts.length) return;

    // Measure everything before anything moves.
    const measured = parts.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, x: r.left, y: r.top, w: r.width, h: r.height };
    });

    const engine = Matter.Engine.create();
    engine.gravity.y = 0; // weightless, to begin with

    const bodies = measured.map(({ x, y, w, h }) =>
      Matter.Bodies.rectangle(x + w / 2, y + h / 2, w, h, {
        restitution: 0.6,
        friction: 0.3,
        frictionAir: 0.012,
      }),
    );

    // A gentle shove upward, as though the page has let go of itself.
    bodies.forEach((b) => {
      Matter.Body.setVelocity(b, {
        x: (Math.random() - 0.5) * 1.8,
        y: -0.6 - Math.random() * 1.4,
      });
      Matter.Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.05);
    });

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const T = 400;
    const wall = (x: number, y: number, w: number, h: number) =>
      Matter.Bodies.rectangle(x, y, w, h, { isStatic: true, restitution: 0.5 });
    const walls = [
      wall(vw / 2, vh + T / 2, vw * 3, T),
      wall(-T / 2, vh / 2, T, vh * 3),
      wall(vw + T / 2, vh / 2, T, vh * 3),
      wall(vw / 2, -T / 2, vw * 3, T),
    ];

    Matter.Composite.add(engine.world, [...bodies, ...walls]);

    // Grab and throw. The parts ignore pointers so events reach the stage
    // and Matter works out what is under the cursor.
    const mouse = Matter.Mouse.create(stage);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.18, damping: 0.05, render: { visible: false } },
    });
    Matter.Composite.add(engine.world, mouseConstraint);

    // Impacts, rate-limited so a pile-up doesn't turn into noise.
    let lastThud = 0;
    const onCollision = (e: Matter.IEventCollision<Matter.Engine>) => {
      const now = performance.now();
      if (now - lastThud < 45) return;
      for (const pair of e.pairs) {
        const speed = Math.max(pair.bodyA.speed, pair.bodyB.speed);
        if (speed < 3.2) continue;
        lastThud = now;
        thud({
          freq: 90 + Math.random() * 130,
          gain: Math.min(0.22, speed * 0.016),
          decay: 0.09,
          q: 0.7,
        });
        break;
      }
    };
    Matter.Events.on(engine, "collisionStart", onCollision);

    // Pin each node to the origin and drive it by transform.
    measured.forEach(({ el, x, y, w, h }) => {
      el.classList.add(s.loose);
      el.style.left = "0px";
      el.style.top = "0px";
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 32);
      last = now;
      Matter.Engine.update(engine, dt);
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const { el, w, h } = measured[i];
        el.style.transform =
          `translate(${b.position.x - w / 2}px, ${b.position.y - h / 2}px) ` +
          `rotate(${b.angle}rad)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    sceneRef.current = {
      engine,
      stop: () => {
        cancelAnimationFrame(raf);
        Matter.Events.off(engine, "collisionStart", onCollision);
        Matter.Composite.clear(engine.world, false);
        Matter.Engine.clear(engine);
        Matter.Mouse.clearSourceEvents(mouse);
        measured.forEach(({ el }) => {
          el.classList.remove(s.loose);
          el.style.left = "";
          el.style.top = "";
          el.style.width = "";
          el.style.height = "";
          el.style.transform = "";
        });
      },
    };

    setPhase("weightless");
  }, []);

  /** Turn it back on, and let the whole page find the floor at once. */
  const dropIt = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.engine.gravity.y = 1.2;
    for (const body of Matter.Composite.allBodies(scene.engine.world)) {
      if (body.isStatic) continue;
      body.frictionAir = 0.008;
      body.restitution = 0.32;
    }
    setPhase("fallen");
  }, []);

  useEffect(() => () => {
    sceneRef.current?.stop();
    closeAudio();
  }, []);

  return (
    <div className={s.stage} ref={stageRef}>
      <div className={s.bar}>
        <span className={s.logo} data-part>
          Northwind
        </span>
        <nav className={s.nav}>
          <span data-part>Product</span>
          <span data-part>Pricing</span>
          <span data-part>Docs</span>
          <span data-part>Contact</span>
        </nav>
      </div>

      <div className={s.page}>
        <h1 className={s.h1}>
          {words(HEADLINE).map((word, i) => (
            <span key={i} data-part>
              {word}
            </span>
          ))}
        </h1>

        <p className={s.p}>
          {words(BODY_1).map((word, i) => (
            <span key={i} data-part>
              {word}
            </span>
          ))}
        </p>
        <p className={s.p}>
          {words(BODY_2).map((word, i) => (
            <span key={i} data-part>
              {word}
            </span>
          ))}
        </p>

        <div className={s.actions}>
          <button className={s.primary} onClick={letGo} data-part>
            Disable gravity
          </button>
          <button className={s.secondary} data-part>
            Learn more
          </button>
        </div>

        <div className={s.field}>
          <span className={s.input} data-part>
            you@example.com
          </span>
          <button className={s.secondary} data-part>
            Subscribe
          </button>
        </div>

        <div className={s.notice} data-part>
          We use cookies to improve your experience.
        </div>
      </div>

      <div className={s.foot}>
        <span data-part>© 2025 Northwind</span>
        <span data-part>Privacy</span>
        <span data-part>Terms</span>
        <span data-part>Status</span>
      </div>

      {phase !== "intact" ? (
        <div className={s.controls}>
          {phase === "weightless" ? (
            <button className={s.restore} onClick={dropIt}>
              Enable gravity
            </button>
          ) : null}
          <button className={s.restore} onClick={restore}>
            Put it back
          </button>
        </div>
      ) : null}
    </div>
  );
}
