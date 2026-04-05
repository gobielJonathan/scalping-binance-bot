/**
 * Widget animation composable
 * Provides animation hooks for widget components
 */

import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue'
import * as animations from '@/utils/animations'

/**
 * Composable for loading animations
 */
export const useWidgetLoading = (isLoading: boolean) => {
  const loadingElementRef = ref<HTMLElement>()

  const startLoadingAnimation = () => {
    if (loadingElementRef.value) {
      animations.animateRotate(loadingElementRef.value, 1)
    }
  }

  const stopLoadingAnimation = () => {
    if (loadingElementRef.value) {
      animations.killAnimations(loadingElementRef.value)
    }
  }

  watch(
    () => isLoading,
    (newVal) => {
      if (newVal) {
        startLoadingAnimation()
      } else {
        stopLoadingAnimation()
      }
    },
  )

  return {
    loadingElementRef,
  }
}

/**
 * Composable for value animations with P&L styling
 */
export const useValueAnimation = (
  value: () => number,
  options?: {
    decimals?: number
    duration?: 'fast' | 'medium' | 'slow' | 'realtime'
    onValueUpdate?: (val: number) => void
  },
) => {
  const elementRef = ref<HTMLElement>()
  let lastValue = value()

  const updateValue = () => {
    const newValue = value()
    if (newValue !== lastValue && elementRef.value) {
      animations.animateNumberValue(
        elementRef.value,
        lastValue,
        newValue,
        animations.getAnimationDuration(options?.duration || 'medium'),
        options?.decimals || 2,
        options?.onValueUpdate,
      )
      lastValue = newValue
    }
  }

  watch(() => value(), updateValue)

  return {
    elementRef,
  }
}

/**
 * Composable for P&L animations with color and glow
 */
export const usePnLAnimation = (
  value: () => number,
  elementRef: Ref<HTMLElement | undefined>,
  options?: {
    showGlow?: boolean
  },
) => {
  const isProfitable = () => value() >= 0
  const lastValue = ref(value())

  watch(
    () => value(),
    (newValue) => {
      if (newValue !== lastValue.value && elementRef.value) {
        const wasProfitable = lastValue.value >= 0
        const isProfitableNow = newValue >= 0

        // Animate number
        animations.animateNumberValue(
          elementRef.value || null,
          lastValue.value,
          newValue,
          animations.getAnimationDuration('medium'),
          2,
        )

        // Animate color if state changed
        if (wasProfitable !== isProfitableNow) {
          const newColor = isProfitableNow ? '#26c281' : '#e74c3c'
          animations.animateColorChange(elementRef.value || null, '', newColor, animations.getAnimationDuration('fast'))
        }

        // Add glow effect
        if (options?.showGlow) {
          if (isProfitableNow) {
            animations.animateProfitGlow(elementRef.value || null)
          } else {
            animations.animateLossGlow(elementRef.value || null)
          }
        }

        lastValue.value = newValue
      }
    },
  )

  return {
    isProfitable,
  }
}

/**
 * Composable for fade in animations
 */
export const useFadeInAnimation = (
  options?: {
    duration?: number
    delay?: number
  },
) => {
  const elementRef = ref<HTMLElement>()

  onMounted(() => {
    if (elementRef.value) {
      animations.animateFadeIn(
        elementRef.value,
        options?.duration || animations.getAnimationDuration('medium'),
        options?.delay || 0,
      )
    }
  })

  return {
    elementRef,
  }
}

/**
 * Composable for cascade/staggered animations
 */
export const useCascadeAnimation = (
  options?: {
    staggerDelay?: number
    duration?: number
  },
) => {
  const containerRef = ref<HTMLElement>()

  onMounted(() => {
    if (containerRef.value) {
      const children = containerRef.value.querySelectorAll('[data-animate]')
      animations.animateCascade(
        children as NodeListOf<HTMLElement>,
        options?.staggerDelay || 0.15,
        options?.duration || animations.getAnimationDuration('slow'),
      )
    }
  })

  return {
    containerRef,
  }
}

/**
 * Composable for hover animations on cards
 */
export const useCardHoverAnimation = () => {
  const cardRef = ref<HTMLElement>()

  const onMouseEnter = () => {
    if (cardRef.value) {
      animations.animateCardElevation(cardRef.value)
      animations.animateScale(cardRef.value, 1, 1.02, animations.getAnimationDuration('fast'))
    }
  }

  const onMouseLeave = () => {
    if (cardRef.value) {
      animations.animateCardElevationReset(cardRef.value)
      animations.animateScale(cardRef.value, 1.02, 1, animations.getAnimationDuration('fast'))
    }
  }

  return {
    cardRef,
    onMouseEnter,
    onMouseLeave,
  }
}

