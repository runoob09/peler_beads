<script setup lang="ts">
defineProps<{ brandNames: string[]; modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <select class="brand-select" :value="modelValue" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
    <option v-for="name in brandNames" :key="name" :value="name">{{ name }}</option>
  </select>
</template>

<style scoped>
.brand-select { width: 100%; padding: 6px 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text-h); font-size: 14px; }
</style>
