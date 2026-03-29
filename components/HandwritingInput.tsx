'use client'

/**
 * 手写输入组件
 * 整合画板和识别功能，提供完整的手写输入体验
 */

import { useState, useRef, useCallback } from 'react'
import { HandwritingCanvas } from './HandwritingCanvas'
import { HandwritingJudgeResult } from '@/types/handwriting'

interface HandwritingInputProps {
  width?: number
  height?: number
  correctAnswer?: string
  onRecognized?: (result: {
    text: string
    confidence: number
    image: string
  }) => void
  onJudged?: (result: HandwritingJudgeResult) => void
  disabled?: boolean
  showJudgeResult?: boolean
  placeholder?: string
}

export function HandwritingInput({
  width = 400,
  height = 200,
  correctAnswer,
  onRecognized,
  onJudged,
  disabled = false,
  showJudgeResult = true,
  placeholder = '请在此处手写...'
}: HandwritingInputProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [judgeResult, setJudgeResult] = useState<HandwritingJudgeResult | null>(null)
  const canvasRef = useRef<any>(null)

  // 识别手写内容
  const recognize = useCallback(async () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const imageData = canvas.getBase64Image()

    setIsLoading(true)
    setJudgeResult(null)

    try {
      // 调用识别 API
      const response = await fetch('/api/handwriting/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '识别失败')
      }

      const { text, confidence } = data.data
      setRecognizedText(text)

      // 回调
      onRecognized?.({
        text,
        confidence,
        image: imageData
      })

      // 如果有正确答案，自动判题
      if (correctAnswer) {
        await judge(imageData, text)
      }
    } catch (error: any) {
      console.error('识别失败:', error)
      alert(`识别失败：${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [correctAnswer, onRecognized])

  // 判题
  const judge = useCallback(async (imageData: string, text: string) => {
    if (!correctAnswer) return

    try {
      const response = await fetch('/api/handwriting/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData,
          correctAnswer,
          options: {
            lenientMode: true // 启用宽松模式
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        setJudgeResult(data.data)
        onJudged?.(data.data)
      }
    } catch (error: any) {
      console.error('判题失败:', error)
    }
  }, [correctAnswer, onJudged])

  // 清除
  const clear = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.clearCanvas()
    }
    setRecognizedText('')
    setJudgeResult(null)
  }, [])

  // 确认使用识别结果
  const confirmResult = useCallback(() => {
    if (!recognizedText) return

    // 这里可以触发确认回调，将结果传给父组件
    console.log('确认使用识别结果:', recognizedText)
  }, [recognizedText])

  return (
    <div className="space-y-4">
      {/* 手写画板 */}
      <div className="inline-block">
        <HandwritingCanvas
          ref={canvasRef}
          width={width}
          height={height}
          placeholder={placeholder}
          disabled={disabled || isLoading}
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={recognize}
          disabled={isLoading || disabled}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '识别中...' : '识别'}
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={isLoading || disabled}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          重写
        </button>
      </div>

      {/* 识别结果 */}
      {recognizedText && (
        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm font-medium text-blue-900">
            识别结果：<span className="text-lg">{recognizedText}</span>
          </p>
        </div>
      )}

      {/* 判题结果 */}
      {showJudgeResult && judgeResult && (
        <div
          className={`p-3 rounded border ${
            judgeResult.isCorrect
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              judgeResult.isCorrect ? 'text-green-900' : 'text-red-900'
            }`}
          >
            {judgeResult.feedback}
          </p>
          <div className="mt-2 text-xs text-gray-600 space-y-1">
            <p>相似度：{(judgeResult.similarity * 100).toFixed(1)}%</p>
            <p>置信度：{(judgeResult.confidence * 100).toFixed(1)}%</p>
          </div>
        </div>
      )}
    </div>
  )
}
