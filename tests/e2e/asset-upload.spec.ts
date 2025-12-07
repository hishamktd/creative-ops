import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Asset Upload E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the assets page
    await page.goto('/assets')
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle')
  })

  test('should upload a single image file via drag and drop', async ({ page }) => {
    // Create a test file
    const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
    
    // Locate the upload zone
    const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
    await expect(uploadZone).toBeVisible()
    
    // Upload file via drag and drop
    await uploadZone.setInputFiles(testImagePath)
    
    // Wait for upload to complete
    await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 10000 })
    
    // Verify the uploaded file appears in the asset grid
    await expect(page.getByText('test-image.jpg')).toBeVisible()
    
    // Verify thumbnail is generated
    const thumbnail = page.getByAltText('test-image.jpg thumbnail')
    await expect(thumbnail).toBeVisible()
  })

  test('should upload multiple files at once', async ({ page }) => {
    const testFiles = [
      path.join(__dirname, '../fixtures/test-image-1.jpg'),
      path.join(__dirname, '../fixtures/test-image-2.png'),
      path.join(__dirname, '../fixtures/test-document.pdf'),
    ]
    
    const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
    
    // Upload multiple files
    await uploadZone.setInputFiles(testFiles)
    
    // Wait for all uploads to complete
    await expect(page.getByText('All uploads completed')).toBeVisible({ timeout: 15000 })
    
    // Verify all files appear in the grid
    await expect(page.getByText('test-image-1.jpg')).toBeVisible()
    await expect(page.getByText('test-image-2.png')).toBeVisible()
    await expect(page.getByText('test-document.pdf')).toBeVisible()
  })

  test('should show upload progress for large files', async ({ page }) => {
    const largeFilePath = path.join(__dirname, '../fixtures/large-video.mp4')
    
    const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
    await uploadZone.setInputFiles(largeFilePath)
    
    // Verify progress bar appears
    const progressBar = page.getByRole('progressbar')
    await expect(progressBar).toBeVisible()
    
    // Verify progress updates
    await expect(progressBar).toHaveAttribute('aria-valuenow', /[1-9]/)
    
    // Wait for completion
    await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 30000 })
  })

  test('should handle upload errors gracefully', async ({ page }) => {
    // Try to upload an invalid file type
    const invalidFilePath = path.join(__dirname, '../fixtures/malware.exe')
    
    const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
    await uploadZone.setInputFiles(invalidFilePath)
    
    // Verify error message appears
    await expect(page.getByText(/file type not allowed/i)).toBeVisible()
    
    // Verify error is announced to screen readers
    const errorAlert = page.getByRole('alert')
    await expect(errorAlert).toContainText(/file type not allowed/i)
  })

  test('should allow cancelling uploads', async ({ page }) => {
    const testFilePath = path.join(__dirname, '../fixtures/large-video.mp4')
    
    const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
    await uploadZone.setInputFiles(testFilePath)
    
    // Wait for upload to start
    await expect(page.getByRole('progressbar')).toBeVisible()
    
    // Cancel the upload
    const cancelButton = page.getByRole('button', { name: /cancel/i })
    await cancelButton.click()
    
    // Verify upload is cancelled
    await expect(page.getByText('Upload cancelled')).toBeVisible()
    await expect(page.getByRole('progressbar')).not.toBeVisible()
  })

  test('should work with keyboard navigation', async ({ page }) => {
    // Navigate to upload zone with keyboard
    await page.keyboard.press('Tab')
    
    const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
    await expect(uploadZone).toBeFocused()
    
    // Activate with Enter key
    await page.keyboard.press('Enter')
    
    // Verify file input is triggered (would open file dialog in real browser)
    const fileInput = page.getByRole('button', { name: /choose files/i })
    await expect(fileInput).toBeVisible()
  })

  test('should provide proper accessibility features', async ({ page }) => {
    const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
    
    // Check ARIA attributes
    await expect(uploadZone).toHaveAttribute('aria-describedby')
    await expect(uploadZone).toHaveAttribute('role', 'button')
    
    // Check for proper labeling
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toHaveAttribute('aria-label')
    
    // Check for status regions
    const statusRegion = page.getByRole('status')
    await expect(statusRegion).toBeVisible()
  })

  test('should handle network failures gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/assets/upload', route => {
      route.abort('failed')
    })
    
    const testFilePath = path.join(__dirname, '../fixtures/test-image.jpg')
    const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
    
    await uploadZone.setInputFiles(testFilePath)
    
    // Verify error handling
    await expect(page.getByText(/upload failed.*network error/i)).toBeVisible({ timeout: 10000 })
    
    // Verify retry option is available
    const retryButton = page.getByRole('button', { name: /retry/i })
    await expect(retryButton).toBeVisible()
  })

  test('should maintain upload state across page refreshes', async ({ page }) => {
    const testFilePath = path.join(__dirname, '../fixtures/test-image.jpg')
    const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
    
    await uploadZone.setInputFiles(testFilePath)
    
    // Wait for upload to start
    await expect(page.getByRole('progressbar')).toBeVisible()
    
    // Refresh the page
    await page.reload()
    
    // Verify upload state is restored or handled appropriately
    // This depends on implementation - could show resume option or restart
    await expect(page.getByText(/upload.*progress/i)).toBeVisible()
  })

  test('should work on mobile devices', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'This test is only for mobile devices')
    
    // On mobile, drag and drop might not be available, so test file input
    const fileInputButton = page.getByRole('button', { name: /choose files/i })
    await expect(fileInputButton).toBeVisible()
    
    // Verify touch-friendly interface
    const uploadArea = page.getByTestId('upload-area')
    await expect(uploadArea).toHaveCSS('min-height', /44px|3rem/) // Minimum touch target size
  })

  test('should integrate with folder structure', async ({ page }) => {
    // Navigate to a specific folder
    await page.getByText('Project Folder').click()
    
    const testFilePath = path.join(__dirname, '../fixtures/test-image.jpg')
    const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
    
    await uploadZone.setInputFiles(testFilePath)
    await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 10000 })
    
    // Verify file is uploaded to the correct folder
    await expect(page.getByText('test-image.jpg')).toBeVisible()
    
    // Verify breadcrumb shows correct location
    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i })
    await expect(breadcrumb).toContainText('Project Folder')
  })
})

