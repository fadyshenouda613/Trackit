import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import type { Plugin } from 'vite'
import { renderMark } from '../src/main/mark'

/*
 * The installer and bundle icons, written from src/main/mark.ts at build
 * time rather than kept as files: an .ico for the Windows executable and
 * installer, an .icns for the macOS bundle. electron-builder picks both up
 * from build/, which is git-ignored — nothing in the repository can drift
 * from the mark the window draws.
 *
 * The three container formats below are small enough to write by hand, and
 * doing so keeps the build free of an image toolchain. Every entry inside the
 * ICO and the ICNS is a PNG, which Windows has accepted since Vista and macOS
 * since 10.7.
 */

/** Straight RGBA pixels for a square icon of the given edge. */
export type Raster = (size: number) => Uint8Array

/** Every size Windows will ask for, from the tray to the large-icon view. */
export const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const

/**
 * Apple's icon types and the pixel edge each carries. The 2x types repeat a
 * size the 1x set already has, so the same raster serves both.
 */
export const ICNS_SIZES: Record<string, number> = {
  icp4: 16,
  icp5: 32,
  icp6: 64,
  ic07: 128,
  ic08: 256,
  ic09: 512,
  ic10: 1024,
  ic11: 32,
  ic12: 64,
  ic13: 256,
  ic14: 512
}

/** How far the mark sits in from the canvas edge on macOS, where icons have a margin. */
const MAC_INSET = 0.1

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** A truecolour-with-alpha PNG, one unfiltered scanline per row. */
export function encodePng(size: number, pixels: Uint8Array): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  // compression, filter and interlace stay 0

  const stride = size * 4
  const scanlines = Buffer.alloc(size * (1 + stride))
  for (let row = 0; row < size; row += 1) {
    // Filter byte 0 (None), then the row's pixels.
    scanlines.set(pixels.subarray(row * stride, (row + 1) * stride), row * (1 + stride) + 1)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

/** A Windows icon: a directory of PNG-compressed entries, one per size. */
export function encodeIco(raster: Raster): Buffer {
  const images = ICO_SIZES.map((size) => encodePng(size, raster(size)))
  const directory = Buffer.alloc(6 + 16 * images.length)
  directory.writeUInt16LE(0, 0) // reserved
  directory.writeUInt16LE(1, 2) // type: icon
  directory.writeUInt16LE(images.length, 4)

  let offset = directory.length
  images.forEach((image, index) => {
    const size = ICO_SIZES[index]
    const entry = 6 + index * 16
    // A 256px edge is written as 0: the field is one byte.
    directory[entry] = size % 256
    directory[entry + 1] = size % 256
    directory[entry + 2] = 0 // palette size
    directory[entry + 3] = 0 // reserved
    directory.writeUInt16LE(1, entry + 4) // colour planes
    directory.writeUInt16LE(32, entry + 6) // bits per pixel
    directory.writeUInt32LE(image.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })

  return Buffer.concat([directory, ...images])
}

/** A macOS icon: the 'icns' container with a PNG per icon type. */
export function encodeIcns(raster: Raster): Buffer {
  const rendered = new Map<number, Buffer>()
  const png = (size: number): Buffer => {
    let image = rendered.get(size)
    if (!image) {
      image = encodePng(size, raster(size))
      rendered.set(size, image)
    }
    return image
  }

  const entries = Object.entries(ICNS_SIZES).map(([type, size]) => {
    const image = png(size)
    const header = Buffer.alloc(8)
    header.write(type, 0, 4, 'latin1')
    header.writeUInt32BE(8 + image.length, 4)
    return Buffer.concat([header, image])
  })

  const total = entries.reduce((sum, entry) => sum + entry.length, 8)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 4, 'latin1')
  header.writeUInt32BE(total, 4)
  return Buffer.concat([header, ...entries])
}

/** Writes icon.ico and icon.icns into `directory`, and names what it wrote. */
export function writeAppIcons(directory: string): string[] {
  mkdirSync(directory, { recursive: true })
  const files = [
    ['icon.ico', encodeIco((size) => renderMark(size))],
    ['icon.icns', encodeIcns((size) => renderMark(size, { inset: MAC_INSET }))]
  ] as const
  for (const [name, data] of files) writeFileSync(join(directory, name), data)
  return files.map(([name]) => name)
}

/**
 * Draws the icons at the start of every main-process build, `dev` included:
 * a few million pixels of arithmetic, well under the time Vite spends on the
 * rest, and cheaper than a rule about when to skip it.
 */
export const appIconsPlugin = (directory: string): Plugin => ({
  name: 'trackit:app-icons',
  buildStart() {
    const written = writeAppIcons(directory)
    this.info(`app icons drawn from src/main/mark.ts: ${written.join(', ')}`)
  }
})
