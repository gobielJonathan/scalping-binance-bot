# Contributing to Trading Dashboard

## Development Setup

### Prerequisites

- Node.js 20.19.0+ or 22.12.0+
- pnpm package manager
- Git
- VS Code (recommended)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/trading-dashboard.git
cd trading-dashboard

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm dev
```

### VS Code Setup

Recommended extensions:
- Vue Language Features (Volar)
- TypeScript Vue Plugin (Volar)
- ESLint
- Prettier
- Tailwind CSS IntelliSense

VS Code settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "vue.codeActions.enabled": true
}
```

## Code Standards

### TypeScript Guidelines

1. **Use strict TypeScript**: All files must pass strict type checking
2. **Explicit types**: Prefer explicit types over `any` or type inference
3. **Interface over type**: Use interfaces for object shapes
4. **Generic constraints**: Use generic constraints for reusable functions

```typescript
// ✅ Good
interface UserData {
  id: string
  name: string
  email: string
}

function processUser<T extends UserData>(user: T): T {
  return { ...user, processedAt: new Date() }
}

// ❌ Bad
function processUser(user: any): any {
  return { ...user, processedAt: new Date() }
}
```

### Vue 3 Guidelines

1. **Composition API**: Use Composition API for all new components
2. **Script setup**: Prefer `<script setup>` syntax
3. **Typed props**: Use TypeScript interfaces for props
4. **Composables**: Extract reusable logic into composables

```vue
<!-- ✅ Good -->
<script setup lang="ts">
interface Props {
  title: string
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
})

const emit = defineEmits<{
  update: [value: number]
  close: []
}>()
</script>

<template>
  <div>
    <h1>{{ props.title }}</h1>
    <p>Count: {{ props.count }}</p>
  </div>
</template>
```

### CSS Guidelines

1. **Bootstrap classes**: Use Bootstrap utility classes when possible
2. **CSS custom properties**: Use CSS variables for theming
3. **BEM methodology**: Use BEM for custom CSS classes
4. **Responsive design**: Mobile-first approach

```css
/* ✅ Good */
.portfolio-widget {
  --widget-bg: var(--bg-card);
  --widget-text: var(--text-primary);
  
  background: var(--widget-bg);
  color: var(--widget-text);
}

.portfolio-widget__header {
  border-bottom: 1px solid var(--border-color);
}

.portfolio-widget__content--loading {
  opacity: 0.6;
}
```

### File Organization

```
src/
├── components/
│   ├── ComponentName/
│   │   ├── ComponentName.vue
│   │   ├── ComponentName.test.ts
│   │   └── index.ts
│   └── index.ts
├── composables/
│   ├── useFeatureName.ts
│   └── index.ts
├── stores/
│   ├── featureStore.ts
│   └── index.ts
├── types/
│   ├── api.ts
│   ├── components.ts
│   └── index.ts
```

### Naming Conventions

- **Components**: PascalCase (`UserProfile.vue`)
- **Files**: kebab-case (`user-profile.ts`)
- **Variables**: camelCase (`userName`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_BASE_URL`)
- **Types**: PascalCase (`UserProfile`)
- **Interfaces**: PascalCase with 'I' prefix optional (`UserData`)

## Testing Guidelines

### Unit Tests

Write unit tests for:
- Pure functions and utilities
- Component logic (excluding UI)
- Store actions and getters
- Services and APIs

```typescript
// ✅ Good test structure
describe('PortfolioWidget', () => {
  beforeEach(() => {
    // Setup test environment
  })
  
  it('should display portfolio balance correctly', async () => {
    // Given
    const mockPortfolio = TestFactory.createPortfolio({ balance: 10000 })
    
    // When
    const wrapper = mountWithPinia(PortfolioWidget, {
      props: { data: mockPortfolio }
    })
    
    // Then
    expect(wrapper.find('[data-testid="balance"]').text()).toContain('$10,000')
  })
})
```

### Integration Tests

Write integration tests for:
- API service integration
- Store and service interaction
- Component data flow
- Error handling scenarios

### E2E Tests

Write E2E tests for:
- Critical user workflows
- Cross-browser compatibility
- Mobile responsive behavior
- Performance benchmarks

### Test Data

Use test factories for consistent test data:

```typescript
export class TestFactory {
  static createPortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
    return {
      balance: 10000,
      pnl: 150,
      pnlPercentage: 1.5,
      // ... other defaults
      ...overrides
    }
  }
}
```

## Git Workflow

### Branch Naming

- `feature/feature-name` - New features
- `bugfix/issue-description` - Bug fixes
- `hotfix/critical-issue` - Critical production fixes
- `refactor/component-name` - Refactoring
- `docs/section-name` - Documentation updates

### Commit Messages

Follow conventional commits format:

```
type(scope): description

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(dashboard): add real-time portfolio updates

Add WebSocket integration for live portfolio data updates.
Includes error handling and reconnection logic.

Closes #123
```

### Pull Request Process

1. **Create feature branch** from `main`
2. **Implement changes** following code standards
3. **Add tests** for new functionality
4. **Update documentation** if needed
5. **Run full test suite** and ensure passing
6. **Create pull request** with detailed description
7. **Code review** and address feedback
8. **Merge** after approval

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

## Component Development

### Widget Development

1. **Create component directory**:
```bash
mkdir src/components/widgets/NewWidget
```

2. **Implement component**:
```vue
<!-- src/components/widgets/NewWidget/NewWidget.vue -->
<script setup lang="ts">
interface Props {
  title: string
  refreshInterval?: number
}

