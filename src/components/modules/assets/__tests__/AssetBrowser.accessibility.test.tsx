import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'vitest-axe'
import { AssetBrowser } from '../AssetBrowser'
import { 
  expectFocusManagement, 
  expectScreenReaderSupport, 
  simulateKeyboardNavigation 
} from '@/test/accessibility-setup'
import { generateMockAsset } from '@/test/test-utils'

expect.extend(toHaveNoViolations)

// Mock the asset service
vi.mock('@/lib/services/assetManager', () => ({
  AssetManager: {
    getAssets: vi.fn(),
    deleteAsset: vi.fn(),
    moveAsset: vi.fn(),
  },
}))

describe('AssetBrowser - Accessibility Tests', () => {
  const mockAssets = Array.from({ length: 10 }, (_, i) => 
    generateMockAsset({ 
      id: `asset-${i}`, 
      name: `Test Asset ${i}.jpg`,
      file_type: 'image/jpeg'
    })
  )

  const mockProps = {
    projectId: 'project-1',
    assets: mockAssets,
    viewMode: 'grid' as const,
    onAssetSelect: vi.fn(),
    onAssetDelete: vi.fn(),
    onViewModeChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.mockAriaLive.clear()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<AssetBrowser {...mockProps} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('provides proper ARIA labels and roles', () => {
    render(<AssetBrowser {...mockProps} />)
    
    // Main container should have proper role
    const assetGrid = screen.getByRole('grid')
    expect(assetGrid).toBeInTheDocument()
    
    // Asset items should have proper roles
    const assetItems = screen.getAllByRole('gridcell')
    expect(assetItems).toHaveLength(mockAssets.length)
    
    // View mode buttons should have proper labels
    const gridViewButton = screen.getByLabelText('Grid view')
    const listViewButton = screen.getByLabelText('List view')
    expect(gridViewButton).toBeInTheDocument()
    expect(listViewButton).toBeInTheDocument()
  })

  it('supports keyboard navigation', () => {
    render(<AssetBrowser {...mockProps} />)
    
    const firstAsset = screen.getAllByRole('gridcell')[0]
    firstAsset.focus()
    
    expectFocusManagement.toBeFocused(firstAsset)
    
    // Arrow key navigation
    simulateKeyboardNavigation.arrowDown(firstAsset)
    // Should move to next row or next item depending on grid layout
    
    simulateKeyboardNavigation.enter(firstAsset)
    expect(mockProps.onAssetSelect).toHaveBeenCalledWith(mockAssets[0])
  })

  it('provides screen reader announcements for actions', () => {
    render(<AssetBrowser {...mockProps} />)
    
    const firstAsset = screen.getAllByRole('gridcell')[0]
    fireEvent.click(firstAsset)
    
    expectScreenReaderSupport.toHaveAnnounced('Selected Test Asset 0.jpg')
  })

  it('handles bulk selection with keyboard', () => {
    render(<AssetBrowser {...mockProps} />)
    
    const firstAsset = screen.getAllByRole('gridcell')[0]
    const secondAsset = screen.getAllByRole('gridcell')[1]
    
    // Select first asset
    firstAsset.focus()
    simulateKeyboardNavigation.space(firstAsset)
    
    expectScreenReaderSupport.toHaveAnnounced('1 asset selected')
    
    // Extend selection with Shift+Click
    fireEvent.click(secondAsset, { shiftKey: true })
    
    expectScreenReaderSupport.toHaveAnnounced('2 assets selected')
  })

  it('provides accessible context menus', () => {
    render(<AssetBrowser {...mockProps} />)
    
    const firstAsset = screen.getAllByRole('gridcell')[0]
    
    // Right-click to open context menu
    fireEvent.contextMenu(firstAsset)
    
    const contextMenu = screen.getByRole('menu')
    expect(contextMenu).toBeInTheDocument()
    
    // Menu items should be accessible
    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems.length).toBeGreaterThan(0)
    
    // First menu item should be focusable
    expectFocusManagement.toBeFocused(menuItems[0])
    
    // Escape should close menu
    simulateKeyboardNavigation.escape(contextMenu)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('supports drag and drop with keyboard', () => {
    render(<AssetBrowser {...mockProps} />)
    
    const firstAsset = screen.getAllByRole('gridcell')[0]
    firstAsset.focus()
    
    // Activate drag mode with keyboard
    simulateKeyboardNavigation.space(firstAsset)
    fireEvent.keyDown(firstAsset, { key: 'Control', ctrlKey: true })
    
    expectScreenReaderSupport.toHaveAnnounced('Drag mode activated for Test Asset 0.jpg')
    
    // Navigate to drop target
    const dropZone = screen.getByLabelText('Drop zone')
    dropZone.focus()
    
    // Complete drop
    simulateKeyboardNavigation.enter(dropZone)
    
    expectScreenReaderSupport.toHaveAnnounced('Asset moved successfully')
  })

  it('provides accessible loading states', () => {
    const loadingProps = { ...mockProps, assets: [], loading: true }
    render(<AssetBrowser {...loadingProps} />)
    
    const loadingIndicator = screen.getByRole('status')
    expect(loadingIndicator).toBeInTheDocument()
    expectScreenReaderSupport.toHaveAriaLabel(loadingIndicator, 'Loading assets')
  })

  it('handles empty states accessibly', () => {
    const emptyProps = { ...mockProps, assets: [] }
    render(<AssetBrowser {...emptyProps} />)
    
    const emptyMessage = screen.getByText(/no assets found/i)
    expect(emptyMessage).toBeInTheDocument()
    
    // Should announce empty state to screen readers
    expectScreenReaderSupport.toHaveAnnounced('No assets found')
  })

  it('provides accessible error states', () => {
    const errorProps = { ...mockProps, error: 'Failed to load assets' }
    render(<AssetBrowser {...errorProps} />)
    
    const errorMessage = screen.getByRole('alert')
    expect(errorMessage).toBeInTheDocument()
    expect(errorMessage).toHaveTextContent('Failed to load assets')
  })

  it('supports high contrast mode', () => {
    // Mock high contrast media query
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const { container } = render(<AssetBrowser {...mockProps} />)
    
    // Should apply high contrast styles
    const assetGrid = container.querySelector('[data-high-contrast="true"]')
    expect(assetGrid).toBeInTheDocument()
  })

  it('provides accessible tooltips and help text', () => {
    render(<AssetBrowser {...mockProps} />)
    
    const helpButton = screen.getByLabelText('Help')
    fireEvent.focus(helpButton)
    
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    
    expectScreenReaderSupport.toHaveAriaDescribedBy(helpButton)
  })

  it('handles reduced motion preferences', () => {
    // Mock reduced motion preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const { container } = render(<AssetBrowser {...mockProps} />)
    
    // Should disable animations
    const animatedElements = container.querySelectorAll('[data-animation="disabled"]')
    expect(animatedElements.length).toBeGreaterThan(0)
  })

  it('provides accessible pagination', () => {
    const paginatedProps = { 
      ...mockProps, 
      totalAssets: 100,
      currentPage: 1,
      pageSize: 10,
      onPageChange: vi.fn()
    }
    
    render(<AssetBrowser {...paginatedProps} />)
    
    const pagination = screen.getByRole('navigation', { name: 'Asset pagination' })
    expect(pagination).toBeInTheDocument()
    
    const pageButtons = screen.getAllByRole('button', { name: /page \d+/i })
    expect(pageButtons.length).toBeGreaterThan(0)
    
    // Current page should be marked as current
    const currentPage = screen.getByRole('button', { name: 'page 1', current: true })
    expect(currentPage).toBeInTheDocument()
  })

  it('supports voice control commands', () => {
    render(<AssetBrowser {...mockProps} />)
    
    // Simulate voice command "select all"
    fireEvent.keyDown(document.body, { 
      key: 'a', 
      ctrlKey: true,
      code: 'KeyA'
    })
    
    expectScreenReaderSupport.toHaveAnnounced(`All ${mockAssets.length} assets selected`)
    
    // Simulate voice command "delete selected"
    fireEvent.keyDown(document.body, { 
      key: 'Delete',
      code: 'Delete'
    })
    
    // Should show confirmation dialog
    const confirmDialog = screen.getByRole('dialog')
    expect(confirmDialog).toBeInTheDocument()
    expectFocusManagement.toHaveFocusWithin(confirmDialog)
  })

  it('provides accessible search and filter controls', () => {
    render(<AssetBrowser {...mockProps} />)
    
    const searchInput = screen.getByRole('searchbox', { name: 'Search assets' })
    expect(searchInput).toBeInTheDocument()
    
    const filterButton = screen.getByRole('button', { name: 'Filter assets' })
    fireEvent.click(filterButton)
    
    const filterPanel = screen.getByRole('region', { name: 'Asset filters' })
    expect(filterPanel).toBeInTheDocument()
    
    // Filter controls should be properly labeled
    const fileTypeFilter = screen.getByRole('group', { name: 'File type' })
    expect(fileTypeFilter).toBeInTheDocument()
  })
})