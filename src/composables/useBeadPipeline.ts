import { ref } from 'vue'
import type { BeadGrid, BeadSettings, PaletteColor } from '../types'
import { loadImageFromFile, resizeImage, applyAdjustments } from './useImageProcessor'
import { applyDithering } from './useDither'

export function useBeadPipeline() {
  const beadGrid = ref<BeadGrid | null>(null)
  const isProcessing = ref(false)
  const error = ref<string | null>(null)

  const settings = ref<BeadSettings>({
    gridCols: 29,
    gridRows: 29,
    keepAspectRatio: true,
    dithering: { algorithm: 'none', strength: 0 },
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

    isProcessing.value = true
    error.value = null

    try {
      const s = { ...settings.value, ...overrideSettings }

      const img = await loadImageFromFile(imageFile)
      const resized = resizeImage(img, s.gridCols, s.gridRows, s.keepAspectRatio)
      const ctx = resized.getContext('2d')
      if (!ctx) {
        error.value = 'Canvas 上下文不可用'
        beadGrid.value = null
        return
      }
      let imageData = ctx.getImageData(0, 0, s.gridCols, s.gridRows)

      imageData = applyAdjustments(
        imageData,
        s.adjustments.brightness,
        s.adjustments.contrast,
        s.adjustments.saturation,
      )

      const grid = applyDithering(imageData, palette, s.dithering.algorithm, s.dithering.strength)
      beadGrid.value = grid
    } catch (e) {
      error.value = e instanceof Error ? e.message : '处理图片时出错'
      beadGrid.value = null
    } finally {
      isProcessing.value = false
    }
  }

  return {
    beadGrid,
    isProcessing,
    error,
    settings,
    process,
  }
}
