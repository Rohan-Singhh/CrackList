// Motion helpers for the things CSS can't see.
//
// The animations themselves live in styles/motion.css — they are fades, a
// stagger and a 2px hover lift, which CSS does for well under a kilobyte.
// A JS animation library was measured for this and put the main bundle
// 40 kB above where it started, which is not a trade worth making for
// enter transitions. Reach for one if shared-element or layout animation
// is ever needed; it earns its weight there, not here.

/** Mirrors the `prefers-reduced-motion` media query the stylesheet honours. */
export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** scrollIntoView that degrades to an instant jump when the user asked for it. */
export function smoothScrollTo(el: Element | null | undefined) {
  el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/** Per-item delay for a staggered list, capped so long lists still finish fast. */
export function staggerDelay(index: number, step = 12, cap = 300) {
  return `${Math.min(index * step, cap)}ms`;
}
