import { test, expect } from '@playwright/test'

test.describe('Asset Upload Visual States', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets')
    await page.waitForLoadState('networkidle')
  })

  test('upload zone default state', async ({ page }) => {
    await page.click('[data-testid="upload-button"]')
    await page.waitForSelector('[data-testid="upload-modal"]')
    
    await expect(page.locator('[data-testid="upload-zone"]')).toHaveScreenshot('upload-zone-default.png')
  })

  test('upload zone drag hover state', async ({ page }) => {
    await page.click('[data-testid="upload-button"]')
    await page.waitForSelector('[data-testid="upload-modal"]')
    
    // Simulate drag hover
    const uploadZone = page.locator('[data-testid="upload-zone"]')
    await uploadZone.hover()
    await page.evaluate(() => {
      const zone = document.querySelector('[data-testid="upload-zone"]')
      if (zone) {
        zone.classList.add('drag-hover')
      }
    })
    
    await expect(uploadZone).toHaveScreenshot('upload-zone-drag-hover.png')
  })

  test('file upload progress states', async ({ page }) => {
    await page.click('[data-testid="upload-button"]')
    await page.waitForSelector('[data-testid="upload-modal"]')
    
    // Mock file upload with progress
    await page.evaluate(() => {
      const progressContainer = document.createElement('div')
      progressContainer.setAttribute('data-testid', 'upload-progress')
      progressContainer.innerHTML = `
        <div class="upload-item">
          <div class="file-info">
            <span class="file-name">test-image.jpg</span>
            <span class="file-size">2.5 MB</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: 45%"></div>
          </div>
          <span class="progress-text">45%</span>
        </div>
      `
      document.body.appendChild(progressContainer)
    })
    
    await expect(page.locator('[data-testid="upload-progress"]')).toHaveScreenshot('upload-progress-45.png')
    
    // Update to 100%
    await page.evaluate(() => {
      const progressFill = document.querySelector('.progress-fill')
      const progressText = document.querySelector('.progress-text')
      if (progressFill && progressText) {
        progressFill.style.width = '100%'
        progressText.textContent = '100%'
      }
    })
    
    await expect(page.locator('[data-testid="upload-progress"]')).toHaveScreenshot('upload-progress-complete.png')
  })

  test('upload error states', async ({ page }) => {
    await page.click('[data-testid="upload-button"]')
    await page.waitForSelector('[data-testid="upload-modal"]')
    
    // Mock upload error
    await page.evaluate(() => {
      const errorContainer = document.createElement('div')
      errorContainer.setAttribute('data-testid', 'upload-error')
      errorContainer.innerHTML = `
        <div class="upload-item error">
          <div class="file-info">
            <span class="file-name">large-file.mp4</span>
            <span class="file-size">150 MB</span>
          </div>
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            <span class="error-text">File size exceeds 100MB limit</span>
          </div>
          <button class="retry-button">Retry</button>
        </div>
      `
      document.body.appendChild(errorContainer)
    })
    
    await expect(page.locator('[data-testid="upload-error"]')).toHaveScreenshot('upload-error-file-size.png')
  })

  test('batch upload queue', async ({ page }) => {
    await page.click('[data-testid="upload-button"]')
    await page.waitForSelector('[data-testid="upload-modal"]')
    
    // Mock batch upload queue
    await page.evaluate(() => {
      const queueContainer = document.createElement('div')
      queueContainer.setAttribute('data-testid', 'upload-queue')
      queueContainer.innerHTML = `
        <div class="queue-header">
          <span class="queue-title">Upload Queue (5 files)</span>
          <button class="clear-queue">Clear All</button>
        </div>
        <div class="queue-items">
          <div class="queue-item completed">
            <span class="file-name">image1.jpg</span>
            <span class="status">✓ Completed</span>
          </div>
          <div class="queue-item uploading">
            <span class="file-name">image2.png</span>
            <span class="status">⏳ Uploading...</span>
          </div>
          <div class="queue-item pending">
            <span class="file-name">document.pdf</span>
            <span class="status">⏸️ Pending</span>
          </div>
          <div class="queue-item error">
            <span class="file-name">video.mp4</span>
            <span class="status">❌ Failed</span>
          </div>
          <div class="queue-item pending">
            <span class="file-name">audio.mp3</span>
            <span class="status">⏸️ Pending</span>
          </div>
        </div>
      `
      document.body.appendChild(queueContainer)
    })
    
    await expect(page.locator('[data-testid="upload-queue"]')).toHaveScreenshot('upload-queue-mixed-states.png')
  })

  test('upload success notification', async ({ page }) => {
    // Mock success notification
    await page.evaluate(() => {
      const notification = document.createElement('div')
      notification.setAttribute('data-testid', 'upload-success')
      notification.innerHTML = `
        <div class="notification success">
          <div class="notification-icon">✅</div>
          <div class="notification-content">
            <div class="notification-title">Upload Successful</div>
            <div class="notification-message">3 files uploaded successfully</div>
          </div>
          <button class="notification-close">×</button>
        </div>
      `
      document.body.appendChild(notification)
    })
    
    await expect(page.locator('[data-testid="upload-success"]')).toHaveScreenshot('upload-success-notification.png')
  })

  test('upload modal responsive states', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.click('[data-testid="upload-button"]')
    await page.waitForSelector('[data-testid="upload-modal"]')
    
    await expect(page.locator('[data-testid="upload-modal"]')).toHaveScreenshot('upload-modal-desktop.png')
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('[data-testid="upload-modal"]')).toHaveScreenshot('upload-modal-tablet.png')
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('[data-testid="upload-modal"]')).toHaveScreenshot('upload-modal-mobile.png')
  })

  test('dark mode upload interface', async ({ page }) => {
    // Enable dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    
    await page.click('[data-testid="upload-button"]')
    await page.waitForSelector('[data-testid="upload-modal"]')
    
    await expect(page.locator('[data-testid="upload-modal"]')).toHaveScreenshot('upload-modal-dark-mode.png')
  })

  test('high contrast mode upload interface', async ({ page }) => {
    // Enable high contrast mode
    await page.evaluate(() => {
      document.documentElement.classList.add('high-contrast')
    })
    
    await page.click('[data-testid="upload-button"]')
    await page.waitForSelector('[data-testid="upload-modal"]')
    
    await expect(page.locator('[data-testid="upload-modal"]')).toHaveScreenshot('upload-modal-high-contrast.png')
  })

  test('upload validation messages', async ({ page }) => {
    await page.click('[data-testid="upload-button"]')
    await page.waitForSelector('[data-testid="upload-modal"]')
    
    // Mock validation messages
    await page.evaluate(() => {
      const validationContainer = document.createElement('div')
      validationContainer.setAttribute('data-testid', 'upload-validation')
      validationContainer.innerHTML = `
        <div class="validation-messages">
          <div class="validation-item warning">
            <span class="validation-icon">⚠️</span>
            <span class="validation-text">File name contains special characters</span>
          </div>
          <div class="validation-item error">
            <span class="validation-icon">❌</span>
            <span class="validation-text">Unsupported file format</span>
          </div>
          <div class="validation-item info">
            <span class="validation-icon">ℹ️</span>
            <span class="validation-text">File will be compressed to reduce size</span>
          </div>
        </div>
      `
      document.body.appendChild(validationContainer)
    })
    
    await expect(page.locator('[data-testid="upload-validation"]')).toHaveScreenshot('upload-validation-messages.png')
  })
})