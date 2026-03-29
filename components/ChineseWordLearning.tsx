"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, BookOpen, Pen, CheckCircle, X } from "lucide-react"

interface ChineseWord {
  id: string
  word: string
  pinyin: string
  meanings: string[]
}

interface KnowledgeLibrary {
  id: string
  name: string
  description?: string
  wordCount: number
  createdAt: string
}

interface ExamResult {
  word: ChineseWord
  recognizedText: string
  isCorrect: boolean
  similarity: number
  feedback: string
}

export default function ChineseWordLearning() {
  const [knowledgeLibraries, setKnowledgeLibraries] = useState<KnowledgeLibrary[]>([])
  const [selectedLibrary, setSelectedLibrary] = useState<KnowledgeLibrary | null>(null)
  const [libraryWords, setLibraryWords] = useState<ChineseWord[]>([])

  // 考试状态
  const [examMode, setExamMode] = useState(false)
  const [examWords, setExamWords] = useState<ChineseWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<ExamResult[]>([])
  const [currentResult, setCurrentResult] = useState<any>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    loadKnowledgeLibraries()
  }, [])

  const loadKnowledgeLibraries = async () => {
    try {
      const response = await fetch('/api/knowledge-base/libraries?subject=chinese')
      if (response.ok) {
        const data = await response.json()
        setKnowledgeLibraries(data.data.libraries || [])
      }
    } catch (error) {
      console.error("Failed to load libraries:", error)
    }
  }

  const selectLibrary = async (library: KnowledgeLibrary) => {
    setSelectedLibrary(library)
    setExamMode(false)
    setResults([])
    setCurrentIndex(0)

    try {
      const response = await fetch(`/api/knowledge-base/${library.id}`)
      if (response.ok) {
        const data = await response.json()
        setLibraryWords(data.data.words || [])
      }
    } catch (error) {
      console.error("Failed to load words:", error)
    }
  }

  const startExam = (random10: boolean = false) => {
    let words = random10
      ? [...libraryWords].sort(() => Math.random() - 0.5).slice(0, 10)
      : [...libraryWords]

    setExamWords(words)
    setCurrentIndex(0)
    setResults([])
    setCurrentResult(null)
    setSubmitted(false)
    setExamMode(true)
  }

  const currentWord = examWords[currentIndex]

  if (!examMode) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-4">📚 语文字词库</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>知识库列表 ({knowledgeLibraries.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {knowledgeLibraries.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-2" />
                  <p>暂无字词库</p>
                  <a href="/demo/knowledge-base-import" className="text-blue-600 hover:underline text-sm">
                    前往导入
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {knowledgeLibraries.map((lib) => (
                    <div
                      key={lib.id}
                      onClick={() => selectLibrary(lib)}
                      className={`p-3 rounded border cursor-pointer ${
                        selectedLibrary?.id === lib.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{lib.name}</span>
                        <span className="text-sm text-gray-600">{lib.wordCount} 字</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedLibrary && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedLibrary.name}</CardTitle>
                <CardDescription>{libraryWords.length} 个字词</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => startExam(false)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      disabled={libraryWords.length === 0}
                    >
                      <Pen className="w-4 h-4 mr-2" />
                      考全部
                    </Button>
                    <Button
                      onClick={() => startExam(true)}
                      variant="outline"
                      className="flex-1"
                      disabled={libraryWords.length === 0}
                    >
                      随机10题
                    </Button>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">字词预览 (前10个)</p>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {libraryWords.slice(0, 10).map((word) => (
                        <div key={word.id} className="p-2 bg-gray-50 rounded text-sm">
                          <span className="font-semibold text-blue-900">{word.word}</span>
                          <span className="text-gray-600 ml-2">{word.pinyin}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  // 考试结束
  if (submitted) {
    const correctCount = results.filter(r => r.isCorrect).length
    const wrongCount = results.filter(r => !r.isCorrect).length
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length * 100

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">🎉 考试完成！</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-900">{correctCount}</p>
                <p className="text-sm text-green-700">正确</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-900">{wrongCount}</p>
                <p className="text-sm text-red-700">错误</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-900">{avgSimilarity.toFixed(1)}%</p>
                <p className="text-sm text-blue-700">平均相似度</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">详细结果</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {results.map((result, i) => (
                  <div key={i} className={`p-3 rounded border ${
                    result.isCorrect
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold">{result.word.word}</span>
                          <span className="text-sm text-gray-600">{result.word.pinyin}</span>
                        </div>
                        <p className="text-sm text-gray-700">{result.word.meanings.join('；')}</p>
                      </div>
                      <span className="text-xl">
                        {result.isCorrect ? <CheckCircle className="text-green-600" /> : <X className="text-red-600" />}
                      </span>
                    </div>
                    {!result.isCorrect && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-sm">
                          <span className="text-gray-600">您的书写：</span>
                          <span className="ml-1">{result.recognizedText}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="text-gray-600">正确答案：</span>
                          <span className="ml-1 font-medium">{result.word.word}</span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center gap-4 pt-4">
              <Button onClick={() => {
                selectLibrary(selectedLibrary!)
              }} variant="outline">
                返回
              </Button>
              <Button onClick={() => {
                // 保存结果
                saveExamResults()
              }} className="bg-green-600 hover:bg-green-700">
                保存结果
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 考试进行中
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>字词考试</CardTitle>
              <CardDescription>第 {currentIndex + 1} / {examWords.length} 题</CardDescription>
            </div>
            <div className="text-right">
              <Button
                onClick={() => {
                  if (confirm('确定要退出考试吗？')) {
                    setExamMode(false)
                    setResults([])
                  }
                }}
                variant="outline"
                size="sm"
              >
                退出
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 题目 */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">拼音</p>
                <p className="text-2xl font-semibold text-blue-900">{currentWord.pinyin}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">释义</p>
                <p className="text-gray-900">{currentWord.meanings.join('；')}</p>
              </div>
            </div>
          </div>

          {/* 手写区域 */}
          <div>
            <p className="text-sm font-medium mb-3">请手写该字词：</p>
            <HandwritingCanvas
              width={500}
              height={250}
              disabled={!!currentResult}
              onImageReady={(imageData) => {
                if (imageData && !currentResult) {
                  recognizeHandwriting(imageData, currentWord.word)
                }
              }}
              onClear={() => setCurrentResult(null)}
            />
          </div>

          {/* 结果 */}
          {currentResult && (
            <div className={`p-4 rounded-lg border-2 ${
              currentResult.isCorrect
                ? 'border-green-500 bg-green-50'
                : 'border-red-500 bg-red-50'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">
                  {currentResult.isCorrect ? '✓' : '✗'}
                </span>
                <span className="font-semibold">
                  {currentResult.isCorrect ? '正确！' : '错误'}
                </span>
              </div>
              <p className="text-sm">
                <strong>识别结果：</strong>{currentResult.recognizedText}
              </p>
              {!currentResult.isCorrect && (
                <p className="text-sm">
                  <strong>正确答案：</strong>{currentWord.word}
                </p>
              )}
              <p className="text-sm text-gray-600 mt-1">{currentResult.feedback}</p>
            </div>
          )}

          {/* 按钮 */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              disabled={currentIndex >= examWords.length}
            >
              {currentIndex > 0 ? '上一题' : '第一题'}
            </Button>

            {!currentResult ? (
              <Button
                disabled
                className="bg-gray-400"
              >
                等待书写...
              </Button>
            ) : (
              <Button
                onClick={() => {
                  const newResults = [...results, currentResult]
                  setResults(newResults)
                  setCurrentResult(null)

                  if (currentIndex < examWords.length - 1) {
                    setCurrentIndex(currentIndex + 1)
                  } else {
                    setSubmitted(true)
                  }
                }}
                className={currentIndex < examWords.length - 1 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
              >
                {currentIndex < examWords.length - 1 ? '下一题' : '完成'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// 手写画板组件
function HandwritingCanvas({ width, height, disabled, onImageReady, onClear }: {
  width: number
  height: number
  disabled?: boolean
  onImageReady?: (imageData: string) => void
  onClear?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3
    ctx.strokeStyle = '#000'

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [width, height])

  const startDrawing = (e: any) => {
    if (disabled) return
    e.preventDefault()

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.touches ? e.touches[0].clientX : e.clientX
    const y = e.touches ? e.touches[0].clientY : e.clientY

    ctx.beginPath()
    ctx.moveTo(x - rect.left, y - rect.top)

    setIsDrawing(true)
    setHasContent(true)
  }

  const draw = (e: any) => {
    if (!isDrawing || disabled) return
    e.preventDefault()

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.touches ? e.touches[0].clientX : e.clientX
    const y = e.touches ? e.touches[0].clientY : e.clientY

    ctx.lineTo(x - rect.left, y - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)

    // 生成图片并识别
    const canvas = canvasRef.current
    if (canvas && hasContent) {
      const imageData = canvas.toDataURL('image/png')
      onImageReady?.(imageData)
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasContent(false)
    onClear?.()
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`border rounded-lg bg-white cursor-crosshair ${disabled ? 'opacity-50' : ''}`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      {!disabled && (
        <div className="flex justify-center">
          <Button
            onClick={clearCanvas}
            variant="outline"
            size="sm"
            type="button"
          >
            重写
          </Button>
        </div>
      )}
    </div>
  )
}
