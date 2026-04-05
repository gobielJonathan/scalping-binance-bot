# Cross-Device Testing Guide

## Quick Start

### Chrome DevTools Testing

1. **Open Chrome DevTools** (`F12` or `Cmd+Option+I`)
2. **Click Device Toolbar** (top-left icon or `Ctrl+Shift+M`)
3. **Select Test Device** from dropdown

### Quick Test Sizes

```
320px   - iPhone SE
375px   - iPhone 12/13
390px   - iPhone 14/15
414px   - iPhone 6+/7+/8+, Android XL
480px   - Galaxy S5
768px   - iPad
1024px  - iPad Pro
1366px  - Laptop (HD)
1920px  - Desktop (Full HD)
2560px  - Desktop (2K)
```

## Mobile Testing Checklist

### iPhone/iOS Devices

#### Sizes to Test
- **iPhone SE (375x667)** - Smallest current iPhone
- **iPhone 12/13 (390x844)** - Standard iPhone
- **iPhone 14/15 (430x932)** - Newer iPhones
- **iPhone 6+/7+/8+ (414x896)** - Larger iPhones

#### iOS-Specific Testing
```
✓ App title correct in Safari address bar
✓ Viewport notch respected (safe-area-inset)
✓ Status bar color matches theme
✓ Pull-to-refresh works smoothly
✓ Pinch-zoom functionality works
✓ Input fields don't zoom on focus
✓ Bottom navigation accessible above home indicator
✓ Share sheet works properly
✓ Can add to home screen
```

### Android Devices

#### Sizes to Test
- **Galaxy S21 (360x800)** - Standard Android
- **Galaxy S23 Ultra (414x915)** - Larger Android
- **Google Pixel 6 (412x892)** - Pure Android
- **OnePlus 10 (412x915)** - Oxygen OS

#### Android-Specific Testing
```
✓ System navigation bar doesn't overlap content
✓ Back button works properly
✓ Long-press context menu works
✓ Swipe gestures respond correctly
✓ Hardware acceleration doesn't cause flickering
✓ Can install as PWA
✓ Status bar color matches theme
✓ Landscape orientation works
```

### Tablet Testing

#### iPad Sizes
- **iPad (768x1024)** - Standard tablet
- **iPad Pro 11" (834x1194)** - Medium tablet
- **iPad Pro 12.9" (1024x1366)** - Large tablet

#### Tablet-Specific Testing
```
✓ Multi-column layouts appear
✓ Charts are appropriately sized
✓ Sidebars don't take excessive space
✓ Split-screen mode works
✓ Landscape/portrait switch is smooth
✓ Touch targets remain appropriately sized
✓ Keyboard input works smoothly
```

## Desktop Testing

### Standard Resolutions

```
1366x768   - Standard laptop
1920x1080  - Full HD
2560x1440  - 2K
3440x1440  - Ultrawide
3840x2160  - 4K
```

### Desktop Testing Checklist

```
✓ Three-column layout appears
✓ Sidebar is visible
✓ No horizontal scrolling
✓ Charts are full-size
✓ Typography is appropriately scaled
✓ Hover states work on buttons
✓ Keyboard navigation works
✓ Mouse wheel scrolling is smooth
✓ Right-click context menus work
```

## Chrome DevTools Usage

### Test Responsive Layout

1. Open DevTools
2. Click **Device Toolbar**
3. Change view:
   - **Responsive**: Drag edges to test any size
   - **Device**: Select specific device presets
   - **DPR**: Test high-DPI displays (2x, 3x)

### Device Throttling

Simulate slow connections:

```
DevTools → Network tab → Set throttling
- Slow 3G: 400 Kbps down, 20 Kbps up
- Fast 3G: 1.6 Mbps down, 750 Kbps up
- 4G: 4 Mbps down, 3 Mbps up
```

### Emulate Touch

```
DevTools → Settings → Emulation
✓ Enable "Emulate touch screen"
```

### CSS Media Query Debugging

View which media queries are active:

```
DevTools → Rendering → Media query viewer
```

## Manual Testing Procedure

### Test Checklist Template

