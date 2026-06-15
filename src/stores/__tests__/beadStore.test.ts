import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBeadStore } from '../beadStore'
import type { PaletteColor } from '../../types'

describe('beadStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with null beadGrid', () => {
    const store = useBeadStore()
    expect(store.beadGrid).toBeNull()
  })

  it('returns settings with defaults', () => {
    const store = useBeadStore()
    expect(store.settings.gridCols).toBe(29)
    expect(store.settings.gridRows).toBe(29)
    expect(store.settings.colorCalcMethod).toBe('dominant')
    expect(store.settings.colorMatchMethod).toBe('ciede2000')
  })

  it('initializes progress to 0', () => {
    const store = useBeadStore()
    expect(store.progress).toBe(0)
  })

  it('initializes error to null', () => {
    const store = useBeadStore()
    expect(store.error).toBeNull()
  })

  it('does not process without image file', async () => {
    const store = useBeadStore()
    const palette: PaletteColor[] = []
    await store.process(null as any, palette)
    expect(store.beadGrid).toBeNull()
  })
})
