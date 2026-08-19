"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { click, closeAudio } from "@/lib/audio";
import s from "./maze.module.css";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Levels are laid out on a 0–1 grid so they fit any window. */
interface Level {
  name: string;
  start: Rect;
  goal: Rect;
  /** Walls are the gaps between these — the corridor is what's listed. */
  corridors: Rect[];
}

const LEVELS: Level[] = [
  {
    name: "warm up",
    start: { x: 0.06, y: 0.44, w: 0.1, h: 0.12 },
    goal: { x: 0.86, y: 0.44, w: 0.1, h: 0.12 },
    corridors: [{ x: 0.06, y: 0.455, w: 0.9, h: 0.09 }],
  },
  {
    name: "the corner",
    start: { x: 0.06, y: 0.76, w: 0.1, h: 0.12 },
    goal: { x: 0.86, y: 0.1, w: 0.1, h: 0.12 },
    corridors: [
      { x: 0.06, y: 0.79, w: 0.42, h: 0.07 },
      { x: 0.44, y: 0.14, w: 0.07, h: 0.72 },
      { x: 0.44, y: 0.14, w: 0.52, h: 0.07 },
    ],
  },
  {
    name: "the pinch",
    start: { x: 0.05, y: 0.44, w: 0.09, h: 0.12 },
    goal: { x: 0.87, y: 0.44, w: 0.09, h: 0.12 },
    corridors: [
      { x: 0.05, y: 0.46, w: 0.26, h: 0.08 },
      { x: 0.31, y: 0.485, w: 0.16, h: 0.03 },
      { x: 0.47, y: 0.42, w: 0.13, h: 0.16 },
      { x: 0.6, y: 0.487, w: 0.14, h: 0.026 },
      { x: 0.74, y: 0.46, w: 0.22, h: 0.08 },
    ],
  },
  {
    name: "the long way",
    start: { x: 0.05, y: 0.08, w: 0.09, h: 0.1 },
    goal: { x: 0.87, y: 0.82, w: 0.09, h: 0.1 },
    corridors: [
      { x: 0.05, y: 0.1, w: 0.9, h: 0.05 },
      { x: 0.9, y: 0.1, w: 0.05, h: 0.34 },
      { x: 0.1, y: 0.39, w: 0.85, h: 0.05 },
      { x: 0.1, y: 0.39, w: 0.05, h: 0.3 },
      { x: 0.1, y: 0.64, w: 0.86, h: 0.05 },
      { x: 0.91, y: 0.64, w: 0.05, h: 0.28 },
      { x: 0.85, y: 0.85, w: 0.11, h: 0.06 },
    ],
  },
];

const inside = (px: number, py: number, r: Rect, w: number, h: number) =>
  px >= r.x * w && px <= (r.x + r.w) * w && py >= r.y * h && py <= (r.y + r.h) * h;

/**
 * 014 — DON'T TOUCH THE WALLS
 *
 * Your cursor is the player. Get from one end to the other without
 * leaving the corridor. There is no forgiveness, no checkpoint and no
 * particular reward — the corridor just gets meaner.
 *
 * It only starts watching once you enter the opening pad, so nobody loses
 * before they have begun.
 */
export default function DontTouchTheWalls() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState(0);
  const [state, setState] = useState<"waiting" | "running" | "failed" | "won">("waiting");

  const spec = LEVELS[Math.min(level, LEVELS.length - 1)];

  const reset = useCallback(() => setState("waiting"), []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const px = e.clientX;
      const py = e.clientY;

      setState((current) => {
        if (current === "failed" || current === "won") return current;

        const onStart = inside(px, py, spec.start, w, h);
        const onGoal = inside(px, py, spec.goal, w, h);
        const onPath = spec.corridors.some((c) => inside(px, py, c, w, h));

        if (current === "waiting") return onStart ? "running" : "waiting";

        if (onGoal) {
          click({ freq: 900, gain: 0.2, decay: 0.12, q: 3 });
          return "won";
        }
        if (!onPath && !onStart) {
          click({ freq: 150, gain: 0.34, decay: 0.22, q: 0.6 });
          return "failed";
        }
        return "running";
      });
    };

    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      closeAudio();
    };
  }, [spec]);

  useEffect(() => closeAudio, []);

  const last = level >= LEVELS.length - 1;

  return (
    <div className={`${s.stage} ${state === "failed" ? s.shake : ""}`} ref={stageRef}>
      {/* the corridor is the safe part; everything else is wall */}
      {spec.corridors.map((c, i) => (
        <div
          key={i}
          className={s.corridor}
          style={{
            left: `${c.x * 100}%`,
            top: `${c.y * 100}%`,
            width: `${c.w * 100}%`,
            height: `${c.h * 100}%`,
          }}
        />
      ))}

      <div
        className={s.pad}
        style={{
          left: `${spec.start.x * 100}%`,
          top: `${spec.start.y * 100}%`,
          width: `${spec.start.w * 100}%`,
          height: `${spec.start.h * 100}%`,
        }}
      >
        start
      </div>

      <div
        className={`${s.pad} ${s.goal}`}
        style={{
          left: `${spec.goal.x * 100}%`,
          top: `${spec.goal.y * 100}%`,
          width: `${spec.goal.w * 100}%`,
          height: `${spec.goal.h * 100}%`,
        }}
      >
        end
      </div>

      <div className={s.hud}>
        <span className={s.level}>
          {String(level + 1).padStart(2, "0")} · {spec.name}
        </span>
      </div>

      {state === "failed" ? (
        <div className={s.overlay}>
          <p className={s.verdict}>you touched the wall</p>
          <button className={s.button} onClick={reset}>
            Again
          </button>
        </div>
      ) : null}

      {state === "won" ? (
        <div className={s.overlay}>
          <p className={s.verdict}>{last ? "that was all of them" : "clear"}</p>
          {last ? (
            <button
              className={s.button}
              onClick={() => {
                setLevel(0);
                setState("waiting");
              }}
            >
              Start over
            </button>
          ) : (
            <button
              className={s.button}
              onClick={() => {
                setLevel((n) => n + 1);
                setState("waiting");
              }}
            >
              Next
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
