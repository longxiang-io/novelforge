<template>
  <span class="brand-mark" :class="{ compact }">
    <img src="/favicon.png" alt="" />
    <span v-if="!compact">{{ $t('brand') }}</span>
  </span>
</template>

<script setup>
defineProps({
  compact: { type: Boolean, default: false }
})
</script>

<style scoped>
.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--cj-accent, #9b1c31);
  font-family: var(--cj-serif, Georgia, serif);
}
.brand-mark img { width: 28px; height: 28px; display: block; }
.brand-mark.compact { gap: 0; }
.brand-mark.compact img { width: 26px; height: 26px; }
</style>
