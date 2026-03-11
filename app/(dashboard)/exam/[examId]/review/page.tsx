"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ExamType {
  id: string
  name: string
  description: string
  icon: string
  color: string
}

interface ExamMetadata {
  examTypes: ExamType[]
}

interface Question {
  number: number
  type: string
  content: string
  options?: string[]
  score: number
  difficulty: number
  knowledgePoints: string[]
  userAnswer?: string
  bbox?: {  // 题目在图片中的位置区域（百分比坐标 0-100）
    x: number
    y: number
    width: number
    height: number
  }
  position?: {
    page: number
    region: string
  }
  // 作文相关字段
  essayGenre?: string  // 作文体裁
  wordCount?: number  // 字数
  // 答题标记字段（记录在每道题中）
  isCorrect?: boolean  // 是否正确（undefined=未标记，true=正确，false=错误）
  isSkipped?: boolean  // 是否跳过
  markedAt?: string  // 标记时间
}

// 题目标记状态（使用数组索引）
interface QuestionMark {
  index: number
  status: 'correct' | 'wrong' | 'skipped' | null  // null = 未标记
}

interface ExamData {
  id: string
  userId: string
  subject: string
  examType: string
  totalScore: number
  imageUrl?: string
  rawText?: string
  questions: Question[]
  createdAt: string
  metadata?: {
    detectedSubject?: string
    overallDifficulty?: number
    estimatedTime?: number
    knowledgePointsSummary?: string[]
    questionTypeStats?: Record<string, number>
    isEssay?: boolean
    essayType?: string
  }
}