/**
 * Composable for row highlight animations
 */
export const useRowHighlightAnimation = () => {
  const rowRef = ref<HTMLElement>()

  const highlight = () => {
    if (rowRef.value) {
      animations.animateRowHighlight(rowRef.value)
    }
  }

  return {
    rowRef,
    highlight,
  }
}

/**
 * Composable for pulsing elements (real-time data)
 */
export const usePulseAnimation = (
  options?: {
    enabled?: boolean
    duration?: number
  },
) => {
  const pulseRef = ref<HTMLElement>()
  let pulseAnimation: gsap.core.Tween | null = null

  const startPulse = () => {
    if (pulseRef.value && !pulseAnimation) {
      pulseAnimation = animations.animatePulse(pulseRef.value, options?.duration || 1.5)
    }
  }

  const stopPulse = () => {
    if (pulseAnimation) {
      animations.killAnimations(pulseRef.value || null)
      pulseAnimation = null
    }
  }

  watch(
    () => options?.enabled,
    (enabled) => {
      if (enabled) {
        startPulse()
      } else {
        stopPulse()
      }
    },
  )

  onUnmounted(() => {
    stopPulse()
  })

  return {
    pulseRef,
    startPulse,
    stopPulse,
  }
}

/**
 * Composable for notification animations
 */
export const useNotificationAnimation = (
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
) => {
  const notificationRef = ref<HTMLElement>()

  const show = () => {
    if (notificationRef.value) {
      animations.animateSlideInTop(notificationRef.value)

      // Flash for important notifications
      if (type === 'error' || type === 'warning') {
        animations.animateFlash(notificationRef.value, animations.getAnimationDuration('fast'), 2)
      }
    }
  }

  const hide = () => {
    if (notificationRef.value) {
      animations.animateFadeOut(notificationRef.value, animations.getAnimationDuration('fast'))
    }
  }

  onMounted(() => {
    show()
  })

  return {
    notificationRef,
    show,
    hide,
  }
}

/**
 * Composable for counter animations
 */
export const useCounterAnimation = (
  targetValue: () => number,
  options?: {
    duration?: number
    decimals?: number
  },
) => {
  const elementRef = ref<HTMLElement>()
  let currentValue = 0

  const animate = () => {
    const newValue = targetValue()
    if (elementRef.value && newValue !== currentValue) {
      animations.animateCounter(
        elementRef.value,
        currentValue,
        newValue,
        options?.duration || animations.getAnimationDuration('slow'),
        options?.decimals || 0,
      )
      currentValue = newValue
    }
  }

  watch(() => targetValue(), animate, { immediate: true })

  return {
    elementRef,
  }
}

/**
 * Composable for button press feedback
 */
export const useButtonAnimation = () => {
  const buttonRef = ref<HTMLElement>()

  const handleClick = (callback?: () => void) => {
    if (buttonRef.value) {
      animations.animateButtonPress(buttonRef.value)
      if (callback) {
        callback()
      }
    }
  }

  return {
    buttonRef,
    handleClick,
  }
}

/**
 * Composable for skeleton loading animations
 */
export const useSkeletonAnimation = () => {
  const skeletonRef = ref<HTMLElement>()

  onMounted(() => {
    if (skeletonRef.value) {
      // Add shimmer background animation
      skeletonRef.value.style.backgroundImage = `linear-gradient(
        90deg,
        rgba(255,255,255,0) 0%,
        rgba(255,255,255,0.2) 50%,
        rgba(255,255,255,0) 100%
      )`
      skeletonRef.value.style.backgroundSize = '200% 100%'
      skeletonRef.value.style.backgroundPosition = '0 0'
      animations.animateSkeletonShimmer(skeletonRef.value)
    }
  })

  return {
    skeletonRef,
  }
}

/**
 * Composable for hardware acceleration management
 */
export const useHardwareAcceleration = () => {
  const elementRef = ref<HTMLElement>()

  onMounted(() => {
    if (elementRef.value) {
      animations.enableHardwareAcceleration(elementRef.value)
    }
  })

  onUnmounted(() => {
    if (elementRef.value) {
      animations.disableHardwareAcceleration(elementRef.value)
    }
  })

  return {
    elementRef,
  }
}

export default {
  useWidgetLoading,
  useValueAnimation,
  usePnLAnimation,
  useFadeInAnimation,
  useCascadeAnimation,
  useCardHoverAnimation,
  useRowHighlightAnimation,
  usePulseAnimation,
  useNotificationAnimation,
  useCounterAnimation,
  useButtonAnimation,
  useSkeletonAnimation,
  useHardwareAcceleration,
}
