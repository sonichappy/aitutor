"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Question {
  number: number
  type: string
  content: string
  options?: string[]
  score: number
  difficulty: number
  knowledgePoints: string[]
  userAnswer?: string
  position?: {
    page: number
    region: string
  }
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

  useEffect(() => {
    loadExamData()
  }, [examId])

  const loadExamData = async () => {
    try {
      const cache = (global as any).examCache?.[examId]
      if (cache) {
        setExamData(cache)
        setQuestions(cache.questions || [])
      } else {
        alert("试卷数据不存在，请重新上传")
        router.push("/exam")
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditStart = (questionNum: number, content: string) => {
    setEditingQuestion(questionNum)
    setEditContent(content)
  }

  const handleEditSave = (questionNum: number) => {
    const updated = questions.map(q =>
      q.number === questionNum ? { ...q, content: editContent } : q
    )
    setQuestions(updated)
    setEditingQuestion(null)

    // 更新缓存
    if (typeof global !== "undefined") {
      (global as any).examCache[examId].questions = updated
    }
  }

  const handleEditCancel = () => {
    setEditingQuestion(null)
    setEditContent("")
  }

  const handleDeleteQuestion = (questionNum: number) => {
    if (!confirm(`确定删除第 ${questionNum} 题吗？`)) return

    const updated = questions.filter(q => q.number !== questionNum)
    setQuestions(updated)

    // 更新缓存
    if (typeof global !== "undefined") {
      (global as any).examCache[examId].questions = updated
    }
  }

  const handleConfirm = () => {
    if (questions.length === 0) {
      alert("请至少保留一道题目")
      return
    }
    router.push(`/exam/${examId}/answer`)
  }

  const handleReparse = () => {
    router.push("/exam")
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{questions.length}</p>
              <p className="text-sm text-gray-600">识别题目</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {questions.filter(q => q.type === "choice").length}
              </p>
              <p className="text-sm text-gray-600">选择题</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {questions.filter(q => q.type === "fill").length}
              </p>
              <p className="text-sm text-gray-600">填空题</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {questions.filter(q => ["answer", "calculation", "essay"].includes(q.type)).length}
              </p>
              <p className="text-sm text-gray-600">解答题</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 原图预览切换 */}
      {examData.imageUrl && (
        <Card>
          <CardContent className="pt-6">
            <Button
              variant="outline"
              onClick={() => setShowImage(!showImage)}
              className="w-full"
            >
              {showImage ? "隐藏" : "显示"}原图
            </Button>
            {showImage && (
              <div className="mt-4 rounded-lg overflow-hidden border">
                <img
                  src={examData.imageUrl}
                  alt="试卷原图"
                  className="w-full h-auto"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 题目列表 */}
      <div className="space-y-4">
        {questions.map((question) => (
          <Card key={question.number} className={editingQuestion === question.number ? "ring-2 ring-blue-500" : ""}>
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
                <div className="flex gap-2">
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
          确认无误，继续 ({questions.length} 题)
        </Button>
      </div>
    </div>
  )
}
