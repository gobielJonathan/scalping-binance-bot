<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  gap?: 'sm' | 'md' | 'lg'
  columns?: 'auto' | 'custom'
  customGridTemplate?: string
}

const props = withDefaults(defineProps<Props>(), {
  gap: 'lg',
  columns: 'auto',
})

const gridStyles = computed(() => {
  const styles: Record<string, string> = {
    display: 'grid',
    gridTemplateColumns: props.customGridTemplate || 'repeat(12, 1fr)',
  }

  switch (props.gap) {
    case 'sm':
      styles.gap = 'var(--trading-spacing-md)'
      break
    case 'md':
      styles.gap = 'var(--trading-spacing-lg)'
      break
    case 'lg':
      styles.gap = 'var(--trading-spacing-xl)'
      break
  }

  return styles
})
</script>

<template>
  <div class="dashboard-grid" :style="gridStyles">
    <slot></slot>
  </div>
</template>

<style scoped>
.dashboard-grid {
  width: 100%;
  margin-bottom: var(--trading-spacing-lg);
}

/* Responsive breakpoints */
/* Desktop (default - 12 columns) */
@media (max-width: 1199px) {
  .dashboard-grid {
    grid-template-columns: repeat(12, 1fr);
  }
}

/* Tablet (768px - 991px - 2 columns for most widgets) */
@media (max-width: 991px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Mobile (below 768px - 1 column) */
@media (max-width: 767px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: var(--trading-spacing-md);
  }
}

/* Extra small (below 576px) */
@media (max-width: 575px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: var(--trading-spacing-sm);
  }
}
</style>
