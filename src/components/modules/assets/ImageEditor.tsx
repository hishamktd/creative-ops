'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Crop, 
  RotateCw, 
  RotateCcw, 
  Save, 
  Undo, 
  Redo,
  Move,
  ZoomIn,
  ZoomOut,
  Square,
  Circle,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export interface ImageEditorProps {
  imageUrl: string
  onSave: (editedImageBlob: Blob, changes: EditChanges) => Promise<void>
  onCancel: () => void
  className?: string
}

export interface EditChanges {
  rotation: number
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
  resize?: {
    width: number
    height: number
  }
  description: string
}

interface EditorState {
  rotation: number
  scale: number
  cropArea: {
    x: number
    y: number
    width: number
    height: number
  } | null
  isDragging: boolean
  dragStart: { x: number; y: number } | null
  history: EditChanges[]
  historyIndex: number
}

export function ImageEditor({
  imageUrl,
  onSave,
  onCancel,
  className = ''
}: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [editorState, setEditorState] = useState<EditorState>({
    rotation: 0,
    scale: 1,
    cropArea: null,
    isDragging: false,
    dragStart: null,
    history: [],
    historyIndex: -1
  })
  
  const [tool, setTool] = useState<'move' | 'crop'>('move')
  const [loading, setLoading] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 })

  // Load and setup image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setOriginalDimensions({ width: img.width, height: img.height })
      setImageLoaded(true)
      drawCanvas()
    }
    img.src = imageUrl
    if (imageRef.current) {
      imageRef.current = img
    }
  }, [imageUrl])

  // Draw canvas with current transformations
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img || !imageLoaded) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const containerWidth = containerRef.current?.clientWidth || 800
    const containerHeight = containerRef.current?.clientHeight || 600
    
    canvas.width = containerWidth
    canvas.height = containerHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate image dimensions to fit container
    const imgAspect = img.width / img.height
    const containerAspect = containerWidth / containerHeight
    
    let drawWidth, drawHeight
    if (imgAspect > containerAspect) {
      drawWidth = containerWidth * editorState.scale
      drawHeight = (containerWidth / imgAspect) * editorState.scale
    } else {
      drawHeight = containerHeight * editorState.scale
      drawWidth = (containerHeight * imgAspect) * editorState.scale
    }

    // Center the image
    const x = (canvas.width - drawWidth) / 2
    const y = (canvas.height - drawHeight) / 2

    // Save context for transformations
    ctx.save()

    // Apply rotation
    if (editorState.rotation !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((editorState.rotation * Math.PI) / 180)
      ctx.translate(-canvas.width / 2, -canvas.height / 2)
    }

    // Draw image
    ctx.drawImage(img, x, y, drawWidth, drawHeight)

    // Draw crop overlay
    if (editorState.cropArea && tool === 'crop') {
      ctx.restore()
      ctx.save()
      
      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Clear crop area
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillRect(
        editorState.cropArea.x,
        editorState.cropArea.y,
        editorState.cropArea.width,
        editorState.cropArea.height
      )
      
      // Draw crop border
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = '#f48c25'
      ctx.lineWidth = 2
      ctx.strokeRect(
        editorState.cropArea.x,
        editorState.cropArea.y,
        editorState.cropArea.width,
        editorState.cropArea.height
      )
      
      // Draw corner handles
      const handleSize = 8
      const corners = [
        { x: editorState.cropArea.x, y: editorState.cropArea.y },
        { x: editorState.cropArea.x + editorState.cropArea.width, y: editorState.cropArea.y },
        { x: editorState.cropArea.x, y: editorState.cropArea.y + editorState.cropArea.height },
        { x: editorState.cropArea.x + editorState.cropArea.width, y: editorState.cropArea.y + editorState.cropArea.height }
      ]
      
      ctx.fillStyle = '#f48c25'
      corners.forEach(corner => {
        ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize)
      })
    }

    ctx.restore()
  }, [editorState, tool, imageLoaded])

  // Redraw canvas when state changes
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // Handle mouse events for crop tool
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'crop') return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setEditorState(prev => ({
      ...prev,
      isDragging: true,
      dragStart: { x, y },
      cropArea: { x, y, width: 0, height: 0 }
    }))
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editorState.isDragging || !editorState.dragStart || tool !== 'crop') return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const width = x - editorState.dragStart.x
    const height = y - editorState.dragStart.y

    setEditorState(prev => ({
      ...prev,
      cropArea: {
        x: width < 0 ? x : prev.dragStart!.x,
        y: height < 0 ? y : prev.dragStart!.y,
        width: Math.abs(width),
        height: Math.abs(height)
      }
    }))
  }

  const handleMouseUp = () => {
    setEditorState(prev => ({
      ...prev,
      isDragging: false,
      dragStart: null
    }))
  }

  // Rotation controls
  const rotate = (degrees: number) => {
    setEditorState(prev => ({
      ...prev,
      rotation: (prev.rotation + degrees) % 360
    }))
    addToHistory(`Rotated ${degrees > 0 ? 'clockwise' : 'counter-clockwise'}`)
  }

  // Zoom controls
  const zoom = (factor: number) => {
    setEditorState(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(5, prev.scale * factor))
    }))
  }

  // History management
  const addToHistory = (description: string) => {
    const changes: EditChanges = {
      rotation: editorState.rotation,
      crop: editorState.cropArea || undefined,
      description
    }

    setEditorState(prev => ({
      ...prev,
      history: [...prev.history.slice(0, prev.historyIndex + 1), changes],
      historyIndex: prev.historyIndex + 1
    }))
  }

  const undo = () => {
    if (editorState.historyIndex > 0) {
      const prevState = editorState.history[editorState.historyIndex - 1]
      setEditorState(prev => ({
        ...prev,
        rotation: prevState.rotation,
        cropArea: prevState.crop || null,
        historyIndex: prev.historyIndex - 1
      }))
    }
  }

  const redo = () => {
    if (editorState.historyIndex < editorState.history.length - 1) {
      const nextState = editorState.history[editorState.historyIndex + 1]
      setEditorState(prev => ({
        ...prev,
        rotation: nextState.rotation,
        cropArea: nextState.crop || null,
        historyIndex: prev.historyIndex + 1
      }))
    }
  }

  // Apply crop
  const applyCrop = () => {
    if (!editorState.cropArea) return
    addToHistory('Applied crop')
    setTool('move')
  }

  // Save edited image
  const handleSave = async () => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    setLoading(true)
    try {
      // Create a new canvas for the final output
      const outputCanvas = document.createElement('canvas')
      const outputCtx = outputCanvas.getContext('2d')
      if (!outputCtx) return

      // Calculate output dimensions
      let outputWidth = originalDimensions.width
      let outputHeight = originalDimensions.height

      if (editorState.cropArea) {
        // Calculate crop dimensions relative to original image
        const scaleX = originalDimensions.width / (canvas.width * editorState.scale)
        const scaleY = originalDimensions.height / (canvas.height * editorState.scale)
        
        outputWidth = editorState.cropArea.width * scaleX
        outputHeight = editorState.cropArea.height * scaleY
      }

      outputCanvas.width = outputWidth
      outputCanvas.height = outputHeight

      // Apply transformations
      outputCtx.save()

      if (editorState.rotation !== 0) {
        outputCtx.translate(outputWidth / 2, outputHeight / 2)
        outputCtx.rotate((editorState.rotation * Math.PI) / 180)
        outputCtx.translate(-outputWidth / 2, -outputHeight / 2)
      }

      if (editorState.cropArea) {
        // Draw cropped portion
        const scaleX = originalDimensions.width / (canvas.width * editorState.scale)
        const scaleY = originalDimensions.height / (canvas.height * editorState.scale)
        
        outputCtx.drawImage(
          img,
          editorState.cropArea.x * scaleX,
          editorState.cropArea.y * scaleY,
          editorState.cropArea.width * scaleX,
          editorState.cropArea.height * scaleY,
          0,
          0,
          outputWidth,
          outputHeight
        )
      } else {
        // Draw full image
        outputCtx.drawImage(img, 0, 0, outputWidth, outputHeight)
      }

      outputCtx.restore()

      // Convert to blob
      outputCanvas.toBlob(async (blob) => {
        if (blob) {
          const changes: EditChanges = {
            rotation: editorState.rotation,
            crop: editorState.cropArea || undefined,
            resize: { width: outputWidth, height: outputHeight },
            description: editorState.history.map(h => h.description).join(', ') || 'Image edited'
          }
          
          await onSave(blob, changes)
        }
      }, 'image/png', 0.9)
    } catch (error) {
      console.error('Error saving edited image:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`fixed inset-0 z-50 bg-background-dark ${className}`}>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#493622]">
          <h2 className="text-white text-lg font-bold font-display">Image Editor</h2>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={editorState.historyIndex <= 0}
              className="text-white hover:bg-[#493622]"
            >
              <Undo size={18} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={redo}
              disabled={editorState.historyIndex >= editorState.history.length - 1}
              className="text-white hover:bg-[#493622]"
            >
              <Redo size={18} />
            </Button>
            
            <div className="w-px h-6 bg-[#493622] mx-2" />
            
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={loading || editorState.history.length === 0}
              className="flex items-center gap-2"
            >
              <Save size={18} />
              Save Changes
            </Button>
            
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex items-center gap-2"
            >
              <X size={18} />
              Cancel
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Toolbar */}
          <div className="w-16 bg-[#1d150c] border-r border-[#493622] flex flex-col items-center py-4 gap-2">
            <Button
              variant={tool === 'move' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTool('move')}
              className="w-12 h-12 p-0"
            >
              <Move size={20} />
            </Button>
            
            <Button
              variant={tool === 'crop' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTool('crop')}
              className="w-12 h-12 p-0"
            >
              <Crop size={20} />
            </Button>
            
            <div className="w-8 h-px bg-[#493622] my-2" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => rotate(-90)}
              className="w-12 h-12 p-0 text-white hover:bg-[#493622]"
            >
              <RotateCcw size={20} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => rotate(90)}
              className="w-12 h-12 p-0 text-white hover:bg-[#493622]"
            >
              <RotateCw size={20} />
            </Button>
            
            <div className="w-8 h-px bg-[#493622] my-2" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => zoom(1.2)}
              className="w-12 h-12 p-0 text-white hover:bg-[#493622]"
            >
              <ZoomIn size={20} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => zoom(0.8)}
              className="w-12 h-12 p-0 text-white hover:bg-[#493622]"
            >
              <ZoomOut size={20} />
            </Button>
          </div>

          {/* Canvas Area */}
          <div ref={containerRef} className="flex-1 bg-[#0f0a06] relative overflow-hidden">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            
            {/* Crop Controls */}
            {tool === 'crop' && editorState.cropArea && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <Card className="bg-[#1d150c] border-[#493622]">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={applyCrop}
                      >
                        Apply Crop
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditorState(prev => ({ ...prev, cropArea: null }))}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="bg-[#1d150c] rounded-lg p-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                  <p className="text-white text-center">Saving changes...</p>
                </div>
              </div>
            )}
          </div>

          {/* Properties Panel */}
          <div className="w-64 bg-[#1d150c] border-l border-[#493622] p-4">
            <h3 className="text-white font-bold mb-4">Properties</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[#cbad90] text-sm block mb-2">Rotation</label>
                <div className="text-white text-sm">
                  {editorState.rotation}°
                </div>
              </div>
              
              <div>
                <label className="text-[#cbad90] text-sm block mb-2">Scale</label>
                <div className="text-white text-sm">
                  {Math.round(editorState.scale * 100)}%
                </div>
              </div>
              
              {editorState.cropArea && (
                <div>
                  <label className="text-[#cbad90] text-sm block mb-2">Crop Area</label>
                  <div className="text-white text-xs space-y-1">
                    <div>X: {Math.round(editorState.cropArea.x)}</div>
                    <div>Y: {Math.round(editorState.cropArea.y)}</div>
                    <div>W: {Math.round(editorState.cropArea.width)}</div>
                    <div>H: {Math.round(editorState.cropArea.height)}</div>
                  </div>
                </div>
              )}
              
              {editorState.history.length > 0 && (
                <div>
                  <label className="text-[#cbad90] text-sm block mb-2">History</label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {editorState.history.map((change, index) => (
                      <div
                        key={index}
                        className={`text-xs p-2 rounded ${
                          index === editorState.historyIndex
                            ? 'bg-primary/20 text-primary'
                            : 'text-[#cbad90]'
                        }`}
                      >
                        {change.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}