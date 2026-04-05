import { onMounted, ref, watch } from 'vue'

/**
 * Composable for responsive design utilities and mobile interactions
 */
export function useResponsive() {
  const windowWidth = ref<number>(0)
  const windowHeight = ref<number>(0)
  const isMobile = ref<boolean>(false)
  const isTablet = ref<boolean>(false)
  const isDesktop = ref<boolean>(false)
  const isLandscape = ref<boolean>(false)
  const prefersReducedMotion = ref<boolean>(false)
  const prefersDarkMode = ref<boolean>(false)
  const devicePixelRatio = ref<number>(1)

  /**
   * Update responsive state based on window size
   */
  const updateBreakpoints = () => {
    windowWidth.value = window.innerWidth
    windowHeight.value = window.innerHeight

    isMobile.value = windowWidth.value < 768
    isTablet.value = windowWidth.value >= 768 && windowWidth.value < 1024
    isDesktop.value = windowWidth.value >= 1024
    isLandscape.value = window.innerHeight < window.innerWidth

    devicePixelRatio.value = window.devicePixelRatio || 1
  }

  /**
   * Check for reduced motion preference
   */
  const checkReducedMotion = () => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.value = mediaQuery.matches
    mediaQuery.addEventListener('change', (e) => {
      prefersReducedMotion.value = e.matches
    })
  }

  /**
   * Check for dark mode preference
   */
  const checkDarkMode = () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    prefersDarkMode.value = mediaQuery.matches
    mediaQuery.addEventListener('change', (e) => {
      prefersDarkMode.value = e.matches
    })
  }

  onMounted(() => {
    updateBreakpoints()
    checkReducedMotion()
    checkDarkMode()

    window.addEventListener('resize', updateBreakpoints)

    return () => {
      window.removeEventListener('resize', updateBreakpoints)
    }
  })

  return {
    windowWidth,
    windowHeight,
    isMobile,
    isTablet,
    isDesktop,
    isLandscape,
    prefersReducedMotion,
    prefersDarkMode,
    devicePixelRatio,
    updateBreakpoints,
  }
}

/**
 * Composable for touch event handling
 */
export function useTouch() {
  const touchStartX = ref<number>(0)
  const touchStartY = ref<number>(0)
  const touchEndX = ref<number>(0)
  const touchEndY = ref<number>(0)
  const isSwiping = ref<boolean>(false)

  const onTouchStart = (e: TouchEvent) => {
    if (e.changedTouches.length > 0 && e.changedTouches[0]) {
      touchStartX.value = e.changedTouches[0].screenX
      touchStartY.value = e.changedTouches[0].screenY
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (e.changedTouches.length > 0 && e.changedTouches[0]) {
      touchEndX.value = e.changedTouches[0].screenX
      touchEndY.value = e.changedTouches[0].screenY
      handleSwipe()
    }
  }

  const handleSwipe = () => {
    const diffX = touchStartX.value - touchEndX.value
    const diffY = touchStartY.value - touchEndY.value

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (Math.abs(diffX) > 50) {
        isSwiping.value = true
        // Swipe detected (left/right)
        return diffX > 0 ? 'left' : 'right'
      }
    } else {
      if (Math.abs(diffY) > 50) {
        // Swipe detected (up/down)
        return diffY > 0 ? 'up' : 'down'
      }
    }
  }

  const getSwipeDirection = (): 'left' | 'right' | 'up' | 'down' | null => {
    const diffX = touchStartX.value - touchEndX.value
    const diffY = touchStartY.value - touchEndY.value

    if (Math.abs(diffX) > Math.abs(diffY)) {
      return Math.abs(diffX) > 50 ? (diffX > 0 ? 'left' : 'right') : null
    }

    return Math.abs(diffY) > 50 ? (diffY > 0 ? 'up' : 'down') : null
  }

  return {
    touchStartX,
    touchStartY,
    touchEndX,
    touchEndY,
    isSwiping,
    onTouchStart,
    onTouchEnd,
    getSwipeDirection,
  }
}

/**
 * Composable for mobile viewport utilities
 */