export default function ExamReviewPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string

  const [examData, setExamData] = useState<ExamData | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null)
  const [editContent, setEditContent] = useState("")
  const [showImage, setShowImage] = useState(false)
  const [showQuestionImages, setShowQuestionImages] = useState<Record<number, boolean>>({})
  const [annotatingQuestion, setAnnotatingQuestion] = useState<number | null>(null)  // 正在标注的题目
  const [examMetadata, setExamMetadata] = useState<ExamMetadata | null>(null)
  const [editingExamType, setEditingExamType] = useState(false)
  const [questionMarks, setQuestionMarks] = useState<Record<number, 'correct' | 'wrong' | 'skipped'>>({})  // 使用数组索引作为 key

  useEffect(() => {
    loadExamData()
    loadExamMetadata()
  }, [examId])

  const loadExamData = async () => {
    try {
      // 首先尝试从 sessionStorage 读取（新上传的试卷）
      const sessionStorageKey = `exam_${examId}`
      const storedData = sessionStorage.getItem(sessionStorageKey)

      if (storedData) {
        const data = JSON.parse(storedData)
        setExamData(data)
        setQuestions(data.questions || [])

        // 从题目对象中加载答题标记状态（使用数组索引作为 key）
        const marksFromQuestions: Record<number, 'correct' | 'wrong' | 'skipped'> = {}
        data.questions?.forEach((q: Question, index: number) => {
          if (q.isCorrect === true) {
            marksFromQuestions[index] = 'correct'
          } else if (q.isCorrect === false) {
            marksFromQuestions[index] = 'wrong'
          } else if (q.isSkipped) {
            marksFromQuestions[index] = 'skipped'
          }
        })
        setQuestionMarks(marksFromQuestions)
        setLoading(false)
        return
      }

      // 如果 sessionStorage 没有，尝试从服务端 API 获取
      const response = await fetch(`/api/exam/${examId}/data`)

      if (response.ok) {
        const data = await response.json()
        setExamData(data)
        setQuestions(data.questions || [])

        // 从题目对象中加载答题标记状态（使用数组索引作为 key）
        const marksFromQuestions: Record<number, 'correct' | 'wrong' | 'skipped'> = {}
        data.questions?.forEach((q: Question, index: number) => {
          if (q.isCorrect === true) {
            marksFromQuestions[index] = 'correct'
          } else if (q.isCorrect === false) {
            marksFromQuestions[index] = 'wrong'
          } else if (q.isSkipped) {
            marksFromQuestions[index] = 'skipped'
          }
        })
        setQuestionMarks(marksFromQuestions)
        setLoading(false)
        return
      }

      // 都没有则提示重新上传
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      alert(`试卷数据不存在或已过期: ${errorData.error || '未知错误'}`)
      router.push("/exam")
    } catch (error) {
      console.error("Load exam data error:", error)
      alert("加载试卷数据失败，请重新上传")
      router.push("/exam")
    } finally {
      setLoading(false)
    }
  }

  const loadExamMetadata = async () => {
    try {
      const response = await fetch("/api/exam/metadata")
      if (response.ok) {
        const data = await response.json()
        setExamMetadata(data)
      }
    } catch (error) {
      console.error("Failed to load exam metadata:", error)
    }
  }

  const getExamTypeInfo = () => {
    if (!examMetadata || !examData) return null
    return examMetadata.examTypes?.find(t => t.id === examData.examType)
  }

  const handleExamTypeChange = async (newExamType: string) => {
    try {
      const response = await fetch(`/api/exam/${examId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examType: newExamType }),
      })

      if (response.ok) {
        // Update local state
        if (examData) {
          setExamData({ ...examData, examType: newExamType })
        }
        // Update sessionStorage
        const stored = sessionStorage.getItem(`exam_${examId}`)
        if (stored) {
          const data = JSON.parse(stored)
          data.examType = newExamType
          sessionStorage.setItem(`exam_${examId}`, JSON.stringify(data))
        }
        setEditingExamType(false)
      }
    } catch (error) {
      console.error("Failed to update exam type:", error)
      alert("更新试卷类型失败")
    }
  }

  const handleEditStart = (questionNum: number, content: string) => {
    setEditingQuestion(questionNum)
    setEditContent(content)
  }

  const handleEditSave = async (questionNum: number) => {
    const updated = questions.map(q =>
      q.number === questionNum ? { ...q, content: editContent } : q
    )
    setQuestions(updated)
    setEditingQuestion(null)

    // 更新 sessionStorage
    const stored = sessionStorage.getItem(`exam_${examId}`)
    if (stored) {
      const data = JSON.parse(stored)
      data.questions = updated
      sessionStorage.setItem(`exam_${examId}`, JSON.stringify(data))
    }

    // 同步到服务端
    try {
      await fetch(`/api/exam/${examId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: updated }),
      })
    } catch (error) {
      console.error("Sync to server failed:", error)
    }
  }

  const handleEditCancel = () => {
    setEditingQuestion(null)
    setEditContent("")
  }

  const handleDeleteQuestion = async (questionNum: number) => {
    if (!confirm(`确定删除第 ${questionNum} 题吗？`)) return

    const updated = questions.filter(q => q.number !== questionNum)
    setQuestions(updated)

    // 更新 sessionStorage
    const stored = sessionStorage.getItem(`exam_${examId}`)
    if (stored) {
      const data = JSON.parse(stored)
      data.questions = updated
      sessionStorage.setItem(`exam_${examId}`, JSON.stringify(data))
    }

    // 同步到服务端
    try {
      await fetch(`/api/exam/${examId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: updated }),
      })
    } catch (error) {
      console.error("Sync to server failed:", error)
    }
  }

  const handleConfirm = async () => {
    if (questions.length === 0) {
      alert("请至少保留一道题目")
      return
    }

    // 同步数据到服务端
    try {
      const response = await fetch(`/api/exam/${examId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`保存失败: ${error.error || "未知错误"}`)
        return
      }

      // 保存成功提示
      alert("保存成功！")
    } catch (error) {
      console.error("Sync error:", error)
      alert("保存数据失败，请重试")
    }
  }

  const handleReparse = () => {
    router.push("/exam")
  }

  const handleStartAnnotation = (questionNum: number) => {
    setAnnotatingQuestion(questionNum)
    setShowImage(true)  // 显示原图用于标注
  }

  const handleCancelAnnotation = () => {
    setAnnotatingQuestion(null)
  }

  const handleSaveAnnotation = (bbox: { x: number; y: number; width: number; height: number }) => {
    if (annotatingQuestion === null) return

    const updated = questions.map(q =>
      q.number === annotatingQuestion ? { ...q, bbox } : q
    )
    setQuestions(updated)

    // 更新 sessionStorage
    const stored = sessionStorage.getItem(`exam_${examId}`)
    if (stored) {
      const data = JSON.parse(stored)
      data.questions = updated
      sessionStorage.setItem(`exam_${examId}`, JSON.stringify(data))
    }

    // 同步到服务端
    fetch(`/api/exam/${examId}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: updated }),
    })

    setAnnotatingQuestion(null)
    setShowImage(false)
  }

  const handleMarkNoImage = (questionNum: number) => {
    const updated = questions.map(q =>
      q.number === questionNum ? { ...q, bbox: undefined } : q
    )
    setQuestions(updated)

    // 更新 sessionStorage
    const stored = sessionStorage.getItem(`exam_${examId}`)
    if (stored) {
      const data = JSON.parse(stored)
      data.questions = updated
      sessionStorage.setItem(`exam_${examId}`, JSON.stringify(data))
    }

    // 同步到服务端
    fetch(`/api/exam/${examId}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: updated }),
    })
  }

  // 标记题目状态（直接保存到题目对象，使用数组索引）
  const handleQuestionMark = async (questionIndex: number, status: 'correct' | 'wrong' | 'skipped') => {
    const currentMark = questionMarks[questionIndex]

    // 如果点击当前状态，则取消标记
    if (currentMark === status) {
      // 取消标记 - 移除答题标记字段
      const updatedQuestions = questions.map((q, i) => {
        if (i !== questionIndex) return q
        const { isCorrect, isSkipped, markedAt, ...rest } = q
        return rest
      })
      setQuestions(updatedQuestions)

      const newMarks = { ...questionMarks }
      delete newMarks[questionIndex]
      setQuestionMarks(newMarks)

      // 同步到服务端
      await saveQuestionsToServer(updatedQuestions)
      return
    }

    // 设置新标记
    const updatedQuestions = questions.map((q, i) => {
      if (i !== questionIndex) return q

      return {
        ...q,
        isCorrect: status === 'skipped' ? undefined : status === 'correct',
        isSkipped: status === 'skipped',
        markedAt: new Date().toISOString(),
      }
    })
    setQuestions(updatedQuestions)

    const newMarks = {
      ...questionMarks,
      [questionIndex]: status,
    }
    setQuestionMarks(newMarks)

    // 同步到服务端
    await saveQuestionsToServer(updatedQuestions)
  }

  // 保存题目到服务器
  const saveQuestionsToServer = async (updatedQuestions: Question[]) => {
    try {
      const response = await fetch(`/api/exam/${examId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: updatedQuestions }),
      })

      if (response.ok) {
        console.log('[Review] Saved to server successfully')
      } else {
        console.error('[Review] Failed to save to server')
      }
    } catch (error) {
      console.error('[Review] Save to server error:', error)
    }
  }

  // 获取题目标记状态（使用索引）
  const getQuestionMark = (index: number) => {
    return questionMarks[index] || null
  }

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      choice: "选择题",
      fill: "填空题",
      answer: "解答题",
      calculation: "计算题",
      essay: "作文/论述题",
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!examData || questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium mb-2">未识别到题目</h3>
            <p className="text-gray-500 mb-4">
              图片解析未能识别出有效题目
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleReparse}>
                重新上传
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          确认解析结果
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          请检查识别的题目是否正确，可编辑或删除
        </p>
      </div>

      {/* 统计信息 */}
      <Card>
        <CardContent className="pt-6">
          {(() => {
            // 计算统计数据（未标记的题目默认为做对）
            const correctCount = Object.values(questionMarks).filter(m => m === 'correct').length
            const wrongCount = Object.values(questionMarks).filter(m => m === 'wrong').length
            const skippedCount = Object.values(questionMarks).filter(m => m === 'skipped').length
            const unmarkedCount = questions.length - Object.keys(questionMarks).length
            const totalCorrect = correctCount + unmarkedCount  // 包括未标记的

            // 计算正确率：做对题目得分 / 题目总分
            let correctScore = 0
            let totalScore = 0
            questions.forEach((q: any, index: number) => {
              totalScore += q.score
              const mark = questionMarks[index]
              if (mark === 'wrong' || mark === 'skipped') {
                // 做错或不会做，不计入得分
              } else {
                // 未标记或标记为正确，计入得分
                correctScore += q.score
              }
            })
            const accuracy = totalScore > 0 ? Math.round((correctScore / totalScore) * 100) : 0

            // 计算题目类型统计
            const typeStats: Record<string, number> = {}
            questions.forEach((q: any) => {
              const type = q.type || 'unknown'
              typeStats[type] = (typeStats[type] || 0) + 1
            })

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{questions.length}</p>
                    <p className="text-sm text-gray-600">总题数</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{totalCorrect}</p>
                    <p className="text-sm text-gray-600">做对了</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{wrongCount}</p>
                    <p className="text-sm text-gray-600">做错了</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-600">{skippedCount}</p>
                    <p className="text-sm text-gray-600">不会做</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${
                      accuracy >= 80 ? 'text-green-600' : accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>{accuracy}%</p>
                    <p className="text-sm text-gray-600">正确率</p>
                  </div>
                </div>

                {/* 题目类型统计 */}
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">题目类型：</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(typeStats).map(([type, count]) => {
                      const typeLabels: Record<string, string> = {
                        'choice': '选择题',
                        'fill': '填空题',
                        'answer': '解答题',
                        'calculation': '计算题',
                        'essay': '作文/论述题',
                        'reading': '阅读理解',
                        'unknown': '其他',
                      }
                      return (
                        <span key={type} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm">
                          {typeLabels[type] || type} {count} 道
                        </span>
                      )
                    })}
                  </div>
                </div>
              </>
            )
          })()}
        </CardContent>
      </Card>

      {/* 试卷类型编辑卡片 */}
      <Card>
        <CardContent className="pt-6">
          {/* 试卷类型编辑 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">试卷类型</p>
              <p className="text-xs text-gray-500 mt-1">
                {getExamTypeInfo()?.description || "选择试卷类型"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {editingExamType ? (
                <select
                  value={examData?.examType || ""}
                  onChange={(e) => handleExamTypeChange(e.target.value)}
                  onBlur={() => setEditingExamType(false)}
                  autoFocus
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {examMetadata?.examTypes?.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.icon} {type.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingExamType(true)}
                >
                  {getExamTypeInfo()?.icon || "📝"} {getExamTypeInfo()?.name || examData?.examType || "未设置"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 图像标注区域 */}
      {annotatingQuestion !== null && (
        <Card className="ring-2 ring-green-500">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>📸 图像标注模式</CardTitle>
                <CardDescription>
                  正在为第 {annotatingQuestion} 题标注图片区域
                </CardDescription>
              </div>
              <Button variant="outline" onClick={handleCancelAnnotation}>
                取消标注
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ImageAnnotationTool
              imageUrl={examData?.imageUrl || ''}
              questionNumber={annotatingQuestion}
              onSave={handleSaveAnnotation}
              onCancel={handleCancelAnnotation}
            />
          </CardContent>
        </Card>
      )}

      {/* 原图预览 - 默认显示，方便对照 */}
      {examData.imageUrl && !annotatingQuestion && (
        <Card>
          <CardHeader>
            <CardTitle>试卷原图</CardTitle>
            <CardDescription>可以对照查看原图，验证题目识别是否正确</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-lg overflow-hidden border">
              <img
                src={examData.imageUrl}
                alt="试卷原图"
                className="w-full h-auto"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              💡 点击下方题目卡片的「标注图片」按钮，可在原图上框选该题对应的图片区域
            </p>
          </CardContent>
        </Card>
      )}

      {/* 题目列表 */}
      <div className="space-y-4">
        {questions.map((question, index) => (
          <Card key={index} className={editingQuestion === question.number ? "ring-2 ring-blue-500" : ""}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    第 {question.number} 题
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      {getQuestionTypeLabel(question.type)} · {question.score} 分
                    </span>
                  </CardTitle>
                  <CardDescription>
                    知识点: {question.knowledgePoints?.join(", ") || "未识别"}
                    {" · "}
                    难度: {"⭐".repeat(question.difficulty || 3)}
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {/* 快速标记按钮 */}
                  <button
                    onClick={() => handleQuestionMark(index, 'correct')}
                    className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      getQuestionMark(index) === 'correct'
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50'
                    }`}
                    title="做对了"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => handleQuestionMark(index, 'wrong')}
                    className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      getQuestionMark(index) === 'wrong'
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50'
                    }`}
                    title="做错了"
                  >
                    ✗
                  </button>
                  <button
                    onClick={() => handleQuestionMark(index, 'skipped')}
                    className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      getQuestionMark(index) === 'skipped'
                        ? 'bg-gray-400 border-gray-400 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    title="不会做"
                  >
                    ○
                  </button>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStartAnnotation(question.number)}
                    className="text-green-600 hover:text-green-700"
                  >
                    ✏️ 标注图片
                  </Button>
                  {question.bbox ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQuestionImages(prev => ({ ...prev, [question.number]: !prev[question.number] }))}
                    >
                      📷 {showQuestionImages[question.number] ? '隐藏' : '查看'}图片
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkNoImage(question.number)}
                      className="text-gray-500"
                    >
                      🚫 无图片
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditStart(question.number, question.content)}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteQuestion(question.number)}
                    className="text-red-600 hover:text-red-700"
                  >
                    删除
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editingQuestion === question.number ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleEditSave(question.number)}
                    >
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEditCancel}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap">{question.content}</p>
                  </div>
                  {question.options && question.options.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {question.options.map((option, i) => (
                        <div
                          key={i}
                          className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm"
                        >
                          {String.fromCharCode(65 + i)}. {option}
                        </div>
                      ))}
                    </div>
                  )}
                  {question.userAnswer && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                        识别到的学生答案:
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                        {question.userAnswer}
                      </p>
                    </div>
                  )}
                  {/* 显示题目图片区域（如果已标注） */}
                  {showQuestionImages[question.number] && question.bbox && examData?.imageUrl && (
                    <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <p className="text-xs text-gray-500 mb-2">标注的图片区域：</p>
                      <QuestionImageDisplay
                        question={question}
                        examImageUrl={examData.imageUrl}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleReparse}>
          重新上传
        </Button>
        <Button onClick={handleConfirm} size="lg">
          💾 保存 ({questions.length} 题)
        </Button>
      </div>
    </div>
  )
}

// 图像标注工具组件
function ImageAnnotationTool({
  imageUrl,
  questionNumber,
  onSave,
  onCancel
}: {
  imageUrl: string
  questionNumber: number
  onSave: (bbox: { x: number; y: number; width: number; height: number }) => void
  onCancel: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  // 图片加载完成后获取尺寸
  useEffect(() => {
    const img = imageRef.current
    if (img) {
      const updateSize = () => {
        setImageSize({
          width: img.offsetWidth,
          height: img.offsetHeight
        })
      }
      img.addEventListener('load', updateSize)
      updateSize()

      return () => img.removeEventListener('load', updateSize)
    }
  }, [imageUrl])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    setIsDragging(true)
    setStartPos({ x, y })
    setCurrentPos({ x, y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    setCurrentPos({ x, y })
  }

  const handleMouseUp = () => {
    if (!startPos || !currentPos) return

    setIsDragging(false)

    // 计算 bbox
    const x = Math.min(startPos.x, currentPos.x)
    const y = Math.min(startPos.y, currentPos.y)
    const width = Math.abs(currentPos.x - startPos.x)
    const height = Math.abs(currentPos.y - startPos.y)

    if (width > 1 && height > 1) {
      onSave({ x, y, width, height })
    }

    setStartPos(null)
    setCurrentPos(null)
  }

  // 计算实际像素值用于显示框选区域
  const getSelectionRect = () => {
    if (!startPos || !currentPos) return null

    const x = Math.min(startPos.x, currentPos.x)
    const y = Math.min(startPos.y, currentPos.y)
    const width = Math.abs(currentPos.x - startPos.x)
    const height = Math.abs(currentPos.y - startPos.y)

    return { x, y, width, height }
  }

  const selectionRect = getSelectionRect()

  return (
    <div className="space-y-4">
      {/* 操作说明 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>操作说明：</strong>
        </p>
        <ol className="text-sm text-blue-700 dark:text-blue-400 list-decimal list-inside mt-2 space-y-1">
          <li>在下方图片上<strong>按住鼠标拖拽</strong>，框选第 {questionNumber} 题对应的图片区域</li>
          <li>松开鼠标后自动保存标注</li>
          <li>如果该题没有对应图片，点击右上角「取消标注」，然后点击「🚫 无图片」按钮</li>
        </ol>
      </div>

      {/* 图片标注区域 */}
      <div
        ref={containerRef}
        className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ minHeight: 300 }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="试卷图片"
          className="w-full h-auto block"
          draggable={false}
        />

        {/* 框选区域 */}
        {selectionRect && (
          <div
            className="absolute border-2 border-green-500 bg-green-500/20 pointer-events-none"
            style={{
              left: `${selectionRect.x}%`,
              top: `${selectionRect.y}%`,
              width: `${selectionRect.width}%`,
              height: `${selectionRect.height}%`,
            }}
          />
        )}
      </div>

      {/* 当前选择信息 */}
      {selectionRect && (
        <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded p-2">
          选择区域: X:{selectionRect.x.toFixed(1)}%, Y:{selectionRect.y.toFixed(1)}%,
          大小: {selectionRect.width.toFixed(1)}% x {selectionRect.height.toFixed(1)}%
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          取消标注
        </Button>
      </div>
    </div>
  )
}

// 题目图片显示组件
function QuestionImageDisplay({ question, examImageUrl }: { question: Question; examImageUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  // 默认显示裁剪区域（如果有bbox的话）
  const [useCrop, setUseCrop] = useState(!!question.bbox)

  // 如果没有 bbox 信息，直接显示完整图片
  if (!question.bbox) {
    return (
      <div className="border rounded-lg overflow-hidden bg-gray-50">
        <p className="text-xs text-gray-500 p-2 bg-gray-100">完整试卷图片</p>
        <img
          src={examImageUrl}
          alt="题目图片"
          className="w-full h-auto"
          onError={(e) => {
            e.currentTarget.src = ''
            return <div className="p-4 text-center text-gray-500">图片加载失败</div>
          }}
        />
      </div>
    )
  }

  // 有 bbox 信息，提供裁剪和完整图两种选项
  return (
    <div className="border rounded-lg overflow-hidden bg-gray-50">
      <div className="flex gap-2 p-2 bg-gray-100">
        <button
          onClick={() => setUseCrop(false)}
          className={`px-3 py-1 text-xs rounded ${!useCrop ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          完整图片
        </button>
        <button
          onClick={() => setUseCrop(true)}
          className={`px-3 py-1 text-xs rounded ${useCrop ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          裁剪区域
        </button>
      </div>

      {!useCrop ? (
        // 显示完整图片
        <div className="relative">
          <img
            src={examImageUrl}
            alt="完整试卷图片"
            className="w-full h-auto"
          />
          {/* 标注题目区域 */}
          <div
            className="absolute border-2 border-red-500 bg-red-500/20 pointer-events-none"
            style={{
              left: `${question.bbox!.x}%`,
              top: `${question.bbox!.y}%`,
              width: `${question.bbox!.width}%`,
              height: `${question.bbox!.height}%`,
            }}
          />
        </div>
      ) : (
        // 显示裁剪图片
        <div className="p-2">
          <p className="text-xs text-gray-500 mb-2">
            裁剪区域: X{question.bbox!.x}%, Y{question.bbox!.y}%, 大小: {question.bbox!.width}%x{question.bbox!.height}%
          </p>
          <QuestionCropCanvas question={question} examImageUrl={examImageUrl} />
        </div>
      )}
    </div>
  )
}

// 裁剪画布组件 - 应用扫描效果
function QuestionCropCanvas({ question, examImageUrl }: { question: Question; examImageUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [processed, setProcessed] = useState(false)

  useEffect(() => {
    if (!canvasRef.current || !examImageUrl || !question.bbox) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        // 设置 canvas 尺寸
        const bbox = question.bbox!
        const width = Math.floor((bbox.width / 100) * img.naturalWidth)
        const height = Math.floor((bbox.height / 100) * img.naturalHeight)

        // 限制最大宽度，避免图片过大
        const maxWidth = 800
        const scale = width > maxWidth ? maxWidth / width : 1
        canvas.width = width * scale
        canvas.height = height * scale

        // 计算裁剪区域
        const sx = Math.floor((bbox.x / 100) * img.naturalWidth)
        const sy = Math.floor((bbox.y / 100) * img.naturalHeight)

        // 创建临时 canvas 来处理图像
        const tempCanvas = document.createElement('canvas')
        const tempCtx = tempCanvas.getContext('2d')
        if (!tempCtx) return

        tempCanvas.width = width
        tempCanvas.height = height

        // 绘制裁剪后的图片到临时 canvas
        tempCtx.drawImage(img, sx, sy, width, height, 0, 0, width, height)

        // 获取图像数据并应用扫描效果
        const imageData = tempCtx.getImageData(0, 0, width, height)
        const processedData = applyScanEffect(imageData)
        tempCtx.putImageData(processedData, 0, 0)

        // 将处理后的图像绘制到显示的 canvas
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)

        setImageLoaded(true)
        setProcessed(true)
      } catch (error) {
        console.error('Canvas draw error:', error)
        setImageLoaded(false)
      }
    }

    img.onerror = () => {
      console.error('Image load error')
      setImageLoaded(false)
    }

    img.src = examImageUrl
  }, [examImageUrl, question.bbox])

  // 扫描效果处理函数
  function applyScanEffect(imageData: ImageData): ImageData {
    const data = imageData.data

    // 遍历每个像素
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]

      // 计算亮度 (使用加权平均，符合人眼感知)
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255

      // 二值化阈值处理
      let value: number

      if (brightness > 0.85) {
        // 亮背景 -> 纯白
        value = 255
      } else if (brightness < 0.5) {
        // 深色文字 -> 增强黑色
        value = Math.max(0, brightness * 255 - 30)
      } else {
        // 中间色调 -> 增强对比度 (S 型曲线)
        const t = brightness
        value = Math.floor(
          255 * (
            t < 0.5
              ? 2 * t * t // 暗部更暗
              : 1 - 2 * (1 - t) * (1 - t) // 亮部更亮
          )
        )
      }

      // 应用处理后的值 (灰度)
      data[i] = value     // R
      data[i + 1] = value // G
      data[i + 2] = value // B
      // Alpha 通道保持不变
    }

    return imageData
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="px-2 py-1 bg-gray-100 border-b text-xs text-gray-600 flex items-center gap-1">
        <span>📷</span>
        <span>扫描效果</span>
        {processed && <span className="text-green-600">✓</span>}
      </div>
      {!imageLoaded && (
        <div className="p-8 text-center text-gray-500">
          加载图片中...
          <br />
          <span className="text-xs">(如果长时间未加载，可能图片地址已过期)</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-auto"
        style={{ display: imageLoaded ? 'block' : 'none' }}
      />
    </div>
  )
}
