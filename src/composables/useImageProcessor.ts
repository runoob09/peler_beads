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
    a: 255,
  }
}

/**
 * 主导色彩（容差众数）：对区域内像素做 RGB 距离容差聚类，
 * 取最大聚类的中心色作为代表色。返回 RGB 值，后续由 pipeline 做调整和匹配。
 */
export function computeDominantCells(
  source: HTMLImageElement,
  gridCols: number,
  gridRows: number,
  keepAspectRatio: boolean,
  tolerance: number,
): AverageCellsResult {
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
        cells[row][col] = toleranceDominantBlock(data, srcW, x1, x2, y1, y2, srcH, tolerance)
      }
    }
  } else {
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
        cells[imageY + r][imageX + c] = toleranceDominantBlock(data, srcW, x1, x2, y1, y2, srcH, tolerance)
      }
    }
  }

  return { cells, imageCols, imageRows, imageX, imageY }
}

interface Cluster {
  r: number; g: number; b: number; count: number
}

function toleranceDominantBlock(
  data: Uint8ClampedArray,
  stride: number,
  x1: number, x2: number, y1: number, y2: number,
  srcH: number,
  tolerance: number,
): AverageBlockResult {
  const clusters: Cluster[] = []

  const sx = Math.max(0, x1)
  const ex = Math.min(stride, x2)
  const sy = Math.max(0, y1)
  const ey = Math.min(y2, srcH)
  const tol2 = tolerance * tolerance

  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const idx = (y * stride + x) * 4

      const pr = data[idx], pg = data[idx + 1], pb = data[idx + 2]
      let bestCluster = -1
      let bestDist = Infinity

      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[i]
        const dr = pr - c.r, dg = pg - c.g, db = pb - c.b
        const dist = dr * dr + dg * dg + db * db
        if (dist < tol2 && dist < bestDist) {
          bestDist = dist
          bestCluster = i
        }
      }

      if (bestCluster >= 0) {
        const c = clusters[bestCluster]
        // running average
        c.r = Math.round((c.r * c.count + pr) / (c.count + 1))
        c.g = Math.round((c.g * c.count + pg) / (c.count + 1))
        c.b = Math.round((c.b * c.count + pb) / (c.count + 1))
        c.count++
      } else {
        clusters.push({ r: pr, g: pg, b: pb, count: 1 })
      }
    }
  }

  if (clusters.length === 0) return { r: 0, g: 0, b: 0, a: 0 }

  let best = clusters[0]
  for (let i = 1; i < clusters.length; i++) {
    if (clusters[i].count > best.count) best = clusters[i]
  }

  return { r: best.r, g: best.g, b: best.b, a: 255 }
}

// ---- 中位色 (Median) 色彩计算 ----

function medianBlock(
  data: Uint8ClampedArray,
  stride: number,
  x1: number, x2: number, y1: number, y2: number,
  srcH: number,
): AverageBlockResult {
  const rs: number[] = [], gs: number[] = [], bs: number[] = []

  const sx = Math.max(0, x1)
  const ex = Math.min(stride, x2)
  const sy = Math.max(0, y1)
  const ey = Math.min(y2, srcH)

  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const idx = (y * stride + x) * 4
      rs.push(data[idx])
      gs.push(data[idx + 1])
      bs.push(data[idx + 2])
    }
  }

  if (rs.length === 0) return { r: 0, g: 0, b: 0, a: 0 }
  rs.sort((a, b) => a - b)
  gs.sort((a, b) => a - b)
  bs.sort((a, b) => a - b)
  const m = Math.floor(rs.length / 2)
  return { r: rs[m], g: gs[m], b: bs[m], a: 255 }
}

/**
 * 中位色：区域内每个通道独立取中位数，不受极端像素（高光/阴影/噪点）影响。
 */
export function computeMedianCells(
  source: HTMLImageElement,
  gridCols: number,
  gridRows: number,
  keepAspectRatio: boolean,
): AverageCellsResult {
  return blockBasedCompute(source, gridCols, gridRows, keepAspectRatio, medianBlock)
}

// ---- 中心加权 (Center-Weighted) 色彩计算 ----

