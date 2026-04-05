# Micro Animations & UX Enhancements

## Overview

This document describes the comprehensive animation and UX enhancement system implemented for the Vue 3 trading dashboard. The system uses GSAP for smooth 60fps animations, respects user accessibility preferences, and provides a professional trading platform feel.

## Architecture

### Core Components

1. **Animation Utilities** (`src/utils/animations.ts`)
   - GSAP-powered animation functions
   - Hardware acceleration utilities
   - Accessibility support (reduced motion detection)
   - Pre-configured timing and easing functions

2. **Animation Composables** (`src/composables/animations.ts`)
   - Vue 3 composables for component-level animations
   - Lifecycle management
   - Reactive animation triggers

3. **Animation Styles** (`src/styles/animations.css`)
   - CSS-based animations for performance
   - Keyframe definitions
   - Responsive animation adjustments
   - Mobile/touch optimizations

## Features Implemented

### 1. Value Change Animations

#### Smooth Number Transitions
- P&L values animate smoothly when they update
- Balance transitions display graceful number morphing
- Counter animations for trade statistics

**Usage:**
```typescript
const { elementRef } = useValueAnimation(
  () => portfolioStore.currentBalance,
  { decimals: 2, duration: 'medium' }
)
```

#### Color Transitions
- Profit values flash green on positive updates
- Loss values flash red on negative updates
- Color changes smoothly over 200-300ms

**Visual Effects:**
- Green glow with upward scale on profit
- Red glow with subtle shake on loss
- Directional indicators (↑/↓) with bounce animation

### 2. Widget Loading Animations

#### Enhanced Loading States
- Rotating spinner with smooth motion
- Skeleton loading with shimmer effect
- Progressive reveal with staggered animations
- Fade-in when data loads

**Features:**
- Loading overlay prevents interaction
- Smooth transitions between loading and loaded states
- Backdrop blur effect for visual depth
- Auto-stops on data load

### 3. Interactive Micro Animations

#### Hover Effects
- Metric cards lift on hover with shadow elevation
- Scale increase (1.0 → 1.02) for visual feedback
- Border color lightening
- Smooth transitions: 200-300ms with ease-out

**Usage:**
```typescript
const { cardRef, onMouseEnter, onMouseLeave } = useCardHoverAnimation()
```

#### Button Press Feedback
- Scale down on press (1.0 → 0.95)
- Inset shadow for "pressed" effect
- Bounce back with back.out easing
- All in 200ms for snappy feel

#### Row Highlight Animations
- Blue glow appears on row hover
- Inset shadow for depth
- Smooth fade out (400ms)
- Used in trade/position tables

### 4. Real-time Data Indicators

#### Pulsing Live Indicators
- Small dot next to "Live" label
- Opacity pulse: 1.0 → 0.4 → 1.0
- 1.5s cycle duration
- Green color for active connection

**Implementation:**
```typescript
const { pulseRef, startPulse, stopPulse } = usePulseAnimation({
  enabled: true,
  duration: 1.5
})
```

#### Flash Animations
- New trade notifications flash briefly
- 3 flash cycles in 0.6s
- Draws attention without being disruptive

#### Connection Status Pulse
- Radial expanding pulse on connection
- 1.5s animation cycle
- Repeats indefinitely
- Visual confirmation of live data

#### Price Change Indicators
- Directional arrows appear with bounce
- Up arrow (↑) for positive changes
- Down arrow (↓) for negative changes
- Smooth entry animation

### 5. Page Transition Animations

#### Widget Entrance Animations
- Fade in + slide from bottom
- Scale up from 0.95 to 1.0
- Back.out easing for bounce effect
- 600ms duration

#### Staggered Widget Reveals (Cascade)
- Each widget enters with delay
- 150ms stagger between widgets
- Creates smooth waterfall effect
- Combined with fade and scale

**Implementation:**
```typescript
const { containerRef } = useCascadeAnimation({
  staggerDelay: 0.15,
  duration: 0.8
})
```

#### Sidebar/Navigation Animations
- Slide in from left: -100% → 0%
- 400ms duration with ease-out
- Smooth entry for navigation elements

#### Modal Animations
- Scale and fade simultaneously
- Scale from 0.9 to 1.0
- Fade from 0 to 1
- 300ms for quick interaction

### 6. Notification Animations

#### Success Notifications
- Slide in from top
- Green border and background
- Check mark (✓) with bounce-in
- Auto-dismiss after 5 seconds

#### Error Notifications
- Shake animation on entry
- Red border and background
- X mark (✕) with bounce-in
- Requires user dismissal for emphasis

#### Warning Notifications
- Orange border, slightly less urgent
- Slide in from top
- No shake animation

#### Info Notifications
- Blue border, informational only
- Slide in from top
- Standard auto-dismiss

**Usage:**
```typescript
const { notificationRef, show, hide } = useNotificationAnimation('success')
```

## Animation Specifications

### Timing

- **Fast Interactions**: 200-300ms
  - Button presses
  - Hover state changes
  - Scale/elevation changes

- **Medium Transitions**: 400-600ms
  - Value number animations
  - Card interactions
  - Modal entrance

- **Slow Reveals**: 800ms-1.2s
  - Widget cascades
  - Page entrance animations
  - Complex transitions

- **Real-time Updates**: 150ms
  - Flash indicators
  - Quick state changes
  - Reactive updates

### Easing Functions

- **ease-out (power2.out)**: For entrance animations
  - Quick start, smooth deceleration
  - Natural, polished feel

