import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest'

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

    it('handles multi-step rotation: 0→90→180 returns correct crop position', async () => {
      await editor.loadImage(makeFile())
      // Image is 100x80 (based on the mock)
      const w = editor.state.sourceImage!.naturalWidth
      const h = editor.state.sourceImage!.naturalHeight
      editor.setCropRect({ x: 10, y: 10, w: 40, h: 30 })
      editor.rotate('cw')  // 0→90
      editor.rotate('cw')  // 90→180
      // After 180°, the crop should be at the opposite corner with same dimensions
      expect(editor.state.cropRect!.w).toBe(40)
      expect(editor.state.cropRect!.h).toBe(30)
      expect(editor.state.cropRect!.x).toBe(w - 10 - 40)
      expect(editor.state.cropRect!.y).toBe(h - 10 - 30)
    })

    it('handles full rotation cycle: 0→90→180→270→0 restores original crop', async () => {
      await editor.loadImage(makeFile())
      editor.setCropRect({ x: 10, y: 10, w: 40, h: 30 })
      editor.rotate('cw')
      editor.rotate('cw')
      editor.rotate('cw')
      editor.rotate('cw')
      expect(editor.state.cropRect).toEqual({ x: 10, y: 10, w: 40, h: 30 })
      expect(editor.state.rotation).toBe(0)
    })

    it('setCropEnabled toggles crop mode', async () => {
      await editor.loadImage(makeFile())
      expect(editor.state.cropEnabled).toBe(false)
      editor.setCropEnabled(true)
      expect(editor.state.cropEnabled).toBe(true)
      editor.setCropEnabled(false)
      expect(editor.state.cropEnabled).toBe(false)
    })

    it('calling setCropRect before loadImage is a no-op', () => {
      editor.setCropRect({ x: 0, y: 0, w: 50, h: 50 })
      expect(editor.state.cropRect).toBeNull()
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

  describe('render', () => {
    // Helper: mock canvas context for happy-dom (no native canvas support)
    function createMockCtx() {
      const state = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        drawImageCalls: [] as any[],
        savedStates: 0,
        actions: [] as string[],
      }
      return {
        _state: state,
        save() { state.savedStates++; state.actions.push('save') },
        restore() { state.actions.push('restore') },
        translate(_x: number, _y: number) { state.actions.push(`translate(${_x},${_y})`) },
        rotate(_a: number) { state.actions.push(`rotate(${_a})`) },
        scale(_x: number, _y: number) { state.actions.push(`scale(${_x},${_y})`) },
        drawImage(...args: any[]) { state.drawImageCalls.push(args); state.actions.push('drawImage') },
        clearRect(_x: number, _y: number, _w: number, _h: number) { state.actions.push('clearRect') },
        getImageData(_x: number, _y: number, _w: number, _h: number) {
          state.actions.push('getImageData')
          const data = new Uint8ClampedArray(_w * _h * 4)
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 100; data[i + 1] = 150; data[i + 2] = 200; data[i + 3] = 255
          }
          return { data, width: _w, height: _h } as ImageData
        },
        putImageData(_d: ImageData, _x: number, _y: number) { state.actions.push('putImageData') },
        get fillStyle() { return state.fillStyle },
        set fillStyle(v: string) { state.fillStyle = v },
        get strokeStyle() { return state.strokeStyle },
        set strokeStyle(v: string) { state.strokeStyle = v },
        get lineWidth() { return state.lineWidth },
        set lineWidth(v: number) { state.lineWidth = v },
      }
    }

    it('does not throw when previewCanvas and sourceImage are set', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas

      expect(() => editor.render()).not.toThrow()
    })

    it('returns early when previewCanvas is null', async () => {
      await editor.loadImage(makeFile())
      editor.previewCanvas.value = null
      expect(() => editor.render()).not.toThrow()
    })

    it('returns early when sourceImage is null', () => {
      editor.previewCanvas.value = document.createElement('canvas')
      expect(() => editor.render()).not.toThrow()
    })

    it('returns early when cropRect is null', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas
      editor.state.cropRect = null

      expect(() => editor.render()).not.toThrow()
      // No draw actions should have occurred
      expect(mockCtx._state.actions).toEqual([])
    })

    it('clears canvas before drawing', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas

      editor.render()

      const actions = mockCtx._state.actions
      const clearIdx = actions.indexOf('clearRect')
      const drawIdx = actions.indexOf('drawImage')
      expect(clearIdx).toBeGreaterThanOrEqual(0)
      expect(drawIdx).toBeGreaterThanOrEqual(0)
      expect(clearIdx).toBeLessThan(drawIdx)
    })

    it('saves and restores context state around drawing', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas

      editor.render()

      const actions = mockCtx._state.actions
      const saveIdx = actions.indexOf('save')
      const restoreIdx = actions.indexOf('restore')
      expect(saveIdx).toBeGreaterThanOrEqual(0)
      expect(restoreIdx).toBeGreaterThanOrEqual(0)
      expect(saveIdx).toBeLessThan(restoreIdx)
    })

    it('applies rotation transform when rotation is non-zero', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas
      editor.state.rotation = 90

      editor.render()

      expect(mockCtx._state.actions).toContain('rotate(1.5707963267948966)')
    })

    it('does not apply rotation when rotation is 0', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas
      editor.state.rotation = 0

      editor.render()

      const rotateCalls = mockCtx._state.actions.filter((a: string) => a.startsWith('rotate'))
      expect(rotateCalls).toHaveLength(0)
    })

    it('applies flip horizontal transform', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas
      editor.state.flipH = true

      editor.render()

      expect(mockCtx._state.actions).toContain('scale(-1,1)')
    })

    it('applies flip vertical transform', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas
      editor.state.flipV = true

      editor.render()

      expect(mockCtx._state.actions).toContain('scale(1,-1)')
    })

    it('does not apply flip when both flipH and flipV are false', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas

      editor.render()

      const scaleCalls = mockCtx._state.actions.filter((a: string) => a.startsWith('scale'))
      expect(scaleCalls).toHaveLength(0)
    })

    it('draws the correct crop region from source image', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas
      editor.setCropRect({ x: 10, y: 20, w: 50, h: 60 })

      editor.render()

      const drawCall = mockCtx._state.drawImageCalls[0]
      // drawImage args: [img, sx, sy, sw, sh, dx, dy, dw, dh]
      expect(drawCall[1]).toBe(10)  // sx = cropRect.x
      expect(drawCall[2]).toBe(20)  // sy = cropRect.y
      expect(drawCall[3]).toBe(50)  // sw = cropRect.w
      expect(drawCall[4]).toBe(60)  // sh = cropRect.h
    })

    it('applies filter pipeline after drawing', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas
      editor.setFilter('brightness', 150)
      editor.setFilter('contrast', 120)
      editor.setFilter('saturation', 80)

      editor.render()

      const actions = mockCtx._state.actions
      const drawIdx = actions.indexOf('drawImage')
      const getDataIdx = actions.indexOf('getImageData')
      const putDataIdx = actions.indexOf('putImageData')
      expect(drawIdx).toBeGreaterThanOrEqual(0)
      expect(getDataIdx).toBeGreaterThan(drawIdx)
      expect(putDataIdx).toBeGreaterThan(getDataIdx)
    })

    it('centers and scales image to fit canvas', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 400; canvas.height = 400
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas

      editor.render()

      // Should translate to canvas center
      expect(mockCtx._state.actions).toContain('translate(200,200)')
    })

    it('allows combining rotation, flip, and crop in a single render', async () => {
      await editor.loadImage(makeFile())
      const canvas = document.createElement('canvas')
      canvas.width = 300; canvas.height = 300
      const mockCtx = createMockCtx() as any
      canvas.getContext = () => mockCtx
      editor.previewCanvas.value = canvas
      editor.state.rotation = 90
      editor.state.flipH = true
      editor.setCropRect({ x: 0, y: 0, w: 40, h: 30 })

      expect(() => editor.render()).not.toThrow()
      expect(mockCtx._state.actions).toContain('scale(-1,1)')
      expect(mockCtx._state.actions).toContain('rotate(1.5707963267948966)')
    })
  })

  describe('getEditedBlob', () => {
    let originalGetContext: any
    let originalToBlob: any

    // Minimal PNG bytes (valid 1×1 red PNG)
    const FAKE_PNG = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])

    function createMockCtx() {
      const state = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        drawImageCalls: [] as any[],
        savedStates: 0,
        actions: [] as string[],
      }
      return {
        _state: state,
        save() { state.savedStates++; state.actions.push('save') },
        restore() { state.actions.push('restore') },
        translate(_x: number, _y: number) { state.actions.push(`translate(${_x},${_y})`) },
        rotate(_a: number) { state.actions.push(`rotate(${_a})`) },
        scale(_x: number, _y: number) { state.actions.push(`scale(${_x},${_y})`) },
        drawImage(...args: any[]) { state.drawImageCalls.push(args); state.actions.push('drawImage') },
        clearRect(_x: number, _y: number, _w: number, _h: number) { state.actions.push('clearRect') },
        getImageData(_x: number, _y: number, _w: number, _h: number) {
          state.actions.push('getImageData')
          const data = new Uint8ClampedArray(_w * _h * 4)
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 100; data[i + 1] = 150; data[i + 2] = 200; data[i + 3] = 255
          }
          return { data, width: _w, height: _h } as ImageData
        },
        putImageData(_d: ImageData, _x: number, _y: number) { state.actions.push('putImageData') },
        get fillStyle() { return state.fillStyle },
        set fillStyle(v: string) { state.fillStyle = v },
        get strokeStyle() { return state.strokeStyle },
        set strokeStyle(v: string) { state.strokeStyle = v },
        get lineWidth() { return state.lineWidth },
        set lineWidth(v: number) { state.lineWidth = v },
      }
    }

    beforeEach(() => {
      originalGetContext = HTMLCanvasElement.prototype.getContext
      originalToBlob = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.getContext = function (..._args: any[]) {
        return createMockCtx() as any
      }
      HTMLCanvasElement.prototype.toBlob = function (cb: (blob: Blob | null) => void, _type?: string) {
        cb(new Blob([FAKE_PNG], { type: _type ?? 'image/png' }))
      }
    })

    afterEach(() => {
      HTMLCanvasElement.prototype.getContext = originalGetContext
      HTMLCanvasElement.prototype.toBlob = originalToBlob
    })

    it('returns a PNG blob from the edited image', async () => {
      await editor.loadImage(makeFile())
      const blob = await editor.getEditedBlob()
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/png')
      expect(blob.size).toBeGreaterThan(0)
    })

    it('applies crop when getting blob', async () => {
      await editor.loadImage(makeFile())
      editor.setCropRect({ x: 0, y: 0, w: 50, h: 50 })
      const blob = await editor.getEditedBlob()
      expect(blob).toBeInstanceOf(Blob)
    })

    it('works with rotation applied', async () => {
      await editor.loadImage(makeFile())
      editor.state.rotation = 90
      const blob = await editor.getEditedBlob()
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/png')
    })

    it('works with flip applied', async () => {
      await editor.loadImage(makeFile())
      editor.state.flipH = true
      editor.state.flipV = true
      const blob = await editor.getEditedBlob()
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/png')
    })

    it('works with filters applied', async () => {
      await editor.loadImage(makeFile())
      editor.setFilter('brightness', 150)
      editor.setFilter('contrast', 80)
      editor.setFilter('saturation', 120)
      const blob = await editor.getEditedBlob()
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/png')
    })

    it('works with full pipeline: crop + rotation + flip + filters', async () => {
      await editor.loadImage(makeFile())
      editor.setCropRect({ x: 10, y: 10, w: 40, h: 30 })
      editor.state.rotation = 90
      editor.state.flipH = true
      editor.setFilter('brightness', 120)
      editor.setFilter('contrast', 110)
      editor.setFilter('saturation', 90)
      const blob = await editor.getEditedBlob()
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/png')
    })

    it('returns empty blob when sourceImage is null', async () => {
      const blob = await editor.getEditedBlob()
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.size).toBe(0)
    })
  })
})
