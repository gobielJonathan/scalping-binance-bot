/**
 * Animation utilities for Vue 3 trading dashboard
 * Provides GSAP-powered animations for smooth micro interactions
 */

import gsap from 'gsap'

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Get animation duration based on type
 */
export const getAnimationDuration = (type: 'fast' | 'medium' | 'slow' | 'realtime'): number => {
  if (prefersReducedMotion()) return 0
  const durations = {
    fast: 0.2,
    medium: 0.4,
    slow: 0.8,
    realtime: 0.15,
  }
  return durations[type]
}

/**
 * Animate number value with smooth transitions
 * Useful for P&L, balances, prices
 */
export const animateNumberValue = (
  element: HTMLElement | null,
  startValue: number,
  endValue: number,
  duration: number = getAnimationDuration('medium'),
  decimals: number = 2,
  onUpdate?: (value: number) => void,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.textContent = endValue.toFixed(decimals)
    return gsap.to({}, {})
  }

  const obj = { value: startValue }
  return gsap.to(obj, {
    value: endValue,
    duration,
    ease: 'power2.out',
    onUpdate() {
      if (onUpdate) {
        onUpdate(obj.value)
      } else {
        element.textContent = obj.value.toFixed(decimals)
      }
    },
  })
}

/**
 * Animate color transition for profit/loss indicators
 */
export const animateColorChange = (
  element: HTMLElement | null,
  fromColor: string,
  toColor: string,
  duration: number = getAnimationDuration('medium'),
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.style.color = toColor
    return gsap.to({}, {})
  }

  return gsap.to(element, {
    color: toColor,
    duration,
    ease: 'power2.out',
  })
}

/**
 * Animate with glow effect for profit values
 */
export const animateProfitGlow = (
  element: HTMLElement | null,
  _intensity: number = 0.3,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) return gsap.to({}, {})

  const glowColor = 'rgba(38, 194, 129, 0.3)'
  return gsap.to(element, {
    boxShadow: `0 0 12px ${glowColor}, inset 0 0 12px ${glowColor}`,
    duration: getAnimationDuration('medium'),
    ease: 'power2.out',
  })
}

/**
 * Animate with glow effect for loss values
 */
export const animateLossGlow = (
  element: HTMLElement | null,
  _intensity: number = 0.3,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) return gsap.to({}, {})

  const glowColor = 'rgba(231, 76, 60, 0.3)'
  return gsap.to(element, {
    boxShadow: `0 0 12px ${glowColor}, inset 0 0 12px ${glowColor}`,
    duration: getAnimationDuration('medium'),
    ease: 'power2.out',
  })
}

/**
 * Subtle shake animation for errors
 */
export const animateShake = (
  element: HTMLElement | null,
  intensity: number = 5,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) return gsap.to({}, {})

  return gsap.to(element, {
    x: intensity,
    duration: 0.1,
    yoyo: true,
    repeat: 5,
    ease: 'power1.inOut',
  })
}

/**
 * Scale animation with easing
 */
export const animateScale = (
  element: HTMLElement | null,
  fromScale: number = 1,
  toScale: number = 1.05,
  duration: number = getAnimationDuration('fast'),
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.style.transform = `scale(${toScale})`
    return gsap.to({}, {})
  }

  return gsap.fromTo(
    element,
    { scale: fromScale },
    {
      scale: toScale,
      duration,
      ease: 'back.out',
    },
  )
}

/**
 * Fade in animation
 */
export const animateFadeIn = (
  element: HTMLElement | null,
  duration: number = getAnimationDuration('medium'),
  delay: number = 0,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.style.opacity = '1'
    return gsap.to({}, {})
  }

  return gsap.fromTo(
    element,
    { opacity: 0 },
    {
      opacity: 1,
      duration,
      delay,
      ease: 'power2.out',
    },
  )
}

/**
 * Fade out animation
 */
export const animateFadeOut = (
  element: HTMLElement | null,
  duration: number = getAnimationDuration('fast'),
  delay: number = 0,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.style.opacity = '0'
    return gsap.to({}, {})
  }

  return gsap.to(element, {
    opacity: 0,
    duration,
    delay,
    ease: 'power2.in',
  })
}

/**
 * Slide in animation from top
 */
export const animateSlideInTop = (
  element: HTMLElement | null,
  duration: number = getAnimationDuration('medium'),
  distance: number = 20,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.style.transform = 'translateY(0)'
    element.style.opacity = '1'
    return gsap.to({}, {})
  }

  return gsap.fromTo(
    element,
    { opacity: 0, y: -distance },
    {
      opacity: 1,
      y: 0,
      duration,
      ease: 'power2.out',
    },
  )
}

/**
 * Slide in animation from bottom
 */
