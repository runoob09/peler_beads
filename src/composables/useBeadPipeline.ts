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

