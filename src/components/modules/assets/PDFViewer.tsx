'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  Download,
  Search,
  FileText,
  Maximize,
  Minimize
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface PDFViewerProps {
  fileUrl: string
  fileName: string
  onClose?: () => void
  className?: string
}

interface PDFState {
  currentPage: number
  totalPages: number
  zoom: number
  rotation: number
  isFullscreen: boolean
  searchTerm: string
  searchResults: number[]
  currentSearchIndex: number
}

export function PDFViewer({
  fileUrl,
  fileName,
  onClose,
  className = ''
}: PDFViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [pdfState, setPdfState] = useState<PDFState>({
    currentPage: 1,
    totalPages: 1,
    zoom: 100,
    rotation: 0,
    isFullscreen: false,
    searchTerm: '',
    searchResults: [],
    currentSearchIndex: 0
  })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // PDF.js integration would go here in a real implementation
  // For now, we'll use a basic iframe with enhanced controls
  
  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setLoading(false)
      // In a real implementation, we'd get the page count from PDF.js
      setPdfState(prev => ({ ...prev, totalPages: 10 })) // Mock value
    }, 1000)

    return () => clearTimeout(timer)
  }, [fileUrl])

  const handlePageChange = (direction: 'prev' | 'next') => {
    setPdfState(prev => ({
      ...prev,
      currentPage: direction === 'next' 
        ? Math.min(prev.currentPage + 1, prev.totalPages)
        : Math.max(prev.currentPage - 1, 1)
    }))
  }

  const handleZoom = (direction: 'in' | 'out') => {
    setPdfState(prev => ({
      ...prev,
      zoom: direction === 'in' 
        ? Math.min(prev.zoom * 1.2, 300)
        : Math.max(prev.zoom / 1.2, 25)
    }))
  }

  const handleRotate = () => {
    setPdfState(prev => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360
    }))
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setPdfState(prev => ({ ...prev, isFullscreen: true }))
    } else {
      document.exitFullscreen()
      setPdfState(prev => ({ ...prev, isFullscreen: false }))
    }
  }

  const handleSearch = (term: string) => {
    setPdfState(prev => ({ ...prev, searchTerm: term }))
    // In a real implementation, this would search through the PDF content
    // For now, we'll simulate some search results
    if (term.length > 2) {
      setPdfState(prev => ({ 
        ...prev, 
        searchResults: [1, 3, 5, 7], // Mock search results
        currentSearchIndex: 0
      }))
    } else {
      setPdfState(prev => ({ 
        ...prev, 
        searchResults: [],
        currentSearchIndex: 0
      }))
    }
  }

  const navigateSearchResults = (direction: 'prev' | 'next') => {
    if (pdfState.searchResults.length === 0) return

    const newIndex = direction === 'next'
      ? (pdfState.currentSearchIndex + 1) % pdfState.searchResults.length
      : (pdfState.currentSearchIndex - 1 + pdfState.searchResults.length) % pdfState.searchResults.length

    setPdfState(prev => ({
      ...prev,
      currentSearchIndex: newIndex,
      currentPage: prev.searchResults[newIndex]
    }))
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full bg-[#1d150c] ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-white">Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full bg-[#1d150c] ${className}`}>
        <div className="text-center">
          <FileText size={48} className="text-red-500 mx-auto mb-4" />
          <p className="text-white mb-2">Error loading PDF</p>
          <p className="text-[#cbad90] text-sm">{error}</p>
          <Button onClick={onClose} variant="outline" className="mt-4">
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`flex flex-col h-full bg-[#1d150c] ${className}`}>
      {/* PDF Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-[#493622] bg-[#1d150c]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-primary" />
            <span className="text-white font-medium text-sm">{fileName}</span>
          </div>
          
          <div className="flex items-center gap-1 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange('prev')}
              disabled={pdfState.currentPage <= 1}
              className="text-white hover:bg-[#493622] p-1"
            >
              <ChevronLeft size={16} />
            </Button>
            
            <div className="flex items-center gap-2 px-2">
              <input
                type="number"
                value={pdfState.currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value)
                  if (page >= 1 && page <= pdfState.totalPages) {
                    setPdfState(prev => ({ ...prev, currentPage: page }))
                  }
                }}
                className="w-12 px-1 py-0.5 text-center bg-[#493622] text-white border border-[#684d31] rounded text-sm"
                min="1"
                max={pdfState.totalPages}
              />
              <span className="text-[#cbad90] text-sm">of {pdfState.totalPages}</span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange('next')}
              disabled={pdfState.currentPage >= pdfState.totalPages}
              className="text-white hover:bg-[#493622] p-1"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#cbad90]" />
            <input
              type="text"
              placeholder="Search in PDF..."
              value={pdfState.searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8 pr-3 py-1 bg-[#493622] text-white border border-[#684d31] rounded text-sm w-40 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            {pdfState.searchResults.length > 0 && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Badge variant="info" className="text-xs px-1 py-0">
                  {pdfState.currentSearchIndex + 1}/{pdfState.searchResults.length}
                </Badge>
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateSearchResults('prev')}
                    className="p-0.5 text-white hover:bg-[#684d31]"
                  >
                    <ChevronLeft size={12} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateSearchResults('next')}
                    className="p-0.5 text-white hover:bg-[#684d31]"
                  >
                    <ChevronRight size={12} />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border border-[#493622] rounded">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleZoom('out')}
              className="text-white hover:bg-[#493622] p-1"
            >
              <ZoomOut size={16} />
            </Button>
            <span className="text-white text-sm px-2 min-w-[3rem] text-center">
              {Math.round(pdfState.zoom)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleZoom('in')}
              className="text-white hover:bg-[#493622] p-1"
            >
              <ZoomIn size={16} />
            </Button>
          </div>

          {/* Other Controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRotate}
            className="text-white hover:bg-[#493622] p-2"
          >
            <RotateCw size={16} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-white hover:bg-[#493622] p-2"
          >
            {pdfState.isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="text-white hover:bg-[#493622] p-2"
          >
            <Download size={16} />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 relative overflow-hidden">
        <iframe
          ref={iframeRef}
          src={`${fileUrl}#page=${pdfState.currentPage}&zoom=${pdfState.zoom}`}
          className="w-full h-full border-0"
          style={{
            transform: `rotate(${pdfState.rotation}deg)`,
            transformOrigin: 'center center'
          }}
          title={fileName}
        />
        
        {/* Search Highlights Overlay */}
        {pdfState.searchResults.length > 0 && (
          <div className="absolute top-4 right-4 bg-[#1d150c]/90 rounded-lg p-2 border border-[#493622]">
            <div className="text-white text-sm">
              Found {pdfState.searchResults.length} results for "{pdfState.searchTerm}"
            </div>
          </div>
        )}
      </div>

      {/* Page Navigation Footer */}
      <div className="flex items-center justify-center p-2 border-t border-[#493622] bg-[#1d150c]">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPdfState(prev => ({ ...prev, currentPage: 1 }))}
            disabled={pdfState.currentPage <= 1}
            className="text-xs"
          >
            First
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange('prev')}
            disabled={pdfState.currentPage <= 1}
          >
            <ChevronLeft size={16} />
            Previous
          </Button>
          
          <div className="text-[#cbad90] text-sm">
            Page {pdfState.currentPage} of {pdfState.totalPages}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange('next')}
            disabled={pdfState.currentPage >= pdfState.totalPages}
          >
            Next
            <ChevronRight size={16} />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPdfState(prev => ({ ...prev, currentPage: prev.totalPages }))}
            disabled={pdfState.currentPage >= pdfState.totalPages}
            className="text-xs"
          >
            Last
          </Button>
        </div>
      </div>
    </div>
  )
}