import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { PaletteColor } from '../types'
import { getBrandColors, BRAND_NAMES } from '../data/palettes'
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
  const selectedBrand = ref<string>(BRAND_NAMES[0] ?? '')
  const customColors = ref<PaletteColorInternal[]>([])

  const brandNames = computed(() => BRAND_NAMES)

  const brandPalette = computed<PaletteColorInternal[]>(() => {
    if (!selectedBrand.value) return []
    const colors = getBrandColors(selectedBrand.value)
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
