/**
 * Comprehensive Test Configuration
 * Centralizes test settings and provides utilities for different test types
 */

const path = require('path')

// Test environment configuration
const testConfig = {
  // Global test settings
  global: {
    testTimeout: 30000,
    setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
    testEnvironment: 'jsdom',
    moduleNameMapping: {
      '^@/(.*)$': '<rootDir>/src/$1',
    },
  },

  // Unit test configuration
  unit: {
    displayName: 'Unit Tests',
    testMatch: [
      '<rootDir>/src/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    testPathIgnorePatterns: [
      '<rootDir>/src/**/*.{integration,e2e,performance,accessibility}.{test,spec}.{js,ts,jsx,tsx}',
    ],
    collectCoverageFrom: [
      'src/**/*.{js,ts,jsx,tsx}',
      '!src/**/*.d.ts',
      '!src/**/*.stories.{js,ts,jsx,tsx}',
      '!src/test/**',
      '!src/**/__tests__/**',
    ],
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      // Component-specific thresholds
      'src/components/modules/assets/': {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85,
      },
      'src/lib/services/': {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },

  // Integration test configuration
  integration: {
    displayName: 'Integration Tests',
    testMatch: [
      '<rootDir>/src/**/*.integration.{test,spec}.{js,ts,jsx,tsx}',
    ],
    setupFilesAfterEnv: [
      '<rootDir>/src/test/setup.ts',
      '<rootDir>/src/test/integration-setup.ts',
    ],
    testTimeout: 60000,
  },

  // Performance test configuration
  performance: {
    displayName: 'Performance Tests',
    testMatch: [
      '<rootDir>/src/**/*.performance.{test,spec}.{js,ts,jsx,tsx}',
    ],
    setupFilesAfterEnv: [
      '<rootDir>/src/test/setup.ts',
      '<rootDir>/src/test/performance-setup.ts',
    ],
    testTimeout: 120000,
    // Performance test thresholds
    thresholds: {
      render: 100, // ms
      interaction: 50, // ms
      search: 500, // ms
      upload: 2000, // ms
      memory: 10 * 1024 * 1024, // 10MB
    },
  },

  // Accessibility test configuration
  accessibility: {
    displayName: 'Accessibility Tests',
    testMatch: [
      '<rootDir>/src/**/*.accessibility.{test,spec}.{js,ts,jsx,tsx}',
    ],
    setupFilesAfterEnv: [
      '<rootDir>/src/test/setup.ts',
      '<rootDir>/src/test/accessibility-setup.ts',
    ],
    testTimeout: 45000,
  },

  // E2E test configuration (Playwright)
  e2e: {
    testDir: './tests/e2e',
    timeout: 60000,
    expect: {
      timeout: 10000,
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
      ['html'],
      ['json', { outputFile: 'test-results/e2e-results.json' }],
      ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    ],
    use: {
      baseURL: 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...require('@playwright/test').devices['Desktop Chrome'] },
      },
      {
        name: 'firefox',
        use: { ...require('@playwright/test').devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...require('@playwright/test').devices['Desktop Safari'] },
      },
      {
        name: 'Mobile Chrome',
        use: { ...require('@playwright/test').devices['Pixel 5'] },
      },
      {
        name: 'Mobile Safari',
        use: { ...require('@playwright/test').devices['iPhone 12'] },
      },
    ],
  },

  // Visual regression test configuration
  visual: {
    testDir: './tests/visual',
    timeout: 30000,
    expect: {
      timeout: 5000,
      threshold: 0.2, // Allow 20% pixel difference
    },
    use: {
      baseURL: 'http://localhost:3000',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...require('@playwright/test').devices['Desktop Chrome'] },
      },
    ],
  },

  // Test data and fixtures
  fixtures: {
    testDataDir: path.join(__dirname, 'tests/fixtures'),
    mockDataDir: path.join(__dirname, 'src/test/mocks'),
    
    // Test file generators
    generateTestImage: (width = 100, height = 100, format = 'jpeg') => ({
      name: `test-image-${width}x${height}.${format}`,
      width,
      height,
      format,
      size: Math.floor(width * height * 0.1), // Rough size estimation
    }),
    
    generateTestVideo: (duration = 60, format = 'mp4') => ({
      name: `test-video-${duration}s.${format}`,
      duration,
      format,
      size: Math.floor(duration * 1024 * 1024 * 0.5), // Rough size estimation
    }),
    
    generateTestDocument: (pages = 1, format = 'pdf') => ({
      name: `test-document-${pages}p.${format}`,
      pages,
      format,
      size: Math.floor(pages * 1024 * 100), // Rough size estimation
    }),
  },

  // Test utilities and helpers
  utils: {
    // Database utilities
    db: {
      setupTestDatabase: async () => {
        // Setup test database with clean state
        console.log('Setting up test database...')
      },
      
      teardownTestDatabase: async () => {
        // Clean up test database
        console.log('Tearing down test database...')
      },
      
      seedTestData: async (dataSet = 'minimal') => {
        // Seed database with test data
        console.log(`Seeding test data: ${dataSet}`)
      },
    },

    // File system utilities
    fs: {
      createTempDir: () => {
        const tmpDir = path.join(__dirname, 'tmp', `test-${Date.now()}`)
        require('fs').mkdirSync(tmpDir, { recursive: true })
        return tmpDir
      },
      
      cleanupTempDirs: () => {
        const tmpDir = path.join(__dirname, 'tmp')
        if (require('fs').existsSync(tmpDir)) {
          require('fs').rmSync(tmpDir, { recursive: true, force: true })
        }
      },
    },

    // Network utilities
    network: {
      mockApiServer: {
        port: 3001,
        start: async () => {
          console.log('Starting mock API server...')
        },
        stop: async () => {
          console.log('Stopping mock API server...')
        },
      },
    },

    // Performance utilities
    performance: {
      measureExecutionTime: async (fn, label) => {
        const start = performance.now()
        await fn()
        const end = performance.now()
        const duration = end - start
        console.log(`${label}: ${duration.toFixed(2)}ms`)
        return duration
      },
      
      measureMemoryUsage: () => {
        if (typeof process !== 'undefined' && process.memoryUsage) {
          return process.memoryUsage()
        }
        return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 }
      },
    },
  },

  // Test reporting configuration
  reporting: {
    outputDir: 'test-results',
    formats: ['json', 'html', 'junit', 'lcov'],
    
    // Custom reporters
    customReporters: [
      {
        name: 'comprehensive-reporter',
        options: {
          outputFile: 'test-results/comprehensive-report.json',
          includePerformanceMetrics: true,
          includeAccessibilityResults: true,
          includeCoverageDetails: true,
        },
      },
    ],
    
    // Notification settings
    notifications: {
      slack: {
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        webhook: process.env.SLACK_WEBHOOK_URL,
        channel: '#test-results',
      },
      
      email: {
        enabled: false,
        recipients: [],
      },
    },
  },

  // CI/CD specific configuration
  ci: {
    // Parallel execution settings
    parallel: {
      unit: 4,
      integration: 2,
      e2e: 1,
      performance: 1,
    },
    
    // Retry settings
    retries: {
      unit: 0,
      integration: 1,
      e2e: 2,
      performance: 1,
    },
    
    // Timeout multipliers for CI
    timeoutMultiplier: process.env.CI ? 2 : 1,
    
    // Quality gates
    qualityGates: {
      coverage: {
        threshold: 80,
        enforced: true,
      },
      
      performance: {
        maxRegressionPercent: 10,
        enforced: true,
      },
      
      accessibility: {
        maxViolations: 0,
        enforced: true,
      },
      
      security: {
        maxVulnerabilities: 0,
        enforced: true,
      },
    },
  },
}

module.exports = testConfig