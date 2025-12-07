'use client'

import { useState, useEffect } from 'react'

export interface MobileDetection {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isTouchDevice: boolean
  screenSize: 'sm' | 'md' | 'lg' | 'xl'
  orientation: 'portrait' | 'landscape'
}

export function useMobileDetection(): MobileDetection {
  const [detection, setDetection] = useState<MobileDetection>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    screenSize: 'lg',
    orientation: 'landscape'
  })

  useEffect(() => {
    const updateDetection = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

      // Screen size breakpoints
      let screenSize: 'sm' | 'md' | 'lg' | 'xl' = 'lg'
      if (width < 640) screenSize = 'sm'
      else if (width < 768) screenSize = 'md'
      else if (width < 1024) screenSize = 'lg'
      else screenSize = 'xl'

      // Device type detection
      const isMobile = width < 768
      const isTablet = width >= 768 && width < 1024 && isTouchDevice
      const isDesktop = width >= 1024 || !isTouchDevice

      // Orientation
      const orientation = height > width ? 'portrait' : 'landscape'

      setDetection({
        isMobile,
        isTablet,
        isDesktop,
        isTouchDevice,
        screenSize,
        orientation
      })
    }

    // Initial detection
    updateDetection()

    // Listen for resize events
    window.addEventListener('resize', updateDetection)
    window.addEventListener('orientationchange', updateDetection)

    return () => {
      window.removeEventListener('resize', updateDetection)
      window.removeEventListener('orientationchange', updateDetection)
    }
  }, [])

  return detection
}