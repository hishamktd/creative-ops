import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Asset Components - Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to assets page
    await page.goto('/assets')
    await page.waitForLoadState('networkidle')
    
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user', email: 'test@example.com' }
      }))
    })
  })

  test.describe('Upload Zone Visual States', () => {
    test('should render default upload zone correctly', async ({ page }) => {
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await expect(uploadZone).toBeVisible()
      
      // Take screenshot of default state
      await expect(uploadZone).toHaveScreenshot('upload-zone-default.png')
    })

    test('should render hover state correctly', async ({ page }) => {
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      
      // Hover over upload zone
      await uploadZone.hover()
      
      // Take screenshot of hover state
      await expect(uploadZone).toHaveScreenshot('upload-zone-hover.png')
    })

    test('should render drag-over state correctly', async ({ page }) => {
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      
      // Simulate drag over
      await page.evaluate(() => {
        const element = document.querySelector('[role="button"]')
        if (element) {
          element.classList.add('drag-over')
          element.setAttribute('data-drag-over', 'true')
        }
      })
      
      // Take screenshot of drag-over state
      await expect(uploadZone).toHaveScreenshot('upload-zone-drag-over.png')
    })

    test('should render upload progress correctly', async ({ page }) => {
      // Mock file upload to show progress
      await page.route('**/api/assets/upload', async route => {
        // Delay response to show progress
        await new Promise(resolve => setTimeout(resolve, 2000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            asset: { id: 'test-asset', name: 'test.jpg' }
          })
        })
      })
      
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      
      await uploadZone.setInputFiles(testImagePath)
      
      // Wait for progress to appear
      await expect(page.getByRole('progressbar')).toBeVisible()
      
      // Take screenshot of progress state
      await expect(page.getByTestId('upload-progress')).toHaveScreenshot('upload-progress.png')
    })

    test('should render error state correctly', async ({ page }) => {
      // Mock upload error
      await page.route('**/api/assets/upload', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'File type not allowed'
          })
        })
      })
      
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      const invalidFile = path.join(__dirname, '../fixtures/malware.exe')
      
      await uploadZone.setInputFiles(invalidFile)
      
      // Wait for error to appear
      await expect(page.getByText(/file type not allowed/i)).toBeVisible()
      
      // Take screenshot of error state
      await expect(page.getByTestId('upload-error')).toHaveScreenshot('upload-error.png')
    })

    test('should render multiple file upload correctly', async ({ page }) => {
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      const testFiles = [
        path.join(__dirname, '../fixtures/test-image-1.jpg'),
        path.join(__dirname, '../fixtures/test-image-2.png'),
        path.join(__dirname, '../fixtures/test-document.pdf'),
      ]
      
      await uploadZone.setInputFiles(testFiles)
      
      // Wait for batch upload UI
      await expect(page.getByText(/uploading 3 files/i)).toBeVisible()
      
      // Take screenshot of batch upload
      await expect(page.getByTestId('batch-upload')).toHaveScreenshot('batch-upload.png')
    })
  })

  test.describe('Asset Browser Visual States', () => {
    test.beforeEach(async ({ page }) => {
      // Upload test assets for browser tests
      const testFiles = [
        path.join(__dirname, '../fixtures/test-image-1.jpg'),
        path.join(__dirname, '../fixtures/test-image-2.png'),
        path.join(__dirname, '../fixtures/test-document.pdf'),
        path.join(__dirname, '../fixtures/test-video.mp4'),
      ]
      
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testFiles)
      await expect(page.getByText('All uploads completed')).toBeVisible({ timeout: 20000 })
    })

    test('should render grid view correctly', async ({ page }) => {
      const assetGrid = page.getByTestId('asset-grid')
      await expect(assetGrid).toBeVisible()
      
      // Take screenshot of grid view
      await expect(assetGrid).toHaveScreenshot('asset-grid-view.png')
    })

    test('should render list view correctly', async ({ page }) => {
      const listViewButton = page.getByRole('button', { name: /list view/i })
      await listViewButton.click()
      
      const assetList = page.getByTestId('asset-list')
      await expect(assetList).toBeVisible()
      
      // Take screenshot of list view
      await expect(assetList).toHaveScreenshot('asset-list-view.png')
    })

    test('should render timeline view correctly', async ({ page }) => {
      const timelineViewButton = page.getByRole('button', { name: /timeline view/i })
      await timelineViewButton.click()
      
      const assetTimeline = page.getByTestId('asset-timeline')
      await expect(assetTimeline).toBeVisible()
      
      // Take screenshot of timeline view
      await expect(assetTimeline).toHaveScreenshot('asset-timeline-view.png')
    })

    test('should render asset cards with different file types', async ({ page }) => {
      // Image asset card
      const imageCard = page.getByTestId('asset-card').filter({ hasText: '.jpg' }).first()
      await expect(imageCard).toHaveScreenshot('asset-card-image.png')
      
      // Document asset card
      const documentCard = page.getByTestId('asset-card').filter({ hasText: '.pdf' }).first()
      await expect(documentCard).toHaveScreenshot('asset-card-document.png')
      
      // Video asset card
      const videoCard = page.getByTestId('asset-card').filter({ hasText: '.mp4' }).first()
      await expect(videoCard).toHaveScreenshot('asset-card-video.png')
    })

    test('should render asset card hover states', async ({ page }) => {
      const assetCard = page.getByTestId('asset-card').first()
      
      // Hover over card
      await assetCard.hover()
      
      // Take screenshot of hover state
      await expect(assetCard).toHaveScreenshot('asset-card-hover.png')
    })

    test('should render selected asset cards', async ({ page }) => {
      const assetCard = page.getByTestId('asset-card').first()
      
      // Select card (assuming checkbox selection)
      const checkbox = assetCard.getByRole('checkbox')
      if (await checkbox.isVisible()) {
        await checkbox.check()
      } else {
        await assetCard.click()
      }
      
      // Take screenshot of selected state
      await expect(assetCard).toHaveScreenshot('asset-card-selected.png')
    })
  })

  test.describe('Asset Preview Visual States', () => {
    test.beforeEach(async ({ page }) => {
      // Upload test image
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testImagePath)
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
    })

    test('should render image preview correctly', async ({ page }) => {
      const assetCard = page.getByTestId('asset-card').first()
      await assetCard.click()
      
      const previewModal = page.getByRole('dialog', { name: /asset preview/i })
      await expect(previewModal).toBeVisible()
      
      // Take screenshot of image preview
      await expect(previewModal).toHaveScreenshot('image-preview.png')
    })

    test('should render zoomed image preview', async ({ page }) => {
      const assetCard = page.getByTestId('asset-card').first()
      await assetCard.click()
      
      const previewModal = page.getByRole('dialog', { name: /asset preview/i })
      await expect(previewModal).toBeVisible()
      
      // Zoom in
      const zoomInButton = page.getByRole('button', { name: /zoom in/i })
      await zoomInButton.click()
      await zoomInButton.click() // Zoom in more
      
      // Take screenshot of zoomed preview
      await expect(previewModal).toHaveScreenshot('image-preview-zoomed.png')
    })

    test('should render metadata panel correctly', async ({ page }) => {
      const assetCard = page.getByTestId('asset-card').first()
      await assetCard.click()
      
      const previewModal = page.getByRole('dialog', { name: /asset preview/i })
      await expect(previewModal).toBeVisible()
      
      // Open metadata tab
      const metadataTab = page.getByRole('tab', { name: /metadata/i })
      await metadataTab.click()
      
      const metadataPanel = page.getByTestId('metadata-panel')
      await expect(metadataPanel).toBeVisible()
      
      // Take screenshot of metadata panel
      await expect(metadataPanel).toHaveScreenshot('metadata-panel.png')
    })

    test('should render comments panel correctly', async ({ page }) => {
      const assetCard = page.getByTestId('asset-card').first()
      await assetCard.click()
      
      const previewModal = page.getByRole('dialog', { name: /asset preview/i })
      await expect(previewModal).toBeVisible()
      
      // Open comments tab
      const commentsTab = page.getByRole('tab', { name: /comments/i })
      await commentsTab.click()
      
      const commentsPanel = page.getByTestId('comments-panel')
      await expect(commentsPanel).toBeVisible()
      
      // Add a comment for visual testing
      const commentInput = page.getByRole('textbox', { name: /add comment/i })
      await commentInput.fill('This is a test comment for visual regression testing')
      
      const submitButton = page.getByRole('button', { name: /post comment/i })
      await submitButton.click()
      
      // Wait for comment to appear
      await expect(page.getByText('This is a test comment')).toBeVisible()
      
      // Take screenshot of comments panel
      await expect(commentsPanel).toHaveScreenshot('comments-panel.png')
    })
  })

  test.describe('Filter and Search Visual States', () => {
    test.beforeEach(async ({ page }) => {
      // Upload diverse test assets
      const testFiles = [
        path.join(__dirname, '../fixtures/test-image-1.jpg'),
        path.join(__dirname, '../fixtures/test-image-2.png'),
        path.join(__dirname, '../fixtures/test-document.pdf'),
        path.join(__dirname, '../fixtures/test-video.mp4'),
      ]
      
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testFiles)
      await expect(page.getByText('All uploads completed')).toBeVisible({ timeout: 20000 })
    })

    test('should render search interface correctly', async ({ page }) => {
      const searchInput = page.getByRole('searchbox', { name: /search assets/i })
      await expect(searchInput).toBeVisible()
      
      // Take screenshot of search interface
      await expect(page.getByTestId('search-interface')).toHaveScreenshot('search-interface.png')
    })

    test('should render search results correctly', async ({ page }) => {
      const searchInput = page.getByRole('searchbox', { name: /search assets/i })
      await searchInput.fill('test-image')
      
      // Wait for search results
      await page.waitForTimeout(500) // Debounce delay
      
      // Take screenshot of search results
      await expect(page.getByTestId('search-results')).toHaveScreenshot('search-results.png')
    })

    test('should render filters panel correctly', async ({ page }) => {
      const filtersButton = page.getByRole('button', { name: /filters/i })
      await filtersButton.click()
      
      const filtersPanel = page.getByTestId('filters-panel')
      await expect(filtersPanel).toBeVisible()
      
      // Take screenshot of filters panel
      await expect(filtersPanel).toHaveScreenshot('filters-panel.png')
    })

    test('should render active filters correctly', async ({ page }) => {
      const filtersButton = page.getByRole('button', { name: /filters/i })
      await filtersButton.click()
      
      // Apply some filters
      const imageFilter = page.getByRole('checkbox', { name: /images/i })
      await imageFilter.check()
      
      const dateFilter = page.getByRole('combobox', { name: /date range/i })
      await dateFilter.selectOption('last-week')
      
      const applyButton = page.getByRole('button', { name: /apply filters/i })
      await applyButton.click()
      
      // Take screenshot with active filters
      await expect(page.getByTestId('active-filters')).toHaveScreenshot('active-filters.png')
    })
  })

  test.describe('Folder Management Visual States', () => {
    test('should render folder sidebar correctly', async ({ page }) => {
      const folderSidebar = page.getByTestId('folder-sidebar')
      await expect(folderSidebar).toBeVisible()
      
      // Take screenshot of folder sidebar
      await expect(folderSidebar).toHaveScreenshot('folder-sidebar.png')
    })

    test('should render create folder modal correctly', async ({ page }) => {
      const createFolderButton = page.getByRole('button', { name: /create folder/i })
      await createFolderButton.click()
      
      const folderModal = page.getByRole('dialog', { name: /create folder/i })
      await expect(folderModal).toBeVisible()
      
      // Take screenshot of create folder modal
      await expect(folderModal).toHaveScreenshot('create-folder-modal.png')
    })

    test('should render folder breadcrumb correctly', async ({ page }) => {
      // Create and navigate to folder
      const createFolderButton = page.getByRole('button', { name: /create folder/i })
      await createFolderButton.click()
      
      const folderNameInput = page.getByRole('textbox', { name: /folder name/i })
      await folderNameInput.fill('Test Folder')
      
      const createButton = page.getByRole('button', { name: /create/i })
      await createButton.click()
      
      // Navigate into folder
      const folderItem = page.getByTestId('folder-item').filter({ hasText: 'Test Folder' })
      await folderItem.click()
      
      // Take screenshot of breadcrumb
      const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i })
      await expect(breadcrumb).toHaveScreenshot('folder-breadcrumb.png')
    })
  })

  test.describe('Responsive Design Visual States', () => {
    test('should render correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Take screenshot of mobile layout
      await expect(page).toHaveScreenshot('mobile-layout.png', { fullPage: true })
    })

    test('should render correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
      
      // Take screenshot of tablet layout
      await expect(page).toHaveScreenshot('tablet-layout.png', { fullPage: true })
    })

    test('should render correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      
      // Take screenshot of desktop layout
      await expect(page).toHaveScreenshot('desktop-layout.png', { fullPage: true })
    })

    test('should render mobile upload interface correctly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      
      const mobileUploadButton = page.getByRole('button', { name: /upload/i })
      await expect(mobileUploadButton).toBeVisible()
      
      // Take screenshot of mobile upload interface
      await expect(page.getByTestId('mobile-upload')).toHaveScreenshot('mobile-upload.png')
    })
  })

  test.describe('Dark Mode Visual States', () => {
    test.beforeEach(async ({ page }) => {
      // Enable dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add('dark')
      })
    })

    test('should render upload zone in dark mode', async ({ page }) => {
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await expect(uploadZone).toBeVisible()
      
      // Take screenshot of dark mode upload zone
      await expect(uploadZone).toHaveScreenshot('upload-zone-dark.png')
    })

    test('should render asset grid in dark mode', async ({ page }) => {
      // Upload test assets
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testImagePath)
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
      
      const assetGrid = page.getByTestId('asset-grid')
      await expect(assetGrid).toBeVisible()
      
      // Take screenshot of dark mode asset grid
      await expect(assetGrid).toHaveScreenshot('asset-grid-dark.png')
    })

    test('should render preview modal in dark mode', async ({ page }) => {
      // Upload and open asset
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testImagePath)
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
      
      const assetCard = page.getByTestId('asset-card').first()
      await assetCard.click()
      
      const previewModal = page.getByRole('dialog', { name: /asset preview/i })
      await expect(previewModal).toBeVisible()
      
      // Take screenshot of dark mode preview
      await expect(previewModal).toHaveScreenshot('preview-modal-dark.png')
    })
  })

  test.describe('Loading and Empty States', () => {
    test('should render loading state correctly', async ({ page }) => {
      // Mock slow API response
      await page.route('**/api/assets**', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], error: null })
        })
      })
      
      await page.reload()
      
      // Take screenshot of loading state
      const loadingSpinner = page.getByRole('status', { name: /loading/i }) || 
                           page.locator('.animate-spin')
      await expect(loadingSpinner).toBeVisible()
      await expect(loadingSpinner).toHaveScreenshot('loading-state.png')
    })

    test('should render empty state correctly', async ({ page }) => {
      // Mock empty response
      await page.route('**/api/assets**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], error: null })
        })
      })
      
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Take screenshot of empty state
      const emptyState = page.getByTestId('empty-state')
      await expect(emptyState).toBeVisible()
      await expect(emptyState).toHaveScreenshot('empty-state.png')
    })

    test('should render error state correctly', async ({ page }) => {
      // Mock error response
      await page.route('**/api/assets**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        })
      })
      
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Take screenshot of error state
      const errorState = page.getByTestId('error-state')
      await expect(errorState).toBeVisible()
      await expect(errorState).toHaveScreenshot('error-state.png')
    })
  })
})