import { describe, it, expect, vi } from 'vitest'
import type { PaletteColor } from '../../types'

interface PaletteColorInternal extends PaletteColor {
  lab: [number, number, number]
}

// Mock the JSON import — must be hoisted
vi.mock('../../data/get-colors.json', () => ({
  default: {
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
  },
}))

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
    BRAND_NAMES: Object.keys(brandData).sort(),
    getBrandColors: (name: string) => (brandData as any)[name] ?? [],
  }
})

import { usePalette } from '../usePalette'

describe('usePalette', () => {
  it('returns brand names', () => {
    const { brandNames } = usePalette()
    expect(brandNames.value).toContain('TestBrand-3')
    expect(brandNames.value).toContain('TestBrand-4')
    expect(brandNames.value.length).toBe(2)
  })

  it('loads palette for a selected brand, deduplicated by hex', () => {
    const { selectBrand, palette } = usePalette()
    selectBrand('TestBrand-3')
    expect(palette.value.length).toBe(3)
  })

  it('deduplicates by hex within a brand', () => {
    const { palette, selectBrand } = usePalette()
    selectBrand('TestBrand-3')
    const hexes = palette.value.map((c: PaletteColorInternal) => c.hex)
    const uniqueHexes = new Set(hexes)
    expect(uniqueHexes.size).toBe(hexes.length)
  })

  it('precomputes LAB values for palette colors', () => {
    const { palette, selectBrand } = usePalette()
    selectBrand('TestBrand-3')
    for (const c of palette.value as PaletteColorInternal[]) {
      expect(c).toHaveProperty('lab')
      expect(Array.isArray(c.lab)).toBe(true)
      expect(c.lab.length).toBe(3)
    }
  })

  it('adds custom color', () => {
    const { palette, addCustomColor } = usePalette()
    addCustomColor({ hex: '#ABCDEF', name: 'Custom Blue' })
    const custom = palette.value.find((c: PaletteColor) => c.brand === 'custom')
    expect(custom).toBeTruthy()
    expect(custom!.hex).toBe('#ABCDEF')
    expect(custom!.name).toBe('Custom Blue')
  })

  it('removes a custom color', () => {
    const { palette, selectBrand, addCustomColor, removeColor } = usePalette()
    selectBrand('TestBrand-3')
    addCustomColor({ hex: '#ABCDEF', name: 'ToRemove' })
    const custom = palette.value.find((c: PaletteColor) => c.brand === 'custom')
    expect(custom).toBeTruthy()
    const beforeCount = palette.value.length
    removeColor(custom!.id)
    expect(palette.value.length).toBe(beforeCount - 1)
    expect(palette.value.find((c: PaletteColor) => c.id === custom!.id)).toBeUndefined()
  })
})
