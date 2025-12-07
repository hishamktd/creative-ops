# Comprehensive Testing Guide

This document provides a complete guide to the testing infrastructure for the Enhanced Assets System.

## Overview

The Enhanced Assets System implements a comprehensive testing strategy covering:

- **Unit Tests**: Component and service-level testing
- **Integration Tests**: API and database integration testing
- **End-to-End Tests**: Complete user workflow testing
- **Performance Tests**: Load and performance benchmarking
- **Accessibility Tests**: WCAG compliance verification
- **Visual Regression Tests**: UI consistency verification
- **Security Tests**: Vulnerability and security scanning

## Test Structure

```
src/
├── components/modules/assets/__tests__/
│   ├── *.test.tsx                    # Unit tests
│   ├── *.integration.test.tsx        # Integration tests
│   ├── *.performance.test.tsx        # Performance tests
│   └── *.accessibility.test.tsx      # Accessibility tests
├── lib/services/__tests__/
│   ├── *.test.ts                     # Service unit tests
│   └── *.integration.test.ts         # Service integration tests
├── app/api/**/__tests__/
│   └── *.integration.test.ts         # API integration tests
└── test/
    ├── setup.ts                      # Test configuration
    ├── test-utils.tsx               # Testing utilities
    ├── mocks/                       # Mock implementations
    └── fixtures/                    # Test data

tests/
├── e2e/                             # End-to-end tests
├── visual/                          # Visual regression tests
└── fixtures/                        # Test assets
```

## Running Tests

### Quick Commands

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance

# Run accessibility tests
npm run test:accessibility

# Run end-to-end tests
npm run test:e2e

# Run visual regression tests
npm run test:visual

# Run all tests
npm run test:all

# Run comprehensive test suite with reporting
npm run test:comprehensive
```

### Comprehensive Test Runner

The comprehensive test runner (`scripts/run-comprehensive-tests.js`) provides:

- Sequential execution of all test suites
- Detailed reporting and analytics
- HTML and JUnit report generation
- Performance benchmarking
- Quality gate enforcement

```bash
# Run comprehensive tests
npm run test:comprehensive

# Skip build step
SKIP_BUILD=1 npm run test:comprehensive

