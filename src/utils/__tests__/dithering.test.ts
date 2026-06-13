import { describe, it, expect } from 'vitest'
import { floydSteinbergDither, atkinsonDither } from '../dithering'

type MockMatchResult = { index: number; rgb: [number, number, number] }

function createTestImageData(width: number, height: number, fillRgb: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fillRgb[0]
    data[i * 4 + 1] = fillRgb[1]
    data[i * 4 + 2] = fillRgb[2]
    data[i * 4 + 3] = 255
  }
  return { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace }
}

function mockMatchColor(r: number, g: number, b: number): MockMatchResult {
  const rq = r < 128 ? 0 : 255
  const gq = g < 128 ? 0 : 255
  const bq = b < 128 ? 0 : 255
  return { index: 0, rgb: [rq, gq, bq] }
}

describe('floydSteinbergDither', () => {
  it('returns same dimensions as input', () => {
    const img = createTestImageData(10, 10, [128, 128, 128])
    const result = floydSteinbergDither(img, mockMatchColor, 100)
    expect(result.length).toBe(10)
    expect(result[0].length).toBe(10)
  })

  it('does not throw on 1x1 image', () => {
    const img = createTestImageData(1, 1, [128, 128, 128])
    expect(() => floydSteinbergDither(img, mockMatchColor, 100)).not.toThrow()
  })

  it('with strength 0 behaves like nearest-neighbor only (no error diffusion)', () => {
    const img = createTestImageData(4, 4, [128, 128, 128])
    const result = floydSteinbergDither(img, mockMatchColor, 0)
    const firstIndex = result[0][0].colorIndex
    const allSame = result.flat().every(cell => cell.colorIndex === firstIndex)
    expect(allSame).toBe(true)
  })

  it('with strength 100 completes without error', () => {
    const img = createTestImageData(4, 4, [128, 128, 128])
    const result = floydSteinbergDither(img, mockMatchColor, 100)
    expect(result.flat().length).toBe(16)
  })
})

describe('atkinsonDither', () => {
  it('returns same dimensions as input', () => {
    const img = createTestImageData(5, 5, [128, 128, 128])
    const result = atkinsonDither(img, mockMatchColor, 100)
    expect(result.length).toBe(5)
    expect(result[0].length).toBe(5)
  })

  it('completes without error', () => {
    const img = createTestImageData(3, 3, [128, 128, 128])
    const result = atkinsonDither(img, mockMatchColor, 100)
    expect(result.flat().length).toBe(9)
  })
})
