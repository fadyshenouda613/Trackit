import { describe, expect, it } from 'vitest'
import { renderMark, RING, TILE } from './mark'

const pixel = (pixels: Uint8Array, size: number, x: number, y: number): number[] =>
  Array.from(pixels.subarray((y * size + x) * 4, (y * size + x) * 4 + 4))

describe('renderMark', () => {
  const size = 96
  const mark = renderMark(size)

  it('is straight RGBA, size squared', () => {
    expect(mark.length).toBe(size * size * 4)
  })

  it('leaves the corners transparent and fills the edge midpoints', () => {
    expect(pixel(mark, size, 0, 0)[3]).toBe(0)
    expect(pixel(mark, size, size - 1, size - 1)[3]).toBe(0)
    expect(pixel(mark, size, size / 2, 0)).toEqual([...TILE, 255])
    expect(pixel(mark, size, 0, size / 2)).toEqual([...TILE, 255])
  })

  it('paints the ring dark at six o’clock and leaves the hole in accent', () => {
    const ringY = Math.round(size / 2 + (6.2 / 24) * size)
    expect(pixel(mark, size, size / 2, ringY)).toEqual([...RING, 255])
    expect(pixel(mark, size, size / 2, size / 2)).toEqual([...TILE, 255])
  })

  it('opens the gap between -76° and +17.6°: eleven o’clock is tile, three o’clock is ring', () => {
    const radius = (6.2 / 24) * size
    const gapAngle = ((-76 + 46.8) * Math.PI) / 180
    const gapX = Math.round(size / 2 + Math.sin(gapAngle) * radius)
    const gapY = Math.round(size / 2 - Math.cos(gapAngle) * radius)
    expect(pixel(mark, size, gapX, gapY)).toEqual([...TILE, 255])
    expect(pixel(mark, size, Math.round(size / 2 + radius), size / 2)).toEqual([...RING, 255])
  })

  it('insets the tile inside the canvas when asked', () => {
    const inset = renderMark(size, { inset: 0.1 })
    expect(pixel(inset, size, size / 2, 0)[3]).toBe(0)
    expect(pixel(inset, size, size / 2, Math.round(size * 0.1) + 2)).toEqual([...TILE, 255])
    expect(pixel(inset, size, size / 2, size / 2)).toEqual([...TILE, 255])
  })
})
