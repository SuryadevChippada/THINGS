"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createTimeline, stagger } from "animejs";

import { archive } from "@/things/registry";
import { formatFull } from "@/lib/date";
import { useLenis } from "@/hooks/useLenis";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Timeline } from "./Timeline";

const SCROLL_KEY = "things:archive-scroll";

export function Archive() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const listRef = useRef<HTMLOListElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);
  /** Row centres in document space, cached so scrolling never reads layout. */
  const centresRef = useRef<number[]>([]);
  const openingRef = useRef(false);

  const [progress, setProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const rows = list.querySelectorAll<HTMLElement>("[data-row]");
    const listTop = list.getBoundingClientRect().top + window.scrollY;
    centresRef.current = Array.from(rows, (el) => listTop + el.offsetTop + el.offsetHeight / 2);
  }, []);

  /**
   * Where you are, measured in things rather than pixels.
   *
   * The marker and its label used to be worked out two different ways —
   * the marker from raw scroll distance, the label from whichever row was
   * nearest the middle — so they disagreed with each other on screen.
   * Both now come from one fractional index into the archive, which is
   * also what makes dragging the track land on the thing it points at.
   */
  const handleScroll = useCallback(() => {
    const scroll = window.scrollY;
    scrollRef.current = scroll;

    const centres = centresRef.current;
    if (centres.length < 2) return;

    const focus = scroll + window.innerHeight / 2;
    let frac: number;
    if (focus <= centres[0]) {
      frac = 0;
    } else if (focus >= centres[centres.length - 1]) {
      frac = centres.length - 1;
    } else {
      frac = centres.length - 1;
      for (let i = 0; i < centres.length - 1; i++) {
        if (focus <= centres[i + 1]) {
          const span = centres[i + 1] - centres[i] || 1;
          frac = i + (focus - centres[i]) / span;
          break;
        }
      }
    }

    setProgress(frac / (centres.length - 1));
    setActiveIndex(Math.round(frac));
  }, []);

  // Lenis scrolls the real window, so a native listener tracks it in both
  // smooth and reduced-motion modes.
  const lenisRef = useLenis({ disabled: reducedMotion });

  // Restore the reading position before paint, so returning from a thing
  // never shows a jump back to the top.
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    measure();

    const saved = Number(sessionStorage.getItem(SCROLL_KEY) ?? 0);
    if (saved > 0) {
      window.scrollTo(0, saved);
      scrollRef.current = saved;
    }
    // Sync the timeline to the restored position on the next frame, once
    // layout has settled.
    const sync = requestAnimationFrame(handleScroll);

    const onResize = () => {
      measure();
      handleScroll();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", handleScroll, { passive: true });

    const persist = () => sessionStorage.setItem(SCROLL_KEY, String(scrollRef.current));
    window.addEventListener("pagehide", persist);

    return () => {
      cancelAnimationFrame(sync);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [measure, handleScroll]);

  /**
   * Opening a thing should not read as ordinary navigation: the archive
   * clears, the chosen title becomes the only thing left, then the
   * experiment takes the viewport.
   */
  const open = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, id: string, index: number) => {
      // Let modified clicks (new tab, etc.) behave normally.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      if (openingRef.current) return;
      openingRef.current = true;

      sessionStorage.setItem(SCROLL_KEY, String(scrollRef.current));

      if (reducedMotion) {
        router.push(`/${id}`);
        return;
      }

      lenisRef.current?.stop();

      const list = listRef.current;
      const rows = Array.from(list?.querySelectorAll<HTMLElement>("[data-row]") ?? []);
      const chosen = rows[index];
      const others = rows.filter((_, i) => i !== index);
      const title = chosen?.querySelector<HTMLElement>("[data-title]") ?? null;
      const num = chosen?.querySelector<HTMLElement>("[data-num]") ?? null;
      const chrome = document.querySelectorAll<HTMLElement>("[data-chrome]");
      const overlay = overlayRef.current;

      const tl = createTimeline({
        defaults: { ease: "outQuart" },
        onComplete: () => router.push(`/${id}`),
      });

      tl.add(chrome, { opacity: 0, duration: 280 }, 0);

      // clears outward from the row you chose
      tl.add(
        others,
        {
          opacity: 0,
          translateY: -6,
          duration: 420,
          delay: stagger(9, { from: Math.min(index, others.length - 1) }),
        },
        40,
      );

      if (num) tl.add(num, { opacity: 0, duration: 260 }, 60);

      if (title) {
        const rect = title.getBoundingClientRect();
        const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
        const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);
        tl.add(
          title,
          {
            translateX: dx,
            translateY: dy,
            scale: 1.35,
            color: "#d6d1c9",
            duration: 640,
            ease: "inOutQuart",
          },
          180,
        );
      }

      if (overlay) {
        tl.add(overlay, { opacity: 1, duration: 300, ease: "inQuad" }, 540);
      }

      // Fallback: if anime is interrupted, still navigate.
      window.setTimeout(() => {
        if (openingRef.current) router.push(`/${id}`);
      }, 1100);
    },
    [reducedMotion, router, lenisRef],
  );

  const activeDate = archive[activeIndex]?.date ?? archive[0].date;

  /** Drag the track to a thing, not to a pixel offset. */
  const scrub = useCallback(
    (p: number) => {
      const centres = centresRef.current;
      if (centres.length < 2) return;

      const frac = Math.max(0, Math.min(1, p)) * (centres.length - 1);
      const i = Math.min(centres.length - 2, Math.floor(frac));
      const centre = centres[i] + (centres[i + 1] - centres[i]) * (frac - i);

      const limit = document.documentElement.scrollHeight - window.innerHeight;
      const target = Math.max(0, Math.min(limit, centre - window.innerHeight / 2));

      const lenis = lenisRef.current;
      if (lenis) lenis.scrollTo(target, { immediate: true });
      else window.scrollTo(0, target);
    },
    [lenisRef],
  );

  return (
    <>
      {/* the list dissolves at the edges rather than running under the chrome */}
      <div className="archive-fade archive-fade--top" />
      <div className="archive-fade archive-fade--bottom" />

      <span className="chrome chrome--mark" data-chrome>
        THINGS
      </span>
      <Link href="/about" className="chrome chrome--about" data-chrome>
        About
      </Link>

      <main className="archive-enter">
        <ol className="archive" id="archive-list" ref={listRef}>
          {archive.map((thing, index) => (
            <li key={thing.id} data-row>
              <Link
                href={`/${thing.id}`}
                onClick={(e) => open(e, thing.id, index)}
                className={`row${thing.status === "planned" ? " row--planned" : ""}`}
              >
                <span className="row__num" data-num>
                  {thing.id}
                </span>
                <span className="row__title" data-title>
                  {thing.title}
                </span>
                <span className="row__rule" />
                <span className="row__date">{formatFull(thing.date)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </main>

      <div data-chrome>
        <Timeline
          progress={progress}
          activeDate={activeDate}
          newestDate={archive[0].date}
          oldestDate={archive[archive.length - 1].date}
          onScrub={scrub}
        />
      </div>

      <span className="chrome chrome--by" data-chrome>
        by Surya
      </span>

      <div ref={overlayRef} className="archive-overlay" />
    </>
  );
}
