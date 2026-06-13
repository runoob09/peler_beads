<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  upload: [file: File]
}>()

const fileName = ref<string>('')
const fileInput = ref<HTMLInputElement>()

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    fileName.value = file.name
    emit('upload', file)
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    fileName.value = file.name
    emit('upload', file)
  }
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
}

function triggerUpload() {
  fileInput.value?.click()
}
</script>

<template>
  <div
    class="upload-area"
    :class="{ 'has-file': !!fileName }"
    @click="triggerUpload"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="file-input"
      @change="onFileChange"
    />
    <span v-if="fileName" class="file-name">{{ fileName }}</span>
    <span v-else class="placeholder">拖拽或点击上传图片</span>
  </div>
</template>

<style scoped>
.upload-area {
  border: 2px dashed var(--border, #ccc);
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}
.upload-area:hover {
  border-color: var(--accent, #aa3bff);
}
.upload-area.has-file {
  border-style: solid;
  border-color: var(--accent, #aa3bff);
}
.file-input {
  display: none;
}
.file-name {
  color: var(--text-h, #08060d);
  font-weight: 500;
}
.placeholder {
  color: var(--text, #6b6375);
}
</style>
