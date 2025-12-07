import { test, expect, Page } from '@playwright/test'

test.describe('Asset Collaboration Features', () => {
  let page1: Page
  let page2: Page

  test.beforeEach(async ({ browser }) => {
    // Create two browser contexts to simulate multiple users
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    page1 = await context1.newPage()
    page2 = await context2.newPage()

    // Login both users
    await page1.goto('/login')
    await page1.fill('[data-testid="email"]', 'user1@example.com')
    await page1.fill('[data-testid="password"]', 'password123')
    await page1.click('[data-testid="login-button"]')
    await page1.waitForURL('/dashboard')

    await page2.goto('/login')
    await page2.fill('[data-testid="email"]', 'user2@example.com')
    await page2.fill('[data-testid="password"]', 'password123')
    await page2.click('[data-testid="login-button"]')
    await page2.waitForURL('/dashboard')

    // Navigate to assets page
    await page1.goto('/assets')
    await page2.goto('/assets')
  })

  test('real-time asset updates between users', async () => {
    // User 1 uploads a file
    await page1.click('[data-testid="upload-button"]')
    await page1.setInputFiles('[data-testid="file-input"]', 'tests/fixtures/test-image.jpg')
    await page1.click('[data-testid="confirm-upload"]')

    // Wait for upload to complete
    await page1.waitForSelector('[data-testid="upload-success"]')

    // User 2 should see the new file appear in real-time
    await page2.waitForSelector('[data-testid="asset-item"]', { timeout: 10000 })
    
    const assetItems = await page2.locator('[data-testid="asset-item"]').count()
    expect(assetItems).toBeGreaterThan(0)
  })

  test('collaborative commenting on assets', async () => {
    // Ensure there's an asset to comment on
    await page1.click('[data-testid="upload-button"]')
    await page1.setInputFiles('[data-testid="file-input"]', 'tests/fixtures/test-image.jpg')
    await page1.click('[data-testid="confirm-upload"]')
    await page1.waitForSelector('[data-testid="upload-success"]')

    // User 1 opens asset and adds a comment
    await page1.click('[data-testid="asset-item"]')
    await page1.waitForSelector('[data-testid="asset-preview"]')
    
    await page1.click('[data-testid="comments-tab"]')
    await page1.fill('[data-testid="comment-input"]', 'This looks great! Can we adjust the colors?')
    await page1.click('[data-testid="post-comment"]')

    // User 2 should see the comment in real-time
    await page2.click('[data-testid="asset-item"]')
    await page2.waitForSelector('[data-testid="asset-preview"]')
    await page2.click('[data-testid="comments-tab"]')
    
    await page2.waitForSelector('[data-testid="comment-item"]')
    const commentText = await page2.locator('[data-testid="comment-text"]').textContent()
    expect(commentText).toContain('This looks great!')

    // User 2 replies to the comment
    await page2.click('[data-testid="reply-button"]')
    await page2.fill('[data-testid="reply-input"]', 'Sure! I can make those adjustments.')
    await page2.click('[data-testid="post-reply"]')

    // User 1 should see the reply
    await page1.waitForSelector('[data-testid="comment-reply"]')
    const replyText = await page1.locator('[data-testid="reply-text"]').textContent()
    expect(replyText).toContain('Sure! I can make those adjustments.')
  })

  test('version control and approval workflow', async () => {
    // User 1 uploads initial version
    await page1.click('[data-testid="upload-button"]')
    await page1.setInputFiles('[data-testid="file-input"]', 'tests/fixtures/test-image.jpg')
    await page1.click('[data-testid="confirm-upload"]')
    await page1.waitForSelector('[data-testid="upload-success"]')

    // User 1 opens asset and uploads new version
    await page1.click('[data-testid="asset-item"]')
    await page1.waitForSelector('[data-testid="asset-preview"]')
    
    await page1.click('[data-testid="versions-tab"]')
    await page1.click('[data-testid="upload-new-version"]')
    await page1.setInputFiles('[data-testid="version-file-input"]', 'tests/fixtures/test-image.jpg')
    await page1.fill('[data-testid="version-notes"]', 'Updated colors and composition')
    await page1.click('[data-testid="upload-version"]')

    // Submit for approval
    await page1.click('[data-testid="submit-for-approval"]')
    await page1.waitForSelector('[data-testid="approval-submitted"]')

    // User 2 (approver) should see approval request
    await page2.goto('/assets?filter=pending-approval')
    await page2.waitForSelector('[data-testid="approval-item"]')
    
    await page2.click('[data-testid="approval-item"]')
    await page2.waitForSelector('[data-testid="approval-preview"]')

    // Compare versions
    await page2.click('[data-testid="compare-versions"]')
    await page2.waitForSelector('[data-testid="version-comparison"]')

    // Approve the version
    await page2.click('[data-testid="approve-button"]')
    await page2.fill('[data-testid="approval-notes"]', 'Looks good! Approved.')
    await page2.click('[data-testid="confirm-approval"]')

    // User 1 should see approval notification
    await page1.waitForSelector('[data-testid="approval-notification"]')
    const notificationText = await page1.locator('[data-testid="notification-text"]').textContent()
    expect(notificationText).toContain('approved')
  })

  test('presence indicators show active users', async () => {
    // User 1 opens an asset
    await page1.click('[data-testid="asset-item"]')
    await page1.waitForSelector('[data-testid="asset-preview"]')

    // User 2 opens the same asset
    await page2.click('[data-testid="asset-item"]')
    await page2.waitForSelector('[data-testid="asset-preview"]')

    // Both users should see presence indicators
    await page1.waitForSelector('[data-testid="presence-indicator"]')
    await page2.waitForSelector('[data-testid="presence-indicator"]')

    const presenceCount1 = await page1.locator('[data-testid="presence-indicator"]').count()
    const presenceCount2 = await page2.locator('[data-testid="presence-indicator"]').count()

    expect(presenceCount1).toBeGreaterThan(0)
    expect(presenceCount2).toBeGreaterThan(0)
  })

  test('file locking prevents simultaneous edits', async () => {
    // User 1 starts editing an asset
    await page1.click('[data-testid="asset-item"]')
    await page1.waitForSelector('[data-testid="asset-preview"]')
    await page1.click('[data-testid="edit-button"]')
    await page1.waitForSelector('[data-testid="image-editor"]')

    // User 2 tries to edit the same asset
    await page2.click('[data-testid="asset-item"]')
    await page2.waitForSelector('[data-testid="asset-preview"]')
    
    // Edit button should be disabled or show lock indicator
    const editButton = page2.locator('[data-testid="edit-button"]')
    await expect(editButton).toBeDisabled()
    
    // Should show lock message
    await page2.waitForSelector('[data-testid="file-locked-message"]')
    const lockMessage = await page2.locator('[data-testid="lock-message-text"]').textContent()
    expect(lockMessage).toContain('currently being edited')

    // User 1 finishes editing
    await page1.click('[data-testid="save-changes"]')
    await page1.waitForSelector('[data-testid="changes-saved"]')

    // User 2 should now be able to edit
    await page2.waitForSelector('[data-testid="edit-button"]:not([disabled])')
    await expect(editButton).toBeEnabled()
  })

  test('shared folders and permissions', async () => {
    // User 1 creates a folder and sets permissions
    await page1.click('[data-testid="create-folder"]')
    await page1.fill('[data-testid="folder-name"]', 'Shared Project Assets')
    await page1.click('[data-testid="create-folder-confirm"]')
    
    await page1.click('[data-testid="folder-settings"]')
    await page1.click('[data-testid="permissions-tab"]')
    await page1.fill('[data-testid="add-user-email"]', 'user2@example.com')
    await page1.selectOption('[data-testid="permission-level"]', 'editor')
    await page1.click('[data-testid="add-user"]')

    // User 2 should see the shared folder
    await page2.reload()
    await page2.waitForSelector('[data-testid="folder-item"]')
    
    const folderName = await page2.locator('[data-testid="folder-name"]').textContent()
    expect(folderName).toContain('Shared Project Assets')

    // User 2 should be able to upload to the shared folder
    await page2.click('[data-testid="folder-item"]')
    await page2.click('[data-testid="upload-button"]')
    await page2.setInputFiles('[data-testid="file-input"]', 'tests/fixtures/test-image.jpg')
    await page2.click('[data-testid="confirm-upload"]')
    await page2.waitForSelector('[data-testid="upload-success"]')

    // User 1 should see the new file in the shared folder
    await page1.click('[data-testid="folder-item"]')
    await page1.waitForSelector('[data-testid="asset-item"]')
  })

  test('activity feed shows team actions', async () => {
    // User 1 performs various actions
    await page1.click('[data-testid="upload-button"]')
    await page1.setInputFiles('[data-testid="file-input"]', 'tests/fixtures/test-image.jpg')
    await page1.click('[data-testid="confirm-upload"]')
    await page1.waitForSelector('[data-testid="upload-success"]')

    // User 2 checks activity feed
    await page2.click('[data-testid="activity-feed"]')
    await page2.waitForSelector('[data-testid="activity-item"]')
    
    const activityText = await page2.locator('[data-testid="activity-text"]').first().textContent()
    expect(activityText).toContain('uploaded')
    expect(activityText).toContain('user1@example.com')
  })

  test.afterEach(async () => {
    await page1.close()
    await page2.close()
  })
})