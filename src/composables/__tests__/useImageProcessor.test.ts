import { describe, it, expect } from 'vitest'
import { applyAdjustments, computeDominantCells } from '../useImageProcessor'
import type { MatchResult } from '../useColorMatcher'

function makeImageData(data: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): ImageData {
  return { data: data as any, width, height, colorSpace: 'srgb' as PredefinedColorSpace }
}

describe('applyAdjustments', () => {
  it('returns ImageData with correct dimensions', () => {
    const data = new Uint8ClampedArray(10 * 10 * 4)
    const imageData = makeImageData(data, 10, 10)
    const result = applyAdjustments(imageData, 0, 0, 0)
    expect(result.width).toBe(10)
    expect(result.height).toBe(10)
  })

  it('brightness +100 makes all pixels white', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128; data[i + 1] = 128; data[i + 2] = 128; data[i + 3] = 255
    }
    const imageData = makeImageData(data, 4, 4)
    const result = applyAdjustments(imageData, 100, 0, 0)
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(255)
      expect(result.data[i + 1]).toBe(255)
      expect(result.data[i + 2]).toBe(255)
    }
  })

  it('brightness -100 makes gray pixels black', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128; data[i + 1] = 128; data[i + 2] = 128; data[i + 3] = 255
    }
    const imageData = makeImageData(data, 4, 4)
    const result = applyAdjustments(imageData, -100, 0, 0)
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(0)
      expect(result.data[i + 1]).toBe(0)
      expect(result.data[i + 2]).toBe(0)
    }
  })

  it('saturation -100 produces grayscale', () => {
    const data = new Uint8ClampedArray(2 * 2 * 4)
    // Fill red pixels
    data[0] = 255; data[1] = 0; data[2] = 0; data[3] = 255
    data[4] = 0; data[5] = 255; data[6] = 0; data[7] = 255
    data[8] = 0; data[9] = 0; data[10] = 255; data[11] = 255
    data[12] = 128; data[13] = 64; data[14] = 32; data[15] = 255
    const imageData = makeImageData(data, 2, 2)
    const result = applyAdjustments(imageData, 0, 0, -100)
    for (let i = 0; i < result.data.length; i += 4) {
      // All channels should be equal (grayscale)
      expect(result.data[i]).toBe(result.data[i + 1])
      expect(result.data[i]).toBe(result.data[i + 2])
    }
  })

  it('default adjustments (all zero) preserve values', () => {
    const data = new Uint8ClampedArray(4)
    data[0] = 100; data[1] = 150; data[2] = 200; data[3] = 255
    const imageData = makeImageData(data, 1, 1)
    const result = applyAdjustments(imageData, 0, 0, 0)
    // Should be close to original (may have tiny rounding differences)
    // Actually, contrast formula with cFactor=1: (r-128)*1+128 = r, no change
    // Brightness factor with 0: no change
    // Saturation factor with 1: no change
    expect(result.data[0]).toBe(100)
    expect(result.data[1]).toBe(150)
    expect(result.data[2]).toBe(200)
  })

  it('increases contrast', () => {
    const data = new Uint8ClampedArray(8)
    // Two pixels: dark and light
    data[0] = 64; data[1] = 64; data[2] = 64; data[3] = 255
    data[4] = 192; data[5] = 192; data[6] = 192; data[7] = 255
    const imageData = makeImageData(data, 2, 1)
    const result = applyAdjustments(imageData, 0, 100, 0)
    // With 100 contrast, cFactor = 2
    // Dark pixel: (64-128)*2+128 = -64*2+128 = 0 → rounded to 0
    // Light pixel: (192-128)*2+128 = 64*2+128 = 256 → clamped to 255
    expect(result.data[0]).toBe(0)
    expect(result.data[4]).toBe(255)
  })
})

import { resizeImage } from '../useImageProcessor'

// Mock a source with width/height — happy-dom canvas.width returns 0 inside module functions
function mockSource(w: number, h: number) {
  return { width: w, height: h, naturalWidth: w, naturalHeight: h } as HTMLImageElement
}

