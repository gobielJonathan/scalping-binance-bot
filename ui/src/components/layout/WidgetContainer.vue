<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useFadeInAnimation } from '@/composables/animations'

interface Props {
  title?: string
  compact?: boolean
  loading?: boolean
  error?: boolean
  success?: boolean
  variant?: 'default' | 'compact' | 'expanded'
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  height: 'auto',
})

const widgetRef = ref<HTMLElement>()
const { elementRef: fadeRef } = useFadeInAnimation({
  duration: 0.6,
  delay: 0.1,
})

const widgetClasses = computed(() => ({
  'widget-card': true,
  'compact': props.compact || props.variant === 'compact',
  'loading': props.loading,
  'error': props.error,
  'success': props.success,
  'widget-entrance': true,
}))

const widgetStyles = computed(() => ({
  minHeight: props.height !== 'auto' ? props.height : undefined,
}))

onMounted(() => {
  if (widgetRef.value) {
    fadeRef.value = widgetRef.value
  }
})
</script>

<template>
  <div ref="widgetRef" :class="widgetClasses" :style="widgetStyles">
    <!-- Widget Header with Title -->
    <div v-if="title" class="widget-header">
      <h5>{{ title }}</h5>
      <div class="widget-header-actions">
        <slot name="header-actions"></slot>
      </div>
    </div>

    <!-- Widget Content -->
    <div class="widget-content">
      <div class="widget-body">
        <slot>
          <div class="text-tertiary" style="text-align: center">
            <p>Widget content goes here</p>
          </div>
        </slot>
      </div>
    </div>

    <!-- Widget Footer -->
    <div
      v-if="$slots.footer"
      class="widget-footer"
      style="border-top: 1px solid var(--trading-border); margin-top: var(--trading-spacing-lg); padding-top: var(--trading-spacing-lg)"
    >
      <slot name="footer"></slot>
    </div>

    <!-- Loading Overlay with Skeleton -->
    <div
      v-if="loading"
      class="loading-overlay"
    >
      <div class="spinner"></div>
    </div>

    <!-- Error State with Animation -->
    <div v-if="error && !loading" class="error-overlay">
      <div class="error-content">
        <p class="error-icon">
          <span>⚠️</span>
        </p>
        <p class="error-message">
          Failed to load data
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Widget card base styles are in theme.css */
.widget-card {
  position: relative;
  transition: all 0.3s ease;
}

.widget-card.widget-entrance {
  animation: widget-slide-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes widget-slide-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.widget-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--trading-spacing-md);
}

/* Loading overlay with smooth fade */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 20, 25, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--trading-radius-lg);
  z-index: 10;
  backdrop-filter: blur(1px);
  animation: fade-in 0.3s ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Error overlay with animation */
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(231, 76, 60, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--trading-radius-lg);
  padding: var(--trading-spacing-lg);
  z-index: 10;
  animation: error-shake 0.4s ease-out;
}

@keyframes error-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-8px);
  }
  75% {
    transform: translateX(8px);
  }
}

.error-content {
  text-align: center;
  color: var(--trading-loss);
}

.error-icon {
  margin: 0;
  font-size: 2rem;
  animation: bounce-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.error-message {
  margin: var(--trading-spacing-sm) 0 0 0;
  font-size: 0.875rem;
}

@keyframes bounce-in {
  0% {
    transform: scale(0) rotate(-45deg);
    opacity: 0;
  }
  100% {
    transform: scale(1) rotate(0);
    opacity: 1;
  }
}
</style>
