<script setup lang="ts">
import { computed } from 'vue'
import type { BeadGrid } from '../types'
import { countColorUsage } from '../composables/useExport'

const props = defineProps<{ beadGrid: BeadGrid | null }>()

const sortedColors = computed(() => {
  if (!props.beadGrid) return []
  const counts = countColorUsage(props.beadGrid)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([idx, count]) => ({
      color: props.beadGrid!.palette[idx],
      count,
      pct: Math.round((count / (props.beadGrid!.rows * props.beadGrid!.cols)) * 100),
    }))
})

const totalBeads = computed(() => {
  if (!props.beadGrid) return 0
  return props.beadGrid.rows * props.beadGrid.cols
})

function textColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1a1a2e' : '#fff'
}

function labelShort(name: string) {
  return name.split(/[\s_]+/)[0] ?? name
}
</script>

<template>
  <aside class="color-legend">
    <h3 class="legend-title">色彩图例</h3>
    <div v-if="!beadGrid" class="legend-empty">上传图片后将显示颜色统计</div>
    <template v-else>
      <div class="legend-summary">
        <span class="summary-num">{{ sortedColors.length }}</span> 色 ·
        <span class="summary-num">{{ totalBeads }}</span> 珠
      </div>
      <div class="legend-list">
        <div
          v-for="item in sortedColors"
          :key="item.color.id"
          class="legend-item"
        >
          <span
            class="legend-swatch"
            :style="{ background: item.color.hex }"
          >
            <span class="swatch-label" :style="{ color: textColor(item.color.hex) }">
              {{ labelShort(item.color.name) }}
            </span>
          </span>
          <span class="legend-count">{{ item.count }}</span>
          <span class="legend-pct">{{ item.pct }}%</span>
          <!-- Mini bar -->
          <span class="legend-bar-bg">
            <span class="legend-bar" :style="{ width: item.pct + '%', background: item.color.hex }"></span>
          </span>
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.color-legend {
  width: 220px; flex-shrink: 0; padding: 16px 14px;
  border-left: 1px solid var(--border, #e5e4e7);
  overflow-y: auto; max-height: 100vh; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 10px;
  background: color-mix(in srgb, var(--bg, #fff) 98%, var(--text, #6b6375));
}
.legend-title {
  font-size: 14px; font-weight: 600; color: var(--text-h, #08060d); margin: 0;
  letter-spacing: 0.5px;
}
.legend-empty { font-size: 12px; color: var(--text, #6b6375); }
.legend-summary { font-size: 12px; color: var(--text, #6b6375); }
.summary-num { font-weight: 600; color: var(--text-h, #08060d); font-family: var(--mono, monospace); }

.legend-list { display: flex; flex-direction: column; gap: 3px; }
.legend-item {
  display: grid; grid-template-columns: 1fr auto auto; gap: 6px; align-items: center;
  padding: 2px 0;
}
.legend-swatch {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 2px 6px; border-radius: 3px; min-width: 28px;
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
}
.swatch-label { font-size: 9px; font-weight: 700; font-family: var(--mono, monospace); line-height: 1; }
.legend-count { font-size: 11px; font-weight: 600; color: var(--text-h, #08060d); font-family: var(--mono, monospace); text-align: right; min-width: 24px; }
.legend-pct { font-size: 10px; color: var(--text, #6b6375); font-family: var(--mono, monospace); text-align: right; width: 28px; }
.legend-bar-bg {
  grid-column: 1 / -1; height: 3px; background: var(--border, #e5e4e7); border-radius: 1px;
  overflow: hidden; margin-top: 1px;
}
.legend-bar { display: block; height: 100%; border-radius: 1px; min-width: 1px; }
</style>
