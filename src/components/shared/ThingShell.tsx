"use client";

import { useEffect, useState, type ReactNode } from "react";

interface Props {
  title: string;
  /** Brief control hint, e.g. "WASD + mouse". Fades once interaction starts. */
  hint?: string;
  children: ReactNode;
}

/**
 * Hands the viewport to the experiment.
 *
 * The title carries over from the archive transition and then gets out of
 * the way — no stack, no description, no sidebar. Any control hint fades
 * as soon as the visitor actually does something.
 */
export function ThingShell({ title, hint, children }: Props) {
  const [introGone, setIntroGone] = useState(false);
  const [hintGone, setHintGone] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setIntroGone(true), 620);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hint) return;
    const dismiss = () => setHintGone(true);
    const timer = window.setTimeout(dismiss, 7000);
    window.addEventListener("pointerdown", dismiss, { once: true });
    window.addEventListener("keydown", dismiss, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
    };
  }, [hint]);

  return (
    <>
      {children}

      <div
        className={`thing-intro${introGone ? " thing-intro--gone" : ""}`}
        aria-hidden="true"
      >
        <span className="thing-intro__title">{title}</span>
      </div>

      {hint ? (
        <span className="thing-hint" style={{ opacity: hintGone ? 0 : 1 }}>
          {hint}
        </span>
      ) : null}
    </>
  );
}
