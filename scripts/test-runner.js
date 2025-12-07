#!/usr/bin/env node

/**
 * Advanced Test Runner for Enhanced Assets System
 * Provides intelligent test execution with parallel processing, 
 * quality gates, and comprehensive reporting
 */

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const testConfig = require('../test.config.js')

class AdvancedTestRunner {
  constructor(options = {}) {
    this.options = {
      parallel: options.parallel ?? true,
      coverage: options.coverage ?? true,
      watch: options.watch ?? false,
      verbose: options.verbose ?? false,
      bail: options.bail ?? false,
      ...options,
    }
    
    this.results = {
      suites: [],
      startTime: Date.now(),
      endTime: null,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
      },
    }
    
    this.setupDirectories()
  }

  setupDirectories() {
    const dirs = [
      'test-results',
      'coverage',
      'tmp',
    ]
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString()
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m',
    }
    
    if (this.options.verbose || level !== 'info') {
      console.log(`${colors[level]}[${timestamp}] ${message}${colors.reset}`)
    }
  }

  async runTestSuite(suiteName, config) {
    this.log(`Starting ${suiteName} tests...`)
    const startTime = Date.now()
    
    try {
      let command
      let args = []
      
      switch (suiteName) {
        case 'unit':
          command = 'vitest'
          args = ['run', '--config', 'vitest.config.ts']
          if (this.options.coverage) {
            args.push('--coverage')
          }
          break
          
        case 'integration':
          command = 'vitest'
          args = ['run', '--config', 'vitest.integration.config.ts']
          break
          
        case 'performance':
          command = 'vitest'
          args = ['run', '--config', 'vitest.performance.config.ts']
          break
          
        case 'accessibility':
          command = 'vitest'
          args = ['run', '--config', 'vitest.accessibility.config.ts']
          break
          
        case 'e2e':
          command = 'playwright'
          args = ['test']
          break
          
        case 'visual':
          command = 'playwright'
          args = ['test', '--config', 'playwright.visual.config.ts']
          break
          
        default:
          throw new Error(`Unknown test suite: ${suiteName}`)
      }
      
      const result = await this.executeCommand(command, args, {
        timeout: config.timeout || 300000,
        cwd: process.cwd(),
      })
      
      const duration = Date.now() - startTime
      const suiteResult = {
        name: suiteName,
        status: 'passed',
        duration,
        output: result.stdout,
        config,
      }
      
      this.results.suites.push(suiteResult)
      this.results.summary.total++
      this.results.summary.passed++
      
      this.log(`✅ ${suiteName} tests completed in ${this.formatDuration(duration)}`, 'success')
      return suiteResult
      
    } catch (error) {
      const duration = Date.now() - startTime
      const suiteResult = {
        name: suiteName,
        status: 'failed',
        duration,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || '',
        config,
      }
      
      this.results.suites.push(suiteResult)
      this.results.summary.total++
      this.results.summary.failed++
      
      this.log(`❌ ${suiteName} tests failed: ${error.message}`, 'error')
      
      if (this.options.bail) {
        throw error
      }
      
      return suiteResult
    }
  }

  async executeCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        ...options,
      })
      
      let stdout = ''
      let stderr = ''
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString()
        if (this.options.verbose) {
          process.stdout.write(data)
        }
      })
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString()
        if (this.options.verbose) {
          process.stderr.write(data)
        }
      })
      
      const timeout = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`Command timeout after ${options.timeout}ms`))
      }, options.timeout || 300000)
      
      child.on('close', (code) => {
        clearTimeout(timeout)
        
        if (code === 0) {
          resolve({ stdout, stderr, code })
        } else {
          const error = new Error(`Command failed with exit code ${code}`)
          error.stdout = stdout
          error.stderr = stderr
          error.code = code
          reject(error)
        }
      })
      
      child.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  async runParallel(suites) {
    this.log(`Running ${suites.length} test suites in parallel...`)
    
    const promises = suites.map(({ name, config }) => 
      this.runTestSuite(name, config)
    )
    
    const results = await Promise.allSettled(promises)
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        const suiteName = suites[index].name
        this.log(`❌ ${suiteName} suite failed: ${result.reason.message}`, 'error')
        
        const failedResult = {
          name: suiteName,
          status: 'failed',
          error: result.reason.message,
          duration: 0,
        }
        
        this.results.summary.total++
        this.results.summary.failed++
        
        return failedResult
      }
    })
  }

  async runSequential(suites) {
    this.log(`Running ${suites.length} test suites sequentially...`)
    
    const results = []
    
    for (const { name, config } of suites) {
      const result = await this.runTestSuite(name, config)
      results.push(result)
      
      if (result.status === 'failed' && this.options.bail) {
        this.log('Stopping execution due to test failure (bail mode)', 'warning')
        break
      }
    }
    
    return results
  }

  async checkQualityGates() {
    this.log('Checking quality gates...')
    
    const gates = testConfig.ci.qualityGates
    const violations = []
    
    // Check coverage
    if (gates.coverage.enforced) {
      const coverageFile = 'coverage/coverage-summary.json'
      if (fs.existsSync(coverageFile)) {
        const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'))
        const totalCoverage = coverage.total.lines.pct
        
        if (totalCoverage < gates.coverage.threshold) {
          violations.push({
            gate: 'coverage',
            expected: gates.coverage.threshold,
            actual: totalCoverage,
            message: `Coverage ${totalCoverage}% is below threshold ${gates.coverage.threshold}%`,
          })
        }
      }
    }
    
    // Check accessibility violations
    if (gates.accessibility.enforced) {
      const a11yResults = this.results.suites.find(s => s.name === 'accessibility')
      if (a11yResults && a11yResults.status === 'failed') {
        violations.push({
          gate: 'accessibility',
          message: 'Accessibility tests failed',
        })
      }
    }
    
    // Check performance regressions
    if (gates.performance.enforced) {
      const perfResults = this.results.suites.find(s => s.name === 'performance')
      if (perfResults && perfResults.status === 'failed') {
        violations.push({
          gate: 'performance',
          message: 'Performance tests failed',
        })
      }
    }
    
    if (violations.length > 0) {
      this.log('❌ Quality gate violations found:', 'error')
      violations.forEach(v => {
        this.log(`  - ${v.message}`, 'error')
      })
      return false
    }
    
    this.log('✅ All quality gates passed', 'success')
    return true
  }

  async generateReports() {
    this.log('Generating test reports...')
    
    this.results.endTime = Date.now()
    this.results.totalDuration = this.results.endTime - this.results.startTime
    
    // Generate JSON report
    const jsonReport = {
      ...this.results,
      environment: {
        node: process.version,
        platform: process.platform,
        ci: !!process.env.CI,
        timestamp: new Date().toISOString(),
      },
    }
    
    fs.writeFileSync(
      'test-results/comprehensive-results.json',
      JSON.stringify(jsonReport, null, 2)
    )
    
    // Generate HTML report
    const htmlReport = this.generateHtmlReport(jsonReport)
    fs.writeFileSync('test-results/comprehensive-report.html', htmlReport)
    
    // Generate JUnit XML
    const junitReport = this.generateJunitReport(jsonReport)
    fs.writeFileSync('test-results/junit-results.xml', junitReport)
    
    this.log('✅ Reports generated successfully', 'success')
  }

  generateHtmlReport(data) {
    const passRate = ((data.summary.passed / data.summary.total) * 100).toFixed(1)
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Comprehensive Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .metric { background: white; padding: 15px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .suite { background: white; margin-bottom: 15px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .suite-header { padding: 15px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; }
        .suite-name { font-weight: bold; }
        .suite-status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status-passed { background: #28a745; }
        .status-failed { background: #dc3545; }
        .suite-details { padding: 15px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Comprehensive Test Report</h1>
        <p>Generated on ${new Date(data.environment.timestamp).toLocaleString()}</p>
        <p>Duration: ${this.formatDuration(data.totalDuration)}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <div class="metric-value">${data.summary.total}</div>
            <div>Total Suites</div>
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
            <div class="metric-value">${passRate}%</div>
            <div>Pass Rate</div>
        </div>
    </div>
    
    <div class="suites">
        ${data.suites.map(suite => `
            <div class="suite">
                <div class="suite-header">
                    <span class="suite-name">${suite.name.toUpperCase()}</span>
                    <span class="suite-status status-${suite.status}">${suite.status}</span>
                </div>
                <div class="suite-details">
                    <p><strong>Duration:</strong> ${this.formatDuration(suite.duration)}</p>
                    ${suite.error ? `<p><strong>Error:</strong> ${suite.error}</p>` : ''}
                </div>
            </div>
        `).join('')}
    </div>
</body>
</html>`
  }

  generateJunitReport(data) {
    const testsuites = data.suites.map(suite => `
      <testsuite name="${suite.name}" tests="1" failures="${suite.status === 'failed' ? 1 : 0}" time="${(suite.duration / 1000).toFixed(3)}">
        ${suite.status === 'failed' 
          ? `<testcase name="${suite.name}"><failure message="${suite.error || 'Test failed'}">${suite.stderr || suite.error || 'Test failed'}</failure></testcase>`
          : `<testcase name="${suite.name}" time="${(suite.duration / 1000).toFixed(3)}"/>`
        }
      </testsuite>
    `).join('')
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Comprehensive Test Suite" tests="${data.summary.total}" failures="${data.summary.failed}" time="${(data.totalDuration / 1000).toFixed(3)}">
  ${testsuites}
</testsuites>`
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  printSummary() {
    const { summary, totalDuration } = this.results
    
    console.log('\n' + '='.repeat(60))
    console.log('🧪 COMPREHENSIVE TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Suites: ${summary.total}`)
    console.log(`✅ Passed: ${summary.passed}`)
    console.log(`❌ Failed: ${summary.failed}`)
    console.log(`⏭️  Skipped: ${summary.skipped}`)
    console.log(`⏱️  Duration: ${this.formatDuration(totalDuration)}`)
    console.log(`📊 Pass Rate: ${((summary.passed / summary.total) * 100).toFixed(1)}%`)
    
    console.log('\n📋 Suite Details:')
    this.results.suites.forEach(suite => {
      const status = suite.status === 'passed' ? '✅' : '❌'
      console.log(`  ${status} ${suite.name.padEnd(15)} ${this.formatDuration(suite.duration)}`)
    })
    
    console.log('='.repeat(60))
    
    if (summary.failed === 0) {
      console.log('🎉 All test suites passed!')
    } else {
      console.log(`⚠️  ${summary.failed} test suite(s) failed`)
    }
  }

  async run(suiteNames = []) {
    try {
      this.log('🚀 Starting comprehensive test execution...')
      
      // Determine which suites to run
      const availableSuites = [
        { name: 'unit', config: testConfig.unit },
        { name: 'integration', config: testConfig.integration },
        { name: 'performance', config: testConfig.performance },
        { name: 'accessibility', config: testConfig.accessibility },
        { name: 'e2e', config: testConfig.e2e },
        { name: 'visual', config: testConfig.visual },
      ]
      
      const suitesToRun = suiteNames.length > 0 
        ? availableSuites.filter(s => suiteNames.includes(s.name))
        : availableSuites
      
      if (suitesToRun.length === 0) {
        throw new Error('No valid test suites specified')
      }
      
      // Run test suites
      if (this.options.parallel && suitesToRun.length > 1) {
        await this.runParallel(suitesToRun)
      } else {
        await this.runSequential(suitesToRun)
      }
      
      // Check quality gates
      const qualityGatesPassed = await this.checkQualityGates()
      
      // Generate reports
      await this.generateReports()
      
      // Print summary
      this.printSummary()
      
      // Exit with appropriate code
      const hasFailures = this.results.summary.failed > 0 || !qualityGatesPassed
      process.exit(hasFailures ? 1 : 0)
      
    } catch (error) {
      this.log(`💥 Test execution failed: ${error.message}`, 'error')
      process.exit(1)
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2)
  const options = {}
  const suites = []
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--parallel':
        options.parallel = true
        break
      case '--sequential':
        options.parallel = false
        break
      case '--coverage':
        options.coverage = true
        break
      case '--no-coverage':
        options.coverage = false
        break
      case '--verbose':
        options.verbose = true
        break
      case '--bail':
        options.bail = true
        break
      case '--watch':
        options.watch = true
        break
      default:
        if (!arg.startsWith('--')) {
          suites.push(arg)
        }
    }
  }
  
  const runner = new AdvancedTestRunner(options)
  runner.run(suites)
}

module.exports = AdvancedTestRunner