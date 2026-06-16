import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'

type UseImageEditorFn = typeof import('../useImageEditor').useImageEditor

function makeFile(): File {
  return new File(['x'], 'test.png', { type: 'image/png' })
}

const IMG_W = 100
const IMG_H = 80

// Mock Image: happy-dom cannot decode real images, so we override Image
// to simulate a successful decode with known dimensions.
class MockImage {
  onload: (() => void) | null = null
  onerror: ((_ev?: string | Event) => void) | null = null
  naturalWidth = IMG_W
  naturalHeight = IMG_H
  width = IMG_W
  height = IMG_H

  set src(_url: string) {
    queueMicrotask(() => {
      this.onload?.()
    })
  }
}

let useImageEditor: UseImageEditorFn

beforeAll(async () => {
  // Stub must happen before the module is loaded so that loadImageFromFile
  // picks up the fake Image constructor.
  vi.stubGlobal('Image', MockImage)
  const mod = await import('../useImageEditor')
  useImageEditor = mod.useImageEditor
})

describe('useImageEditor', () => {
  let editor: ReturnType<UseImageEditorFn>

  beforeEach(() => {
    editor = useImageEditor()
  })

  describe('loadImage', () => {
    it('loads image and sets default crop rect covering full image', async () => {
      await editor.loadImage(makeFile())
      expect(editor.state.sourceImage).not.toBeNull()
      expect(editor.state.sourceImage!.naturalWidth).toBeGreaterThan(0)
      expect(editor.state.cropRect).toEqual({
        x: 0, y: 0,
        w: editor.state.sourceImage!.naturalWidth,
        h: editor.state.sourceImage!.naturalHeight,
      })
    })
  })

  describe('setCropRect', () => {
    it('clamps crop rect to image boundaries', async () => {
      await editor.loadImage(makeFile())
      const w = editor.state.sourceImage!.naturalWidth
      const h = editor.state.sourceImage!.naturalHeight
      editor.setCropRect({ x: -10, y: -10, w: w + 20, h: h + 20 })
      expect(editor.state.cropRect).toEqual({ x: 0, y: 0, w, h })
    })

    it('enforces minimum crop size of 10x10', async () => {
      await editor.loadImage(makeFile())
      editor.setCropRect({ x: 0, y: 0, w: 5, h: 5 })
      expect(editor.state.cropRect!.w).toBe(10)
      expect(editor.state.cropRect!.h).toBe(10)
    })
  })

  describe('rotate', () => {
    it('cycles rotation 0 → 90 → 180 → 270 → 0 for cw', async () => {
      await editor.loadImage(makeFile())
      expect(editor.state.rotation).toBe(0)
      editor.rotate('cw')
      expect(editor.state.rotation).toBe(90)
      editor.rotate('cw')
      expect(editor.state.rotation).toBe(180)
      editor.rotate('cw')
      expect(editor.state.rotation).toBe(270)
      editor.rotate('cw')
      expect(editor.state.rotation).toBe(0)
    })

    it('cycles rotation 0 → 270 → 180 → 90 → 0 for ccw', async () => {
      await editor.loadImage(makeFile())
      editor.rotate('ccw')
      expect(editor.state.rotation).toBe(270)
      editor.rotate('ccw')
      expect(editor.state.rotation).toBe(180)
      editor.rotate('ccw')
      expect(editor.state.rotation).toBe(90)
      editor.rotate('ccw')
      expect(editor.state.rotation).toBe(0)
    })

    it('swaps crop rect dimensions when rotating to 90/270', async () => {
      await editor.loadImage(makeFile())
      // Use crop that fits within image (100×80) to avoid clamping
      const w0 = 40
      const h0 = 30
      editor.setCropRect({ x: 10, y: 10, w: w0, h: h0 })
      expect(editor.state.cropRect!.w).toBe(w0)
      expect(editor.state.cropRect!.h).toBe(h0)
      editor.rotate('cw') // 0 → 90
      expect(editor.state.cropRect!.w).toBe(h0)
      expect(editor.state.cropRect!.h).toBe(w0)
    })
  })

  describe('flip', () => {
    it('toggles flipH', async () => {
      await editor.loadImage(makeFile())
      expect(editor.state.flipH).toBe(false)
      editor.flip('h')
      expect(editor.state.flipH).toBe(true)
      editor.flip('h')
      expect(editor.state.flipH).toBe(false)
    })

    it('toggles flipV', async () => {
      await editor.loadImage(makeFile())
      expect(editor.state.flipV).toBe(false)
      editor.flip('v')
      expect(editor.state.flipV).toBe(true)
      editor.flip('v')
      expect(editor.state.flipV).toBe(false)
    })
  })

  describe('setFilter', () => {
    it('sets brightness within 0-200 range', async () => {
      await editor.loadImage(makeFile())
      editor.setFilter('brightness', 150)
      expect(editor.state.brightness).toBe(150)
    })

    it('clamps filter value to 0-200', async () => {
      await editor.loadImage(makeFile())
      editor.setFilter('brightness', -50)
      expect(editor.state.brightness).toBe(0)
      editor.setFilter('brightness', 300)
      expect(editor.state.brightness).toBe(200)
    })

    it('sets contrast and saturation', async () => {
      await editor.loadImage(makeFile())
      editor.setFilter('contrast', 120)
      editor.setFilter('saturation', 80)
      expect(editor.state.contrast).toBe(120)
      expect(editor.state.saturation).toBe(80)
    })
  })

  describe('reset', () => {
    it('resets all edit parameters to defaults', async () => {
      await editor.loadImage(makeFile())
      editor.setCropRect({ x: 0, y: 0, w: 100, h: 100 })
      editor.rotate('cw')
      editor.flip('h')
      editor.setFilter('brightness', 150)
      editor.setFilter('contrast', 120)
      editor.setFilter('saturation', 80)

      editor.reset()

      const w = editor.state.sourceImage!.naturalWidth
      const h = editor.state.sourceImage!.naturalHeight
      expect(editor.state.cropRect).toEqual({ x: 0, y: 0, w, h })
      expect(editor.state.rotation).toBe(0)
      expect(editor.state.flipH).toBe(false)
      expect(editor.state.flipV).toBe(false)
      expect(editor.state.brightness).toBe(100)
      expect(editor.state.contrast).toBe(100)
      expect(editor.state.saturation).toBe(100)
    })
  })

  describe('invalid input', () => {
    it('throws on non-image file', async () => {
      const textFile = new File(['not an image'], 'test.txt', { type: 'text/plain' })
      await expect(editor.loadImage(textFile)).rejects.toThrow()
    })
  })
})
