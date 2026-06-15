import { ref } from 'vue'
import type { BeadGrid, BeadSettings, PaletteColor, BeadCell } from '../types'
import { loadImageFromFile, computeAverageCells, computeDominantCells, applyAdjustments } from './useImageProcessor'
import { createColorMatcher } from './useColorMatcher'

export function useBeadPipeline() {
  const beadGrid = ref<BeadGrid | null>(null)
  const progress = ref(0) // 0 = idle, 1–100 = processing
  const error = ref<string | null>(null)

  const settings = ref<BeadSettings>({
    gridCols: 29,
    gridRows: 29,
    keepAspectRatio: true,
    colorMatchScheme: 'average',
    adjustments: { brightness: 0, contrast: 0, saturation: 0 },
    display: {
      showGrid: true,
      gridLineColor: '#cccccc',
      gridLineWidth: 1,
      boldGridInterval: 10,
      boldGridColor: '#000000',
      boldGridWidth: 2,
      renderMode: 'color',
    },
  })

  async function process(
    imageFile: File | null,
    palette: PaletteColor[],
    overrideSettings?: Partial<BeadSettings>,
  ) {
    if (!imageFile || palette.length === 0) {
      beadGrid.value = null
      return
    }

    progress.value = 10
    error.value = null

    try {
      const s = { ...settings.value, ...overrideSettings }

      const img = await loadImageFromFile(imageFile)
      progress.value = 30

      if (s.colorMatchScheme === 'dominant') {
        // 主导色方案：先对全图做亮度/对比度/饱和度调整，再逐像素匹配+投票
        beadGrid.value = await processDominant(img, palette, s)
      } else {
        // 平均色方案：分块取均值 → 逐格调整 → 匹配
        beadGrid.value = await processAverage(img, palette, s)
      }

      progress.value = 100
    } catch (e) {
      error.value = e instanceof Error ? e.message : '处理图片时出错'
      beadGrid.value = null
      progress.value = 0
    } finally {
      if (progress.value === 100) {
        setTimeout(() => { progress.value = 0 }, 400)
      }
    }
  }

  return {
    beadGrid,
    progress,
    error,
    settings,
    process,
  }
}

/** 平均色方案：区域像素取均值 → 逐格调整 → Delta E 匹配 */
async function processAverage(
  img: HTMLImageElement,
  palette: PaletteColor[],
  s: BeadSettings,
): Promise<BeadGrid> {
  const { cells: avgCells, imageCols, imageRows, imageX, imageY } =
    computeAverageCells(img, s.gridCols, s.gridRows, s.keepAspectRatio)

  // 对每个格子的平均色进行调整
  for (const row of avgCells) {
    for (const cell of row) {
      const adj = applyAdjustmentsToPixel(
        cell.r, cell.g, cell.b,
        s.adjustments.brightness,
        s.adjustments.contrast,
        s.adjustments.saturation,
      )
      cell.r = adj.r
      cell.g = adj.g
      cell.b = adj.b
    }
  }

  // Delta E 最近邻匹配
  const matchColor = createColorMatcher(palette)
  const cells: BeadCell[][] = Array.from({ length: s.gridRows }, (_, row) =>
    Array.from({ length: s.gridCols }, (_, col) => {
      const avg = avgCells[row][col]
      if (col < imageX || col >= imageX + imageCols || row < imageY || row >= imageY + imageRows) {
        return { row, col, colorIndex: null as number | null }
      }
      if (avg.a === 0) return { row, col, colorIndex: null }
      const match = matchColor(avg.r, avg.g, avg.b)
      return { row, col, colorIndex: match.index }
    }),
  )

  return { rows: s.gridRows, cols: s.gridCols, cells, palette, imageCols, imageRows }
}

/** 主导色方案：全图调整 → 逐像素匹配 → 区域内投票选出最多出现的调色板颜色 */
async function processDominant(
  img: HTMLImageElement,
  palette: PaletteColor[],
  s: BeadSettings,
): Promise<BeadGrid> {
  // 获取全分辨率像素
  const srcW = img.naturalWidth
  const srcH = img.naturalHeight
  const offCanvas = document.createElement('canvas')
  offCanvas.width = srcW
  offCanvas.height = srcH
  const offCtx = offCanvas.getContext('2d')!
  offCtx.drawImage(img, 0, 0)
  let imageData = offCtx.getImageData(0, 0, srcW, srcH)

  // 对全图应用亮度/对比度/饱和度
  imageData = applyAdjustments(imageData, s.adjustments.brightness, s.adjustments.contrast, s.adjustments.saturation)

  // 逐像素匹配 + 区域内投票
  const matchColor = createColorMatcher(palette)
  const { cells: indexCells, imageCols, imageRows } =
    computeDominantCells(imageData, s.gridCols, s.gridRows, s.keepAspectRatio, matchColor)

  const cells: BeadCell[][] = indexCells.map((row, r) =>
    row.map((colorIndex, c) => ({ row: r, col: c, colorIndex })),
  )

  return { rows: s.gridRows, cols: s.gridCols, cells, palette, imageCols, imageRows }
}

function applyAdjustmentsToPixel(
  r: number, g: number, b: number,
  brightness: number, contrast: number, saturation: number,
): { r: number; g: number; b: number } {
  const bFactor = brightness / 100
  const cFactor = (contrast + 100) / 100
  const sFactor = (saturation + 100) / 100

  let nr = r, ng = g, nb = b

  if (brightness > 0) {
    nr = nr + (255 - nr) * bFactor
    ng = ng + (255 - ng) * bFactor
    nb = nb + (255 - nb) * bFactor
  } else if (brightness < 0) {
    nr = nr * (1 + bFactor)
    ng = ng * (1 + bFactor)
    nb = nb * (1 + bFactor)
  }

  nr = (nr - 128) * cFactor + 128
  ng = (ng - 128) * cFactor + 128
  nb = (nb - 128) * cFactor + 128

  const gray = 0.299 * nr + 0.587 * ng + 0.114 * nb
  nr = gray + (nr - gray) * sFactor
  ng = gray + (ng - gray) * sFactor
  nb = gray + (nb - gray) * sFactor

  return {
    r: Math.max(0, Math.min(255, Math.round(nr))),
    g: Math.max(0, Math.min(255, Math.round(ng))),
    b: Math.max(0, Math.min(255, Math.round(nb))),
  }
}
