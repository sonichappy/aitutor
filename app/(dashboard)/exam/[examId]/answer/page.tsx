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
  userAnswer?: string  // 从 OCR 识别的学生答案
}

interface AnswerData {
  questionId: string
  userAnswer: string
  isCorrect?: boolean
  isSkipped: boolean
  errorAnalysis?: string  // AI 分析的错误原因
  weakPoints?: string[]  // 薄弱知识点
  improvement?: string  // 改进建议
  aiExplanation?: string  // AI 详细解析
}

export default function ExamAnswerPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerData>>({})
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [analyzingAI, setAnalyzingAI] = useState(false)
  const [autoGrading, setAutoGrading] = useState(false)
  const [examSubject, setExamSubject] = useState("")

  useEffect(() => {
    // 加载试卷数据
    loadExamData()
  }, [examId])

  const loadExamData = async () => {
    try {
      // 从全局缓存获取（模拟数据库）
      const cache = (global as any).examCache?.[examId]
      if (cache) {
        setQuestions(cache.questions)
        setExamSubject(cache.subject || "")
      } else {
        // 如果缓存没有，尝试从 sessionStorage 读取
        const stored = sessionStorage.getItem(`exam_${examId}`)
        if (stored) {
          const data = JSON.parse(stored)
          setQuestions(data.questions || [])
          setExamSubject(data.subject || "")
        } else {
          alert("试卷数据不存在，请重新上传")
          router.push("/exam")
          return
        }
      }

      // 加载题目标记状态
      const marks = sessionStorage.getItem(`exam_marks_${examId}`)
      if (marks) {
        const marksData = JSON.parse(marks)
        const initialAnswers: Record<string, AnswerData> = {}
        Object.entries(marksData).forEach(([qNum, status]: [string, any]) => {
          if (status !== null) {  // 只加载明确标记的题目
            initialAnswers[qNum] = {
              questionId: qNum,
              userAnswer: '',
              isCorrect: status === 'correct' ? true : status === 'wrong' ? false : undefined,
              isSkipped: status === 'skipped',
            }
          }
        })
        setAnswers(initialAnswers)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const currentQuestion = questions[currentIndex]
  const currentAnswer = answers[currentQuestion?.number]?.userAnswer || ""
  // 未标记的题目默认为做对
  const hasMark = currentQuestion && answers[currentQuestion.number] !== undefined
  const currentResult = hasMark ? answers[currentQuestion.number]?.isCorrect : true  // 默认为正确
  const currentSkipped = hasMark ? (answers[currentQuestion.number]?.isSkipped || false) : false

  const handleAnswerChange = (value: string) => {
    if (submitted) return
    setAnswers({
      ...answers,
      [currentQuestion.number]: {
        questionId: currentQuestion.number.toString(),
        userAnswer: value,
        isCorrect: true,  // 默认为做对了
        isSkipped: false,
      },
    })
  }

  const handleResultChange = (result: "correct" | "wrong" | "skipped") => {
    // 如果点击当前状态，则取消标记（恢复为未标记，默认做对）
    const isCurrentlyCorrect = !currentSkipped && currentResult === true
    const isCurrentlyWrong = !currentSkipped && currentResult === false
    const isCurrentlySkipped = currentSkipped

    if ((result === 'correct' && isCurrentlyCorrect) ||
        (result === 'wrong' && isCurrentlyWrong) ||
        (result === 'skipped' && isCurrentlySkipped)) {
      // 取消标记
      const newAnswers = { ...answers }
      delete newAnswers[currentQuestion.number]
      setAnswers(newAnswers)

      // 更新 sessionStorage
      const marks = sessionStorage.getItem(`exam_marks_${examId}`)
      if (marks) {
        const marksData = JSON.parse(marks)
        delete marksData[currentQuestion.number]
        sessionStorage.setItem(`exam_marks_${examId}`, JSON.stringify(marksData))
      }
      return
    }

    // 设置新标记
    setAnswers({
      ...answers,
      [currentQuestion.number]: {
        questionId: currentQuestion.number.toString(),
        userAnswer: currentAnswer,
        isCorrect: result === 'skipped' ? undefined : result === 'correct',
        isSkipped: result === 'skipped',
      },
    })

    // 更新 sessionStorage
    const marks = sessionStorage.getItem(`exam_marks_${examId}`)
    const marksData = marks ? JSON.parse(marks) : {}
    marksData[currentQuestion.number] = result
    sessionStorage.setItem(`exam_marks_${examId}`, JSON.stringify(marksData))
  }

  const handleAIAnalyze = async () => {
    if (!currentAnswer.trim()) {
      alert("请先输入学生答案")
      return
    }

    setAnalyzingAI(true)

    try {
      const response = await fetch("/api/exam/analyze-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion,
          userAnswer: currentAnswer,
          subject: examSubject,
        }),
      })

      if (!response.ok) throw new Error("AI分析失败")

      const data = await response.json()

      // 更新答案数据，包含 AI 分析结果和正确性判定
      setAnswers({
        ...answers,
        [currentQuestion.number]: {
          ...answers[currentQuestion.number],
          questionId: currentQuestion.number.toString(),
          userAnswer: currentAnswer,
          isCorrect: data.isCorrect,
          correctAnswer: data.correctAnswer,
          errorAnalysis: data.errorAnalysis,
          weakPoints: data.weakPoints || [],
          improvement: data.improvement,
          aiExplanation: data.explanation,
          isSkipped: false,
        },
      })
    } catch (error) {
      console.error(error)
      alert("AI分析失败，请重试")
    } finally {
      setAnalyzingAI(false)
    }
  }

  // 一键判题所有已答题但标记为做错的题目
  const handleAutoGradeAll = async () => {
    // 找出所有已答题且标记为做错的题目
    const needAnalysis = questions.filter(q => {
      const ans = answers[q.number]
      return ans?.userAnswer && ans.userAnswer.trim() && ans.isCorrect === false && !ans.isSkipped && !ans.errorAnalysis
    })

    if (needAnalysis.length === 0) {
      alert("没有需要分析的题目（请先标记做错的题目）")
      return
    }

    if (!confirm(`即将使用 AI 分析 ${needAnalysis.length} 道错题，这可能需要一些时间。确定继续吗？`)) {
      return
    }

    setAutoGrading(true)

    try {
      let analyzed = 0

      for (const question of needAnalysis) {
        const answer = answers[question.number]

        try {
          const response = await fetch("/api/exam/analyze-question", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question,
              userAnswer: answer.userAnswer,
              subject: examSubject,
            }),
          })

          if (response.ok) {
            const data = await response.json()

            setAnswers(prev => ({
              ...prev,
              [question.number]: {
                ...prev[question.number],
                isCorrect: data.isCorrect,
                correctAnswer: data.correctAnswer,
                errorAnalysis: data.errorAnalysis,
                weakPoints: data.weakPoints || [],
                improvement: data.improvement,
                aiExplanation: data.explanation,
              },
            }))
          }
        } catch (error) {
          console.error(`Failed to analyze question ${question.number}:`, error)
        }

        analyzed++
      }

      alert(`已完成 ${analyzed} 道错题的分析`)
    } catch (error) {
      console.error(error)
      alert("批量分析失败，请重试")
    } finally {
      setAutoGrading(false)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleSubmit = async () => {
    if (!confirm("确定提交答案并生成分析报告吗？")) return

    try {
      // 保存答案并生成分析
      const response = await fetch(`/api/exam/${examId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.values(answers),
          questions,
        }),
      })

      if (!response.ok) throw new Error("分析失败")

      // 跳转到报告页面
      router.push(`/exam/${examId}/report`)
    } catch (error) {
      console.error(error)
      alert("提交失败，请重试")
    }
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

  if (!currentQuestion) {
    return <div>题目不存在</div>
  }

  const renderQuestionInput = () => {
    switch (currentQuestion.type) {
      case "choice":
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerChange(String.fromCharCode(65 + index))}
                disabled={submitted}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  currentAnswer === String.fromCharCode(65 + index)
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <span className="font-medium mr-2">
                  {String.fromCharCode(65 + index)}.
                </span>
                {option}
              </button>
            ))}
          </div>
        )

      case "fill":
        return (
          <Input
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            disabled={submitted}
            placeholder="请输入答案..."
            className="text-lg"
          />
        )

      default:
        return (
          <textarea
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            disabled={submitted}
            placeholder="请输入解答过程和答案..."
            className="w-full h-40 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          答案录入
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          填写学生答案，点击下方按钮标记状态（默认为做对了）
        </p>
      </div>

      {/* 进度 */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                进度: {currentIndex + 1} / {questions.length}
              </span>
              <Button
                onClick={handleAutoGradeAll}
                disabled={autoGrading || submitted}
                variant="outline"
                size="sm"
                className="text-purple-600 hover:text-purple-700 border-purple-600"
              >
                {autoGrading ? "分析中..." : "🤖 分析错题"}
              </Button>
            </div>
            <div className="flex gap-1">
              {questions.map((q, i) => {
                const answered = answers[q.number]?.userAnswer
                const isCorrect = answers[q.number]?.isCorrect !== false  // 默认为正确
                const isWrong = answers[q.number]?.isCorrect === false
                const isSkipped = answers[q.number]?.isSkipped

                return (
                  <div
                    key={q.number}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-8 h-8 flex items-center justify-center text-xs rounded cursor-pointer ${
                      i === currentIndex
                        ? "bg-blue-600 text-white"
                        : answered
                        ? isCorrect
                          ? "bg-green-100 text-green-700"
                          : isWrong
                          ? "bg-red-100 text-red-700"
                          : isSkipped
                          ? "bg-gray-100 text-gray-500"
                          : "bg-green-100 text-green-700"  // 默认绿色
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {q.number}
                  </div>
                )
              })}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 题目卡片 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>
                第 {currentQuestion.number} 题
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {currentQuestion.score} 分
                </span>
              </CardTitle>
              <CardDescription>
                知识点: {currentQuestion.knowledgePoints?.join(", ") || "未识别"}
                {" · "}
                难度: {"⭐".repeat(currentQuestion.difficulty || 3)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 题目内容 */}
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-lg whitespace-pre-wrap">{currentQuestion.content}</p>
          </div>

          {/* 答案输入 */}
          <div>{renderQuestionInput()}</div>

          {/* 结果标注 - 大按钮快速标记 */}
          <div className="border-t pt-4" key={`result-${currentQuestion.number}`}>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                标记状态:
              </label>
              {currentResult === false && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAIAnalyze}
                  disabled={analyzingAI}
                  className="text-purple-600 hover:text-purple-700"
                >
                  {analyzingAI ? "分析中..." : "🤖 AI 错因分析"}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleResultChange("correct")}
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                  currentResult === true && !currentSkipped
                    ? "bg-green-500 border-green-500 text-white shadow-lg"
                    : "bg-white border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50"
                }`}
              >
                <span className="text-xl">✓</span>
                <span className="ml-1">做对了</span>
              </button>
              <button
                onClick={() => handleResultChange("wrong")}
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                  currentResult === false && !currentSkipped
                    ? "bg-red-500 border-red-500 text-white shadow-lg"
                    : "bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50"
                }`}
              >
                <span className="text-xl">✗</span>
                <span className="ml-1">做错了</span>
              </button>
              <button
                onClick={() => handleResultChange("skipped")}
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                  currentSkipped
                    ? "bg-gray-400 border-gray-400 text-white shadow-lg"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="text-xl">○</span>
                <span className="ml-1">不会做</span>
              </button>
            </div>
          </div>

          {/* AI 分析结果 */}
          {answers[currentQuestion.number]?.errorAnalysis && (
            <div className="border-t pt-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-purple-900 dark:text-purple-300">
                  🤖 AI 分析结果
                </h4>

                {answers[currentQuestion.number].errorAnalysis && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      错误原因:
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {answers[currentQuestion.number].errorAnalysis}
                    </p>
                  </div>
                )}

                {answers[currentQuestion.number].weakPoints &&
                  answers[currentQuestion.number].weakPoints!.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      薄弱知识点:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {answers[currentQuestion.number].weakPoints!.map((point, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded"
                        >
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {answers[currentQuestion.number].improvement && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      改进建议:
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {answers[currentQuestion.number].improvement}
                    </p>
                  </div>
                )}

                {answers[currentQuestion.number].aiExplanation && (
                  <details className="mt-2">
                    <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                      📝 查看详细解析
                    </summary>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">
                      {answers[currentQuestion.number].aiExplanation}
                    </p>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* 导航按钮 */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              上一题
            </Button>
            <div className="flex gap-2">
              {currentIndex < questions.length - 1 ? (
                <Button onClick={handleNext}>下一题</Button>
              ) : (
                <Button onClick={handleSubmit}>提交分析</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
