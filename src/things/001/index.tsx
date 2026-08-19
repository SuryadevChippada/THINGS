"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createTimeline, utils } from "animejs";

import { click, whir, closeAudio } from "@/lib/audio";
import s from "./machine.module.css";

const OFF = 26;
const ON = -26;

/**
 * 001 — USELESS MACHINE
 *
 * One switch. You turn it on. The machine turns it off. Nothing else
 * happens, and nothing else should. The whole thing lives or dies on the
 * timing, so the beats are spaced deliberately: a pause before it reacts
 * (it noticed), an unhurried reach, a fast decisive flick, a tidy retreat.
 */
export default function UselessMachine() {
  const lever = useRef<HTMLDivElement>(null);
  const hatch = useRef<HTMLDivElement>(null);
  const arm = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (lever.current) utils.set(lever.current, { rotate: OFF });
    if (hatch.current) utils.set(hatch.current, { rotateY: 0 });
    if (arm.current) utils.set(arm.current, { translateX: 0 });
    return closeAudio;
  }, []);

  const flip = useCallback(() => {
    const lv = lever.current;
    const ht = hatch.current;
    const am = arm.current;
    if (busy.current || !lv || !ht || !am) return;
    busy.current = true;

    click({ freq: 2600, gain: 0.3 });

    const tl = createTimeline({
      defaults: { ease: "outQuart" },
      onComplete: () => {
        busy.current = false;
        setCount((c) => c + 1);
      },
    });

    // you flick it on
    tl.add(lv, { rotate: ON, duration: 130, ease: "outBack" }, 0);

    // ...pause. then the lid opens.
    tl.add(
      ht,
      {
        rotateY: -118,
        duration: 460,
        onBegin: () => whir(0.46, 78),
      },
      460,
    );

    // the arm reaches out
    tl.add(
      am,
      {
        translateX: 128,
        duration: 420,
        ease: "outCubic",
        onBegin: () => whir(0.42, 104),
      },
      820,
    );

    // and flicks it off
    tl.add(
      lv,
      {
        rotate: OFF,
        duration: 140,
        ease: "outBack",
        onBegin: () => click({ freq: 2100, gain: 0.34 }),
      },
      1190,
    );

    // then leaves, without comment
    tl.add(
      am,
      {
        translateX: 0,
        duration: 380,
        ease: "inOutQuad",
        onBegin: () => whir(0.38, 96),
      },
      1330,
    );

    tl.add(
      ht,
      {
        rotateY: 0,
        duration: 400,
        onComplete: () => click({ freq: 1500, gain: 0.2, decay: 0.06 }),
      },
      1700,
    );
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.machine}>
        <div className={s.cavity} />
        <div className={s.arm} ref={arm} />
        <div className={s.hatch} ref={hatch} />

        <div className={s.labels}>
          <span>ON</span>
          <span>OFF</span>
        </div>

        <div className={s.plate}>
          <div
            className={s.slot}
            role="button"
            tabIndex={0}
            aria-label="switch"
            onClick={flip}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                flip();
              }
            }}
          >
            <div className={s.lever} ref={lever} />
          </div>
        </div>
      </div>

      <span className={s.count} style={{ opacity: count ? 1 : 0 }}>
        {count === 1 ? "switched off once" : `switched off ${count} times`}
      </span>
    </div>
  );
}
