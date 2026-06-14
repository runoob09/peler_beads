export interface ResizeResult {
  canvas: HTMLCanvasElement
  imageX: number
  imageY: number
  imageW: number
  imageH: number
}

export function resizeImage(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  keepAspectRatio: boolean,
): ResizeResult {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')

  if (!keepAspectRatio) {
    if (ctx) ctx.drawImage(source, 0, 0, targetWidth, targetHeight)
    return { canvas, imageX: 0, imageY: 0, imageW: targetWidth, imageH: targetHeight }
  }

  // Compute contain-fit dimensions
  const srcW = 'naturalWidth' in source
    ? (source as HTMLImageElement).naturalWidth
    : (source as HTMLCanvasElement | ImageBitmap).width
  const srcH = 'naturalHeight' in source
    ? (source as HTMLImageElement).naturalHeight
    : (source as HTMLCanvasElement | ImageBitmap).height

  const scale = Math.min(targetWidth / srcW, targetHeight / srcH)
  const imageW = Math.round(srcW * scale)
  const imageH = Math.round(srcH * scale)
  const imageX = Math.floor((targetWidth - imageW) / 2)
  const imageY = Math.floor((targetHeight - imageH) / 2)

  if (ctx) ctx.drawImage(source, imageX, imageY, imageW, imageH)
  return { canvas, imageX, imageY, imageW, imageH }
}

// Posterize image to N levels per channel for cartoon/flat color effect
// 6 levels → 6×6×6 = 216 buckets, good balance of flatness and detail
export function posterize(imageData: ImageData, levels: number = 6): ImageData {
  const result = new ImageData(imageData.width, imageData.height)
  const step = 255 / (levels - 1)

  for (let i = 0; i < imageData.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = imageData.data[i + c]
      const bucket = Math.round(v / step) * step
      result.data[i + c] = Math.round(Math.max(0, Math.min(255, bucket)))
    }
    result.data[i + 3] = imageData.data[i + 3]
  }

  return result
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export function applyAdjustments(
  imageData: ImageData,
  brightness: number,
  contrast: number,
  saturation: number,
): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const result = new ImageData(imageData.width, imageData.height)

  const bFactor = brightness / 100
  const cFactor = (contrast + 100) / 100
  const sFactor = (saturation + 100) / 100

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    // Brightness
    if (brightness > 0) {
      r = r + (255 - r) * bFactor
      g = g + (255 - g) * bFactor
      b = b + (255 - b) * bFactor
    } else if (brightness < 0) {
      r = r * (1 + bFactor)
      g = g * (1 + bFactor)
      b = b * (1 + bFactor)
    }

    // Contrast
    r = (r - 128) * cFactor + 128
    g = (g - 128) * cFactor + 128
    b = (b - 128) * cFactor + 128

    // Saturation
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    r = gray + (r - gray) * sFactor
    g = gray + (g - gray) * sFactor
    b = gray + (b - gray) * sFactor

    result.data[i] = Math.max(0, Math.min(255, Math.round(r)))
    result.data[i + 1] = Math.max(0, Math.min(255, Math.round(g)))
    result.data[i + 2] = Math.max(0, Math.min(255, Math.round(b)))
    result.data[i + 3] = data[i + 3]
  }

  return result
}