# Run in CI mode (continue on failures)
CI=1 npm run test:comprehensive
```

## Test Categories

### 1. Unit Tests

**Purpose**: Test individual components and functions in isolation

**Location**: `src/**/__tests__/*.test.{ts,tsx}`

**Coverage**: 
- React components
- Service functions
- Utility functions
- Custom hooks

**Example**:
```typescript
describe('AssetUploadZone', () => {
  it('should render upload interface', () => {
    render(<AssetUploadZone projectId="test" />)
    expect(screen.getByText(/drag.*drop/i)).toBeInTheDocument()
  })
})
```

### 2. Integration Tests

**Purpose**: Test component and service interactions with external systems

**Location**: `src/**/__tests__/*.integration.test.{ts,tsx}`

**Coverage**:
- API endpoints with database
- Component integration with services
- Real Supabase interactions
- File upload workflows

**Example**:
```typescript
describe('Asset Upload API', () => {
  it('should upload file and create database record', async () => {
    const formData = new FormData()
    formData.append('file', mockFile)
    
    const response = await POST(new NextRequest(url, { body: formData }))
    expect(response.status).toBe(200)
  })
})
```

### 3. Performance Tests

**Purpose**: Verify performance characteristics and identify bottlenecks

**Location**: `src/**/__tests__/*.performance.test.{ts,tsx}`

**Metrics**:
- Render time
- Memory usage
- Network requests
- Large dataset handling

**Example**:
```typescript
it('should render 1000 assets efficiently', async () => {
  const renderTime = await measurePerformance(() => {
    render(<AssetBrowser assets={largeDataset} />)
  })
  
  expectPerformance(renderTime, 2000, 'Large dataset rendering')
})
```

### 4. Accessibility Tests

**Purpose**: Ensure WCAG 2.1 AA compliance and screen reader compatibility

**Location**: `src/**/__tests__/*.accessibility.test.{ts,tsx}`

**Coverage**:
- ARIA attributes
- Keyboard navigation
- Screen reader announcements
- Color contrast
- Focus management

**Example**:
```typescript
it('should have no accessibility violations', async () => {
  const { container } = render(<AssetUploadZone />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### 5. End-to-End Tests

**Purpose**: Test complete user workflows in real browser environment

**Location**: `tests/e2e/*.spec.ts`

**Coverage**:
- Upload workflows
- Asset management
- Search and filtering
- Collaboration features
- Mobile responsiveness

**Example**:
```typescript
test('should complete upload workflow', async ({ page }) => {
  await page.goto('/assets')
  await page.setInputFiles('input[type="file"]', 'test-image.jpg')
  await expect(page.getByText('Upload completed')).toBeVisible()
})
```

### 6. Visual Regression Tests

**Purpose**: Detect unintended UI changes through screenshot comparison

**Location**: `tests/visual/*.spec.ts`

**Coverage**:
- Component visual states
- Responsive layouts
- Dark/light themes
- Loading states
- Error states

**Example**:
```typescript
test('should render upload zone correctly', async ({ page }) => {
  const uploadZone = page.getByRole('button', { name: /upload/i })
  await expect(uploadZone).toHaveScreenshot('upload-zone.png')
})
```

### 7. Security Tests

**Purpose**: Identify security vulnerabilities and ensure secure practices

**Coverage**:
- Dependency vulnerabilities
- File upload security
- Authentication/authorization
- Input validation
- XSS prevention

## Test Configuration

### Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
})
```

### Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
    { name: 'Mobile Chrome', use: devices['Pixel 5'] }
  ]
})
```

## Test Utilities

### Mock Factories

```typescript
// src/test/test-utils.tsx
export const createMockFile = (name: string, type: string = 'image/jpeg') => {
  return new File(['mock content'], name, { type })
}

export const generateMockAsset = (overrides = {}) => ({
  id: 'mock-asset-id',
  name: 'mock-asset.jpg',
  file_type: 'image/jpeg',
  // ... other properties
  ...overrides
})
```

### Custom Matchers

```typescript
// Accessibility matchers
expect(element).toHaveNoViolations()
expect(element).toBeAccessible()

// Performance matchers
expectPerformance(duration, maxDuration, 'operation name')

// Visual matchers
await expect(element).toHaveScreenshot('component.png')
```

## Continuous Integration

### GitHub Actions Workflow

The CI pipeline runs:

1. **Unit Tests**: Fast feedback on code changes
2. **Integration Tests**: Database and API testing
3. **Performance Tests**: Benchmark tracking
4. **Accessibility Tests**: WCAG compliance
5. **E2E Tests**: Cross-browser testing
6. **Visual Regression**: UI consistency
7. **Security Tests**: Vulnerability scanning

### Quality Gates

Tests must pass these criteria:

- **Coverage**: Minimum 80% code coverage
- **Performance**: No regression > 20%
- **Accessibility**: Zero WCAG violations
- **Security**: No high/critical vulnerabilities
- **Visual**: No unintended UI changes

## Best Practices

### Writing Tests

1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **Use Descriptive Names**: Test names should explain the scenario
3. **Test Behavior, Not Implementation**: Focus on user-facing behavior
4. **Keep Tests Independent**: Each test should run in isolation
5. **Use Page Object Model**: For E2E tests, abstract page interactions

### Test Data Management

1. **Use Factories**: Generate test data programmatically
2. **Isolate Test Data**: Each test should use fresh data
3. **Clean Up**: Remove test data after tests complete
4. **Use Realistic Data**: Test data should mirror production

### Performance Testing

1. **Set Baselines**: Establish performance benchmarks
2. **Test Edge Cases**: Large datasets, slow networks
3. **Monitor Trends**: Track performance over time
4. **Profile Bottlenecks**: Identify slow operations

### Accessibility Testing

1. **Test with Screen Readers**: Use actual assistive technology
2. **Keyboard Navigation**: Ensure all functionality is keyboard accessible
3. **Color Contrast**: Verify sufficient contrast ratios
4. **Focus Management**: Test focus flow and trapping

## Debugging Tests

### Common Issues

1. **Flaky Tests**: Use proper waits and stable selectors
2. **Timing Issues**: Implement proper async handling
3. **Environment Differences**: Ensure consistent test environments
4. **Mock Leakage**: Clean up mocks between tests

### Debugging Tools

```bash
# Run tests in debug mode
npm run test:debug

# Run specific test file
npm test -- AssetUploadZone.test.tsx

# Run tests with UI
npm run test:ui

# Run E2E tests in headed mode
npm run test:e2e:headed

# Update visual snapshots
npm run test:visual:update
```

## Reporting

### Coverage Reports

Coverage reports are generated in multiple formats:
- HTML: `coverage/index.html`
- LCOV: `coverage/lcov.info`
- JSON: `coverage/coverage-final.json`

### Test Reports

- **JUnit XML**: For CI integration
- **HTML Reports**: Human-readable results
- **JSON Reports**: Programmatic analysis

### Performance Reports

Performance benchmarks are tracked over time:
- Render performance
- Memory usage
- Network requests
- Bundle size impact

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Keep testing tools current
2. **Review Coverage**: Identify untested code paths
3. **Performance Monitoring**: Track performance trends
4. **Accessibility Audits**: Regular WCAG compliance checks
5. **Visual Baseline Updates**: Update screenshots when UI changes

### Test Health Monitoring

- Monitor test execution times
- Track flaky test patterns
- Review test coverage trends
- Analyze failure patterns

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Performance Testing](https://web.dev/performance/)

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all test types are covered
3. Update documentation
4. Verify CI pipeline passes
5. Review test coverage reports

For questions or issues with testing, please refer to the project's issue tracker or contact the development team.