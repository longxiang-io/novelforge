<template>
  <div class="cj-steps">
    <template v-for="(step, index) in steps" :key="step.label">
      <span v-if="index" class="cj-arrow">›</span>
      <span class="cj-step" :class="step.state">{{ step.state === 'done' ? '✓ ' : '' }}{{ step.label }}</span>
    </template>
  </div>
</template>

<script setup>
defineProps({ steps: { type: Array, default: () => [] } })
</script>