export const animateSlideInBottom = (
  element: HTMLElement | null,
  duration: number = getAnimationDuration('medium'),
  distance: number = 20,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.style.transform = 'translateY(0)'
    element.style.opacity = '1'
    return gsap.to({}, {})
  }

  return gsap.fromTo(
    element,
    { opacity: 0, y: distance },
    {
      opacity: 1,
      y: 0,
      duration,
      ease: 'power2.out',
    },
  )
}

/**
 * Pulse animation for real-time indicators
 */
export const animatePulse = (
  element: HTMLElement | null,
  duration: number = 1.5,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) return gsap.to({}, {})

  return gsap.to(element, {
    opacity: 0.5,
    duration: duration / 2,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
  })
}

/**
 * Bounce animation
 */
export const animateBounce = (
  element: HTMLElement | null,
  distance: number = 10,
  duration: number = getAnimationDuration('fast'),
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.style.transform = 'translateY(0)'
    return gsap.to({}, {})
  }

  return gsap.fromTo(
    element,
    { y: 0 },
    {
      y: -distance,
      duration,
      ease: 'back.out',
    },
  )
}

/**
 * Skeleton loading shimmer animation
 */
export const animateSkeletonShimmer = (element: HTMLElement | null): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) return gsap.to({}, {})

  return gsap.to(element, {
    backgroundPosition: '200% 0',
    duration: 1.5,
    repeat: -1,
    ease: 'none',
  })
}

/**
 * Counter animation for statistics
 */
export const animateCounter = (
  element: HTMLElement | null,
  startValue: number,
  endValue: number,
  duration: number = getAnimationDuration('slow'),
  decimals: number = 0,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.textContent = endValue.toFixed(decimals)
    return gsap.to({}, {})
  }

  const obj = { value: startValue }
  return gsap.to(obj, {
    value: endValue,
    duration,
    ease: 'power2.out',
    snap: { value: 1 },
    onUpdate() {
      element.textContent = obj.value.toFixed(decimals)
    },
  })
}

/**
 * Batch animate multiple elements with stagger
 */
export const animateBatchFadeIn = (
  elements: HTMLElement[] | NodeListOf<HTMLElement> | null,
  staggerDelay: number = 0.1,
  duration: number = getAnimationDuration('medium'),
): gsap.core.Timeline => {
  const timeline = gsap.timeline()

  if (!elements) return timeline
  if (prefersReducedMotion()) {
    Array.from(elements).forEach((el) => {
      el.style.opacity = '1'
    })
    return timeline
  }

  Array.from(elements).forEach((element, index) => {
    timeline.fromTo(
      element,
      { opacity: 0, y: 10 },
      {
        opacity: 1,
        y: 0,
        duration,
        ease: 'power2.out',
      },
      index * staggerDelay,
    )
  })

  return timeline
}

/**
 * Cascade animation for widget entrances
 */
export const animateCascade = (
  elements: HTMLElement[] | NodeListOf<HTMLElement> | null,
  staggerDelay: number = 0.15,
  duration: number = getAnimationDuration('slow'),
): gsap.core.Timeline => {
  const timeline = gsap.timeline()

  if (!elements) return timeline
  if (prefersReducedMotion()) {
    Array.from(elements).forEach((el) => {
      el.style.opacity = '1'
      el.style.transform = 'translateY(0) scale(1)'
    })
    return timeline
  }

  Array.from(elements).forEach((element, index) => {
    timeline.fromTo(
      element,
      { opacity: 0, y: 20, scale: 0.95 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration,
        ease: 'back.out',
      },
      index * staggerDelay,
    )
  })

  return timeline
}

/**
 * Rotate animation for loading spinners
 */
export const animateRotate = (
  element: HTMLElement | null,
  duration: number = 1,
  clockwise: boolean = true,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) return gsap.to({}, {})

  return gsap.to(element, {
    rotation: clockwise ? 360 : -360,
    duration,
    repeat: -1,
    ease: 'none',
  })
}

/**
 * Flash animation for notifications
 */
export const animateFlash = (
  element: HTMLElement | null,
  duration: number = getAnimationDuration('fast'),
  flashCount: number = 3,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.style.opacity = '1'
    return gsap.to({}, {})
  }

  return gsap.to(element, {
    opacity: 0.3,
    duration: duration / 2,
    yoyo: true,
    repeat: flashCount * 2 - 1,
    ease: 'power1.inOut',
  })
}

/**
 * Row highlight animation for tables
 */
export const animateRowHighlight = (
  element: HTMLElement | null,
  duration: number = getAnimationDuration('medium'),
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) return gsap.to({}, {})

  return gsap.fromTo(
    element,
    { backgroundColor: 'rgba(52, 152, 219, 0.2)' },
    {
      backgroundColor: 'transparent',
      duration,
      ease: 'power2.out',
    },
  )
}

/**
 * Button press feedback animation
 */
