<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFocusStore } from '../stores/focusStore'

const router = useRouter()
const focusStore = useFocusStore()

onMounted(() => {
  const ok = focusStore.initFromGrid()
  if (!ok) {
    router.replace('/')
  }
})
</script>

<template>
  <div class="focus-page">
    <p>Focus Mode — Scaffold</p>
  </div>
</template>

<style scoped>
.focus-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
}
</style>
