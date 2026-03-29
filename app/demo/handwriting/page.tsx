'use client'

/**
 * 手写识别功能演示页面
 * 展示如何使用手写画板和识别功能
 */

import { useState } from 'react'
import { HandwritingCanvas } from '@/components/HandwritingCanvas'
import { HandwritingInput } from '@/components/HandwritingInput'
import { HandwritingJudgeResult } from '@/types/handwriting'

export default function HandwritingDemoPage() {
  const [recognizedText, setRecognizedText] = useState('')
  const [judgeResult, setJudgeResult] = useState<HandwritingJudgeResult | null>(null)
  const [mode, setMode] = useState<'basic' | 'with-judge'>('basic')

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">手写识别功能演示</h1>

      {/* 模式切换 */}
      <div className="mb-8 flex gap-4">
        <button
          onClick={() => setMode('basic')}
          className={`px-4 py-2 rounded ${
            mode === 'basic'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          基础模式
        </button>
        <button
          onClick={() => setMode('with-judge')}
          className={`px-4 py-2 rounded ${
            mode === 'with-judge'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          判题模式
        </button>
      </div>

      {/* 基础模式 */}
      {mode === 'basic' && (
        <div className="space-y-8">
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">基础用法</h2>
            <p className="text-gray-600 mb-4">
              在下方画板中手写文字，然后点击"识别"按钮进行识别。
            </p>

            <BasicDemo onRecognized={setRecognizedText} />

            {recognizedText && (
              <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
                <p className="font-medium">识别结果：</p>
                <p className="text-2xl mt-2">{recognizedText}</p>
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">识别说明</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>支持中文手写识别</li>
              <li>建议书写工整，字迹清晰</li>
              <li>支持撤销和清除操作</li>
              <li>识别准确率可达 90%+</li>
            </ul>
          </section>
        </div>
      )}

      {/* 判题模式 */}
      {mode === 'with-judge' && (
        <div className="space-y-8">
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">判题模式</h2>
            <p className="text-gray-600 mb-4">
              在下方画板中手写词语"侍弄"，系统会自动判题。
            </p>

            <HandwritingInput
              width={500}
              height={250}
              correctAnswer="侍弄"
              placeholder="请手写：侍弄"
              onRecognized={({ text }) => {
                setRecognizedText(text)
              }}
              onJudged={(result) => {
                setJudgeResult(result)
              }}
            />
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">判题说明</h2>
            <div className="space-y-4 text-gray-600">
              <div>
                <h3 className="font-medium text-gray-900">判题规则</h3>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>完全匹配：直接判定正确</li>
                  <li>相似度 ≥80% 且置信度 ≥70%：判定正确</li>
                  <li>相似度 60-80%：宽松模式判定正确</li>
                  <li>相似度 &lt;50%：判定错误</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">测试建议</h3>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>尝试书写正确答案"侍弄"</li>
                  <li>尝试书写相似但错误的字词</li>
                  <li>尝试书写完全不同的内容</li>
                  <li>观察系统给出的反馈</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* API 说明 */}
      <section className="bg-white rounded-lg shadow p-6 mt-8">
        <h2 className="text-xl font-semibold mb-4">API 使用示例</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">识别 API</h3>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
              <code>{`const response = await fetch('/api/handwriting/recognize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: 'data:image/png;base64,...' })
})

const data = await response.json()
console.log(data.data.text) // 识别结果`}</code>
            </pre>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">判题 API</h3>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
              <code>{`const response = await fetch('/api/handwriting/judge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image: 'data:image/png;base64,...',
    correctAnswer: '侍弄'
  })
})

const data = await response.json()
console.log(data.data.isCorrect) // 是否正确`}</code>
            </pre>
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * 基础演示组件
 */
function BasicDemo({ onRecognized }: { onRecognized: (text: string) => void }) {
  const canvasRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleRecognize = async () => {
    if (!canvasRef.current) return

    const imageData = canvasRef.current.getBase64Image()
    setIsLoading(true)

    try {
      const response = await fetch('/api/handwriting/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      })

      const data = await response.json()

      if (data.success) {
        onRecognized(data.data.text)
      } else {
        alert(`识别失败：${data.error}`)
      }
    } catch (error: any) {
      alert(`识别失败：${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <HandwritingCanvas
        ref={canvasRef}
        width={500}
        height={250}
        placeholder="请在此处手写..."
      />

      <div className="flex gap-2">
        <button
          onClick={handleRecognize}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? '识别中...' : '识别'}
        </button>
        <button
          onClick={() => {
            if (canvasRef.current) {
              canvasRef.current.clearCanvas()
              onRecognized('')
            }
          }}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          清除
        </button>
      </div>
    </div>
  )
}
