import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CollaborativeComments } from '../CollaborativeComments'
import { useAssetComments } from '@/lib/hooks/useCollaboration'

// Mock the hooks
vi.mock('@/lib/hooks/useCollaboration', () => ({
  useAssetComments: vi.fn()
}))

// Mock the format utilities
vi.mock('@/lib/utils/format', () => ({
  formatTimeAgo: vi.fn((date) => '2 hours ago')
}))

const mockComments = [
  {
    id: 'comment-1',
    asset_id: 'asset-123',
    version_id: null,
    parent_id: null,
    user_id: 'user-123',
    user_name: 'John Doe',
    user_avatar: 'https://example.com/avatar1.jpg',
    content: 'This looks great!',
    pin_x: null,
    pin_y: null,
    pin_timestamp: null,
    resolved: false,
    resolved_by: null,
    resolved_at: null,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    replies: [
      {
        id: 'reply-1',
        asset_id: 'asset-123',
        version_id: null,
        parent_id: 'comment-1',
        user_id: 'user-456',
        user_name: 'Jane Smith',
        user_avatar: null,
        content: 'Thanks!',
        pin_x: null,
        pin_y: null,
        pin_timestamp: null,
        resolved: false,
        resolved_by: null,
        resolved_at: null,
        created_at: '2023-01-01T01:00:00Z',
        updated_at: '2023-01-01T01:00:00Z',
        replies: []
      }
    ]
  },
  {
    id: 'comment-2',
    asset_id: 'asset-123',
    version_id: null,
    parent_id: null,
    user_id: 'user-456',
    user_name: 'Jane Smith',
    user_avatar: null,
    content: 'Could we adjust the colors?',
    pin_x: 50,
    pin_y: 25,
    pin_timestamp: null,
    resolved: true,
    resolved_by: 'user-123',
    resolved_at: '2023-01-01T02:00:00Z',
    created_at: '2023-01-01T00:30:00Z',
    updated_at: '2023-01-01T02:00:00Z',
    replies: []
  }
]

describe('CollaborativeComments', () => {
  const mockUseAssetComments = {
    comments: mockComments,
    loading: false,
    error: null,
    createComment: vi.fn(),
    updateComment: vi.fn(),
    resolveComment: vi.fn(),
    deleteComment: vi.fn(),
    refetch: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAssetComments as any).mockReturnValue(mockUseAssetComments)
  })

  it('should render comments correctly', () => {
    render(<CollaborativeComments assetId="asset-123" />)

    expect(screen.getByText('Add a comment')).toBeInTheDocument()
    expect(screen.getByText('This looks great!')).toBeInTheDocument()
    expect(screen.getByText('Could we adjust the colors?')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    ;(useAssetComments as any).mockReturnValue({
      ...mockUseAssetComments,
      loading: true
    })

    render(<CollaborativeComments assetId="asset-123" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should show error state', () => {
    ;(useAssetComments as any).mockReturnValue({
      ...mockUseAssetComments,
      loading: false,
      error: 'Failed to load comments'
    })

    render(<CollaborativeComments assetId="asset-123" />)

    expect(screen.getByText('Failed to load comments')).toBeInTheDocument()
  })

  it('should handle new comment submission', async () => {
    render(<CollaborativeComments assetId="asset-123" />)

    const textarea = screen.getByPlaceholderText('Share your thoughts...')
    const submitButton = screen.getByText('Post Comment')

    fireEvent.change(textarea, { target: { value: 'New comment' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockUseAssetComments.createComment).toHaveBeenCalledWith({
        content: 'New comment',
        parentId: undefined
      })
    })
  })

  it('should not submit empty comments', () => {
    render(<CollaborativeComments assetId="asset-123" />)

    const submitButton = screen.getByText('Post Comment')
    expect(submitButton).toBeDisabled()
  })

  it('should handle comment editing', async () => {
    render(<CollaborativeComments assetId="asset-123" />)

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    const textarea = screen.getByDisplayValue('This looks great!')
    fireEvent.change(textarea, { target: { value: 'This looks amazing!' } })

    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockUseAssetComments.updateComment).toHaveBeenCalledWith(
        'comment-1',
        'This looks amazing!'
      )
    })
  })

  it('should handle comment resolution', async () => {
    render(<CollaborativeComments assetId="asset-123" />)

    const resolveButtons = screen.getAllByText('Resolve')
    fireEvent.click(resolveButtons[0])

    await waitFor(() => {
      expect(mockUseAssetComments.resolveComment).toHaveBeenCalledWith(
        'comment-1',
        true
      )
    })
  })

  it('should handle comment unresolving', async () => {
    render(<CollaborativeComments assetId="asset-123" />)

    const unresolveButton = screen.getByText('Unresolve')
    fireEvent.click(unresolveButton)

    await waitFor(() => {
      expect(mockUseAssetComments.resolveComment).toHaveBeenCalledWith(
        'comment-2',
        false
      )
    })
  })

  it('should handle comment deletion', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => true)

    render(<CollaborativeComments assetId="asset-123" />)

    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(mockUseAssetComments.deleteComment).toHaveBeenCalledWith('comment-1')
    })

    // Restore original confirm
    window.confirm = originalConfirm
  })

  it('should handle reply creation', async () => {
    render(<CollaborativeComments assetId="asset-123" />)

    const replyButtons = screen.getAllByText('Reply')
    fireEvent.click(replyButtons[0])

    const replyTextarea = screen.getByPlaceholderText('Write a reply...')
    fireEvent.change(replyTextarea, { target: { value: 'Great reply!' } })

    const replySubmitButton = screen.getByText('Reply')
    fireEvent.click(replySubmitButton)

    await waitFor(() => {
      expect(mockUseAssetComments.createComment).toHaveBeenCalledWith({
        content: 'Great reply!',
        parentId: 'comment-1'
      })
    })
  })

  it('should show resolved status correctly', () => {
    render(<CollaborativeComments assetId="asset-123" />)

    expect(screen.getByText('Resolved')).toBeInTheDocument()
  })

  it('should show pinned indicator', () => {
    render(<CollaborativeComments assetId="asset-123" />)

    expect(screen.getByText('📍 Pinned')).toBeInTheDocument()
  })

  it('should display replies correctly', () => {
    render(<CollaborativeComments assetId="asset-123" />)

    expect(screen.getByText('Thanks!')).toBeInTheDocument()
  })

  it('should show empty state when no comments', () => {
    ;(useAssetComments as any).mockReturnValue({
      ...mockUseAssetComments,
      comments: []
    })

    render(<CollaborativeComments assetId="asset-123" />)

    expect(screen.getByText('No comments yet. Be the first to share your thoughts!')).toBeInTheDocument()
  })

  it('should handle cancel editing', () => {
    render(<CollaborativeComments assetId="asset-123" />)

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    expect(screen.queryByDisplayValue('This looks great!')).not.toBeInTheDocument()
  })

  it('should handle cancel reply', () => {
    render(<CollaborativeComments assetId="asset-123" />)

    const replyButtons = screen.getAllByText('Reply')
    fireEvent.click(replyButtons[0])

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    expect(screen.queryByPlaceholderText('Write a reply...')).not.toBeInTheDocument()
  })

  it('should show user avatars correctly', () => {
    render(<CollaborativeComments assetId="asset-123" />)

    const avatar = screen.getByAltText('John Doe')
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar1.jpg')
  })

  it('should show user initials when no avatar', () => {
    render(<CollaborativeComments assetId="asset-123" />)

    expect(screen.getByText('J')).toBeInTheDocument() // Jane Smith's initial
  })
})