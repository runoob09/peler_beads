import { reactive, ref, type Ref } from 'vue'

export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

export interface ImageEditState {
  sourceImage: HTMLImageElement | null
  cropEnabled: boolean
  cropRect: CropRect | null
  rotation: 0 | 90 | 180 | 270
  flipH: boolean
  flipV: boolean
  brightness: number
  contrast: number
  saturation: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function clampChannel(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

// ---- HSL / RGB conversion helpers ----

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) {
    return [0, 0, l] // achromatic
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
    case g: h = ((b - r) / d + 2) / 6; break
    case b: h = ((r - g) / d + 4) / 6; break
  }

  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255)
  const g = Math.round(hue2rgb(p, q, h) * 255)
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255)

  return [r, g, b]
}

// ---- Filter application ----

function applyFilters(
  imageData: ImageData,
  brightness: number,
  contrast: number,
  saturation: number,
): void {
  const data = imageData.data
  const brightFactor = brightness / 100
  const contrastFactor = contrast / 100
  const satFactor = saturation / 100

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    // Brightness: multiplicative
    r = clampChannel(r * brightFactor)
    g = clampChannel(g * brightFactor)
    b = clampChannel(b * brightFactor)

    // Contrast: (pixel - 128) * factor + 128
    r = clampChannel((r - 128) * contrastFactor + 128)
    g = clampChannel((g - 128) * contrastFactor + 128)
    b = clampChannel((b - 128) * contrastFactor + 128)

    // Saturation: RGB -> HSL, adjust S, -> RGB
    if (satFactor !== 1) {
      const [h, s, l] = rgbToHsl(r, g, b)
      const newS = clamp(s * satFactor, 0, 1)
      const [nr, ng, nb] = hslToRgb(h, newS, l)
      r = clampChannel(nr)
      g = clampChannel(ng)
      b = clampChannel(nb)
    }

    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
}

// ---- Canvas drawing helper ----

function drawTransformedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cropRect: CropRect | null,
  rotation: 0 | 90 | 180 | 270,
  flipH: boolean,
  flipV: boolean,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const rotRad = (rotation * Math.PI) / 180
  const srcW = cropRect ? cropRect.w : img.naturalWidth
  const srcH = cropRect ? cropRect.h : img.naturalHeight

  // Effective output size after rotation
  const absCos = Math.abs(Math.cos(rotRad))
  const absSin = Math.abs(Math.sin(rotRad))
  const outputW = srcW * absCos + srcH * absSin
  const outputH = srcW * absSin + srcH * absCos

  // Scale to fit canvas while preserving aspect ratio
  const scale = Math.min(canvasWidth / outputW, canvasHeight / outputH)
  const drawW = outputW * scale
  const drawH = outputH * scale

  ctx.save()

  // Translate to canvas center
  ctx.translate(canvasWidth / 2, canvasHeight / 2)

  // Flip transforms
  if (flipH) ctx.scale(-1, 1)
  if (flipV) ctx.scale(1, -1)

  // Rotation
  if (rotation !== 0) ctx.rotate(rotRad)

  // Draw cropped region centered
  ctx.drawImage(
    img,
    cropRect ? cropRect.x : 0, cropRect ? cropRect.y : 0,
    srcW, srcH,
    -drawW / 2, -drawH / 2, drawW, drawH,
  )

  ctx.restore()
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('无法加载图片'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('无法读取文件'))
    reader.readAsDataURL(file)
  })
}