function centerWeightedBlock(
  data: Uint8ClampedArray,
  stride: number,
  x1: number, x2: number, y1: number, y2: number,
  srcH: number,
): AverageBlockResult {
  const sx = Math.max(0, x1)
  const ex = Math.min(stride, x2)
  const sy = Math.max(0, y1)
  const ey = Math.min(y2, srcH)

  const bw = ex - sx, bh = ey - sy
  if (bw <= 0 || bh <= 0) return { r: 0, g: 0, b: 0, a: 0 }

  const cx = (sx + ex - 1) / 2
  const cy = (sy + ey - 1) / 2
  const halfW = bw / 2, halfH = bh / 2

  let rSum = 0, gSum = 0, bSum = 0, wSum = 0

  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const idx = (y * stride + x) * 4

      const dx = (x - cx) / halfW
      const dy = (y - cy) / halfH
      const dist = Math.sqrt(dx * dx + dy * dy)
      const weight = Math.exp(-dist * dist * 2) // Gaussian falloff

      rSum += data[idx] * weight
      gSum += data[idx + 1] * weight
      bSum += data[idx + 2] * weight
      wSum += weight
    }
  }

  if (wSum === 0) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: Math.round(rSum / wSum),
    g: Math.round(gSum / wSum),
    b: Math.round(bSum / wSum),
    a: 255,
  }
}

/**
 * 中心加权：距离格子中心越近的像素权重越大（高斯衰减），
 * 使相邻格子之间的过渡更平滑。
 */
export function computeCenterWeightedCells(
  source: HTMLImageElement,
  gridCols: number,
  gridRows: number,
  keepAspectRatio: boolean,
): AverageCellsResult {
  return blockBasedCompute(source, gridCols, gridRows, keepAspectRatio, centerWeightedBlock)
}

// ---- 通用分块计算框架 ----

type BlockFn = (data: Uint8ClampedArray, stride: number, x1: number, x2: number, y1: number, y2: number, srcH: number) => AverageBlockResult

function blockBasedCompute(
  source: HTMLImageElement,
  gridCols: number,
  gridRows: number,
  keepAspectRatio: boolean,
  blockFn: BlockFn,
): AverageCellsResult {
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
        cells[row][col] = blockFn(data, srcW, x1, x2, y1, y2, srcH)
      }
    }
  } else {
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
        cells[imageY + r][imageX + c] = blockFn(data, srcW, x1, x2, y1, y2, srcH)
      }
    }
  }

  return { cells, imageCols, imageRows, imageX, imageY }
}

// ---- 色桶（Bucket）色彩计算 ----

function quantizeToBucket(r: number, g: number, b: number, levels: number): number {
  const step = 256 / levels
  const qr = Math.min(levels - 1, Math.floor(r / step))
  const qg = Math.min(levels - 1, Math.floor(g / step))
  const qb = Math.min(levels - 1, Math.floor(b / step))
  return qr * levels * levels + qg * levels + qb
}

function bucketCenterColor(bucketIndex: number, levels: number): { r: number; g: number; b: number } {
  const step = 256 / levels
  const qb = bucketIndex % levels
  const qg = Math.floor(bucketIndex / levels) % levels
  const qr = Math.floor(bucketIndex / (levels * levels))
  return {
    r: Math.round(qr * step + step / 2),
    g: Math.round(qg * step + step / 2),
    b: Math.round(qb * step + step / 2),
  }
}

/**
 * 色桶主导计算：将每个像素量化到 RGB 色桶，统计区域内出现最多的桶，
 * 以该桶的中心色作为代表色返回。
 * 和平均方案一样返回 RGB 值，后续由 pipeline 做调整和匹配。
 */
export function computeBucketCells(
  source: HTMLImageElement,
  gridCols: number,
  gridRows: number,
  keepAspectRatio: boolean,
  bucketLevels: number,
): AverageCellsResult {
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
        cells[row][col] = bucketDominantBlock(data, srcW, x1, x2, y1, y2, srcH, bucketLevels)
      }
    }
  } else {
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
        cells[imageY + r][imageX + c] = bucketDominantBlock(data, srcW, x1, x2, y1, y2, srcH, bucketLevels)
      }
    }
  }

  return { cells, imageCols, imageRows, imageX, imageY }
}

function bucketDominantBlock(
  data: Uint8ClampedArray,
  stride: number,
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  srcH: number,
  levels: number,
): AverageBlockResult {
  const counts = new Map<number, number>()
  let maxCount = 0
  let bestBucket = 0

  const sx = Math.max(0, x1)
  const ex = Math.min(stride, x2)
  const sy = Math.max(0, y1)
  const ey = Math.min(y2, srcH)

  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const idx = (y * stride + x) * 4
      const bucket = quantizeToBucket(data[idx], data[idx + 1], data[idx + 2], levels)
      const count = (counts.get(bucket) ?? 0) + 1
      counts.set(bucket, count)
      if (count > maxCount) {
        maxCount = count
        bestBucket = bucket
      }
    }
  }

  if (maxCount === 0) return { r: 0, g: 0, b: 0, a: 0 }
  const center = bucketCenterColor(bestBucket, levels)
  return { r: center.r, g: center.g, b: center.b, a: 255 }
}

