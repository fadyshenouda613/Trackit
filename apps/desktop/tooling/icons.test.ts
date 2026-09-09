import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { encodeIcns, encodeIco, encodePng, ICNS_SIZES, ICO_SIZES } from './icons'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Width, height and the raw scanlines of a PNG this module wrote. */
function readPng(png: Buffer): { width: number; height: number; rows: Buffer } {
  expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  expect(png.toString('latin1', 12, 16)).toBe('IHDR')
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  expect(png[24]).toBe(8) // bit depth
  expect(png[25]).toBe(6) // RGBA
  const idatLength = png.readUInt32BE(33)
  expect(png.toString('latin1', 37, 41)).toBe('IDAT')
  const rows = inflateSync(png.subarray(41, 41 + idatLength))
  expect(png.toString('latin1', png.length - 8, png.length - 4)).toBe('IEND')
  return { width, height, rows }
}

const gradient = (size: number): Uint8Array => {
  const pixels = new Uint8Array(size * size * 4)
  for (let index = 0; index < size * size; index += 1) {
    pixels.set([index % 256, (index * 7) % 256, (index * 13) % 256, 255 - (index % 3)], index * 4)
  }
  return pixels
}

describe('encodePng', () => {
  it('writes an RGBA PNG whose scanlines inflate back to the pixels', () => {
    const size = 5
    const pixels = gradient(size)
    const { width, height, rows } = readPng(encodePng(size, pixels))
    expect([width, height]).toEqual([size, size])
    expect(rows.length).toBe(size * (1 + size * 4))
    for (let row = 0; row < size; row += 1) {
      const start = row * (1 + size * 4)
      expect(rows[start]).toBe(0) // filter type None
      expect(rows.subarray(start + 1, start + 1 + size * 4)).toEqual(
        Buffer.from(pixels.subarray(row * size * 4, (row + 1) * size * 4))
      )
    }
  })
})

describe('encodeIco', () => {
  const ico = encodeIco((size) => gradient(size))

  it('has one PNG entry per size, offsets in order, 256 written as 0', () => {
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(ICO_SIZES.length)

    let expectedOffset = 6 + 16 * ICO_SIZES.length
    ICO_SIZES.forEach((size, index) => {
      const entry = 6 + index * 16
      expect(ico[entry]).toBe(size === 256 ? 0 : size)
      expect(ico[entry + 1]).toBe(size === 256 ? 0 : size)
      expect(ico.readUInt16LE(entry + 4)).toBe(1)
      expect(ico.readUInt16LE(entry + 6)).toBe(32)
      const length = ico.readUInt32LE(entry + 8)
      const offset = ico.readUInt32LE(entry + 12)
      expect(offset).toBe(expectedOffset)
      const { width, height } = readPng(ico.subarray(offset, offset + length))
      expect([width, height]).toEqual([size, size])
      expectedOffset += length
    })
    expect(expectedOffset).toBe(ico.length)
  })
})

describe('encodeIcns', () => {
  const icns = encodeIcns((size) => gradient(size))

  it('is a walkable icns container with a PNG per Apple icon type', () => {
    expect(icns.toString('latin1', 0, 4)).toBe('icns')
    expect(icns.readUInt32BE(4)).toBe(icns.length)

    const seen: Record<string, number> = {}
    let cursor = 8
    while (cursor < icns.length) {
      const type = icns.toString('latin1', cursor, cursor + 4)
      const length = icns.readUInt32BE(cursor + 4)
      const { width, height } = readPng(icns.subarray(cursor + 8, cursor + length))
      expect(width).toBe(height)
      seen[type] = width
      cursor += length
    }
    expect(cursor).toBe(icns.length)
    expect(seen).toEqual(ICNS_SIZES)
  })
})
