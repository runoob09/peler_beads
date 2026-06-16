// src/stores/paletteStore.ts
import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import type { PaletteColor } from '../types'
import { getBrandNames, getBrandColors, type ColorItem } from '../data/palettes'
import { hexToRgb, rgbToLab } from '../utils/colorSpace'

export interface PaletteColorInternal extends PaletteColor {
  lab: [number, number, number]
}

function computeLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return rgbToLab(r, g, b)
}

function generateId(): string {
  return `c_${Math.random().toString(36).substring(2, 10)}`
}

export const usePaletteStore = defineStore('palette', () => {
  const selectedBrand = ref<string>('')
  const customColors = ref<PaletteColorInternal[]>([])

  // Async brand names
  const brandNames = ref<string[]>([])
  getBrandNames().then(names => {
    brandNames.value = names
    if (names.length > 0 && !selectedBrand.value) {
      selectedBrand.value = names[0]
    }
  })

  // Async brand palette
  const brandPaletteData = ref<ColorItem[]>([])

  watch(selectedBrand, async (brand) => {
    if (!brand) { brandPaletteData.value = []; return }
    brandPaletteData.value = await getBrandColors(brand)
  }, { immediate: true })

  const brandPalette = computed<PaletteColorInternal[]>(() => {
    const colors = brandPaletteData.value
    const seen = new Set<string>()
    const result: PaletteColorInternal[] = []
    for (const c of colors) {
      const hexUpper = c.color.toUpperCase()
      if (!seen.has(hexUpper)) {
        seen.add(hexUpper)
        result.push({
          id: `${selectedBrand.value}_${c['color-name']}`,
          name: `${c['color-name']}`,
          hex: hexUpper,
          brand: selectedBrand.value,
          lab: computeLab(hexUpper),
        })
      }
    }
    return result
  })

  const palette = computed<PaletteColorInternal[]>(() => {
    return [...brandPalette.value, ...customColors.value]
  })

  function selectBrand(brand: string) {
    selectedBrand.value = brand
  }

  function addCustomColor(color: { hex: string; name: string }) {
    const hexUpper = color.hex.toUpperCase()
    customColors.value.push({
      id: generateId(),
      name: color.name,
      hex: hexUpper,
      brand: 'custom',
      lab: computeLab(hexUpper),
    })
  }

  function removeColor(id: string) {
    customColors.value = customColors.value.filter(c => c.id !== id)
  }

  return {
    brandNames,
    selectedBrand,
    palette,
    selectBrand,
    addCustomColor,
    removeColor,
    customColors,
  }
})
