import { describe, it, expect } from 'vitest'
import { useBeadPipeline } from '../useBeadPipeline'
import type { BeadSettings, PaletteColor } from '../../types'
import { nextTick } from 'vue'

function makeSettings(overrides?: Partial<BeadSettings>): BeadSettings {
  return {
    gridCols: 10,
    gridRows: 10,
    keepAspectRatio: true,
    colorMapping: 'average',
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
    ...overrides,
  }
}

describe('useBeadPipeline', () => {
  it('initializes with null beadGrid', () => {
    const { beadGrid, isProcessing } = useBeadPipeline()
    expect(beadGrid.value).toBeNull()
    expect(isProcessing.value).toBe(false)
  })

  it('does not process without image', async () => {
    const pipeline = useBeadPipeline()
    const palette: PaletteColor[] = []
    pipeline.process(null as any, palette, makeSettings())
    await nextTick()
    expect(pipeline.beadGrid.value).toBeNull()
  })

  it('returns settings ref with defaults', () => {
    const { settings } = useBeadPipeline()
    expect(settings.value.gridCols).toBe(29)
    expect(settings.value.gridRows).toBe(29)
    expect(settings.value.dithering.algorithm).toBe('none')
    expect(settings.value.adjustments.brightness).toBe(0)
  })

  it('returns error ref initially null', () => {
    const { error } = useBeadPipeline()
    expect(error.value).toBeNull()
  })
})
