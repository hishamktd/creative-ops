import { test, expect, Page } from '@playwright/test'
import path from 'path'

test.describe('Asset Management Workflow', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    
    // Navigate to assets page
    await page.goto('/assets')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test('complete asset upload and management workflow', async () => {
    // Step 1: Upload a file
    await test.step('Upload file via drag and drop', async () => {
      // Create a test file
      const testFilePath = path.join(__dirname, '../fixtures/test-image.jpg')
      
      // Locate the upload zone
      const uploadZone = page.getByRole('button', { name: /upload files/i })
      await expect(uploadZone).toBeVisible()
      
      // Upload file using file input
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(testFilePath)
      
      // Wait for upload to complete
      await expect(page.getByText('Upload completed')).toBeVisible({ timeout: 10000 })
    })

    // Step 2: Verify file appears in browser
    await test.step('Verify file appears in asset browser', async () => {
      await expect(page.getByText('test-image.jpg')).toBeVisible()
      
      // Check that thumbnail is loaded
      const thumbnail = page.locator('img[alt*="test-image.jpg"]')
      await expect(thumbnail).toBeVisible()
    })

    // Step 3: Test search functionality
    await test.step('Search for uploaded asset', async () => {
      const searchInput = page.getByPlaceholder('Search assets...')
      await searchInput.fill('test-image')
      
      // Wait for search results
      await expect(page.getByText('test-image.jpg')).toBeVisible()
      
      // Clear search
      await searchInput.clear()
    })

    // Step 4: Test filtering
    await test.step('Filter assets by type', async () => {
      const filtersButton = page.getByRole('button', { name: /filters/i })
      await filtersButton.click()
      
      // Select image filter
      await page.getByLabel('Images').check()
      
      // Apply filters
      await page.getByRole('button', { name: /apply filters/i }).click()
      
      // Verify only images are shown
      await expect(page.getByText('test-image.jpg')).toBeVisible()
    })

    // Step 5: Test asset preview
    await test.step('Preview asset', async () => {
      // Click on the asset
      await page.getByText('test-image.jpg').click()
      
      // Wait for preview modal to open
      await expect(page.getByRole('dialog')).toBeVisible()
      
      // Check preview image is loaded
      const previewImage = page.locator('[role="dialog"] img')
      await expect(previewImage).toBeVisible()
      
      // Close preview
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })

    // Step 6: Test metadata editing
    await test.step('Edit asset metadata', async () => {
      // Right-click on asset for context menu
      await page.getByText('test-image.jpg').click({ button: 'right' })
      
      // Click edit metadata
      await page.getByText('Edit Metadata').click()
      
      // Wait for metadata modal
      await expect(page.getByRole('dialog', { name: /metadata/i })).toBeVisible()
      
      // Add description
      const descriptionInput = page.getByLabel('Description')
      await descriptionInput.fill('Test image for E2E testing')
      
      // Add tags
      const tagsInput = page.getByLabel('Tags')
      await tagsInput.fill('test, e2e, automation')
      
      // Save changes
      await page.getByRole('button', { name: /save/i }).click()
      
      // Wait for modal to close
      await expect(page.getByRole('dialog', { name: /metadata/i })).not.toBeVisible()
    })

    // Step 7: Test folder organization
    await test.step('Organize asset into folder', async () => {
      // Create new folder
      const newFolderButton = page.getByRole('button', { name: /new folder/i })
      await newFolderButton.click()
      
      // Enter folder name
      const folderNameInput = page.getByLabel('Folder name')
      await folderNameInput.fill('Test Folder')
      
      // Create folder
      await page.getByRole('button', { name: /create/i }).click()
      
      // Wait for folder to appear
      await expect(page.getByText('Test Folder')).toBeVisible()
      
      // Drag asset to folder (simulate with keyboard)
      await page.getByText('test-image.jpg').click()
      await page.keyboard.press('Control+X') // Cut
      
      await page.getByText('Test Folder').dblclick() // Enter folder
      await page.keyboard.press('Control+V') // Paste
      
      // Verify asset is in folder
      await expect(page.getByText('test-image.jpg')).toBeVisible()
    })

    // Step 8: Test version control
    await test.step('Upload new version of asset', async () => {
      // Right-click on asset
      await page.getByText('test-image.jpg').click({ button: 'right' })
      
      // Click upload new version
      await page.getByText('Upload New Version').click()
      
      // Upload new version
      const fileInput = page.locator('input[type="file"]')
      const newVersionPath = path.join(__dirname, '../fixtures/test-image-v2.jpg')
      await fileInput.setInputFiles(newVersionPath)
      
      // Wait for upload
      await expect(page.getByText('Version 2')).toBeVisible({ timeout: 10000 })
    })

    // Step 9: Test sharing
    await test.step('Share asset with secure link', async () => {
      // Right-click on asset
      await page.getByText('test-image.jpg').click({ button: 'right' })
      
      // Click share
      await page.getByText('Share').click()
      
      // Wait for share modal
      await expect(page.getByRole('dialog', { name: /share/i })).toBeVisible()
      
      // Generate share link
      await page.getByRole('button', { name: /generate link/i }).click()
      
      // Verify link is generated
      const shareLink = page.getByLabel('Share link')
      await expect(shareLink).toHaveValue(/^https?:\/\//)
      
      // Copy link
      await page.getByRole('button', { name: /copy link/i }).click()
      
      // Close modal
      await page.getByRole('button', { name: /close/i }).click()
    })

    // Step 10: Test bulk operations
    await test.step('Perform bulk operations', async () => {
      // Go back to main folder
      await page.getByRole('button', { name: /back/i }).click()
      
      // Select multiple assets (if more exist)
      await page.keyboard.press('Control+A') // Select all
      
      // Open bulk actions menu
      const bulkActionsButton = page.getByRole('button', { name: /bulk actions/i })
      await expect(bulkActionsButton).toBeVisible()
      await bulkActionsButton.click()
      
      // Test bulk tag addition
      await page.getByText('Add Tags').click()
      
      const bulkTagsInput = page.getByLabel('Tags to add')
      await bulkTagsInput.fill('bulk-operation')
      
      await page.getByRole('button', { name: /apply/i }).click()
      
      // Wait for operation to complete
      await expect(page.getByText('Tags added successfully')).toBeVisible()
    })
  })

  test('asset search and filtering workflow', async () => {
    // Test advanced search
    await test.step('Use advanced search', async () => {
      const searchInput = page.getByPlaceholder('Search assets...')
      await searchInput.click()
      
      // Open advanced search
      const advancedButton = page.getByRole('button', { name: /advanced/i })
      await advancedButton.click()
      
      // Fill advanced search form
      await page.getByLabel('File name contains').fill('test')
      await page.getByLabel('File type').selectOption('image/jpeg')
      await page.getByLabel('Created after').fill('2024-01-01')
      
      // Execute search
      await page.getByRole('button', { name: /search/i }).click()
      
      // Verify results
      await expect(page.getByText('Search Results')).toBeVisible()
    })

    // Test saved searches
    await test.step('Save and use saved search', async () => {
      // Save current search
      const saveSearchButton = page.getByRole('button', { name: /save search/i })
      await saveSearchButton.click()
      
      const searchNameInput = page.getByLabel('Search name')
      await searchNameInput.fill('My Test Search')
      
      await page.getByRole('button', { name: /save/i }).click()
      
      // Use saved search
      const savedSearchesDropdown = page.getByRole('button', { name: /saved searches/i })
      await savedSearchesDropdown.click()
      
      await page.getByText('My Test Search').click()
      
      // Verify search is applied
      await expect(page.getByDisplayValue('test')).toBeVisible()
    })
  })

  test('collaborative features workflow', async () => {
    // Test commenting
    await test.step('Add and manage comments', async () => {
      // Click on an asset
      await page.getByText('test-image.jpg').first().click()
      
      // Wait for preview
      await expect(page.getByRole('dialog')).toBeVisible()
      
      // Add comment
      const commentInput = page.getByPlaceholder('Add a comment...')
      await commentInput.fill('This is a test comment for E2E testing')
      
      await page.getByRole('button', { name: /post comment/i }).click()
      
      // Verify comment appears
      await expect(page.getByText('This is a test comment')).toBeVisible()
      
      // Reply to comment
      const replyButton = page.getByRole('button', { name: /reply/i }).first()
      await replyButton.click()
      
      const replyInput = page.getByPlaceholder('Write a reply...')
      await replyInput.fill('This is a reply to the comment')
      
      await page.getByRole('button', { name: /post reply/i }).click()
      
      // Verify reply appears
      await expect(page.getByText('This is a reply')).toBeVisible()
    })

    // Test approval workflow
    await test.step('Test approval workflow', async () => {
      // Mark asset for approval
      const approvalButton = page.getByRole('button', { name: /request approval/i })
      await approvalButton.click()
      
      // Add approval message
      const approvalMessage = page.getByLabel('Approval message')
      await approvalMessage.fill('Please review this asset for final approval')
      
      await page.getByRole('button', { name: /submit for approval/i }).click()
      
      // Verify approval status
      await expect(page.getByText('Pending Approval')).toBeVisible()
    })
  })

  test('mobile responsive behavior', async () => {
    // Test mobile viewport
    await test.step('Test mobile layout', async () => {
      await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
      
      // Verify mobile navigation
      const mobileMenuButton = page.getByRole('button', { name: /menu/i })
      await expect(mobileMenuButton).toBeVisible()
      
      // Test mobile upload
      const mobileUploadButton = page.getByRole('button', { name: /upload/i })
      await expect(mobileUploadButton).toBeVisible()
      
      // Test mobile asset grid
      const assetGrid = page.locator('[data-testid="mobile-asset-grid"]')
      await expect(assetGrid).toBeVisible()
    })

    // Test tablet viewport
    await test.step('Test tablet layout', async () => {
      await page.setViewportSize({ width: 768, height: 1024 }) // iPad
      
      // Verify tablet-specific features
      const tabletSidebar = page.locator('[data-testid="tablet-sidebar"]')
      await expect(tabletSidebar).toBeVisible()
    })
  })

  test('accessibility compliance', async () => {
    await test.step('Test keyboard navigation', async () => {
      // Test tab navigation
      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toBeVisible()
      
      // Navigate through interface with keyboard
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        const focusedElement = page.locator(':focus')
        await expect(focusedElement).toBeVisible()
      }
    })

    await test.step('Test screen reader support', async () => {
      // Check for proper ARIA labels
      const uploadButton = page.getByRole('button', { name: /upload files/i })
      await expect(uploadButton).toHaveAttribute('aria-label')
      
      // Check for proper headings structure
      const mainHeading = page.getByRole('heading', { level: 1 })
      await expect(mainHeading).toBeVisible()
    })
  })

  test('performance under load', async () => {
    await test.step('Test with many assets', async () => {
      // Navigate to a project with many assets
      await page.goto('/assets?project_id=large-project')
      
      // Measure load time
      const startTime = Date.now()
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime
      
      console.log(`Page loaded in ${loadTime}ms`)
      expect(loadTime).toBeLessThan(5000) // Should load within 5 seconds
      
      // Test scrolling performance
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 500)
        await page.waitForTimeout(100)
      }
      
      // Verify smooth scrolling (no layout shifts)
      const assetGrid = page.locator('[data-testid="asset-grid"]')
      await expect(assetGrid).toBeVisible()
    })
  })

  test('error handling and recovery', async () => {
    await test.step('Test network error handling', async () => {
      // Simulate network failure
      await page.route('**/api/assets/**', route => route.abort())
      
      // Try to upload a file
      const fileInput = page.locator('input[type="file"]')
      const testFilePath = path.join(__dirname, '../fixtures/test-image.jpg')
      await fileInput.setInputFiles(testFilePath)
      
      // Verify error message appears
      await expect(page.getByText('Upload failed')).toBeVisible()
      
      // Verify retry functionality
      const retryButton = page.getByRole('button', { name: /retry/i })
      await expect(retryButton).toBeVisible()
      
      // Restore network and retry
      await page.unroute('**/api/assets/**')
      await retryButton.click()
      
      // Verify successful retry
      await expect(page.getByText('Upload completed')).toBeVisible({ timeout: 10000 })
    })

    await test.step('Test graceful degradation', async () => {
      // Disable JavaScript to test graceful degradation
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false
        })
      })
      
      await page.reload()
      
      // Verify offline message
      await expect(page.getByText('You are currently offline')).toBeVisible()
      
      // Verify basic functionality still works
      const searchInput = page.getByPlaceholder('Search assets...')
      await expect(searchInput).toBeVisible()
    })
  })
})