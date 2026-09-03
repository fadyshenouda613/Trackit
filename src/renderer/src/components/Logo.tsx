import type { JSX } from 'react'

type LogoProps = {
  /** Rendered size in px. The mark is drawn on a 24 grid and scales from there. */
  size?: number
  /**
   * `app` follows the theme; `print` cannot. The sheet sets its own palette and
   * nothing on it may change when the app flips to light, so the printed mark
   * carries its ink with it rather than reading a token.
   */
  tone?: 'app' | 'print'
}

/*
 * The Trackit mark.
 *
 * A ring with a gap on a rounded tile: an arc of elapsed time, which is also the
 * budget meter the whole app is built on — hours run against a fixed price, and
 * what is left is the gap. One shape answers both, which is why it is this one
 * and not a clock face.
 *
 * The wordmark beside it stays HTML text rather than outlines: the app already
 * has a type system, and a logo that carries its own copy of Plex is a second
 * place for the wordmark to drift.
 */

/* r 6.2 → circumference 38.96. 74% of it is drawn, 26% is the gap, and the
   rotation puts that gap at roughly one o'clock. */
const RADIUS = 6.2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const DRAWN = CIRCUMFERENCE * 0.74

export function Logo({ size = 18, tone = 'app' }: LogoProps): JSX.Element {
  const tile = tone === 'print' ? 'var(--brand)' : 'var(--accent)'
  const ring = tone === 'print' ? 'var(--paper-bg)' : 'var(--accent-on)'

  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="24" height="24" rx="7" fill={tile} />
      <circle
        cx="12"
        cy="12"
        r={RADIUS}
        stroke={ring}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray={`${DRAWN} ${CIRCUMFERENCE - DRAWN}`}
        transform="rotate(-76 12 12)"
      />
    </svg>
  )
}
