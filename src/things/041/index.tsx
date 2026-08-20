"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { click, closeAudio, getAudio } from "@/lib/audio";
import s from "./button.module.css";

type Step = "safety" | "keys" | "arm" | "confirm" | "countdown" | "done";

/**
 * 041 — VERY IMPORTANT BUTTON
 *
 * A launch procedure. Lift the cover, turn both keys, arm the system,
 * confirm you understand the consequences, wait out the countdown, and
 * press the button.
 *
 * The consequence is one small green LED. It stays on. That is the whole
 * of it, and the ceremony is the point — by the time you get there you
 * have invested enough that a single LED feels like something.
 */
export default function VeryImportantButton() {
  const [step, setStep] = useState<Step>("safety");
  const [keys, setKeys] = useState([false, false]);
  const [count, setCount] = useState(10);
  const [lit, setLit] = useState(false);
  const alarmRef = useRef<{ stop: () => void } | null>(null);

  const stopAlarm = useCallback(() => {
    alarmRef.current?.stop();
    alarmRef.current = null;
  }, []);

  useEffect(() => () => {
    stopAlarm();
    closeAudio();
  }, [stopAlarm]);

  // the alarm, which is genuinely irritating on purpose
  const startAlarm = useCallback(() => {
    const ac = getAudio();
    if (!ac || alarmRef.current) return;
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.value = 660;
    const gain = ac.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(ac.destination);
    osc.start();
    const beat = window.setInterval(() => {
      const t = ac.currentTime;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.setValueAtTime(0, t + 0.16);
    }, 620);
    alarmRef.current = {
      stop: () => {
        window.clearInterval(beat);
        try {
          osc.stop();
        } catch {
          // already stopped
        }
      },
    };
  }, []);

  useEffect(() => {
    if (step !== "countdown") return;
    startAlarm();

    // Count against a deadline rather than decrementing state from inside
    // the tick: the remaining time is derived, so a slow frame or a paused
    // tab can't leave the count out of step with the clock.
    const deadline = performance.now() + 10_000;
    let lastWhole = 10;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      if (left !== lastWhole) {
        lastWhole = left;
        if (left > 0) click({ freq: 900, gain: 0.14, decay: 0.06 });
      }
      setCount(left);
      if (left === 0) window.clearInterval(timer);
    }, 120);

    return () => window.clearInterval(timer);
  }, [step, startAlarm]);

  const turnKey = useCallback(
    (i: number) => {
      const next = [...keys];
      next[i] = true;
      setKeys(next);
      click({ freq: 1600, gain: 0.24, decay: 0.07 });
      if (next.every(Boolean)) window.setTimeout(() => setStep("arm"), 500);
    },
    [keys],
  );

  const fire = useCallback(() => {
    stopAlarm();
    setLit(true);
    setStep("done");
    click({ freq: 220, gain: 0.3, decay: 0.5, q: 0.6 });
  }, [stopAlarm]);

  return (
    <div className={s.stage}>
      <div className={s.console}>
        <div className={s.header}>
          <span className={s.title}>SYSTEM</span>
          <span className={`${s.status} ${step === "done" ? s.statusOn : ""}`}>
            {step === "done" ? "NOMINAL" : step === "countdown" ? "COMMITTED" : "SAFE"}
          </span>
        </div>

        <div className={s.stepsRow}>
          {(["safety", "keys", "arm", "confirm", "countdown"] as Step[]).map((id, i) => (
            <span
              key={id}
              className={`${s.pip} ${
                ["safety", "keys", "arm", "confirm", "countdown", "done"].indexOf(step) > i
                  ? s.pipDone
                  : step === id
                    ? s.pipNow
                    : ""
              }`}
            />
          ))}
        </div>

        {step === "safety" ? (
          <div className={s.panel}>
            <p className={s.instruction}>1 · remove the safety cover</p>
            <button
              className={s.cover}
              onClick={() => {
                click({ freq: 700, gain: 0.2, decay: 0.12 });
                setStep("keys");
              }}
            >
              lift
            </button>
          </div>
        ) : null}

        {step === "keys" ? (
          <div className={s.panel}>
            <p className={s.instruction}>2 · turn both keys</p>
            <div className={s.keys}>
              {keys.map((on, i) => (
                <button
                  key={i}
                  className={`${s.key} ${on ? s.keyOn : ""}`}
                  onClick={() => turnKey(i)}
                  disabled={on}
                  aria-label={`key ${i + 1}`}
                >
                  <span className={s.keyNotch} />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === "arm" ? (
          <div className={s.panel}>
            <p className={s.instruction}>3 · arm the system</p>
            <button
              className={s.arm}
              onClick={() => {
                click({ freq: 480, gain: 0.26, decay: 0.14 });
                setStep("confirm");
              }}
            >
              arm
            </button>
          </div>
        ) : null}

        {step === "confirm" ? (
          <div className={s.panel}>
            <p className={s.warning}>
              this action cannot be undone, reviewed, appealed, or explained
              afterwards to anyone who asks.
            </p>
            <label className={s.check}>
              <input type="checkbox" onChange={() => setStep("countdown")} />
              I understand what I am about to do
            </label>
          </div>
        ) : null}

        {step === "countdown" ? (
          <div className={s.panel}>
            <p className={s.instruction}>4 · stand by</p>
            <span className={s.count}>{String(count).padStart(2, "0")}</span>
            <button className={s.fire} onClick={fire} disabled={count > 0}>
              {count > 0 ? "locked" : "press"}
            </button>
          </div>
        ) : null}

        {step === "done" ? (
          <div className={s.panel}>
            <div className={s.ledRow}>
              <span className={`${s.led} ${lit ? s.ledOn : ""}`} />
              <span className={s.ledLabel}>ok</span>
            </div>
            <p className={s.instruction}>that&rsquo;s it</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
