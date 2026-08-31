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