```
Device: iPhone 12
Screen Size: 390x844
OS Version: iOS 16
Browser: Safari

Layout:
[ ] No horizontal scrolling
[ ] All text readable without zoom
[ ] Images load properly
[ ] Cards stack correctly

Typography:
[ ] Heading sizes appropriate
[ ] Body text readable
[ ] Code examples visible

Touch:
[ ] Button targets are 44x44px+
[ ] No accidental taps
[ ] Swipe gestures work
[ ] Long press menus appear

Navigation:
[ ] Menu accessible
[ ] Back button works
[ ] Links are tappable
[ ] No dead links

Forms:
[ ] Input fields expand properly
[ ] Keyboard doesn't hide content
[ ] Submit buttons are tappable
[ ] Error messages visible

Media:
[ ] Charts render correctly
[ ] Images are responsive
[ ] Videos play properly
[ ] Loading indicators visible

Performance:
[ ] Page loads in < 3 seconds
[ ] Interactions are smooth (60fps)
[ ] No memory leaks
[ ] Battery usage acceptable

Offline:
[ ] Service worker caches content
[ ] Offline page visible when needed
[ ] Can retry failed requests

Accessibility:
[ ] Screen reader friendly
[ ] Keyboard navigation works
[ ] Color contrast is sufficient
[ ] Focus indicators visible
```

## Automated Testing

### Testing Framework Setup

```bash
# Install testing dependencies
npm install -D @playwright/test @testing-library/vue

# Run mobile-specific tests
npm run test:mobile

# Test across browsers
npm run test:cross-browser
```

### Example Test

```typescript
// tests/responsive.spec.ts
import { test, expect } from '@playwright/test'

test('Mobile layout on iPhone 12', async ({ browser }) => {
  const context = await browser.createBrowserContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'iPhone'
  })
  
  const page = await context.newPage()
  await page.goto('http://localhost:5173')
  
  // Check no horizontal scrolling
  const bodyWidth = await page.evaluate(() => 
    document.documentElement.scrollWidth
  )
  const viewportWidth = await page.evaluate(() => 
    window.innerWidth
  )
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth)
  
  // Check touch targets
  const buttons = await page.locator('button')
  for (let i = 0; i < await buttons.count(); i++) {
    const button = buttons.nth(i)
    const box = await button.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
})
```

## Performance Testing

### Lighthouse Testing

1. Open Chrome DevTools
2. Click **Lighthouse** tab
3. Select:
   - Device: Mobile / Desktop
   - Categories: Performance, Accessibility, Best Practices, SEO
4. Click **Analyze page load**

### Expected Scores

```
Performance:   > 90
Accessibility: > 95
Best Practices:> 90
SEO:           > 95
```

### Web Vitals Testing

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } 
  from 'web-vitals'

getCLS(console.log)  // Cumulative Layout Shift
getFID(console.log)  // First Input Delay
getFCP(console.log)  // First Contentful Paint
getLCP(console.log)  // Largest Contentful Paint
getTTFB(console.log) // Time to First Byte
```

## Real Device Testing

### Using BrowserStack

```bash
# Test on real devices
npm install -D @browserstack/local

# Configure credentials in browserstack.json
# Run tests on real devices
npx playwright test --project=browserstack
```

### Using Local Server

For testing on actual devices:

```bash
# 1. Find your machine IP
ipconfig getifaddr en0  # macOS
hostname -I  # Linux

# 2. Start dev server on 0.0.0.0
npm run dev -- --host 0.0.0.0

# 3. Visit from device: http://YOUR_IP:5173
```

## Common Issues & Fixes

### Issue: Text Too Small on Mobile

**Test**:
```javascript
// DevTools Console
const fontSize = window.getComputedStyle(
  document.body
).fontSize
console.log('Body font size:', fontSize)
// Should be at least 14px
```

**Fix**:
```css
body { font-size: 14px; } /* Not less than 12px */
```

### Issue: Horizontal Scrolling on Mobile

**Test**:
```javascript
// Check scroll width
const hasHorizontalScroll = 
  document.documentElement.scrollWidth > 
  window.innerWidth
console.log('Has horizontal scroll:', hasHorizontalScroll)
```

**Fix**:
```css
html, body {
  width: 100%;
  overflow-x: hidden;
}

