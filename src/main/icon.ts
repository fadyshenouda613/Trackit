import { nativeImage, type NativeImage } from 'electron'

/*
 * The window icon: the Trackit mark, rasterized rather than shipped.
 *
 * Same reasoning as the tray glyph next door — this is a rounded square and one
 * arc, and a build asset for that is a build asset to keep in sync with
 * Logo.tsx. Drawn here with the same distance-field coverage trick dotIcon
 * uses, so the two marks stay one shape described twice rather than two shapes.
 *
 * Geometry is Logo.tsx's 24-unit grid scaled to SIZE: tile radius 7/24, ring
 * radius 6.2/24, stroke 2.6/24, and a 26% gap centred at one o'clock.
 */

const SIZE = 256

/* oklch(0.655 0.175 274) and oklch(0.150 0.020 274) — accent and accent.on. */
const TILE: [number, number, number] = [114, 132, 250]
const RING: [number, number, number] = [9, 11, 20]

const U = SIZE / 24
const CORNER = 7 * U
const RING_RADIUS = 6.2 * U
const RING_HALF = 1.3 * U // half of the 2.6 stroke

/*
 * The gap. Logo.tsx draws 74% of the circumference starting from a -76° origin,
 * so the missing quarter spans the 26% after it. Angles here are measured the
 * way atan2 gives them, clockwise from twelve o'clock.
 */
const GAP_START = -76
const GAP_SWEEP = 360 * 0.26

/** Coverage of a half-pixel band around an edge: 1 inside, 0 outside. */
const band = (distance: number): number => Math.min(1, Math.max(0, 0.5 - distance))

/** Distance from a point to the rounded-square boundary; negative is inside. */
function tileDistance(x: number, y: number): number {
  const half = SIZE / 2
  const dx = Math.abs(x - half + 0.5) - (half - CORNER)
  const dy = Math.abs(y - half + 0.5) - (half - CORNER)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  return outside + Math.min(Math.max(dx, dy), 0) - CORNER
}

/** Where a stroke end sits, so the raster gets the SVG's round caps. */
function capCentre(degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180
  return [SIZE / 2 + Math.sin(radians) * RING_RADIUS, SIZE / 2 - Math.cos(radians) * RING_RADIUS]
}

const CAPS: [number, number][] = [capCentre(GAP_START), capCentre(GAP_START + GAP_SWEEP)]

/** Coverage of the ring at one pixel: the arc band, plus its two round caps. */
function ringCoverage(x: number, y: number): number {
  const dx = x - SIZE / 2 + 0.5
  const dy = y - SIZE / 2 + 0.5
  // Clockwise from twelve, which is how the rotation in Logo.tsx reads.
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI
  const fromGap = (angle - GAP_START + 360) % 360

  let coverage = fromGap > GAP_SWEEP ? band(Math.abs(Math.hypot(dx, dy) - RING_RADIUS) - RING_HALF) : 0

  for (const [cx, cy] of CAPS) {
    coverage = Math.max(coverage, band(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - RING_HALF))
  }

  return coverage
}

export function appIcon(): NativeImage {
  const buffer = Buffer.alloc(SIZE * SIZE * 4)

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const tile = band(tileDistance(x, y))
      if (tile <= 0) continue

      const ring = ringCoverage(x, y)

      // The ring sits on the tile, so it wins where both cover the pixel.
      const red = TILE[0] * (1 - ring) + RING[0] * ring
      const green = TILE[1] * (1 - ring) + RING[1] * ring
      const blue = TILE[2] * (1 - ring) + RING[2] * ring

      const offset = (y * SIZE + x) * 4
      buffer[offset] = Math.round(blue * tile) // B, premultiplied
      buffer[offset + 1] = Math.round(green * tile) // G
      buffer[offset + 2] = Math.round(red * tile) // R
      buffer[offset + 3] = Math.round(tile * 255)
    }
  }

  return nativeImage.createFromBitmap(buffer, { width: SIZE, height: SIZE })
}
