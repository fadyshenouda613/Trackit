/**
 * The app's semantic vocabulary, in one place. Every coloured element — meter
 * fills, rate figures, status pills, avatars — resolves through here, so no
 * component file ever names a colour.
 */

/** Tones that have a tinted chip form. */
export type Tone = 'neutral' | 'accent' | 'positive' | 'warning' | 'negative'

/**
 * Tones a figure or meter fill can take. The two extra greys carry no semantic
 * weight: `secondary` is an unjudged figure, `muted` a deliberately recessive
 * one (the cancelled row's meters).
 */
export type TextTone = Tone | 'secondary' | 'muted'

/** Solid colour: meter fills, figures, dots. */
export const toneVar: Record<TextTone, string> = {
  neutral: 'var(--text-tertiary)',
  accent: 'var(--accent)',
  positive: 'var(--positive)',
  warning: 'var(--warning)',
  negative: 'var(--negative)',
  secondary: 'var(--text-secondary)',
  muted: 'var(--text-muted)'
}

/** Tinted surface + text: the chip family. */
export const tintVars: Record<Tone, { background: string; color: string }> = {
  neutral: { background: 'var(--neutral-surface)', color: 'var(--neutral-text)' },
  accent: { background: 'var(--accent-surface)', color: 'var(--accent-text)' },
  positive: { background: 'var(--positive-surface)', color: 'var(--positive-text)' },
  warning: { background: 'var(--warning-surface)', color: 'var(--warning-text)' },
  negative: { background: 'var(--negative-surface)', color: 'var(--negative-text)' }
}

/**
 * Tinted surface + border + body text: the banner family.
 *
 * A chip states one word and needs two values. A banner holds a sentence, an
 * edge and sometimes a button, so it needs the third step — the border — and a
 * dimmer text than the chip's, because a whole paragraph at chip brightness
 * shouts. Same three tokens for every tone, so a notice can change register
 * without changing shape.
 */
export const noticeVars: Record<Tone, { background: string; borderColor: string; color: string }> =
  {
    neutral: {
      background: 'var(--bg-overlay)',
      borderColor: 'var(--neutral-line)',
      color: 'var(--neutral-text-dim)'
    },
    accent: {
      background: 'var(--accent-surface)',
      borderColor: 'var(--accent-line)',
      color: 'var(--accent-text-dim)'
    },
    positive: {
      background: 'var(--positive-surface)',
      borderColor: 'var(--positive-line)',
      color: 'var(--positive-text-dim)'
    },
    warning: {
      background: 'var(--warning-surface)',
      borderColor: 'var(--warning-line)',
      color: 'var(--warning-text-dim)'
    },
    negative: {
      background: 'var(--negative-surface)',
      borderColor: 'var(--negative-line)',
      color: 'var(--negative-text-dim)'
    }
  }

/** The mark, title and link inside a notice: one step brighter than its body. */
export const noticeAccentVar: Record<Tone, string> = {
  neutral: 'var(--text-primary)',
  accent: 'var(--accent-text)',
  positive: 'var(--positive-text)',
  warning: 'var(--warning-text)',
  negative: 'var(--negative-text)'
}