export function useViewport() {
  const scrollY = ref<number>(0)
  const isScrolling = ref<boolean>(false)
  let scrollTimer: number

  onMounted(() => {
    const handleScroll = () => {
      scrollY.value = window.scrollY
      isScrolling.value = true

      clearTimeout(scrollTimer)
      scrollTimer = window.setTimeout(() => {
        isScrolling.value = false
      }, 150)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimer)
    }
  })

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToElement = (element: HTMLElement) => {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return {
    scrollY,
    isScrolling,
    scrollToTop,
    scrollToElement,
  }
}

/**
 * Composable for service worker management
 */
export function useServiceWorker() {
  const isSupported = ref<boolean>('serviceWorker' in navigator)
  const isRegistered = ref<boolean>(false)
  const updateAvailable = ref<boolean>(false)

  const register = async () => {
    if (!isSupported.value) {
      console.log('Service Worker not supported')
      return
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      })

      isRegistered.value = true
      console.log('[SW] Registration successful:', registration)

      // Check for updates periodically
      setInterval(() => {
        registration.update()
      }, 60000) // Check every minute

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing

        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            updateAvailable.value = true
            console.log('[SW] Update available')
          }
        })
      })
    } catch (error) {
      console.error('[SW] Registration failed:', error)
      isRegistered.value = false
    }
  }

  const unregister = async () => {
    if (!isSupported.value) return

    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const registration of registrations) {
        await registration.unregister()
      }
      isRegistered.value = false
      console.log('[SW] Unregistration successful')
    } catch (error) {
      console.error('[SW] Unregistration failed:', error)
    }
  }

  const clearCache = async () => {
    if (!isSupported.value) return

    try {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((name) => caches.delete(name)))
      console.log('[SW] Cache cleared')
    } catch (error) {
      console.error('[SW] Cache clearing failed:', error)
    }
  }

  const updateServiceWorker = () => {
    const registration = navigator.serviceWorker.controller
    if (registration) {
      registration.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  }

  onMounted(() => {
    register()
  })

  return {
    isSupported,
    isRegistered,
    updateAvailable,
    register,
    unregister,
    clearCache,
    updateServiceWorker,
  }
}

/**
 * Composable for device capabilities detection
 */
export function useDevice() {
  const hasTouchScreen = ref<boolean>(false)
  const hasGeolocation = ref<boolean>(false)
  const hasVibration = ref<boolean>(false)
  const hasCamera = ref<boolean>(false)
  const isBrowser = ref<boolean>(true)

  const detectTouchScreen = () => {
    const prefixes = ['moz', 'webkit', 'ms', 'o', '']
    for (const prefix of prefixes) {
      const key = (prefix + 'MaxTouchPoints') as keyof Navigator
      if (key in navigator) {
        const value = navigator[key]
        if (typeof value === 'number' && value > 0) {
          hasTouchScreen.value = true
          return
        }
      }
    }

    if ('ontouchstart' in window) {
      hasTouchScreen.value = true
      return
    }

    const mediaQuery = matchMedia('(pointer:coarse)')
    hasTouchScreen.value = mediaQuery.matches
  }

  const detectCapabilities = () => {
    hasGeolocation.value = 'geolocation' in navigator
    hasVibration.value = 'vibrate' in navigator
    hasCamera.value = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices
  }

  onMounted(() => {
    detectTouchScreen()
    detectCapabilities()
  })

  return {
    hasTouchScreen,
    hasGeolocation,
    hasVibration,
    hasCamera,
    isBrowser,
  }
}

/**
 * Composable for haptic feedback
 */
export function useHaptics() {
  const canVibrate = ref<boolean>('vibrate' in navigator)

  const tap = () => {
    if (canVibrate.value && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }
  }

  const feedback = () => {
    if (canVibrate.value && 'vibrate' in navigator) {
      navigator.vibrate([10, 5, 10])
    }
  }

  const success = () => {
    if (canVibrate.value && 'vibrate' in navigator) {
      navigator.vibrate([20, 10, 20])
    }
  }

  const warning = () => {
    if (canVibrate.value && 'vibrate' in navigator) {
      navigator.vibrate([30, 10, 30, 10, 30])
    }
  }

  const error = () => {
    if (canVibrate.value && 'vibrate' in navigator) {
      navigator.vibrate([50, 10, 50])
    }
  }

  return {
    canVibrate,
    tap,
    feedback,
    success,
    warning,
    error,
  }
}
