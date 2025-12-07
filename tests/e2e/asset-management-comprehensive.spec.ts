import { test, expect, Page } from '@playwright/test'
import path from 'path'

test.describe('Comprehensive Asset Management E2E Tests', () => {
  let page: Page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    
    // Navigate to assets page and wait for load
    await page.goto('/assets')
    await page.waitForLoadState('networkidle')
    
    // Ensure user is authenticated (mock or real auth)
    await page.evaluate(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user', email: 'test@example.com' }
      }))
    })
  })

  test.describe('Upload Workflows', () => {
    test('should complete full upload workflow with metadata', async () => {
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      
      // Step 1: Upload file
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testImagePath)
      
      // Step 2: Verify upload progress
      await expect(page.getByRole('progressbar')).toBeVisible()
      await expect(page.getByText(/uploading.*test-image\.jpg/i)).toBeVisible()
      
      // Step 3: Wait for completion
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
      
      // Step 4: Verify asset appears in grid
      const assetCard = page.getByTestId('asset-card').filter({ hasText: 'test-image.jpg' })
      await expect(assetCard).toBeVisible()
      
      // Step 5: Verify thumbnail generation
      const thumbnail = assetCard.getByRole('img', { name: /thumbnail/i })
      await expect(thumbnail).toBeVisible()
      await expect(thumbnail).toHaveAttribute('src', /thumb/)
      
      // Step 6: Open asset details
      await assetCard.click()
      
      // Step 7: Verify metadata display
      const metadataPanel = page.getByTestId('asset-metadata')
      await expect(metadataPanel).toBeVisible()
      await expect(metadataPanel).toContainText('File Size:')
      await expect(metadataPanel).toContainText('Dimensions:')
      await expect(metadataPanel).toContainText('Upload Date:')
    })

    test('should handle batch upload with mixed file types', async () => {
      const testFiles = [
        path.join(__dirname, '../fixtures/test-image-1.jpg'),
        path.join(__dirname, '../fixtures/test-image-2.png'),
        path.join(__dirname, '../fixtures/test-document.pdf'),
        path.join(__dirname, '../fixtures/test-video.mp4'),
      ]
      
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testFiles)
      
      // Verify batch upload UI
      await expect(page.getByText(/uploading 4 files/i)).toBeVisible()
      
      // Verify individual progress indicators
      for (const fileName of ['test-image-1.jpg', 'test-image-2.png', 'test-document.pdf', 'test-video.mp4']) {
        await expect(page.getByText(fileName)).toBeVisible()
      }
      
      // Wait for all uploads to complete
      await expect(page.getByText('All uploads completed')).toBeVisible({ timeout: 30000 })
      
      // Verify all assets appear in grid
      for (const fileName of ['test-image-1.jpg', 'test-image-2.png', 'test-document.pdf', 'test-video.mp4']) {
        await expect(page.getByText(fileName)).toBeVisible()
      }
    })

    test('should handle upload errors and retry functionality', async () => {
      // Mock network failure
      await page.route('**/api/assets/upload', route => {
        route.abort('failed')
      })
      
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      
      await uploadZone.setInputFiles(testImagePath)
      
      // Verify error handling
      await expect(page.getByText(/upload failed.*network error/i)).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('button', { name: /retry/i })).toBeVisible()
      
      // Remove network mock and retry
      await page.unroute('**/api/assets/upload')
      
      const retryButton = page.getByRole('button', { name: /retry/i })
      await retryButton.click()
      
      // Verify successful retry
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
    })

    test('should validate file types and show appropriate errors', async () => {
      const invalidFilePath = path.join(__dirname, '../fixtures/malware.exe')
      
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(invalidFilePath)
      
      // Verify validation error
      await expect(page.getByText(/file type not allowed/i)).toBeVisible()
      await expect(page.getByRole('alert')).toContainText(/security/i)
      
      // Verify file is not uploaded
      await expect(page.getByText('malware.exe')).not.toBeVisible()
    })
  })

  test.describe('Asset Browser and Navigation', () => {
    test.beforeEach(async () => {
      // Upload test assets for browsing tests
      const testFiles = [
        path.join(__dirname, '../fixtures/test-image-1.jpg'),
        path.join(__dirname, '../fixtures/test-image-2.png'),
        path.join(__dirname, '../fixtures/test-document.pdf'),
      ]
      
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testFiles)
      await expect(page.getByText('All uploads completed')).toBeVisible({ timeout: 20000 })
    })

    test('should switch between view modes', async () => {
      // Test grid view (default)
      const gridView = page.getByTestId('asset-grid')
      await expect(gridView).toBeVisible()
      
      // Switch to list view
      const listViewButton = page.getByRole('button', { name: /list view/i })
      await listViewButton.click()
      
      const listView = page.getByTestId('asset-list')
      await expect(listView).toBeVisible()
      await expect(gridView).not.toBeVisible()
      
      // Switch to timeline view
      const timelineViewButton = page.getByRole('button', { name: /timeline view/i })
      await timelineViewButton.click()
      
      const timelineView = page.getByTestId('asset-timeline')
      await expect(timelineView).toBeVisible()
      await expect(listView).not.toBeVisible()
    })

    test('should filter assets by type and other criteria', async () => {
      // Open filters panel
      const filtersButton = page.getByRole('button', { name: /filters/i })
      await filtersButton.click()
      
      const filtersPanel = page.getByTestId('filters-panel')
      await expect(filtersPanel).toBeVisible()
      
      // Filter by image type
      const imageFilter = page.getByRole('checkbox', { name: /images/i })
      await imageFilter.check()
      
      const applyButton = page.getByRole('button', { name: /apply filters/i })
      await applyButton.click()
      
      // Verify only images are shown
      await expect(page.getByText('test-image-1.jpg')).toBeVisible()
      await expect(page.getByText('test-image-2.png')).toBeVisible()
      await expect(page.getByText('test-document.pdf')).not.toBeVisible()
      
      // Clear filters
      const clearButton = page.getByRole('button', { name: /clear filters/i })
      await clearButton.click()
      
      // Verify all assets are shown again
      await expect(page.getByText('test-document.pdf')).toBeVisible()
    })

    test('should search assets with real-time results', async () => {
      const searchInput = page.getByRole('searchbox', { name: /search assets/i })
      
      // Type search query
      await searchInput.fill('test-image')
      
      // Verify real-time filtering
      await expect(page.getByText('test-image-1.jpg')).toBeVisible()
      await expect(page.getByText('test-image-2.png')).toBeVisible()
      await expect(page.getByText('test-document.pdf')).not.toBeVisible()
      
      // Clear search
      await searchInput.clear()
      
      // Verify all assets are shown
      await expect(page.getByText('test-document.pdf')).toBeVisible()
    })

    test('should sort assets by different criteria', async () => {
      const sortSelect = page.getByRole('combobox', { name: /sort by/i })
      
      // Sort by name
      await sortSelect.selectOption('name')
      
      // Verify sorting order
      const assetCards = page.getByTestId('asset-card')
      const firstCard = assetCards.first()
      const lastCard = assetCards.last()
      
      await expect(firstCard).toContainText('test-document.pdf') // Alphabetically first
      
      // Sort by date (newest first)
      await sortSelect.selectOption('created_at')
      
      const sortOrderButton = page.getByRole('button', { name: /sort order/i })
      await sortOrderButton.click() // Toggle to newest first
      
      // Verify newest assets appear first
      await expect(firstCard).not.toContainText('test-document.pdf')
    })
  })

  test.describe('Asset Preview and Interaction', () => {
    test.beforeEach(async () => {
      // Upload test assets
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testImagePath)
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
    })

    test('should open asset preview with full functionality', async () => {
      const assetCard = page.getByTestId('asset-card').first()
      await assetCard.click()
      
      // Verify preview modal opens
      const previewModal = page.getByRole('dialog', { name: /asset preview/i })
      await expect(previewModal).toBeVisible()
      
      // Verify image is displayed
      const previewImage = page.getByTestId('preview-image')
      await expect(previewImage).toBeVisible()
      
      // Test zoom functionality
      const zoomInButton = page.getByRole('button', { name: /zoom in/i })
      await zoomInButton.click()
      
      // Verify zoom level changed
      await expect(previewImage).toHaveCSS('transform', /scale\(1\.[5-9]/)
      
      // Test pan functionality
      await previewImage.hover()
      await page.mouse.down()
      await page.mouse.move(100, 100)
      await page.mouse.up()
      
      // Verify image position changed
      await expect(previewImage).toHaveCSS('transform', /translate/)
      
      // Reset zoom
      const resetButton = page.getByRole('button', { name: /reset zoom/i })
      await resetButton.click()
      
      await expect(previewImage).toHaveCSS('transform', /scale\(1\)/)
    })

    test('should display and edit asset metadata', async () => {
      const assetCard = page.getByTestId('asset-card').first()
      await assetCard.click()
      
      const previewModal = page.getByRole('dialog', { name: /asset preview/i })
      await expect(previewModal).toBeVisible()
      
      // Open metadata tab
      const metadataTab = page.getByRole('tab', { name: /metadata/i })
      await metadataTab.click()
      
      const metadataPanel = page.getByTestId('metadata-panel')
      await expect(metadataPanel).toBeVisible()
      
      // Edit asset name
      const nameField = page.getByRole('textbox', { name: /asset name/i })
      await nameField.clear()
      await nameField.fill('Updated Asset Name')
      
      // Edit description
      const descriptionField = page.getByRole('textbox', { name: /description/i })
      await descriptionField.fill('Updated description for this asset')
      
      // Add tags
      const tagsInput = page.getByRole('textbox', { name: /tags/i })
      await tagsInput.fill('design, final, approved')
      
      // Save changes
      const saveButton = page.getByRole('button', { name: /save changes/i })
      await saveButton.click()
      
      // Verify success message
      await expect(page.getByText('Asset updated successfully')).toBeVisible()
      
      // Close and reopen to verify persistence
      const closeButton = page.getByRole('button', { name: /close/i })
      await closeButton.click()
      
      await assetCard.click()
      await metadataTab.click()
      
      await expect(nameField).toHaveValue('Updated Asset Name')
      await expect(descriptionField).toHaveValue('Updated description for this asset')
    })

    test('should handle different file type previews', async () => {
      // Upload different file types
      const testFiles = [
        path.join(__dirname, '../fixtures/test-document.pdf'),
        path.join(__dirname, '../fixtures/test-video.mp4'),
      ]
      
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testFiles)
      await expect(page.getByText('All uploads completed')).toBeVisible({ timeout: 20000 })
      
      // Test PDF preview
      const pdfCard = page.getByTestId('asset-card').filter({ hasText: 'test-document.pdf' })
      await pdfCard.click()
      
      const pdfViewer = page.getByTestId('pdf-viewer')
      await expect(pdfViewer).toBeVisible()
      
      // Test page navigation
      const nextPageButton = page.getByRole('button', { name: /next page/i })
      if (await nextPageButton.isVisible()) {
        await nextPageButton.click()
        await expect(page.getByText(/page 2/i)).toBeVisible()
      }
      
      await page.getByRole('button', { name: /close/i }).click()
      
      // Test video preview
      const videoCard = page.getByTestId('asset-card').filter({ hasText: 'test-video.mp4' })
      await videoCard.click()
      
      const videoPlayer = page.getByTestId('video-player')
      await expect(videoPlayer).toBeVisible()
      
      // Test video controls
      const playButton = page.getByRole('button', { name: /play/i })
      await playButton.click()
      
      // Verify video is playing
      await expect(page.getByRole('button', { name: /pause/i })).toBeVisible()
    })
  })

  test.describe('Folder Management', () => {
    test('should create and manage folder structure', async () => {
      // Create new folder
      const createFolderButton = page.getByRole('button', { name: /create folder/i })
      await createFolderButton.click()
      
      const folderModal = page.getByRole('dialog', { name: /create folder/i })
      await expect(folderModal).toBeVisible()
      
      const folderNameInput = page.getByRole('textbox', { name: /folder name/i })
      await folderNameInput.fill('Design Assets')
      
      const createButton = page.getByRole('button', { name: /create/i })
      await createButton.click()
      
      // Verify folder appears in sidebar
      const folderItem = page.getByTestId('folder-item').filter({ hasText: 'Design Assets' })
      await expect(folderItem).toBeVisible()
      
      // Navigate into folder
      await folderItem.click()
      
      // Verify breadcrumb navigation
      const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i })
      await expect(breadcrumb).toContainText('Design Assets')
      
      // Upload file to folder
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testImagePath)
      
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
      
      // Verify file is in folder
      await expect(page.getByText('test-image.jpg')).toBeVisible()
      
      // Navigate back to root
      const rootBreadcrumb = page.getByRole('link', { name: /assets/i }).first()
      await rootBreadcrumb.click()
      
      // Verify we're back at root (folder should be visible but not the file)
      await expect(folderItem).toBeVisible()
      await expect(page.getByText('test-image.jpg')).not.toBeVisible()
    })

    test('should move assets between folders', async () => {
      // Create two folders
      const createFolderButton = page.getByRole('button', { name: /create folder/i })
      
      await createFolderButton.click()
      await page.getByRole('textbox', { name: /folder name/i }).fill('Folder A')
      await page.getByRole('button', { name: /create/i }).click()
      
      await createFolderButton.click()
      await page.getByRole('textbox', { name: /folder name/i }).fill('Folder B')
      await page.getByRole('button', { name: /create/i }).click()
      
      // Upload asset to Folder A
      const folderA = page.getByTestId('folder-item').filter({ hasText: 'Folder A' })
      await folderA.click()
      
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testImagePath)
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
      
      // Select asset and move to Folder B
      const assetCard = page.getByTestId('asset-card').first()
      await assetCard.click({ button: 'right' }) // Right-click for context menu
      
      const moveOption = page.getByRole('menuitem', { name: /move to/i })
      await moveOption.click()
      
      const moveModal = page.getByRole('dialog', { name: /move asset/i })
      await expect(moveModal).toBeVisible()
      
      const folderBOption = page.getByRole('option', { name: 'Folder B' })
      await folderBOption.click()
      
      const moveButton = page.getByRole('button', { name: /move/i })
      await moveButton.click()
      
      // Verify asset is no longer in Folder A
      await expect(page.getByText('test-image.jpg')).not.toBeVisible()
      
      // Navigate to Folder B and verify asset is there
      await page.getByRole('link', { name: /assets/i }).first().click()
      const folderB = page.getByTestId('folder-item').filter({ hasText: 'Folder B' })
      await folderB.click()
      
      await expect(page.getByText('test-image.jpg')).toBeVisible()
    })
  })

  test.describe('Collaboration Features', () => {
    test('should add and manage comments on assets', async () => {
      // Upload test asset
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testImagePath)
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
      
      // Open asset preview
      const assetCard = page.getByTestId('asset-card').first()
      await assetCard.click()
      
      // Navigate to comments tab
      const commentsTab = page.getByRole('tab', { name: /comments/i })
      await commentsTab.click()
      
      const commentsPanel = page.getByTestId('comments-panel')
      await expect(commentsPanel).toBeVisible()
      
      // Add a comment
      const commentInput = page.getByRole('textbox', { name: /add comment/i })
      await commentInput.fill('This looks great! Can we adjust the colors slightly?')
      
      const submitButton = page.getByRole('button', { name: /post comment/i })
      await submitButton.click()
      
      // Verify comment appears
      const comment = page.getByTestId('comment').filter({ hasText: 'This looks great!' })
      await expect(comment).toBeVisible()
      
      // Reply to comment
      const replyButton = comment.getByRole('button', { name: /reply/i })
      await replyButton.click()
      
      const replyInput = page.getByRole('textbox', { name: /reply/i })
      await replyInput.fill('Sure, I can make those adjustments.')
      
      const submitReplyButton = page.getByRole('button', { name: /post reply/i })
      await submitReplyButton.click()
      
      // Verify reply appears
      const reply = page.getByTestId('comment-reply').filter({ hasText: 'Sure, I can make' })
      await expect(reply).toBeVisible()
    })

    test('should handle asset approval workflow', async () => {
      // Upload test asset
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testImagePath)
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
      
      // Open asset preview
      const assetCard = page.getByTestId('asset-card').first()
      await assetCard.click()
      
      // Navigate to approval tab
      const approvalTab = page.getByRole('tab', { name: /approval/i })
      await approvalTab.click()
      
      const approvalPanel = page.getByTestId('approval-panel')
      await expect(approvalPanel).toBeVisible()
      
      // Submit for approval
      const submitForApprovalButton = page.getByRole('button', { name: /submit for approval/i })
      await submitForApprovalButton.click()
      
      // Verify status change
      await expect(page.getByText('Pending Approval')).toBeVisible()
      
      // Approve asset (as approver)
      const approveButton = page.getByRole('button', { name: /approve/i })
      await approveButton.click()
      
      const approvalComments = page.getByRole('textbox', { name: /approval comments/i })
      await approvalComments.fill('Approved - looks perfect!')
      
      const confirmApprovalButton = page.getByRole('button', { name: /confirm approval/i })
      await confirmApprovalButton.click()
      
      // Verify approval status
      await expect(page.getByText('Approved')).toBeVisible()
      await expect(page.getByText('Approved - looks perfect!')).toBeVisible()
    })
  })

  test.describe('Performance and Accessibility', () => {
    test('should load large asset libraries efficiently', async () => {
      // Upload many assets to test performance
      const testFiles = Array.from({ length: 20 }, (_, i) => 
        path.join(__dirname, `../fixtures/test-image-${i % 3 + 1}.jpg`)
      )
      
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      
      const startTime = Date.now()
      
      // Upload in batches to avoid overwhelming the system
      for (let i = 0; i < testFiles.length; i += 5) {
        const batch = testFiles.slice(i, i + 5)
        await uploadZone.setInputFiles(batch)
        await expect(page.getByText('All uploads completed')).toBeVisible({ timeout: 30000 })
      }
      
      const uploadTime = Date.now() - startTime
      
      // Verify all assets are visible
      const assetCards = page.getByTestId('asset-card')
      await expect(assetCards).toHaveCount(20)
      
      // Test scrolling performance
      const scrollStartTime = Date.now()
      
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 500)
        await page.waitForTimeout(100)
      }
      
      const scrollTime = Date.now() - scrollStartTime
      
      // Performance assertions
      expect(uploadTime).toBeLessThan(120000) // 2 minutes for 20 files
      expect(scrollTime).toBeLessThan(5000) // 5 seconds for scrolling
    })

    test('should be fully accessible with keyboard navigation', async () => {
      // Upload test asset
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testImagePath)
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
      
      // Test keyboard navigation
      await page.keyboard.press('Tab') // Focus first interactive element
      
      // Navigate to asset card
      let focusedElement = page.locator(':focus')
      while (!(await focusedElement.getAttribute('data-testid'))?.includes('asset-card')) {
        await page.keyboard.press('Tab')
        focusedElement = page.locator(':focus')
      }
      
      // Open asset with Enter key
      await page.keyboard.press('Enter')
      
      const previewModal = page.getByRole('dialog', { name: /asset preview/i })
      await expect(previewModal).toBeVisible()
      
      // Navigate within modal using Tab
      await page.keyboard.press('Tab')
      focusedElement = page.locator(':focus')
      
      // Should be able to reach all interactive elements
      const interactiveElements = [
        'button[aria-label*="zoom"]',
        'button[aria-label*="close"]',
        'tab[role="tab"]',
      ]
      
      for (const selector of interactiveElements) {
        const element = page.locator(selector).first()
        if (await element.isVisible()) {
          // Navigate to element
          while (!(await focusedElement.evaluate((el, sel) => 
            el.matches(sel), selector))) {
            await page.keyboard.press('Tab')
            focusedElement = page.locator(':focus')
          }
          
          // Verify element is focusable
          await expect(focusedElement).toBeFocused()
        }
      }
      
      // Close modal with Escape
      await page.keyboard.press('Escape')
      await expect(previewModal).not.toBeVisible()
    })

    test('should provide proper screen reader support', async () => {
      // Upload test asset
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      const uploadZone = page.getByRole('button', { name: /drag.*drop.*upload/i })
      await uploadZone.setInputFiles(testImagePath)
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
      
      // Check for proper ARIA labels and roles
      const assetCard = page.getByTestId('asset-card').first()
      
      // Verify asset card has proper accessibility attributes
      await expect(assetCard).toHaveAttribute('role', 'button')
      await expect(assetCard).toHaveAttribute('aria-label')
      
      // Check for status announcements
      const statusRegion = page.getByRole('status')
      await expect(statusRegion).toBeVisible()
      
      // Open asset preview
      await assetCard.click()
      
      const previewModal = page.getByRole('dialog', { name: /asset preview/i })
      await expect(previewModal).toBeVisible()
      
      // Verify modal has proper accessibility
      await expect(previewModal).toHaveAttribute('aria-modal', 'true')
      await expect(previewModal).toHaveAttribute('aria-labelledby')
      
      // Check for proper heading structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6')
      const headingCount = await headings.count()
      expect(headingCount).toBeGreaterThan(0)
      
      // Verify images have alt text
      const images = page.locator('img')
      const imageCount = await images.count()
      
      for (let i = 0; i < imageCount; i++) {
        const image = images.nth(i)
        if (await image.isVisible()) {
          await expect(image).toHaveAttribute('alt')
        }
      }
    })
  })

  test.describe('Mobile Responsiveness', () => {
    test('should work properly on mobile devices', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Verify mobile layout
      const mobileNav = page.getByTestId('mobile-navigation')
      await expect(mobileNav).toBeVisible()
      
      // Test mobile upload interface
      const mobileUploadButton = page.getByRole('button', { name: /upload/i })
      await expect(mobileUploadButton).toBeVisible()
      
      // Upload file on mobile
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg')
      await mobileUploadButton.click()
      
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(testImagePath)
      
      await expect(page.getByText('Upload completed successfully')).toBeVisible({ timeout: 15000 })
      
      // Test mobile asset grid
      const assetGrid = page.getByTestId('mobile-asset-grid')
      await expect(assetGrid).toBeVisible()
      
      // Test touch interactions
      const assetCard = page.getByTestId('asset-card').first()
      
      // Tap to open
      await assetCard.tap()
      
      const mobilePreview = page.getByTestId('mobile-asset-preview')
      await expect(mobilePreview).toBeVisible()
      
      // Test swipe gestures (simulate touch events)
      await page.touchscreen.tap(200, 300)
      await page.touchscreen.tap(100, 300) // Swipe left
      
      // Verify gesture handling
      await expect(page.getByText(/swipe/i)).toBeVisible()
    })
  })
})