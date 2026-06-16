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
  }

  function setCropEnabled(v: boolean): void {
    state.cropEnabled = v
  }

  function setCropRect(rect: CropRect): void {
    if (!state.sourceImage) return
    const maxW = state.sourceImage.naturalWidth
    const maxH = state.sourceImage.naturalHeight
    const cx = clamp(rect.x, 0, maxW - 10)
    const cy = clamp(rect.y, 0, maxH - 10)
    state.cropRect = {
      x: cx,
      y: cy,
      w: clamp(rect.w, 10, maxW - cx),
      h: clamp(rect.h, 10, maxH - cy),
    }
  }

  function rotate(direction: 'cw' | 'ccw'): void {
    const delta = direction === 'cw' ? 90 : -90
    state.rotation = (((state.rotation + delta) % 360) + 360) % 360 as 0 | 90 | 180 | 270

    if (state.cropRect && state.sourceImage) {
      const isVertical = state.rotation === 90 || state.rotation === 270
      const maxW = state.sourceImage.naturalWidth
      const maxH = state.sourceImage.naturalHeight

      if (isVertical) {
        // After rotation, width and height swap
        const newW = state.cropRect.h
        const newH = state.cropRect.w
        // Map old x,y to new position in rotated coordinate space
        const newX = clamp(maxH - state.cropRect.y - state.cropRect.h, 0, maxH - 10)
        const newY = clamp(state.cropRect.x, 0, maxW - 10)
        state.cropRect = { x: newX, y: newY, w: clamp(newW, 10, maxH - newX), h: clamp(newH, 10, maxW - newY) }
      } else {
        // Rotation to 0/180: width and height stay the same
        const newX = clamp(state.cropRect.y, 0, maxH - 10)
        const newY = clamp(maxW - state.cropRect.x - state.cropRect.w, 0, maxH - 10)
        state.cropRect = { x: newX, y: newY, w: clamp(state.cropRect.w, 10, maxW - newX), h: clamp(state.cropRect.h, 10, maxH - newY) }
      }
    }
  }

  function flip(direction: 'h' | 'v'): void {
    if (direction === 'h') {
      state.flipH = !state.flipH
    } else {
      state.flipV = !state.flipV
    }
  }

  function setFilter(type: 'brightness' | 'contrast' | 'saturation', value: number): void {
    state[type] = clamp(Math.round(value), 0, 200)
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

  function render(): void {
    // Placeholder - Task 2
  }

  async function getEditedBlob(): Promise<Blob> {
    // Placeholder - Task 2
    return new Blob()
  }

  return {
    state,
    previewCanvas,
    loadImage,
    setCropEnabled,
    setCropRect,
    rotate,
    flip,
    setFilter,
    reset,
    render,
    getEditedBlob,
  }
}