const props = withDefaults(defineProps<Props>(), {
  refreshInterval: 30000
})

const emit = defineEmits<{
  refresh: []
  error: [error: Error]
}>()

// Component logic here
</script>

<template>
  <WidgetContainer :title="props.title">
    <!-- Widget content -->
  </WidgetContainer>
</template>
```

3. **Add tests**:
```typescript
// src/components/widgets/NewWidget/NewWidget.test.ts
import { mountWithPinia } from '@/tests/utils'
import NewWidget from './NewWidget.vue'

describe('NewWidget', () => {
  it('should render correctly', () => {
    const wrapper = mountWithPinia(NewWidget, {
      props: { title: 'Test Widget' }
    })
    
    expect(wrapper.text()).toContain('Test Widget')
  })
})
```

4. **Export component**:
```typescript
// src/components/widgets/NewWidget/index.ts
export { default as NewWidget } from './NewWidget.vue'
```

### Composable Development

Create reusable logic as composables:

```typescript
// src/composables/useWebSocket.ts
export function useWebSocket(url: string) {
  const socket = ref<WebSocket | null>(null)
  const status = ref<'connecting' | 'connected' | 'disconnected'>('disconnected')
  
  const connect = () => {
    status.value = 'connecting'
    socket.value = new WebSocket(url)
    
    socket.value.onopen = () => {
      status.value = 'connected'
    }
    
    socket.value.onclose = () => {
      status.value = 'disconnected'
    }
  }
  
  const disconnect = () => {
    socket.value?.close()
  }
  
  onUnmounted(() => {
    disconnect()
  })
  
  return {
    socket: readonly(socket),
    status: readonly(status),
    connect,
    disconnect
  }
}
```

## Performance Guidelines

### Bundle Size

- Keep component bundles under 50KB
- Use dynamic imports for large dependencies
- Analyze bundle with `pnpm build --analyze`

### Runtime Performance

- Use `v-memo` for expensive list rendering
- Implement virtual scrolling for large datasets
- Debounce/throttle frequent updates
- Use `shallowRef` for large objects

### Code Splitting

```typescript
// Route-based splitting
const Dashboard = defineAsyncComponent(() => import('@/views/Dashboard.vue'))

// Component-based splitting
const TradingChart = defineAsyncComponent({
  loader: () => import('@/components/charts/TradingChart.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorDisplay,
  delay: 200,
  timeout: 3000
})
```

## Documentation Guidelines

### Code Documentation

Use JSDoc comments for public APIs:

```typescript
/**
 * Fetches portfolio data from the API
 * @param options - Request options
 * @returns Promise resolving to portfolio data
 * @throws {ApiError} When the request fails
 */
async function fetchPortfolio(options?: RequestOptions): Promise<Portfolio> {
  // Implementation
}
```

### Component Documentation

Document component props and events:

```vue
<script setup lang="ts">
/**
 * Portfolio Widget Component
 * 
 * Displays real-time portfolio information including balance,
 * P&L, and performance metrics.
 * 
 * @example
 * <PortfolioWidget 
 *   :refresh-interval="30000"
 *   @refresh="handleRefresh"
 * />
 */

interface Props {
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number
  /** Show detailed metrics panel */
  showDetailed?: boolean
}
</script>
```

## Security Guidelines

### Input Validation

- Validate all user inputs
- Sanitize data before display
- Use TypeScript for type safety

### Authentication

- Store tokens securely
- Implement token refresh
- Handle auth errors gracefully

### API Security

- Use HTTPS for all requests
- Implement request signing
- Rate limit API calls

## Accessibility Guidelines

### WCAG Compliance

Ensure components meet WCAG 2.1 AA standards:

- Use semantic HTML elements
- Provide alt text for images
- Ensure keyboard navigation
- Maintain color contrast ratios

### Implementation

```vue
<template>
  <div 
    role="region"
    :aria-label="title"
    aria-live="polite"
  >
    <h2 :id="headingId">{{ title }}</h2>
    <div :aria-labelledby="headingId">
      <!-- Content -->
    </div>
  </div>
</template>
```

## Release Process

### Version Management

Use semantic versioning (semver):
- MAJOR: Breaking changes
- MINOR: New features (backwards compatible)
- PATCH: Bug fixes (backwards compatible)

### Release Steps

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with new changes
3. **Run full test suite**
4. **Build and test production bundle**
5. **Create release tag**
6. **Deploy to production**
7. **Monitor for issues**

### Changelog Format

```markdown
## [1.2.0] - 2024-01-15

### Added
- Real-time portfolio updates
- New trading chart indicators

### Changed
- Improved error handling
- Updated design system

### Fixed
- WebSocket reconnection issues
- Chart rendering on mobile

### Deprecated
- Old API endpoints (will be removed in v2.0.0)
```

## Getting Help

### Documentation
- [Component API Reference](./docs/components/API_REFERENCE.md)
- [Deployment Guide](./docs/deployment/PRODUCTION_DEPLOYMENT.md)
- [Architecture Overview](./docs/developer/ARCHITECTURE.md)

### Community
- GitHub Issues for bug reports
- GitHub Discussions for questions
- Discord channel for real-time chat

### Code Reviews

All contributions require code review:
1. Self-review your changes
2. Request review from maintainers
3. Address feedback promptly
4. Ensure all checks pass before merge