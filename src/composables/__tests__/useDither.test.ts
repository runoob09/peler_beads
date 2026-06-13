import { describe, it, expect } from 'vitest'
import { applyDithering } from '../useDither'
import type { PaletteColor } from '../../types'

interface TestColor extends PaletteColor {
  lab: [number, number, number]
}

function makeColor(hex: string): TestColor {
  return {
    id: hex,
    name: hex,
    hex: hex.toUpperCase(),
    brand: 'test',
    lab: [0, 0, 0],
  }
}

function simpleMatch(r: number, g: number, b: number) {
  const bright = (r + g + b) / 3
  return bright < 128
    ? { index: 1, rgb: [0, 0, 0] as [number, number, number] }
    : { index: 0, rgb: [255, 255, 255] as [number, number, number] }
}

function createTestImageData(): ImageData {
  const w = 4, h = 4
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = 128
    data[i * 4 + 1] = 128
    data[i * 4 + 2] = 128
    data[i * 4 + 3] = 255
  }
  return { data, width: w, height: h, colorSpace: 'srgb' as PredefinedColorSpace }
}

describe('applyDithering', () => {
  it('returns BeadGrid with correct dimensions for none', () => {
    const img = createTestImageData()
    const palette = [makeColor('#FFFFFF'), makeColor('#000000')]
    const result = applyDithering(img, palette, 'none', 0, simpleMatch)
    expect(result.cells.length).toBe(4)
    expect(result.cells[0].length).toBe(4)
  })

  it('returns BeadGrid with correct dimensions for floydSteinberg', () => {
    const img = createTestImageData()
    const palette = [makeColor('#FFFFFF'), makeColor('#000000')]
    const result = applyDithering(img, palette, 'floydSteinberg', 100, simpleMatch)
    expect(result.cells.length).toBe(4)
    expect(result.cells[0].length).toBe(4)
  })

  it('returns BeadGrid with correct dimensions for atkinson', () => {
    const img = createTestImageData()
    const palette = [makeColor('#FFFFFF'), makeColor('#000000')]
    const result = applyDithering(img, palette, 'atkinson', 100, simpleMatch)
    expect(result.cells.length).toBe(4)
    expect(result.cells[0].length).toBe(4)
  })

  it('includes palette in result', () => {
    const img = createTestImageData()
    const palette = [makeColor('#FFFFFF'), makeColor('#000000')]
    const result = applyDithering(img, palette, 'none', 0, simpleMatch)
    expect(result.palette).toBe(palette)
    expect(result.rows).toBe(4)
    expect(result.cols).toBe(4)
  })

  it('nearest neighbor assigns cells', () => {
    const img = createTestImageData()
    const palette = [makeColor('#FFFFFF'), makeColor('#000000')]
    const result = applyDithering(img, palette, 'none', 0, simpleMatch)
    expect(result.cells[0][0].row).toBe(0)
    expect(result.cells[0][0].col).toBe(0)
    expect(result.cells[3][3].row).toBe(3)
    expect(result.cells[3][3].col).toBe(3)
  })
})