.container {
  width: 100%;
  max-width: 100%;
}
```

### Issue: Touch Targets Too Small

**Test**:
```javascript
// Check all button sizes
document.querySelectorAll('button').forEach(btn => {
  const rect = btn.getBoundingClientRect()
  const minSize = 44
  if (rect.width < minSize || rect.height < minSize) {
    console.warn('Small button:', btn, rect)
  }
})
```

**Fix**:
```css
button {
  min-height: 44px;
  min-width: 44px;
  padding: 0.75rem 1rem;
}
```

## Debugging on Devices

### iOS Debugging

```bash
# Enable Web Inspector in Safari preferences
Preferences → Advanced → Show features for web developers

# View logs from iOS device
- Device → Develop → [Your Device] → [Website]
- Console shows JS errors and logs
```

### Android Debugging

```bash
# Enable USB Debugging
Settings → Developer Options → USB Debugging

# Connect device via USB
# In Chrome: chrome://inspect/#devices

# View logs, live debug, screenshot
```

## Performance Benchmarking

### Measure Load Time

```typescript
// In browser console
performance.getEntriesByType('navigation')[0]

// Or use timing API
const navigationTiming = performance.timing
const loadTime = navigationTiming.loadEventEnd - 
                 navigationTiming.navigationStart
console.log('Load time:', loadTime + 'ms')
```

### Monitor Frame Rate

```typescript
// Check if animations run at 60fps
let lastTime = performance.now()
let frameCount = 0

function checkFrameRate() {
  frameCount++
  const currentTime = performance.now()
  
  if (currentTime >= lastTime + 1000) {
    console.log('FPS:', frameCount)
    frameCount = 0
    lastTime = currentTime
  }
  
  requestAnimationFrame(checkFrameRate)
}

checkFrameRate()
```

## Accessibility Testing

### Screen Reader Testing

**NVDA (Windows)**:
```
Download: https://www.nvaccess.org/
Test by reading through entire page
```

**VoiceOver (macOS)**:
```
Enable: System Preferences → Accessibility → VoiceOver
Cmd+F5 to toggle
```

**JAWS (Windows - Commercial)**:
```
Industry standard screen reader
Used by most blind users
```

### Keyboard Navigation

```
Test without mouse:
- Tab: Navigate forward
- Shift+Tab: Navigate backward
- Enter/Space: Activate buttons
- Arrow keys: Navigate lists/menus
- Escape: Close modals/menus

All interactive elements should be reachable
Focus should always be visible
```

### Color Contrast Testing

```bash
# Install contrast analyzer
npm install -D axe-core

# Run axe tests
npx axe https://localhost:5173
```

## Test Results Template

```markdown
# Test Results - 2024-01-15

## Mobile Phones

### iPhone 12 (390x844)
- ✅ Layout correct
- ✅ Touch targets adequate
- ✅ Charts readable
- ✅ Performance good (2.1s load)
- ⚠️ Input field fonts at 16px (OK)

### Android Samsung S23 (414x915)
- ✅ All pass
- ✅ PWA installs correctly

## Tablets

### iPad (768x1024)
- ✅ Multi-column layout
- ✅ Charts appropriately sized
- ✅ Portrait/landscape work

## Desktop

### 1920x1080
- ✅ Full-width layout
- ✅ All features visible
- ✅ Hover states work

## Accessibility

- ✅ WCAG 2.1 AA compliant
- ✅ Screen reader compatible
- ✅ Keyboard navigation works
- ✅ Color contrast: AAA

## Performance

- ✅ LCP: 1.8s (target: <2.5s)
- ✅ FID: 45ms (target: <100ms)
- ✅ CLS: 0.08 (target: <0.1)

## Issues Found

None - All tests passed! ✅
```

## Continuous Testing

### GitHub Actions CI

```yaml
# .github/workflows/test.yml
name: Cross-Device Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run test:mobile
      - run: npm run test:desktop
      - run: npm run test:a11y
```

## Summary

Comprehensive testing across devices ensures:
✅ Mobile experience is excellent
✅ Tablet layouts are optimized
✅ Desktop maximizes content
✅ Accessibility standards are met
✅ Performance targets are achieved
✅ All browsers are supported
