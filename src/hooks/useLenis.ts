"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

interface Options {
  /** Skip Lenis entirely (reduced motion) — native scrolling stays. */
  disabled?: boolean;
}

/**
 * Smooth scroll for the archive.
 *
 * `lerp` mode rather than duration mode: a trackpad delivers many small
 * deltas, and duration-based easing restarts on each one, which reads as
 * floaty. Lerp stays responsive under rapid input and still smooths a
 * coarse mouse wheel. Touch is left native — it already feels right.
 *
 * Lenis drives the real window scroll, so anything that needs the current
 * position can just listen for `scroll`.
 */
export function useLenis({ disabled = false }: Options = {}) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (disabled) return;

    const lenis = new Lenis({
      lerp: 0.095,
      wheelMultiplier: 1,
      touchMultiplier: 1.8,
      syncTouch: false,
      autoRaf: false,
    });
    lenisRef.current = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [disabled]);

  return lenisRef;
}
