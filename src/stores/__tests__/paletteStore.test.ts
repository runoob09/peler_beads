import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

// Mock palettes with async functions — must be hoisted
vi.mock('../../data/palettes', () => {
  const brandData = {
    'TestBrand-3': [
      { 'color-name': 'A01', color: '#FFFFFF' },
      { 'color-name': 'A02', color: '#000000' },
      { 'color-name': 'A03', color: '#FF0000' },
    ],
    'TestBrand-4': [
      { 'color-name': 'B01', color: '#FFFFFF' },
      { 'color-name': 'B02', color: '#000000' },
      { 'color-name': 'B03', color: '#FF0000' },
      { 'color-name': 'B04', color: '#00FF00' },
    ],
  }
  return {
    getBrandNames: vi.fn().mockResolvedValue(Object.keys(brandData).sort()),
    getBrandColors: vi.fn().mockImplementation(
      async (name: string) => (brandData as Record<string, typeof brandData['TestBrand-3']>)[name] ?? [],
    ),
  }
})

import { usePaletteStore } from '../paletteStore'
import type { PaletteColor } from '../../types'

// Helper to flush all pending microtasks
const flush = () => new Promise<void>(r => setTimeout(r, 0))

describe('paletteStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns brand names (async)', async () => {
    const store = usePaletteStore()
    await flush()
    expect(store.brandNames).toContain('TestBrand-3')
    expect(store.brandNames).toContain('TestBrand-4')
    expect(store.brandNames.length).toBe(2)
  })

  it('loads palette for a selected brand, deduplicated by hex', async () => {
    const store = usePaletteStore()
    await flush()
    store.selectBrand('TestBrand-3')
    await flush()
    await nextTick()
    expect(store.palette.length).toBe(3)
  })

  it('deduplicates by hex within a brand', async () => {
    const store = usePaletteStore()
    await flush()
    store.selectBrand('TestBrand-3')
    await flush()
    await nextTick()
    const hexes = store.palette.map((c: PaletteColor) => c.hex)
    const uniqueHexes = new Set(hexes)
    expect(uniqueHexes.size).toBe(hexes.length)
  })

  it('precomputes LAB values for palette colors', async () => {
    const store = usePaletteStore()
    await flush()
    store.selectBrand('TestBrand-3')
    await flush()
    await nextTick()
    for (const c of store.palette as any[]) {
      expect(c).toHaveProperty('lab')
      expect(Array.isArray(c.lab)).toBe(true)
      expect(c.lab.length).toBe(3)
    }
  })

  it('adds custom color', async () => {
    const store = usePaletteStore()
    await flush()
    store.addCustomColor({ hex: '#ABCDEF', name: 'Custom Blue' })
    const custom = store.palette.find((c: PaletteColor) => c.brand === 'custom')
    expect(custom).toBeTruthy()
    expect(custom!.hex).toBe('#ABCDEF')
    expect(custom!.name).toBe('Custom Blue')
  })

  it('removes a custom color', async () => {
    const store = usePaletteStore()
    await flush()
    store.selectBrand('TestBrand-3')
    await flush()
    await nextTick()
    store.addCustomColor({ hex: '#ABCDEF', name: 'ToRemove' })
    const custom = store.palette.find((c: PaletteColor) => c.brand === 'custom')
    expect(custom).toBeTruthy()
    const beforeCount = store.palette.length
    store.removeColor(custom!.id)
    expect(store.palette.length).toBe(beforeCount - 1)
    expect(store.palette.find((c: PaletteColor) => c.id === custom!.id)).toBeUndefined()
  })
})
