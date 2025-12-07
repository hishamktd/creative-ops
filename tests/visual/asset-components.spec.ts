import { test, expect } from '@playwright/test'

test.describe('Asset Components Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 })
    
    // Navigate to assets page
    await page.goto('/assets')
    await page.waitForLoadState('networkidle')
  })

  test('asset browser grid view', async ({ page }) => {
    // Ensure grid view is selected
    await page.getByRole('button', { name: /grid/i }).click()
    
    // Wait for assets to load
    await page.waitForSelector('[data-testid="asset-grid"]', { timeout: 5000 })
    
    // Take screenshot
    await expect(page.locator('[data-testid="asset-grid"]')).toHaveScreenshot('asset-grid-view.png')
  })

  test('asset browser list view', async ({ page }) => {
    // Switch to list view
    await page.getByRole('button', { name: /list/i }).click()
    
    // Wait for view to change
    await page.waitForSelector('[data-testid="asset-list"]', { timeout: 5000 })
    
    // Take screenshot
    await expect(page.locator('[data-testid="asset-list"]')).toHaveScreenshot('asset-list-view.png')
  })

  test('asset upload zone states', async ({ page }) => {
    const uploadZone = page.locator('[data-testid="upload-zone"]')
    
    // Default state
    await expect(uploadZone).toHaveScreenshot('upload-zone-default.png')
    
    // Hover state
    await uploadZone.hover()
    await expect(uploadZone).toHaveScreenshot('upload-zone-hover.png')
    
    // Drag over state (simulate)
    await page.evaluate(() => {
      const zone = document.querySelector('[data-testid="upload-zone"]')
      if (zone) {
        zone.classList.add('drag-over')
      }
    })
    await expect(uploadZone).toHaveScreenshot('upload-zone-dragover.png')
  })

  test('asset preview modal', async ({ page }) => {
    // Click on first asset to open preview
    await page.locator('[data-testid="asset-item"]').first().click()
    
    // Wait for modal to open
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    
    // Take screenshot of modal
    await expect(modal).toHaveScreenshot('asset-preview-modal.png')
    
    // Test different file types if available
    const imagePreview = page.locator('[data-testid="image-preview"]')
    if (await imagePreview.isVisible()) {
      await expect(imagePreview).toHaveScreenshot('image-preview.png')
    }
  })

  test('search interface', async ({ page }) => {
    const searchContainer = page.locator('[data-testid="search-container"]')
    
    // Default search state
    await expect(searchContainer).toHaveScreenshot('search-default.png')
    
    // Search with results
    await page.getByPlaceholder('Search assets...').fill('test')
    await page.waitForTimeout(500) // Wait for debounce
    await expect(searchContainer).toHaveScreenshot('search-with-results.png')
    
    // Advanced search open
    await page.getByRole('button', { name: /advanced/i }).click()
    await expect(page.locator('[data-testid="advanced-search"]')).toHaveScreenshot('advanced-search.png')
  })

  test('filters panel', async ({ page }) => {
    // Open filters
    await page.getByRole('button', { name: /filters/i }).click()
    
    const filtersPanel = page.locator('[data-testid="filters-panel"]')
    await expect(filtersPanel).toBeVisible()
    
    // Default filters state
    await expect(filtersPanel).toHaveScreenshot('filters-panel-default.png')
    
    // With some filters applied
    await page.getByLabel('Images').check()
    await page.getByLabel('Videos').check()
    await expect(filtersPanel).toHaveScreenshot('filters-panel-applied.png')
  })

  test('asset metadata editor', async ({ page }) => {
    // Right-click on asset to open context menu
    await page.locator('[data-testid="asset-item"]').first().click({ button: 'right' })
    
    // Click edit metadata
    await page.getByText('Edit Metadata').click()
    
    const metadataModal = page.getByRole('dialog', { name: /metadata/i })
    await expect(metadataModal).toBeVisible()
    
    // Take screenshot of metadata editor
    await expect(metadataModal).toHaveScreenshot('metadata-editor.png')
  })

  test('folder management interface', async ({ page }) => {
    const folderSidebar = page.locator('[data-testid="folder-sidebar"]')
    
    // Default folder structure
    await expect(folderSidebar).toHaveScreenshot('folder-sidebar-default.png')
    
    // Create new folder dialog
    await page.getByRole('button', { name: /new folder/i }).click()
    const createFolderModal = page.getByRole('dialog', { name: /create folder/i })
    await expect(createFolderModal).toHaveScreenshot('create-folder-modal.png')
  })

  test('bulk actions interface', async ({ page }) => {
    // Select multiple assets
    await page.keyboard.press('Control+A')
    
    // Wait for bulk actions to appear
    const bulkActions = page.locator('[data-testid="bulk-actions"]')
    await expect(bulkActions).toBeVisible()
    
    // Take screenshot of bulk actions bar
    await expect(bulkActions).toHaveScreenshot('bulk-actions-bar.png')
  })

  test('empty states', async ({ page }) => {
    // Navigate to empty folder or project
    await page.goto('/assets?project_id=empty-project')
    
    const emptyState = page.locator('[data-testid="empty-state"]')
    await expect(emptyState).toBeVisible()
    
    // Take screenshot of empty state
    await expect(emptyState).toHaveScreenshot('empty-state.png')
  })

  test('loading states', async ({ page }) => {
    // Intercept API calls to simulate loading
    await page.route('**/api/assets/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.continue()
    })
    
    await page.reload()
    
    // Capture loading state
    const loadingIndicator = page.locator('[data-testid="loading-indicator"]')
    await expect(loadingIndicator).toHaveScreenshot('loading-state.png')
  })

  test('error states', async ({ page }) => {
    // Simulate API error
    await page.route('**/api/assets/**', route => route.abort())
    
    await page.reload()
    
    // Wait for error state
    const errorState = page.locator('[data-testid="error-state"]')
    await expect(errorState).toBeVisible()
    
    // Take screenshot of error state
    await expect(errorState).toHaveScreenshot('error-state.png')
  })

  test('responsive breakpoints', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.locator('main')).toHaveScreenshot('desktop-layout.png')
    
    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('main')).toHaveScreenshot('tablet-layout.png')
    
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('main')).toHaveScreenshot('mobile-layout.png')
  })

  test('dark mode theme', async ({ page }) => {
    // Switch to dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    
    // Take screenshots of key components in dark mode
    await expect(page.locator('[data-testid="asset-grid"]')).toHaveScreenshot('asset-grid-dark.png')
    await expect(page.locator('[data-testid="search-container"]')).toHaveScreenshot('search-dark.png')
  })

  test('high contrast mode', async ({ page }) => {
    // Enable high contrast mode
    await page.evaluate(() => {
      document.documentElement.classList.add('high-contrast')
    })
    
    // Take screenshots with high contrast
    await expect(page.locator('[data-testid="asset-grid"]')).toHaveScreenshot('asset-grid-high-contrast.png')
  })

  test('animation states', async ({ page }) => {
    // Test hover animations
    const assetItem = page.locator('[data-testid="asset-item"]').first()
    await assetItem.hover()
    
    // Wait for animation to complete
    await page.waitForTimeout(300)
    await expect(assetItem).toHaveScreenshot('asset-item-hover.png')
    
    // Test focus states
    await assetItem.focus()
    await expect(assetItem).toHaveScreenshot('asset-item-focus.png')
  })

  test('notification components', async ({ page }) => {
    // Trigger a notification (e.g., upload success)
    await page.evaluate(() => {
      // Simulate notification
      const notification = document.createElement('div')
      notification.setAttribute('data-testid', 'notification')
      notification.className = 'notification success'
      notification.textContent = 'Upload completed successfully'
      document.body.appendChild(notification)
    })
    
    const notification = page.locator('[data-testid="notification"]')
    await expect(notification).toHaveScreenshot('success-notification.png')
  })

  test('context menus', async ({ page }) => {
    // Right-click to open context menu
    await page.locator('[data-testid="asset-item"]').first().click({ button: 'right' })
    
    const contextMenu = page.locator('[data-testid="context-menu"]')
    await expect(contextMenu).toBeVisible()
    await expect(contextMenu).toHaveScreenshot('asset-context-menu.png')
  })

  test('progress indicators', async ({ page }) => {
    // Simulate upload progress
    await page.evaluate(() => {
      const progressBar = document.createElement('div')
      progressBar.setAttribute('data-testid', 'progress-bar')
      progressBar.innerHTML = `
        <div class="progress-container">
          <div class="progress-bar" style="width: 65%"></div>
          <span class="progress-text">65%</span>
        </div>
      `
      document.body.appendChild(progressBar)
    })
    
    const progressBar = page.locator('[data-testid="progress-bar"]')
    await expect(progressBar).toHaveScreenshot('upload-progress.png')
  })
})