export const animateButtonPress = (
  element: HTMLElement | null,
  duration: number = getAnimationDuration('fast'),
): gsap.core.Timeline => {
  const timeline = gsap.timeline()

  if (!element) return timeline
  if (prefersReducedMotion()) {
    element.style.transform = 'scale(1)'
    element.style.boxShadow = 'none'
    return timeline
  }

  timeline
    .to(element, { scale: 0.95, duration: duration / 2, ease: 'power2.in' }, 0)
    .to(element, { boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' }, 0)
    .to(element, { scale: 1, boxShadow: 'none', duration: duration / 2, ease: 'back.out' })

  return timeline
}

/**
 * Card elevation on hover
 */
export const animateCardElevation = (
  element: HTMLElement | null,
  duration: number = getAnimationDuration('fast'),
  elevation: number = 8,
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.style.boxShadow = `0 ${elevation}px ${elevation * 2}px rgba(0,0,0,0.3)`
    return gsap.to({}, {})
  }

  return gsap.to(element, {
    boxShadow: `0 ${elevation}px ${elevation * 2}px rgba(0,0,0,0.3)`,
    y: -elevation / 2,
    duration,
    ease: 'power2.out',
  })
}

/**
 * Reset card elevation
 */
export const animateCardElevationReset = (
  element: HTMLElement | null,
  duration: number = getAnimationDuration('fast'),
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'
    element.style.transform = 'translateY(0)'
    return gsap.to({}, {})
  }

  return gsap.to(element, {
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    y: 0,
    duration,
    ease: 'power2.out',
  })
}

/**
 * Progress bar animation
 */
export const animateProgressBar = (
  element: HTMLElement | null,
  startValue: number = 0,
  endValue: number = 100,
  duration: number = getAnimationDuration('slow'),
): gsap.core.Tween => {
  if (!element) return gsap.to({}, {})
  if (prefersReducedMotion()) {
    element.style.width = `${endValue}%`
    return gsap.to({}, {})
  }

  return gsap.fromTo(
    element,
    { width: `${startValue}%` },
    {
      width: `${endValue}%`,
      duration,
      ease: 'power2.out',
    },
  )
}

/**
 * Create a master timeline for coordinated animations
 */
export const createAnimationTimeline = (): gsap.core.Timeline => {
  return gsap.timeline()
}

/**
 * Kill all active animations on an element
 */
export const killAnimations = (element: HTMLElement | null): void => {
  if (element) {
    gsap.killTweensOf(element)
  }
}

/**
 * Utility to add hardware acceleration to element
 */
export const enableHardwareAcceleration = (element: HTMLElement | null): void => {
  if (element) {
    element.style.willChange = 'transform, opacity'
  }
}

/**
 * Remove hardware acceleration hints
 */
export const disableHardwareAcceleration = (element: HTMLElement | null): void => {
  if (element) {
    element.style.willChange = 'auto'
  }
}

/**
 * Format number with animation helper
 */
export const formatAnimatedNumber = (
  value: number,
  decimals: number = 2,
  prefix: string = '',
  suffix: string = '',
): string => {
  return `${prefix}${value.toFixed(decimals)}${suffix}`
}

/**
 * Get directional indicator for price changes
 */
export const getDirectionalIndicator = (change: number): string => {
  if (change > 0) return '↑'
  if (change < 0) return '↓'
  return '→'
}

/**
 * Create color transition object for better organization
 */
export const colorTransitions = {
  profitColor: '#26c281',
  lossColor: '#e74c3c',
  neutralColor: '#3498db',
  warningColor: '#f39c12',
  successColor: '#27ae60',
  errorColor: '#c0392b',
}

/**
 * Timing configuration for different animation scenarios
 */
export const animationTimings = {
  fast: getAnimationDuration('fast'),
  medium: getAnimationDuration('medium'),
  slow: getAnimationDuration('slow'),
  realtime: getAnimationDuration('realtime'),
}

/**
 * Easing configurations following the spec
 */
export const easingPresets = {
  fastOut: 'power2.out',
  mediumInOut: 'power2.inOut',
  slowOut: 'back.out',
  bounce: 'back.out',
  elastic: 'elastic.out',
  smooth: 'sine.inOut',
  sharp: 'power1.inOut',
}

export default {
  prefersReducedMotion,
  getAnimationDuration,
  animateNumberValue,
  animateColorChange,
  animateProfitGlow,
  animateLossGlow,
  animateShake,
  animateScale,
  animateFadeIn,
  animateFadeOut,
  animateSlideInTop,
  animateSlideInBottom,
  animatePulse,
  animateBounce,
  animateSkeletonShimmer,
  animateCounter,
  animateBatchFadeIn,
  animateCascade,
  animateRotate,
  animateFlash,
  animateRowHighlight,
  animateButtonPress,
  animateCardElevation,
  animateCardElevationReset,
  animateProgressBar,
  createAnimationTimeline,
  killAnimations,
  enableHardwareAcceleration,
  disableHardwareAcceleration,
  formatAnimatedNumber,
  getDirectionalIndicator,
  colorTransitions,
  animationTimings,
  easingPresets,
}