test.describe('Asset Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets')
    await page.waitForLoadState('networkidle')
    
    // Ensure we have some test assets
    const testFilePath = path.join(__dirname, '../fixtures/test-image.jpg')
    const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
    await uploadZone.setInputFiles(testFilePath)
    await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 10000 })
  })

  test('should preview assets in full screen', async ({ page }) => {
    // Click on an asset to preview
    const assetCard = page.getByText('test-image.jpg').first()
    await assetCard.click()
    
    // Verify preview modal opens
    const previewModal = page.getByRole('dialog', { name: /asset preview/i })
    await expect(previewModal).toBeVisible()
    
    // Verify image is displayed
    const previewImage = page.getByAltText('test-image.jpg')
    await expect(previewImage).toBeVisible()
    
    // Test zoom functionality
    const zoomInButton = page.getByRole('button', { name: /zoom in/i })
    await zoomInButton.click()
    
    // Verify image is zoomed (this would need specific implementation details)
    await expect(previewImage).toHaveCSS('transform', /scale/)
    
    // Close preview
    const closeButton = page.getByRole('button', { name: /close/i })
    await closeButton.click()
    await expect(previewModal).not.toBeVisible()
  })

  test('should search and filter assets', async ({ page }) => {
    // Use search functionality
    const searchInput = page.getByRole('searchbox', { name: /search assets/i })
    await searchInput.fill('test-image')
    
    // Verify search results
    await expect(page.getByText('test-image.jpg')).toBeVisible()
    
    // Test filters
    const filterButton = page.getByRole('button', { name: /filters/i })
    await filterButton.click()
    
    const imageFilter = page.getByRole('checkbox', { name: /images/i })
    await imageFilter.check()
    
    const applyFiltersButton = page.getByRole('button', { name: /apply filters/i })
    await applyFiltersButton.click()
    
    // Verify filtered results
    await expect(page.getByText('test-image.jpg')).toBeVisible()
  })

  test('should handle bulk operations', async ({ page }) => {
    // Select multiple assets
    const selectAllButton = page.getByRole('button', { name: /select all/i })
    await selectAllButton.click()
    
    // Verify selection
    const selectedCount = page.getByText(/\d+ selected/i)
    await expect(selectedCount).toBeVisible()
    
    // Test bulk delete
    const deleteButton = page.getByRole('button', { name: /delete selected/i })
    await deleteButton.click()
    
    // Confirm deletion
    const confirmButton = page.getByRole('button', { name: /confirm delete/i })
    await confirmButton.click()
    
    // Verify assets are deleted
    await expect(page.getByText('Assets deleted successfully')).toBeVisible()
  })

  test('should manage asset versions', async ({ page }) => {
    // Click on an asset
    const assetCard = page.getByText('test-image.jpg').first()
    await assetCard.click()
    
    // Navigate to version history
    const versionsTab = page.getByRole('tab', { name: /versions/i })
    await versionsTab.click()
    
    // Upload a new version
    const uploadNewVersionButton = page.getByRole('button', { name: /upload new version/i })
    await uploadNewVersionButton.click()
    
    const newVersionPath = path.join(__dirname, '../fixtures/test-image-v2.jpg')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(newVersionPath)
    
    // Verify new version is created
    await expect(page.getByText('Version 2')).toBeVisible({ timeout: 10000 })
    
    // Test version comparison
    const compareButton = page.getByRole('button', { name: /compare versions/i })
    await compareButton.click()
    
    const comparisonView = page.getByTestId('version-comparison')
    await expect(comparisonView).toBeVisible()
  })
})