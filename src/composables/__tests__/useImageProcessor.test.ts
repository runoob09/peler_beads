import { describe, it, expect } from 'vitest'
import { applyAdjustments, posterize } from '../useImageProcessor'

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

describe('posterize', () => {
  it('reduces colors to discrete levels', () => {
    const data = new Uint8ClampedArray(16)
    // 4 pixels with gradient-like values
    data[0] = 0;   data[1] = 0;   data[2] = 0;   data[3] = 255
    data[4] = 40;  data[5] = 40;  data[6] = 40;  data[7] = 255
    data[8] = 200; data[9] = 200; data[10] = 200; data[11] = 255
    data[12] = 255; data[13] = 255; data[14] = 255; data[15] = 255
    const imageData = makeImageData(data, 2, 2)
    const result = posterize(imageData, 6)
    // With 6 levels, step = 51
    // 40/51 ≈ 0.78 → round to 1 → 1*51 = 51
    // 200/51 ≈ 3.92 → round to 4 → 4*51 = 204
    expect(result.data[0]).toBe(0)
    expect(result.data[4]).toBe(51)
    expect(result.data[8]).toBe(204)
    expect(result.data[12]).toBe(255)
  })

  it('preserves alpha channel', () => {
    const data = new Uint8ClampedArray(4)
    data[0] = 100; data[1] = 100; data[2] = 100; data[3] = 255
    const imageData = makeImageData(data, 1, 1)
    const result = posterize(imageData, 6)
    expect(result.data[3]).toBe(255)
  })

  it('returns same dimensions', () => {
    const data = new Uint8ClampedArray(5 * 3 * 4)
    const imageData = makeImageData(data, 5, 3)
    const result = posterize(imageData, 4)
    expect(result.width).toBe(5)
    expect(result.height).toBe(3)
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
