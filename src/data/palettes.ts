// src/data/palettes.ts
export interface ColorItem {
  'color-name': string
  color: string
}

export interface BrandColorMap {
  [brandName: string]: ColorItem[]
}

let brandData: BrandColorMap | null = null
let loadPromise: Promise<BrandColorMap> | null = null

async function loadData(): Promise<BrandColorMap> {
  if (brandData) return brandData
  if (!loadPromise) {
    loadPromise = import('./get-colors.json').then(m => m.default as BrandColorMap)
  }
  brandData = await loadPromise
  return brandData
}

// Eagerly start loading in background
loadData()

const BRAND_NAMES: string[] = []
let brandNamesReady = false

export async function getBrandNames(): Promise<string[]> {
  if (brandNamesReady) return BRAND_NAMES
  const data = await loadData()
  BRAND_NAMES.length = 0
  BRAND_NAMES.push(...Object.keys(data).sort())
  brandNamesReady = true
  return BRAND_NAMES
}

export async function getBrandColors(brandName: string): Promise<ColorItem[]> {
  const data = await loadData()
  return data[brandName] ?? []
}
