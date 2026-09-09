import { nativeImage, type NativeImage } from 'electron'
import { renderMark } from './mark'

/*
 * The window icon: the Trackit mark, rasterized rather than shipped.
 *
 * Same reasoning as the tray glyph next door — this is a rounded square and one
 * arc, and a build asset for that is a build asset to keep in sync with
 * Logo.tsx. The shape itself lives in mark.ts, which the build also draws the
 * installer icons from, so the window and the installer show one mark
 * described once.
 */

const SIZE = 256

export function appIcon(): NativeImage {
  const rgba = renderMark(SIZE)
  // createFromBitmap wants BGRA with the colour premultiplied by alpha.
  const buffer = Buffer.alloc(rgba.length)
  for (let offset = 0; offset < rgba.length; offset += 4) {
    const alpha = rgba[offset + 3] / 255
    buffer[offset] = Math.round(rgba[offset + 2] * alpha) // B
    buffer[offset + 1] = Math.round(rgba[offset + 1] * alpha) // G
    buffer[offset + 2] = Math.round(rgba[offset] * alpha) // R
    buffer[offset + 3] = rgba[offset + 3]
  }
  return nativeImage.createFromBitmap(buffer, { width: SIZE, height: SIZE })
}
