<template>
  <span class="user-avatar" :class="size" :title="name">
    <img v-if="src" :src="src" alt="" />
    <span v-else>{{ letter }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { avatarKey } from '../../../../shared/avatars.js'

const props = defineProps({
  name: { type: String, default: '' },
  avatar: { type: String, default: '' },
  size: { type: String, default: '' }
})

const src = computed(() => {
  const key = avatarKey(props.avatar)
  return key ? `/avatars/${key}.svg` : ''
})

const letter = computed(() => String(props.name || 'A').charAt(0).toUpperCase() || 'A')
</script>

<style scoped>
.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #d9cfc2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: #5b5045;
  overflow: hidden;
  flex-shrink: 0;
  line-height: 1;
}
.user-avatar img { width: 100%; height: 100%; display: block; object-fit: cover; }
.user-avatar.sm { width: 24px; height: 24px; font-size: 12px; }
.user-avatar.lg { width: 48px; height: 48px; font-size: 18px; }
</style>
