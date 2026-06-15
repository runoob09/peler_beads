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
export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export interface AverageBlockResult {
  r: number
  g: number
  b: number
  a: number
}

export interface AverageCellsResult {
  cells: AverageBlockResult[][]
  imageCols: number
  imageRows: number
  imageX: number
  imageY: number
}

/**
 * 对每个珠子格子计算原图对应区域的平均色彩。
 * 不使用 canvas drawImage 的插值缩放，而是直接对原图像素分块取均值，
 * 避免 bilinear 插值带来的色彩混合失真。
 */
export function computeAverageCells(
  source: HTMLImageElement,
  gridCols: number,
  gridRows: number,
  keepAspectRatio: boolean,
): AverageCellsResult {
  // 用 ImageBitmap 拿原始像素（避免 canvas 缩放插值）
  const srcW = source.naturalWidth
  const srcH = source.naturalHeight

  const offCanvas = document.createElement('canvas')
  offCanvas.width = srcW
  offCanvas.height = srcH
  const offCtx = offCanvas.getContext('2d')!
  offCtx.drawImage(source, 0, 0)
  const imageData = offCtx.getImageData(0, 0, srcW, srcH)
  const data = imageData.data

  const cells: AverageBlockResult[][] = Array.from({ length: gridRows }, () =>
    Array.from({ length: gridCols }, () => ({ r: 0, g: 0, b: 0, a: 0 })),
  )

  let imageCols: number, imageRows: number, imageX: number, imageY: number

  if (!keepAspectRatio) {
    // 拉伸模式：每个格子均匀覆盖原图区域
    imageCols = gridCols
    imageRows = gridRows
    imageX = 0
    imageY = 0

    for (let row = 0; row < gridRows; row++) {
      const y1 = Math.floor((row * srcH) / gridRows)
      const y2 = Math.floor(((row + 1) * srcH) / gridRows)
      for (let col = 0; col < gridCols; col++) {
        const x1 = Math.floor((col * srcW) / gridCols)
        const x2 = Math.floor(((col + 1) * srcW) / gridCols)
        cells[row][col] = averageBlock(data, srcW, x1, x2, y1, y2)
      }
    }
  } else {
    // contain 模式：先算缩放和居中偏移
    const scale = Math.min(gridCols / srcW, gridRows / srcH)
    imageCols = Math.round(srcW * scale)
    imageRows = Math.round(srcH * scale)
    imageX = Math.floor((gridCols - imageCols) / 2)
    imageY = Math.floor((gridRows - imageRows) / 2)

    for (let r = 0; r < imageRows; r++) {
      const y1 = Math.floor((r * srcH) / imageRows)
      const y2 = Math.floor(((r + 1) * srcH) / imageRows)
      for (let c = 0; c < imageCols; c++) {
        const x1 = Math.floor((c * srcW) / imageCols)
        const x2 = Math.floor(((c + 1) * srcW) / imageCols)
        cells[imageY + r][imageX + c] = averageBlock(data, srcW, x1, x2, y1, y2)
      }
    }
  }

  return { cells, imageCols, imageRows, imageX, imageY }
}

function averageBlock(
  data: Uint8ClampedArray,
  stride: number,
  x1: number,
  x2: number,
  y1: number,
  y2: number,
): AverageBlockResult {
  let r = 0, g = 0, b = 0, a = 0
  let count = 0

  const sx = Math.max(0, x1)
  const ex = Math.min(stride, x2)
  const sy = Math.max(0, y1)
  const ey = Math.min(y2, Math.floor(data.length / 4 / stride))

  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const idx = (y * stride + x) * 4
      r += data[idx]
      g += data[idx + 1]
      b += data[idx + 2]
      a += data[idx + 3]
      count++
    }
  }

  if (count === 0) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
    a: Math.round(a / count),
  }
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
