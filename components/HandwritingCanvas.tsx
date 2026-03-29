'use client'

/**
 * 手写画板组件
 * 支持鼠标和触摸输入，用于手写识别
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { Stroke, StrokePoint } from '@/types/handwriting'

interface HandwritingCanvasProps {
  width?: number
  height?: number
  strokeWidth?: number
  strokeColor?: string
  backgroundColor?: string
  enableTouch?: boolean
  onStrokesChange?: (strokes: Stroke[]) => void
  onClear?: () => void
  disabled?: boolean
  placeholder?: string
}

export function HandwritingCanvas({
  width = 400,
  height = 200,
  strokeWidth = 3,
  strokeColor = '#000000',
  backgroundColor = '#ffffff',
  enableTouch = true,
  onStrokesChange,
  onClear,
  disabled = false,
  placeholder = '请在此处手写...'
}: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [hasContent, setHasContent] = useState(false)
  const currentStroke = useRef<StrokePoint[]>([])

  // 初始化画布
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 设置画布样式
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = strokeWidth
    ctx.strokeStyle = strokeColor

    // 填充背景色
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 如果有占位符，绘制占位符文本
    if (!hasContent && placeholder) {
      ctx.fillStyle = '#cccccc'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(placeholder, canvas.width / 2, canvas.height / 2)
    }
  }, [width, height, strokeWidth, strokeColor, backgroundColor, placeholder, hasContent])

  // 获取坐标
  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent): StrokePoint => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0, timestamp: 0 }

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      timestamp: Date.now()
    }
  }, [])

  // 绘制点
  const drawPoint = useCallback((point: StrokePoint, lastPoint?: StrokePoint) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (lastPoint) {
      ctx.beginPath()
      ctx.moveTo(lastPoint.x, lastPoint.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(point.x, point.y, strokeWidth / 2, 0, Math.PI * 2)
      ctx.fillStyle = strokeColor
      ctx.fill()
    }
  }, [strokeWidth, strokeColor])

  // 开始绘制
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return
    e.preventDefault()

    setIsDrawing(true)
    const point = getPoint(e)
    currentStroke.current = [point]
    drawPoint(point)
  }, [disabled, getPoint, drawPoint])

  // 绘制中
  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return
    e.preventDefault()

    const point = getPoint(e)
    const lastPoint = currentStroke.current[currentStroke.current.length - 1]

    currentStroke.current.push(point)
    drawPoint(point, lastPoint)

    setHasContent(true)
  }, [isDrawing, disabled, getPoint, drawPoint])

  // 停止绘制
  const stopDrawing = useCallback(() => {
    if (!isDrawing) return

    setIsDrawing(false)

    if (currentStroke.current.length > 0) {
      const newStrokes = [...strokes, { points: currentStroke.current }]
      setStrokes(newStrokes)
      onStrokesChange?.(newStrokes)
    }

    currentStroke.current = []
  }, [isDrawing, strokes, onStrokesChange])

  // 清除画布
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 重绘占位符
    if (placeholder) {
      ctx.fillStyle = '#cccccc'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(placeholder, canvas.width / 2, canvas.height / 2)
    }

    setStrokes([])
    setHasContent(false)
    currentStroke.current = []
    onClear?.()
  }, [backgroundColor, placeholder, onClear])

  // 撤销上一笔
  const undoLastStroke = useCallback(() => {
    if (strokes.length === 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 清除画布
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 重绘占位符
    if (!hasContent && placeholder) {
      ctx.fillStyle = '#cccccc'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(placeholder, canvas.width / 2, canvas.height / 2)
    }

    // 重绘剩余笔画
    const newStrokes = strokes.slice(0, -1)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = strokeWidth
    ctx.strokeStyle = strokeColor

    newStrokes.forEach(stroke => {
      if (stroke.points.length === 0) return

      // 绘制第一个点
      const firstPoint = stroke.points[0]
      ctx.beginPath()
      ctx.arc(firstPoint.x, firstPoint.y, strokeWidth / 2, 0, Math.PI * 2)
      ctx.fillStyle = strokeColor
      ctx.fill()

      // 绘制连线
      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i]
        const lastPoint = stroke.points[i - 1]

        ctx.beginPath()
        ctx.moveTo(lastPoint.x, lastPoint.y)
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
      }
    })

    setStrokes(newStrokes)
    onStrokesChange?.(newStrokes)
  }, [strokes, backgroundColor, placeholder, hasContent, strokeWidth, strokeColor, onStrokesChange])

  // 获取 base64 图片
  const getBase64Image = useCallback((): string => {
    const canvas = canvasRef.current
    if (!canvas) return ''
    return canvas.toDataURL('image/png')
  }, [])

  // 导出方法供外部调用
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 将方法挂载到 canvas 元素上，方便外部调用
    ;(canvas as any).getBase64Image = getBase64Image
    ;(canvas as any).clearCanvas = clearCanvas
    ;(canvas as any).undoLastStroke = undoLastStroke
  }, [getBase64Image, clearCanvas, undoLastStroke])

  return (
    <div className="inline-block">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`border rounded bg-white cursor-crosshair ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={enableTouch ? startDrawing : undefined}
        onTouchMove={enableTouch ? draw : undefined}
        onTouchEnd={enableTouch ? stopDrawing : undefined}
        style={{ touchAction: 'none' }}
      />

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={undoLastStroke}
          disabled={disabled || strokes.length === 0}
          className="px-3 py-1.5 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          撤销
        </button>
        <button
          type="button"
          onClick={clearCanvas}
          disabled={disabled || !hasContent}
          className="px-3 py-1.5 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          清除
        </button>
      </div>
    </div>
  )
}