- **ease-in-out (power2.inOut)**: For reversible animations
  - Balanced acceleration/deceleration
  - Modal transitions

- **back-out**: For bouncy animations
  - Overshoot slightly then settle
  - Playful, modern feel

- **smooth (sine.inOut)**: For pulse animations
  - Gentle, continuous motion
  - Live data heartbeat

### Visual Effects

#### Profit Animations
```
- Green color: #26c281
- Glow shadow: 0 0 12px rgba(38, 194, 129, 0.3)
- Transform: scale(1.05)
- Duration: 400-600ms
```

#### Loss Animations
```
- Red color: #e74c3c
- Glow shadow: 0 0 12px rgba(231, 76, 60, 0.3)
- Shake effect: ±5px horizontal
- Duration: 400-600ms
```

#### Loading Skeleton
```
- Shimmer gradient: left to right
- Speed: 1.5s cycle
- Opacity pulse: 1.0 → 0.5 → 1.0
```

## Accessibility

### Reduced Motion Support

All animations respect the `prefers-reduced-motion` media query:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Implementation in Composables:**
```typescript
if (animations.prefersReducedMotion()) {
  // Skip animations, apply end state immediately
  element.style.opacity = '1'
  return
}
```

### Touch Device Optimization

- Removed hover-based animations on touch devices
- Button press animations enhanced
- Removed card elevation on hover for touch
- Maintains 60fps on all devices

## Performance Optimization

### Hardware Acceleration

Enables GPU acceleration for smooth animations:

```typescript
animations.enableHardwareAcceleration(element)
// Applies: transform: translateZ(0), backface-visibility: hidden, will-change
```

### Memory Management

- GSAP animations are killed on component unmount
- Continuous animations (pulse) stop when disabled
- Proper cleanup in composable lifecycle hooks

```typescript
onUnmounted(() => {
  stopPulse()
  animations.killAnimations(element)
})
```

### CSS Hardware Acceleration

```css
.animate-gpu {
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
  will-change: transform, opacity;
}
```

## Integration Guide

### Using Animation Composables

#### Example 1: Card Hover Animation
```vue
<script setup>
import { useCardHoverAnimation } from '@/composables/animations'

const { cardRef, onMouseEnter, onMouseLeave } = useCardHoverAnimation()
</script>

<template>
  <div
    ref="cardRef"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    class="metric-card"
  >
    <!-- Content -->
  </div>
</template>
```

#### Example 2: Value Animation
```vue
<script setup>
import { useValueAnimation } from '@/composables/animations'
import { usePortfolioStore } from '@/stores'

const portfolioStore = usePortfolioStore()
const { elementRef } = useValueAnimation(
  () => portfolioStore.currentBalance,
  { decimals: 2, duration: 'medium' }
)
</script>

<template>
  <div ref="elementRef">{{ portfolioStore.currentBalance }}</div>
</template>
```

#### Example 3: Cascade Animation
```vue
<script setup>
import { useCascadeAnimation } from '@/composables/animations'

const { containerRef } = useCascadeAnimation({
  staggerDelay: 0.15,
  duration: 0.8
})
</script>

<template>
  <div ref="containerRef">
    <div class="widget" data-animate>Widget 1</div>
    <div class="widget" data-animate>Widget 2</div>
    <div class="widget" data-animate>Widget 3</div>
  </div>
</template>
```

### Using Animation Utilities Directly

```typescript
import * as animations from '@/utils/animations'

// Animate number value
animations.animateNumberValue(
  element,
  startValue,
  endValue,
  0.4, // duration in seconds
  2,   // decimal places
  (value) => console.log(value) // optional callback
)

// Flash animation
animations.animateFlash(element, 0.2, 3) // duration, flash count

// Scale animation
animations.animateScale(element, 1, 1.05, 0.2)

// Batch fade in
animations.animateBatchFadeIn(elements, 0.1, 0.4)
```

## Browser Support

- **Modern Browsers**: Full support (Chrome, Firefox, Safari, Edge)
- **Graceful Degradation**: Respects `prefers-reduced-motion`
- **Mobile**: Touch optimizations active on touch devices
- **Performance**: 60fps on devices with sufficient resources

## Testing Animations

### Check Reduced Motion
```typescript
// In browser console
window.matchMedia('(prefers-reduced-motion: reduce)').matches
```

### Manually Trigger Animations
```typescript
import * as animations from '@/utils/animations'

const element = document.querySelector('.metric-card')
animations.animateScale(element, 1, 1.05, 0.3)
animations.animateFlash(element, 0.2, 3)
```

## Future Enhancements

1. **Custom Animation Presets**: User-selectable animation intensity
2. **Performance Monitoring**: Track animation frame rates
3. **Animation Sequencing**: Master timelines for coordinated animations
4. **Stagger Variations**: Different stagger patterns for different contexts
5. **Sound Effects**: Optional audio cues with animations (muted by default)

## API Reference

See `src/utils/animations.ts` for complete API documentation with JSDoc comments for all functions.

## Examples in Codebase

- **PortfolioWidget.vue**: Cascade animations on widget cards
- **WidgetContainer.vue**: Loading and error state animations
- **All widgets**: Hover effects and interactive animations

## Browser DevTools Tips

1. **Slow Down Animations**: DevTools → Performance → slow down animations
2. **Disable Animations**: DevTools → Animations → disable
3. **Monitor Performance**: DevTools → Performance → record and check FPS
4. **Check Accessibility**: DevTools → Accessibility → check motion preferences
