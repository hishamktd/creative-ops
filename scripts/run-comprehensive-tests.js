#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * Comprehensive test runner for the Enhanced Assets System
 * Executes all test suites and generates consolidated reports
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
}

const testSuites = [
  {
    name: 'Unit Tests',
    command: 'npm run test:run',
    required: true,
    timeout: 300000, // 5 minutes
  },
  {
    name: 'Integration Tests',
    command: 'npm run test:integration',
    required: true,
    timeout: 600000, // 10 minutes
  },
  {
    name: 'Performance Tests',
    command: 'npm run test:performance',
    required: false,
    timeout: 900000, // 15 minutes
  },
  {
    name: 'Accessibility Tests',
    command: 'npm run test:accessibility',
    required: true,
    timeout: 300000, // 5 minutes
  },
  {
    name: 'End-to-End Tests',
    command: 'npm run test:e2e',
    required: true,
    timeout: 1200000, // 20 minutes
  },
  {
    name: 'Visual Regression Tests',
    command: 'npm run test:visual',
    required: false,
    timeout: 900000, // 15 minutes
  },
  {
    name: 'Security Tests',
    command: 'npm run test:security',
    required: true,
    timeout: 300000, // 5 minutes
  },
]

class TestRunner {
  constructor() {
    this.results = []
    this.startTime = Date.now()
    this.reportDir = path.join(process.cwd(), 'test-reports')
    
    // Ensure report directory exists
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true })
    }
  }

  async runTest(suite) {
    log.info(`Running ${suite.name}...`)
    const startTime = Date.now()
    
    try {
      const output = execSync(suite.command, {
        encoding: 'utf8',
        timeout: suite.timeout,
        stdio: 'pipe',
      })
      
      const duration = Date.now() - startTime
      const result = {
        name: suite.name,
        status: 'passed',
        duration,
        output: output.trim(),
        required: suite.required,
      }
      
      log.success(`${suite.name} completed in ${this.formatDuration(duration)}`)
      return result
      
    } catch (error) {
      const duration = Date.now() - startTime
      const result = {
        name: suite.name,
        status: 'failed',
        duration,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || '',
        required: suite.required,
      }
      
      if (suite.required) {
        log.error(`${suite.name} failed (required): ${error.message}`)
      } else {
        log.warning(`${suite.name} failed (optional): ${error.message}`)
      }
      
      return result
    }
  }

  async runAllTests() {
    log.header('🧪 Starting Comprehensive Test Suite')
    
    // Check prerequisites
    await this.checkPrerequisites()
    
    // Run each test suite
    for (const suite of testSuites) {
      const result = await this.runTest(suite)
      this.results.push(result)
      
      // Stop on required test failure if not in CI
      if (result.status === 'failed' && result.required && !process.env.CI) {
        log.error('Required test failed. Stopping execution.')
        break
      }
    }
    
    // Generate reports
    await this.generateReports()
    
    // Print summary
    this.printSummary()
    
    // Exit with appropriate code
    const hasRequiredFailures = this.results.some(r => r.status === 'failed' && r.required)
    process.exit(hasRequiredFailures ? 1 : 0)
  }

  async checkPrerequisites() {
    log.info('Checking prerequisites...')
    
    // Check Node.js version
    const nodeVersion = process.version
    log.info(`Node.js version: ${nodeVersion}`)
    
    // Check if dependencies are installed
    if (!fs.existsSync('node_modules')) {
      log.error('Dependencies not installed. Run "npm install" first.')
      process.exit(1)
    }
    
    // Check if build is required
    if (!fs.existsSync('.next') && !process.env.SKIP_BUILD) {
      log.info('Building application...')
      try {
        execSync('npm run build', { stdio: 'inherit' })
        log.success('Build completed')
      } catch (error) {
        log.error('Build failed')
        process.exit(1)
      }
    }
    
    // Check test environment
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'test'
    }
    
    log.success('Prerequisites check completed')
  }

  async generateReports() {
    log.info('Generating test reports...')
    
    // Generate JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: this.getSummary(),
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        ci: !!process.env.CI,
      },
    }
    
    fs.writeFileSync(
      path.join(this.reportDir, 'comprehensive-test-report.json'),
      JSON.stringify(jsonReport, null, 2)
    )
    
    // Generate HTML report
    const htmlReport = this.generateHtmlReport(jsonReport)
    fs.writeFileSync(
      path.join(this.reportDir, 'comprehensive-test-report.html'),
      htmlReport
    )
    
    // Generate JUnit XML for CI systems
    const junitReport = this.generateJunitReport(jsonReport)
    fs.writeFileSync(
      path.join(this.reportDir, 'comprehensive-test-results.xml'),
      junitReport
    )
    
    log.success(`Reports generated in ${this.reportDir}`)
  }

  getSummary() {
    const total = this.results.length
    const passed = this.results.filter(r => r.status === 'passed').length
    const failed = this.results.filter(r => r.status === 'failed').length
    const requiredFailed = this.results.filter(r => r.status === 'failed' && r.required).length
    const optionalFailed = this.results.filter(r => r.status === 'failed' && !r.required).length
    
    return {
      total,
      passed,
      failed,
      requiredFailed,
      optionalFailed,
      passRate: ((passed / total) * 100).toFixed(1),
    }
  }

  printSummary() {
    const summary = this.getSummary()
    const totalDuration = Date.now() - this.startTime
    
    log.header('📊 Test Summary')
    
    console.log(`Total Tests: ${summary.total}`)
    console.log(`${colors.green}Passed: ${summary.passed}${colors.reset}`)
    console.log(`${colors.red}Failed: ${summary.failed}${colors.reset}`)
    
    if (summary.requiredFailed > 0) {
      console.log(`${colors.red}Required Failures: ${summary.requiredFailed}${colors.reset}`)
    }
    
    if (summary.optionalFailed > 0) {
      console.log(`${colors.yellow}Optional Failures: ${summary.optionalFailed}${colors.reset}`)
    }
    
    console.log(`Pass Rate: ${summary.passRate}%`)
    console.log(`Total Duration: ${this.formatDuration(totalDuration)}`)
    
    // Detailed results
    console.log('\n📋 Detailed Results:')
    this.results.forEach(result => {
      const status = result.status === 'passed' 
        ? `${colors.green}✓${colors.reset}` 
        : `${colors.red}✗${colors.reset}`
      const duration = this.formatDuration(result.duration)
      const required = result.required ? '' : ' (optional)'
      
      console.log(`  ${status} ${result.name}${required} - ${duration}`)
    })
    
    // Overall result
    if (summary.requiredFailed === 0) {
      log.success('All required tests passed! 🎉')
    } else {
      log.error(`${summary.requiredFailed} required test(s) failed`)
    }
  }

  generateHtmlReport(data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprehensive Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8fafc; padding: 15px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .passed { color: #059669; }
        .failed { color: #dc2626; }
        .warning { color: #d97706; }
        .test-results { margin-top: 30px; }
        .test-item { display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #e5e7eb; }
        .test-status { width: 20px; height: 20px; border-radius: 50%; margin-right: 15px; }
        .status-passed { background: #059669; }
        .status-failed { background: #dc2626; }
        .test-name { flex: 1; font-weight: 500; }
        .test-duration { color: #6b7280; font-size: 0.9em; }
        .test-required { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; margin-left: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Comprehensive Test Report</h1>
            <p>Generated on ${new Date(data.timestamp).toLocaleString()}</p>
        </div>
        <div class="content">
            <div class="summary">
                <div class="metric">
                    <div class="metric-value">${data.summary.total}</div>
                    <div>Total Tests</div>
                </div>
                <div class="metric">
                    <div class="metric-value passed">${data.summary.passed}</div>
                    <div>Passed</div>
                </div>
                <div class="metric">
                    <div class="metric-value failed">${data.summary.failed}</div>
                    <div>Failed</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${data.summary.passRate}%</div>
                    <div>Pass Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${this.formatDuration(data.duration)}</div>
                    <div>Duration</div>
                </div>
            </div>
            
            <div class="test-results">
                <h2>Test Results</h2>
                ${data.results.map(result => `
                    <div class="test-item">
                        <div class="test-status status-${result.status}"></div>
                        <div class="test-name">${result.name}</div>
                        ${!result.required ? '<span class="test-required">Optional</span>' : ''}
                        <div class="test-duration">${this.formatDuration(result.duration)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
</body>
</html>`
  }

  generateJunitReport(data) {
    const testsuites = data.results.map(result => {
      const testcase = result.status === 'passed' 
        ? `<testcase name="${result.name}" time="${(result.duration / 1000).toFixed(3)}"/>`
        : `<testcase name="${result.name}" time="${(result.duration / 1000).toFixed(3)}">
             <failure message="${result.error || 'Test failed'}">${result.stderr || result.error || 'Test failed'}</failure>
           </testcase>`
      
      return `<testsuite name="${result.name}" tests="1" failures="${result.status === 'failed' ? 1 : 0}" time="${(result.duration / 1000).toFixed(3)}">
        ${testcase}
      </testsuite>`
    }).join('\n')
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Comprehensive Test Suite" tests="${data.summary.total}" failures="${data.summary.failed}" time="${(data.duration / 1000).toFixed(3)}">
  ${testsuites}
</testsuites>`
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }
}

// Run the comprehensive test suite
if (require.main === module) {
  const runner = new TestRunner()
  runner.runAllTests().catch(error => {
    log.error(`Test runner failed: ${error.message}`)
    process.exit(1)
  })
}

module.exports = TestRunner