export function useImageEditor() {
  const state = reactive<ImageEditState>({
    sourceImage: null,
    cropEnabled: false,
    cropRect: null,
    rotation: 0,
    flipH: false,
    flipV: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
  })

  const previewCanvas: Ref<HTMLCanvasElement | null> = ref(null)

  // Offscreen cache: holds the fully filtered image, so during crop drag
  // we only copy + overlay without re-running the expensive filter pipeline.
  let cacheCanvas: HTMLCanvasElement | null = null
  let cacheValid = false

  function invalidateCache() {
    cacheValid = false
  }

  async function loadImage(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      throw new Error('不支持的文件类型')
    }
    const img = await loadImageFromFile(file)
    state.sourceImage = img
    state.cropRect = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }
    state.rotation = 0
    state.flipH = false
    state.flipV = false
    state.brightness = 100
    state.contrast = 100
    state.saturation = 100
    invalidateCache()
  }

  function setCropEnabled(v: boolean): void {
    state.cropEnabled = v
  }

  function setCropRect(rect: CropRect): void {
    if (!state.sourceImage) return
    const maxW = state.sourceImage.naturalWidth
    const maxH = state.sourceImage.naturalHeight
    state.cropRect = clampRect(rect, maxW, maxH, 10)
  }

  // Clamp rect to image bounds. minSize = enforced min w/h (0 = no min).
  function clampRect(rect: CropRect, maxW: number, maxH: number, minSize: number): CropRect {
    const x = clamp(rect.x, 0, maxW - minSize)
    const y = clamp(rect.y, 0, maxH - minSize)
    const w = clamp(rect.w, minSize, maxW - x)
    const h = clamp(rect.h, minSize, maxH - y)
    return { x, y, w, h }
  }

  // Clamp rect to image bounds WITHOUT min-size enforcement (for use during drag)
  function clampCropToBounds(rect: CropRect): CropRect {
    if (!state.sourceImage) return rect
    return clampRect(rect, state.sourceImage.naturalWidth, state.sourceImage.naturalHeight, 0)
  }

  function rotate(direction: 'cw' | 'ccw'): void {
    const oldRotation = state.rotation
    const delta = direction === 'cw' ? 90 : -90
    state.rotation = (((state.rotation + delta) % 360) + 360) % 360 as 0 | 90 | 180 | 270
    invalidateCache()

    if (state.cropRect && state.sourceImage) {
      const imgW = state.sourceImage.naturalWidth
      const imgH = state.sourceImage.naturalHeight

      // Determine effective width/height of the image BEFORE this rotation
      const wasVertical = oldRotation === 90 || oldRotation === 270
      const effW = wasVertical ? imgH : imgW
      const effH = wasVertical ? imgW : imgH

      if (delta === 90) {
        // CW: x' = effH - y - h, y' = x, w' = h, h' = w
        state.cropRect = {
          x: clamp(effH - state.cropRect.y - state.cropRect.h, 0, effH - 10),
          y: clamp(state.cropRect.x, 0, effW - 10),
          w: state.cropRect.h,
          h: state.cropRect.w,
        }
      } else {
        // CCW (-90): x' = y, y' = effW - x - w, w' = h, h' = w
        state.cropRect = {
          x: clamp(state.cropRect.y, 0, effH - 10),
          y: clamp(effW - state.cropRect.x - state.cropRect.w, 0, effW - 10),
          w: state.cropRect.h,
          h: state.cropRect.w,
        }
      }
    }
  }

  function flip(direction: 'h' | 'v'): void {
    if (direction === 'h') {
      state.flipH = !state.flipH
    } else {
      state.flipV = !state.flipV
    }
    invalidateCache()
  }

  function setFilter(type: 'brightness' | 'contrast' | 'saturation', value: number): void {
    state[type] = clamp(Math.round(value), 0, 200)
    invalidateCache()
  }

  function reset(): void {
    if (!state.sourceImage) return
    state.cropRect = {
      x: 0, y: 0,
      w: state.sourceImage.naturalWidth,
      h: state.sourceImage.naturalHeight,
    }
    state.rotation = 0
    state.flipH = false
    state.flipV = false
    state.brightness = 100
    state.contrast = 100
    state.saturation = 100
  }

  function drawCropOverlay(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cropRect: CropRect,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const sw = img.naturalWidth
    const sh = img.naturalHeight
    const isVertical = state.rotation === 90 || state.rotation === 270
    const outW = isVertical ? sh : sw
    const outH = isVertical ? sw : sh
    const scale = Math.min(canvasWidth / outW, canvasHeight / outH)
    const dw = outW * scale
    const dh = outH * scale
    const dx = (canvasWidth - dw) / 2
    const dy = (canvasHeight - dh) / 2

    ctx.save()
    ctx.translate(dx + dw / 2, dy + dh / 2)
    if (state.rotation !== 0) ctx.rotate((state.rotation * Math.PI) / 180)
    if (state.flipH || state.flipV) ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1)

    // Map crop rect from image coords to current transformed space
    const scX = dw / sw
    const scY = dh / sh
    const cx = cropRect.x * scX - dw / 2
    const cy = cropRect.y * scY - dh / 2
    const cw = cropRect.w * scX
    const ch = cropRect.h * scY

    // Dark overlay around crop area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    // top strip
    ctx.fillRect(-dw / 2, -dh / 2, dw, cy - (-dh / 2))
    // bottom strip
    const bottom = cy + ch
    ctx.fillRect(-dw / 2, bottom, dw, dh / 2 - bottom)
    // left strip (between top and bottom)
    ctx.fillRect(-dw / 2, cy, cx - (-dw / 2), ch)
    // right strip
    const right = cx + cw
    ctx.fillRect(right, cy, dw / 2 - right, ch)

    // White border
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = Math.max(1, 1.5 / scale)
    ctx.strokeRect(cx, cy, cw, ch)

    // Resize handles at corners and edge midpoints
    const hs = 6 / scale   // handle size in current space
    ctx.fillStyle = '#fff'
    const handles = [
      [cx, cy], [cx + cw / 2, cy], [cx + cw, cy],
      [cx, cy + ch / 2], [cx + cw, cy + ch / 2],
      [cx, cy + ch], [cx + cw / 2, cy + ch], [cx + cw, cy + ch],
    ]
    for (const [hx, hy] of handles) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
    }

    ctx.restore()
  }

  function render(): void {
    const canvas = previewCanvas.value
    const img = state.sourceImage
    if (!canvas || !img) return

    const cropRect = state.cropRect
    if (!cropRect) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (state.cropEnabled) {
      // Use offscreen cache: only rebuild image+filter when invalidated
      if (!cacheValid || !cacheCanvas || cacheCanvas.width !== canvas.width || cacheCanvas.height !== canvas.height) {
        if (!cacheCanvas) {
          cacheCanvas = document.createElement('canvas')
        }
        cacheCanvas.width = canvas.width
        cacheCanvas.height = canvas.height
        const cacheCtx = cacheCanvas.getContext('2d')
        if (!cacheCtx) return

        drawTransformedImage(
          cacheCtx, img, null, state.rotation,
          state.flipH, state.flipV,
          canvas.width, canvas.height,
        )
        const imageData = cacheCtx.getImageData(0, 0, canvas.width, canvas.height)
        applyFilters(imageData, state.brightness, state.contrast, state.saturation)
        cacheCtx.putImageData(imageData, 0, 0)
        cacheValid = true
      }
      // Fast path: copy cached image + draw overlay
      ctx.drawImage(cacheCanvas, 0, 0)

      // Only show overlay when user has made an explicit (non-full-image) selection.
      // Check if the rect covers the full image area, accounting for rotation.
      const coversFull = cropRect.x <= 0 && cropRect.y <= 0
        && cropRect.x + cropRect.w >= img.naturalWidth
        && cropRect.y + cropRect.h >= img.naturalHeight
      if (!coversFull && cropRect.w > 0 && cropRect.h > 0) {
        drawCropOverlay(ctx, img, cropRect, canvas.width, canvas.height)
      }
    } else {
      drawTransformedImage(
        ctx, img, cropRect, state.rotation,
        state.flipH, state.flipV,
        canvas.width, canvas.height,
      )
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      applyFilters(imageData, state.brightness, state.contrast, state.saturation)
      ctx.putImageData(imageData, 0, 0)
    }
  }

  async function getEditedBlob(): Promise<Blob> {
    const img = state.sourceImage
    const cropRect = state.cropRect
    if (!img || !cropRect) return new Blob([], { type: 'image/png' })

    // Output dimensions account for rotation
    const isVertical = state.rotation === 90 || state.rotation === 270
    const outputW = isVertical ? cropRect.h : cropRect.w
    const outputH = isVertical ? cropRect.w : cropRect.h

    const canvas = document.createElement('canvas')
    canvas.width = outputW
    canvas.height = outputH

    const ctx = canvas.getContext('2d')
    if (!ctx) return new Blob([], { type: 'image/png' })

    drawTransformedImage(
      ctx, img, cropRect, state.rotation,
      state.flipH, state.flipV,
      outputW, outputH,
    )

    // Apply color filters
    const imageData = ctx.getImageData(0, 0, outputW, outputH)
    applyFilters(imageData, state.brightness, state.contrast, state.saturation)
    ctx.putImageData(imageData, 0, 0)

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to create blob'))
      }, 'image/png')
    })
  }

  return {
    state,
    previewCanvas,
    loadImage,
    setCropEnabled,
    setCropRect,
    clampCropToBounds,
    rotate,
    flip,
    setFilter,
    reset,
    render,
    getEditedBlob,
  }
}
