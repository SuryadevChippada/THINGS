"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, utils } from "animejs";

import { click, whir, closeAudio } from "@/lib/audio";
import s from "./machine.module.css";

const OFF = 26;
const ON = -26;

/** The lid stops well short of flat — it's a door, not a drawbridge. */
const HATCH_OPEN = -74;
const HATCH_PEEK = -22;
const ARM_OUT = 128;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Promise-wrapped tween, so the machine can be written as a routine. */
function tween(el: HTMLElement, params: Record<string, unknown>) {
  return new Promise<void>((resolve) => {
    animate(el, { ...params, onComplete: () => resolve() });
  });
}

/** How wound up it is, from how fast you have been flicking the switch. */
type Mood = "calm" | "annoyed" | "furious";

/** Everything gets quicker and sharper as it loses patience. */
const TEMPO: Record<Mood, number> = { calm: 1, annoyed: 0.74, furious: 0.5 };

/**
 * 001 — USELESS MACHINE
 *
 * One switch. You turn it on, the machine turns it off, and nothing else
 * ever happens.
 *
 * Fighting it is the only thing to do here, so it has to fight back. Beat
 * it to the switch and it stops dead, prods the air where the switch used
 * to be, sulks back inside — then cracks the lid a moment later to see
 * whether you have finished. Left alone it gets curious on its own. Spam
 * it and it stops being polite about any of that.
 */
