import { ref } from 'vue'
import type { BeadGrid, BeadSettings, PaletteColor, BeadCell } from '../types'
import { loadImageFromFile, computeAverageCells, computeBucketCells, computeDominantCells, computeMedianCells, computeCenterWeightedCells } from './useImageProcessor'
import { createColorMatcher } from './useColorMatcher'

export function useBeadPipeline() {
  const beadGrid = ref<BeadGrid | null>(null)
  const progress = ref(0) // 0 = idle, 1–100 = processing
  const error = ref<string | null>(null)

  const settings = ref<BeadSettings>({
    gridCols: 29,
    gridRows: 29,
    keepAspectRatio: true,
    colorCalcMethod: 'average',
    colorMatchMethod: 'deltaE',
    bucketLevels: 8,
    tolerance: 30,
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

      if (s.colorCalcMethod === 'dominant') {
        beadGrid.value = await processRgbCells(
          computeDominantCells(img, s.gridCols, s.gridRows, s.keepAspectRatio, s.tolerance),
          palette, s,
        )
      } else if (s.colorCalcMethod === 'bucket') {
        beadGrid.value = await processRgbCells(
          computeBucketCells(img, s.gridCols, s.gridRows, s.keepAspectRatio, s.bucketLevels),
          palette, s,
        )
      } else if (s.colorCalcMethod === 'median') {
        beadGrid.value = await processRgbCells(
          computeMedianCells(img, s.gridCols, s.gridRows, s.keepAspectRatio),
          palette, s,
        )
      } else if (s.colorCalcMethod === 'centerWeighted') {
        beadGrid.value = await processRgbCells(
          computeCenterWeightedCells(img, s.gridCols, s.gridRows, s.keepAspectRatio),
          palette, s,
        )
      } else {
        beadGrid.value = await processRgbCells(
          computeAverageCells(img, s.gridCols, s.gridRows, s.keepAspectRatio),
          palette, s,
        )
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

/** 统一 RGB 管线：代表色计算 → 逐格调整 → 匹配调色板 */
async function processRgbCells(
  result: { cells: { r: number; g: number; b: number; a: number }[][]; imageCols: number; imageRows: number; imageX: number; imageY: number },
  palette: PaletteColor[],
  s: BeadSettings,
): Promise<BeadGrid> {
  const { cells: rgbCells, imageCols, imageRows, imageX, imageY } = result

  for (const row of rgbCells) {
    for (const cell of row) {
      const adj = applyAdjustmentsToPixel(
        cell.r, cell.g, cell.b,
        s.adjustments.brightness,
        s.adjustments.contrast,
        s.adjustments.saturation,
      )
      cell.r = adj.r; cell.g = adj.g; cell.b = adj.b
    }
  }

  const matchColor = createColorMatcher(palette, s.colorMatchMethod)
  const cells: BeadCell[][] = Array.from({ length: s.gridRows }, (_, row) =>
    Array.from({ length: s.gridCols }, (_, col) => {
      const c = rgbCells[row][col]
      if (col < imageX || col >= imageX + imageCols || row < imageY || row >= imageY + imageRows) {
        return { row, col, colorIndex: null as number | null }
      }
      const match = matchColor(c.r, c.g, c.b)
      return { row, col, colorIndex: match.index }
    }),
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
