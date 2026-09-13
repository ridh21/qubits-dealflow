"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealGroup = {
  selector: string;
  stagger: number;
};

const REVEAL_GROUPS: RevealGroup[] = [
  { selector: ".landing-section-heading, .reveal-heading", stagger: 0 },
  { selector: ".flow-grid > article", stagger: 60 },
  { selector: ".feature-grid > article", stagger: 45 },
  { selector: ".walkthrough", stagger: 90 },
  { selector: ".pricing-grid > *", stagger: 60 },
  { selector: "[data-slot=accordion-item]", stagger: 45 },
  { selector: ".landing-cta, .landing-footer-top", stagger: 0 },
];

/** Adds one shared, reduced-motion-aware viewport reveal to the marketing page. */
export function MarketingMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const targets: HTMLElement[] = [];
    for (const group of REVEAL_GROUPS) {
      root.querySelectorAll<HTMLElement>(group.selector).forEach((element, index) => {
        element.dataset.reveal = "true";
        element.style.setProperty(
          "--reveal-delay",
          `${Math.min(index * group.stagger, 180)}ms`,
        );
        targets.push(element);
      });
    }
    root.dataset.motionReady = "true";

    const revealAll = () => targets.forEach((element) => element.classList.add("is-visible"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealAll();
      return;
    }
    if (!("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.classList.add("is-visible");
          observer.unobserve(element);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8%" },
    );
    targets.forEach((element) => observer.observe(element));
    const revealInViewport = () => {
      const viewportHeight = window.innerHeight;
      for (const element of targets) {
        if (element.classList.contains("is-visible")) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top < viewportHeight * 0.94 && rect.bottom > 0) {
          element.classList.add("is-visible");
          observer.unobserve(element);
        }
      }
    };
    // Browsers can jump several viewports at once (PageDown, anchor links,
    // restored scroll position). IntersectionObserver is not guaranteed to
    // deliver an entry for every skipped section, so reveal anything still
    // pending after the initial motion window. This keeps the page usable even
    // when a user lands deep in the page or scrolls faster than the observer.
    const revealFallback = window.setTimeout(revealAll, 1600);
    // Hash navigation can move the viewport before the observer's first
    // delivery; this keeps anchored sections visible on the first frame.
    requestAnimationFrame(revealInViewport);
    window.setTimeout(revealInViewport, 220);
    window.addEventListener("scroll", revealInViewport, { passive: true });
    window.addEventListener("hashchange", revealInViewport);
    window.addEventListener("resize", revealInViewport);
    return () => {
      observer.disconnect();
      window.clearTimeout(revealFallback);
      window.removeEventListener("scroll", revealInViewport);
      window.removeEventListener("hashchange", revealInViewport);
      window.removeEventListener("resize", revealInViewport);
    };
  }, []);

  return (
    <div ref={rootRef} className="marketing-motion">
      {children}
    </div>
  );
}
