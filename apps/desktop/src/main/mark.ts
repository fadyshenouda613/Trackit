/*
 * The Trackit mark as pixels: a rounded square and one arc.
 *
 * This is the one description of the shape that every raster form of it is
 * drawn from — the window icon (icon.ts, through nativeImage), and the
 * installer and bundle icons the build writes (tooling/icons.ts). It has no
 * Electron in it so both can share it, and so it can be tested under Node.
 *
 * Geometry is Logo.tsx's 24-unit grid scaled to the drawn size: tile radius
 * 7/24, ring radius 6.2/24, stroke 2.6/24, and a 26% gap centred at one
 * o'clock. Coverage is a distance-field band, the trick the tray's dot glyph
 * uses, so the edges are anti-aliased without a rasterizer.
 */

/* oklch(0.655 0.175 274) and oklch(0.150 0.020 274) — accent and accent.on. */
export const TILE: readonly [number, number, number] = [114, 132, 250]
export const RING: readonly [number, number, number] = [9, 11, 20]

/*
 * The gap. Logo.tsx draws 74% of the circumference starting from a -76° origin,
 * so the missing quarter spans the 26% after it. Angles here are measured the
 * way atan2 gives them, clockwise from twelve o'clock.
 */
const GAP_START = -76
const GAP_SWEEP = 360 * 0.26

/** Coverage of a half-pixel band around an edge: 1 inside, 0 outside. */
const band = (distance: number): number => Math.min(1, Math.max(0, 0.5 - distance))

export type MarkOptions = {
  /**
   * Margin on every side as a fraction of the size, so the tile does not run
   * to the canvas edge. Zero (the default) is the mark as Logo.tsx draws it.
   * macOS app icons sit inside their canvas, the way Apple's own do.
   */
  inset?: number
}

/**
 * Straight (not premultiplied) RGBA, row-major, `size` pixels square.
 * Consumers that want another byte order or premultiplication convert.
 */
export function renderMark(size: number, options: MarkOptions = {}): Uint8Array {
  const inset = options.inset ?? 0
  const drawn = size * (1 - 2 * inset)
  const origin = size * inset

  const unit = drawn / 24
  const corner = 7 * unit
  const ringRadius = 6.2 * unit
  const ringHalf = 1.3 * unit // half of the 2.6 stroke
  const half = drawn / 2
  const centre = origin + half

  /** Distance from a point to the rounded-square boundary; negative is inside. */
  const tileDistance = (x: number, y: number): number => {
    const dx = Math.abs(x - centre) - (half - corner)
    const dy = Math.abs(y - centre) - (half - corner)
    const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
    return outside + Math.min(Math.max(dx, dy), 0) - corner
  }

  /** Where a stroke end sits, so the raster gets the SVG's round caps. */
  const capCentre = (degrees: number): [number, number] => {
    const radians = (degrees * Math.PI) / 180
    return [centre + Math.sin(radians) * ringRadius, centre - Math.cos(radians) * ringRadius]
  }
  const caps = [capCentre(GAP_START), capCentre(GAP_START + GAP_SWEEP)]

  /** Coverage of the ring at one pixel: the arc band, plus its two round caps. */
  const ringCoverage = (x: number, y: number): number => {
    const dx = x - centre
    const dy = y - centre
    // Clockwise from twelve, which is how the rotation in Logo.tsx reads.
    const angle = (Math.atan2(dx, -dy) * 180) / Math.PI
    const fromGap = (angle - GAP_START + 360) % 360

    let coverage = fromGap > GAP_SWEEP ? band(Math.abs(Math.hypot(dx, dy) - ringRadius) - ringHalf) : 0
    for (const [cx, cy] of caps) {
      coverage = Math.max(coverage, band(Math.hypot(x - cx, y - cy) - ringHalf))
    }
    return coverage
  }

  const pixels = new Uint8Array(size * size * 4)

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      // Sample at the pixel's centre.
      const x = column + 0.5
      const y = row + 0.5
      const tile = band(tileDistance(x, y))
      if (tile <= 0) continue

      const ring = ringCoverage(x, y)
      const offset = (row * size + column) * 4
      // The ring sits on the tile, so it wins where both cover the pixel.
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(TILE[channel] * (1 - ring) + RING[channel] * ring)
      }
      pixels[offset + 3] = Math.round(tile * 255)
    }
  }

  return pixels
}