describe('resizeImage', () => {
  it('contain fits wide image within square bounds', () => {
    const src = mockSource(200, 100)
    const { canvas, imageX, imageY, imageW, imageH } = resizeImage(src, 30, 30, true)
    expect(canvas.width).toBe(30)
    expect(canvas.height).toBe(30)
    // 200:100 → 30:15 fits in 30×30
    expect(imageW).toBe(30)
    expect(imageH).toBe(15)
    // centered vertically → offsetY = (30-15)/2 = 7.5 → 7
    expect(imageX).toBe(0)
    expect(imageY).toBe(7)
  })

  it('contain fits tall image within square bounds', () => {
    const src = mockSource(100, 200)
    const { canvas, imageX, imageY, imageW, imageH } = resizeImage(src, 30, 30, true)
    expect(canvas.width).toBe(30)
    expect(canvas.height).toBe(30)
    // 100:200 → 15:30 fits in 30×30
    expect(imageW).toBe(15)
    expect(imageH).toBe(30)
    expect(imageX).toBe(7)
    expect(imageY).toBe(0)
  })

  it('contain same-aspect fits exactly', () => {
    const src = mockSource(100, 100)
    const { imageX, imageY, imageW, imageH } = resizeImage(src, 30, 30, true)
    expect(imageW).toBe(30)
    expect(imageH).toBe(30)
    expect(imageX).toBe(0)
    expect(imageY).toBe(0)
  })

  it('keepAspectRatio false stretches to exact size', () => {
    const src = mockSource(200, 100)
    const { canvas, imageX, imageY, imageW, imageH } = resizeImage(src, 30, 30, false)
    expect(canvas.width).toBe(30)
    expect(canvas.height).toBe(30)
    expect(imageW).toBe(30)
    expect(imageH).toBe(30)
    expect(imageX).toBe(0)
    expect(imageY).toBe(0)
  })
})

describe('computeDominantCells', () => {
  // Simple matcher: always return index 0 (red)
  function mockMatch(_r: number, _g: number, _b: number): MatchResult {
    return { index: 0, rgb: [255, 0, 0] }
  }

  function makeSolidImage(r: number, g: number, b: number, w: number, h: number): ImageData {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255
    }
    return { data: data as any, width: w, height: h, colorSpace: 'srgb' as PredefinedColorSpace }
  }

  it('returns correct grid dimensions', () => {
    const img = makeSolidImage(128, 128, 128, 100, 100)
    const result = computeDominantCells(img, 10, 10, false, mockMatch)
    expect(result.cells.length).toBe(10)
    expect(result.cells[0].length).toBe(10)
  })

  it('stretch mode fills all cells', () => {
    const img = makeSolidImage(255, 0, 0, 200, 100)
    const result = computeDominantCells(img, 4, 4, false, mockMatch)
    // All cells should be index 0 (our mock always returns 0)
    for (const row of result.cells) {
      for (const cell of row) {
        expect(cell).toBe(0)
      }
    }
    expect(result.imageCols).toBe(4)
    expect(result.imageRows).toBe(4)
    expect(result.imageX).toBe(0)
    expect(result.imageY).toBe(0)
  })

  it('contain mode centers image and leaves nulls outside', () => {
    // 200×100 → 4×4 contain: scale = min(4/200, 4/100) = 0.02
    // imageW = 200*0.02 = 4, imageH = 100*0.02 = 2
    // imageX = (4-4)/2 = 0, imageY = (4-2)/2 = 1
    const img = makeSolidImage(255, 0, 0, 200, 100)
    const result = computeDominantCells(img, 4, 4, true, mockMatch)

    // Row 0 (imageY=1 so row 0 is outside): all null
    for (const cell of result.cells[0]) {
      expect(cell).toBeNull()
    }
    // Row 1-2 (image rows): all 0
    for (let r = 1; r <= 2; r++) {
      for (const cell of result.cells[r]) {
        expect(cell).toBe(0)
      }
    }
    // Row 3 (outside): all null
    for (const cell of result.cells[3]) {
      expect(cell).toBeNull()
    }
  })

  it('picks majority palette index in region', () => {
    // 2×2 image, 1×1 grid: all 4 pixels map to one cell
    // make a matcher that returns different indices for different colors
    function selectiveMatch(r: number, _g: number, _b: number): MatchResult {
      if (r > 200) return { index: 1, rgb: [255, 0, 0] }
      return { index: 0, rgb: [0, 0, 255] }
    }
    const data = new Uint8ClampedArray(2 * 2 * 4)
    // 3 blue-ish pixels (r=100), 1 red-ish (r=250)
    data[0] = 100; data[1] = 0; data[2] = 0; data[3] = 255
    data[4] = 100; data[5] = 0; data[6] = 0; data[7] = 255
    data[8] = 100; data[9] = 0; data[10] = 0; data[11] = 255
    data[12] = 250; data[13] = 0; data[14] = 0; data[15] = 255
    const img: ImageData = { data: data as any, width: 2, height: 2, colorSpace: 'srgb' as PredefinedColorSpace }

    const result = computeDominantCells(img, 1, 1, false, selectiveMatch)
    // index 0 (blue) appears 3 times, index 1 (red) appears 1 time → winner is 0
    expect(result.cells[0][0]).toBe(0)
  })
})
