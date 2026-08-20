"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { click, closeAudio } from "@/lib/audio";
import s from "./checkbox.module.css";

/** What it says, in the order it gives up. */
const PROTESTS = [
  "no",
  "please don't",
  "I'd rather not",
  "we've been over this",
  "what do you even want",
  "is this fun for you",
  "I have rights",
  "fine. FINE.",
];

const RESIGNED = [
  "…",
  "go on then",
  "get it over with",
];

/**
 * 026 — ANGRY CHECKBOX
 *
 * One checkbox. It does not want to be checked.
 *
 * It dodges at first, and it is quite good at it. Then it gets tired,
 * gets slower, starts negotiating, and eventually stops running — at
 * which point checking it feels slightly worse than not bothering.
 */
export default function AngryCheckbox() {
  const boxRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dodges, setDodges] = useState(0);
  const [checked, setChecked] = useState(false);
  const [says, setSays] = useState("");

  /** Stamina runs out, which is the whole arc. */
  const energy = Math.max(0, 1 - dodges / 9);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (checked) return;
      const box = boxRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = cx - e.clientX;
      const dy = cy - e.clientY;
      const dist = Math.hypot(dx, dy);

      // once it has given up it stops bothering to move
      if (dist > 90 + energy * 40 || energy <= 0) return;

      const flee = (90 + energy * 130) / (dist || 1);
      const nx = pos.x + dx * 0.05 * flee * energy;
      const ny = pos.y + dy * 0.05 * flee * energy;
      const limitX = window.innerWidth / 2 - 90;
      const limitY = window.innerHeight / 2 - 110;

      setPos({
        x: Math.max(-limitX, Math.min(limitX, nx)),
        y: Math.max(-limitY, Math.min(limitY, ny)),
      });
      setDodges((n) => n + 1);
      setSays(
        energy > 0.15
          ? PROTESTS[Math.min(PROTESTS.length - 1, Math.floor(dodges / 2))]
          : RESIGNED[Math.floor(Math.random() * RESIGNED.length)],
      );
    };

    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [pos, dodges, energy, checked]);

  useEffect(() => closeAudio, []);

  const tick = useCallback(() => {
    setChecked(true);
    setSays("oh.");
    click({ freq: 1400, gain: 0.24, decay: 0.06 });
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.middle}>
        <button
          ref={boxRef}
          className={`${s.box} ${checked ? s.boxOn : ""}`}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
          onClick={tick}
          aria-pressed={checked}
          aria-label="a checkbox"
        >
          {checked ? <span className={s.tick}>✓</span> : null}
        </button>

        <p className={s.says} key={says}>
          {says || "check the box"}
        </p>

        {checked ? (
          <button
            className={s.again}
            onClick={() => {
              setChecked(false);
              setDodges(0);
              setPos({ x: 0, y: 0 });
              setSays("");
            }}
          >
            leave it alone
          </button>
        ) : null}
      </div>
    </div>
  );
}
