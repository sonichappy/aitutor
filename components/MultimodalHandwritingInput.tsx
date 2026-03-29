'use client'

/**
 * 多模态手写输入组件
 * 使用通义千问 VL 等多模态大模型进行智能识别
 */

import { useState, useRef } from 'react'
import { HandwritingCanvas } from './HandwritingCanvas'
import { MultimodalJudgeResult } from '@/lib/handwriting/multimodal-recognizer'

interface MultimodalHandwritingInputProps {
  width?: number
  height?: number
  correctAnswer?: string
  onRecognized?: (result: {
    text: string
    confidence: number
    image: string
  }) => void
  onJudged?: (result: MultimodalJudgeResult) => void
  disabled?: boolean
  placeholder?: string
  model?: string
}

export function MultimodalHandwritingInput({
  width = 400,
  height = 200,
  correctAnswer,
  onRecognized,
  onJudged,
  disabled = false,
  placeholder = '请在此处手写...',
  model = 'qwen-vl-max'
}: MultimodalHandwritingInputProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [judgeResult, setJudgeResult] = useState<MultimodalJudgeResult | null>(null)
  const canvasRef = useRef<any>(null)

  // 识别手写内容
  const recognize = async () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const imageData = canvas.getBase64Image()

    setIsLoading(true)
    setJudgeResult(null)

    try {
      // 调用多模态识别 API
      const response = await fetch('/api/handwriting/recognize-multimodal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData,
          expectedAnswer: correctAnswer,
          model
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '识别失败')
      }

      const { text, confidence, isCorrect, feedback, suggestions } = data.data
      setRecognizedText(text)

      // 回调
      onRecognized?.({
        text,
        confidence,
        image: imageData
      })

      // 如果有正确答案，显示判题结果
      if (correctAnswer && isCorrect !== undefined) {
        const result: MultimodalJudgeResult = {
          isCorrect,
          recognizedText: text,
          confidence,
          similarity: confidence,
          feedback: feedback || '',
          suggestions: suggestions || []
        }
        setJudgeResult(result)
        onJudged?.(result)
      }
    } catch (error: any) {
      console.error('识别失败:', error)
      alert(`识别失败：${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 清除
  const clear = () => {
    if (canvasRef.current) {
      canvasRef.current.clearCanvas()
    }
    setRecognizedText('')
    setJudgeResult(null)
  }

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
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              AI 识别中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              智能识别
            </>
          )}
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
        <div className="p-3 bg-purple-50 rounded border border-purple-200">
          <p className="text-sm font-medium text-purple-900">
            识别结果：<span className="text-lg">{recognizedText}</span>
          </p>
        </div>
      )}

      {/* 判题结果 */}
      {judgeResult && (
        <div
          className={`p-4 rounded border ${
            judgeResult.isCorrect
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          {/* 结果标题 */}
          <div className="flex items-center gap-2 mb-3">
            {judgeResult.isCorrect ? (
              <>
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-lg font-semibold text-green-900">回答正确！</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-lg font-semibold text-red-900">需要再练习</span>
              </>
            )}
          </div>

          {/* AI 反馈 */}
          <p className="text-gray-700 mb-3">{judgeResult.feedback}</p>

          {/* 改进建议 */}
          {judgeResult.suggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-900 mb-2">改进建议：</p>
              <ul className="list-disc list-inside space-y-1">
                {judgeResult.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-gray-600">{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 详细信息 */}
          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600 space-y-1">
            <p>识别结果：{judgeResult.recognizedText}</p>
            <p>置信度：{(judgeResult.confidence * 100).toFixed(1)}%</p>
          </div>
        </div>
      )}
    </div>
  )
}
