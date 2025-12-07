import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UploadNotification, NotificationManager, useNotifications } from '../UploadNotification'
import { renderHook, act } from '@testing-library/react'

// Mock timers
vi.useFakeTimers()

describe('UploadNotification', () => {
  const mockOnClose = vi.fn()
  
  const defaultProps = {
    id: 'notification-1',
    type: 'success' as const,
    title: 'Upload Complete',
    message: 'File uploaded successfully',
    onClose: mockOnClose
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders notification with correct content', () => {
    render(<UploadNotification {...defaultProps} />)
    
    expect(screen.getByText('Upload Complete')).toBeInTheDocument()
    expect(screen.getByText('File uploaded successfully')).toBeInTheDocument()
  })

  it('renders without message', () => {
    render(<UploadNotification {...defaultProps} message={undefined} />)
    
    expect(screen.getByText('Upload Complete')).toBeInTheDocument()
    expect(screen.queryByText('File uploaded successfully')).not.toBeInTheDocument()
  })

  it('displays correct icon for success type', () => {
    render(<UploadNotification {...defaultProps} type="success" />)
    
    expect(screen.getByText('check_circle')).toBeInTheDocument()
  })

  it('displays correct icon for error type', () => {
    render(<UploadNotification {...defaultProps} type="error" />)
    
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('displays correct icon for warning type', () => {
    render(<UploadNotification {...defaultProps} type="warning" />)
    
    expect(screen.getByText('warning')).toBeInTheDocument()
  })

  it('displays correct icon for info type', () => {
    render(<UploadNotification {...defaultProps} type="info" />)
    
    expect(screen.getByText('info')).toBeInTheDocument()
  })

  it('applies correct styling for success type', () => {
    render(<UploadNotification {...defaultProps} type="success" />)
    
    const container = screen.getByText('Upload Complete').closest('div')
    expect(container).toHaveClass('bg-green-50', 'dark:bg-green-900/20')
  })

  it('applies correct styling for error type', () => {
    render(<UploadNotification {...defaultProps} type="error" />)
    
    const container = screen.getByText('Upload Complete').closest('div')
    expect(container).toHaveClass('bg-red-50', 'dark:bg-red-900/20')
  })

  it('calls onClose when close button is clicked', () => {
    render(<UploadNotification {...defaultProps} />)
    
    const closeButton = screen.getByText('close')
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalledWith('notification-1')
  })

  it('auto-closes after duration', async () => {
    render(<UploadNotification {...defaultProps} duration={1000} />)
    
    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith('notification-1')
    })
  })

  it('animates in and out correctly', async () => {
    const { container } = render(<UploadNotification {...defaultProps} />)
    
    // Initially should be translated out
    const notification = container.firstChild as HTMLElement
    expect(notification).toHaveClass('translate-x-full', 'opacity-0')
    
    // Should animate in after a short delay
    act(() => {
      vi.advanceTimersByTime(20)
    })
    
    await waitFor(() => {
      expect(notification).toHaveClass('translate-x-0', 'opacity-100')
    })
  })
})

describe('NotificationManager', () => {
  const mockOnRemove = vi.fn()
  
  const notifications = [
    {
      id: 'notification-1',
      type: 'success' as const,
      title: 'Success',
      onClose: mockOnRemove
    },
    {
      id: 'notification-2',
      type: 'error' as const,
      title: 'Error',
      onClose: mockOnRemove
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders multiple notifications', () => {
    render(<NotificationManager notifications={notifications} onRemove={mockOnRemove} />)
    
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('renders empty when no notifications', () => {
    const { container } = render(<NotificationManager notifications={[]} onRemove={mockOnRemove} />)
    
    expect(container.firstChild?.childNodes).toHaveLength(0)
  })

  it('passes correct props to notifications', () => {
    render(<NotificationManager notifications={notifications} onRemove={mockOnRemove} />)
    
    // Check that both notifications are rendered with correct content
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })
})

describe('useNotifications hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with empty notifications array', () => {
    const { result } = renderHook(() => useNotifications())
    
    expect(result.current.notifications).toEqual([])
  })

  it('adds notification', () => {
    const { result } = renderHook(() => useNotifications())
    
    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Test Notification'
      })
    })
    
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0].title).toBe('Test Notification')
    expect(result.current.notifications[0].type).toBe('success')
    expect(result.current.notifications[0].id).toBeDefined()
  })

  it('removes notification', () => {
    const { result } = renderHook(() => useNotifications())
    
    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Test Notification'
      })
    })
    
    const notificationId = result.current.notifications[0].id
    
    act(() => {
      result.current.removeNotification(notificationId)
    })
    
    expect(result.current.notifications).toHaveLength(0)
  })

  it('clears all notifications', () => {
    const { result } = renderHook(() => useNotifications())
    
    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Test 1'
      })
      result.current.addNotification({
        type: 'error',
        title: 'Test 2'
      })
    })
    
    expect(result.current.notifications).toHaveLength(2)
    
    act(() => {
      result.current.clearAll()
    })
    
    expect(result.current.notifications).toHaveLength(0)
  })

  it('generates unique IDs for notifications', () => {
    const { result } = renderHook(() => useNotifications())
    
    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Test 1'
      })
      result.current.addNotification({
        type: 'success',
        title: 'Test 2'
      })
    })
    
    const ids = result.current.notifications.map(n => n.id)
    expect(ids[0]).not.toBe(ids[1])
  })
})