export default function UselessMachine() {
  const lever = useRef<HTMLSpanElement>(null);
  const hatch = useRef<HTMLDivElement>(null);
  const arm = useRef<HTMLDivElement>(null);

  /** Switch position, read inside the running routines. */
  const onRef = useRef(false);
  /** Bumped on every flick, so a stale routine knows to stand down. */
  const runId = useRef(0);
  /** Where the mechanism actually is, so a routine can pick up mid-move. */
  const pose = useRef({ lid: 0, arm: 0 });
  /** Recent flick times — its patience is a rolling window. */
  const flicks = useRef<number[]>([]);

  const [on, setOn] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (lever.current) utils.set(lever.current, { rotate: OFF });
    if (hatch.current) utils.set(hatch.current, { rotateY: 0 });
    if (arm.current) utils.set(arm.current, { translateX: 0 });
    return closeAudio;
  }, []);

  const mood = useCallback((): Mood => {
    const recent = flicks.current.filter((t) => t > performance.now() - 6000);
    if (recent.length >= 7) return "furious";
    if (recent.length >= 4) return "annoyed";
    return "calm";
  }, []);

  /** Move the lid, remembering where it ended up. */
  const moveLid = useCallback(async (to: number, duration: number) => {
    const ht = hatch.current;
    if (!ht) return;
    pose.current.lid = to;
    await tween(ht, { rotateY: to, duration, ease: "outQuart" });
  }, []);

  const moveArm = useCallback(async (to: number, duration: number, ease = "outCubic") => {
    const am = arm.current;
    if (!am) return;
    pose.current.arm = to;
    await tween(am, { translateX: to, duration, ease });
  }, []);

  /** What it does when you get to the switch first. */
  const settle = useCallback(
    async (id: number) => {
      const am = arm.current;
      if (!am) return;
      const stale = () => runId.current !== id;
      const caught = pose.current.arm > 10;

      if (caught) {
        // stops dead, then prods the air where the switch used to be
        await sleep(200);
        if (stale()) return;
        await tween(am, { translateX: pose.current.arm + 9, duration: 110, ease: "outQuad" });
        if (stale()) return;
        await sleep(220);
        if (stale()) return;
      }

      if (pose.current.arm !== 0) {
        whir(0.38, 96);
        await moveArm(0, 380, "inOutQuad");
        if (stale()) return;
      }
      if (pose.current.lid !== 0) {
        await moveLid(0, 400);
        if (stale()) return;
        click({ freq: 1500, gain: 0.2, decay: 0.06 });
      }

      // ...then checks whether you have finished
      if (!caught && Math.random() > 0.45) return;
      await sleep(rand(900, 2000));
      if (stale() || onRef.current) return;
      await moveLid(HATCH_PEEK, 260);
      if (stale()) return;
      await sleep(rand(700, 1400));
      if (stale() || onRef.current) return;
      await moveLid(0, 240);
    },
    [moveArm, moveLid],
  );

  const react = useCallback(
    async (id: number) => {
      const lv = lever.current;
      if (!lv || !hatch.current || !arm.current) return;

      const stale = () => runId.current !== id;
      const temper = mood();
      const d = (ms: number) => ms * TEMPO[temper];
      const pitch = temper === "furious" ? 1.5 : temper === "annoyed" ? 1.2 : 1;
      /** It was already watching through the gap — no need to think. */
      const primed = pose.current.lid < -5;
      const gone = () => stale() || !onRef.current;

      await sleep(primed ? d(140) : d(440));
      if (gone()) return;

      const feint = temper !== "furious" && !primed && Math.random() < 0.3;
      const peek = temper === "calm" && !primed && Math.random() < 0.3;

      if (peek) {
        // cracks the lid, has a look, thinks better of it
        await moveLid(HATCH_PEEK, d(240));
        if (gone()) return;
        await sleep(d(420));
        if (gone()) return;
        await moveLid(0, d(200));
        if (gone()) return;
        await sleep(d(300));
        if (gone()) return;
      }

      whir(0.46 * TEMPO[temper], 78 * pitch);
      await moveLid(HATCH_OPEN, d(460));
      if (gone()) return;

      if (feint) {
        // half a reach, then changes its mind
        await moveArm(58, d(280));
        if (gone()) return;
        await moveArm(0, d(220), "inOutQuad");
        if (gone()) return;
        await sleep(d(340));
        if (gone()) return;
      }

      whir(0.42 * TEMPO[temper], 104 * pitch);
      await moveArm(ARM_OUT, d(feint ? 300 : 420));
      if (gone()) return;

      // and flicks it off
      click({ freq: 2100, gain: 0.34 });
      onRef.current = false;
      setOn(false);
      setCount((c) => c + 1);
      await tween(lv, { rotate: OFF, duration: 140, ease: "outBack" });
      if (stale()) return;

      // a furious machine does not linger
      if (temper === "calm" && Math.random() < 0.3) await sleep(320);
      if (stale()) return;

      whir(0.38 * TEMPO[temper], 96 * pitch);
      await moveArm(0, d(380), "inOutQuad");
      if (stale()) return;
      await moveLid(0, d(400));
      if (stale()) return;
      click({ freq: 1500, gain: 0.2, decay: 0.06 });
    },
    [mood, moveArm, moveLid],
  );

  /** Left alone, it gets curious. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      while (alive) {
        await sleep(rand(9000, 18000));
        if (!alive) return;
        if (onRef.current || pose.current.lid !== 0 || pose.current.arm !== 0) continue;

        const id = ++runId.current;
        const stale = () => runId.current !== id;
        await moveLid(HATCH_PEEK, 300);
        if (!alive || stale()) return;
        await sleep(rand(800, 1800));
        if (!alive || stale() || onRef.current) continue;
        await moveLid(0, 260);
      }
    })();
    return () => {
      alive = false;
    };
  }, [moveLid]);

  const flip = useCallback(() => {
    const lv = lever.current;
    if (!lv) return;

    const next = !onRef.current;
    onRef.current = next;
    setOn(next);
    flicks.current = [
      ...flicks.current.filter((t) => t > performance.now() - 6000),
      performance.now(),
    ];

    click({ freq: next ? 2600 : 2200, gain: 0.3 });
    animate(lv, { rotate: next ? ON : OFF, duration: 130, ease: "outBack" });

    const id = ++runId.current;
    if (next) void react(id);
    else void settle(id);
  }, [react, settle]);

  return (
    <div className={s.stage}>
      <div className={s.machine}>
        <div className={s.cavity} />
        <div className={s.arm} ref={arm} />
        <div className={s.hatch} ref={hatch} />

        <div className={s.labels}>
          <span className={on ? s.labelLit : undefined}>ON</span>
          <span className={on ? undefined : s.labelLit}>OFF</span>
        </div>

        <div className={s.plate}>
          <button
            type="button"
            className={s.slot}
            aria-label={on ? "switch, on" : "switch, off"}
            aria-pressed={on}
            onClick={flip}
          >
            <span className={s.lever} ref={lever} />
          </button>
        </div>
      </div>

      <span className={s.count} style={{ opacity: count ? 1 : 0 }}>
        {count === 1 ? "switched off once" : `switched off ${count} times`}
      </span>
    </div>
  );
}
