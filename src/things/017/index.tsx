"use client";

import { useEffect, useRef, useState } from "react";
import s from "./loading.module.css";

/** Things the machine keeps finding out it has to do. */
const TASKS = [
  "reticulating splines",
  "optimizing nothing",
  "checking the moon",
  "downloading more progress",
  "asking the server nicely",
  "counting to a large number",
  "warming up the warmer",
  "verifying the verification",
  "rounding down",
  "waking the other thread",
  "unpacking the packing",
  "consulting the manual",
  "rebuilding what was fine",
  "waiting for the waiting to finish",
  "deciding what to do next",
  "reading the terms",
  "aligning something invisible",
  "compressing the compression",
  "finding where it left off",
  "double-checking the moon",
];

/**
 * 017 — LOADING
 *
 * A loading screen that is doing its absolute best. It gets almost all
 * the way there, and then — right at the end, every time — it notices one
 * more thing it should probably do first.
 *
 * It will never finish. That is the whole thing.
 */
export default function Loading() {
  const [percent, setPercent] = useState(0);
  const [task, setTask] = useState(TASKS[0]);
  const [found, setFound] = useState(0);
  const taskIndex = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let value = 0;
    /** Fast at first, painfully slow at the end. Always. */
    let stall = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (stall > 0) {
        stall -= dt;
      } else {
        const remaining = 100 - value;
        // approach the end asymptotically, so the last percent takes an age
        value += Math.max(0.35, remaining * 0.55) * dt * 2.4;

        if (value >= 98 + Math.random() * 1.6) {
          // ...ah.
          taskIndex.current = (taskIndex.current + 1 + Math.floor(Math.random() * 3)) % TASKS.length;
          setTask(TASKS[taskIndex.current]);
          setFound((n) => n + 1);
          value = 24 + Math.random() * 44;
          stall = 0.5;
        }
      }

      setPercent(value);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.panel}>
        <div className={s.readout}>
          <span className={s.percent}>{percent.toFixed(0)}</span>
          <span className={s.sign}>%</span>
        </div>

        <div className={s.track}>
          <div className={s.fill} style={{ width: `${percent}%` }} />
        </div>

        <p className={s.task} key={task}>
          {task}…
        </p>

        <p className={s.footnote}>
          {found === 0
            ? "please wait"
            : found === 1
              ? "found 1 more thing to do"
              : `found ${found} more things to do`}
        </p>
      </div>
    </div>
  );
}
