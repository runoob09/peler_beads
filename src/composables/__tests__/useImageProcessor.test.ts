import { describe, it, expect } from 'vitest'
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

// computeDominantCells / computeAverageCells / computeBucketCells require canvas
// operations (drawImage + getImageData) not supported by happy-dom.
// Their logic is tested indirectly through pipeline integration.
