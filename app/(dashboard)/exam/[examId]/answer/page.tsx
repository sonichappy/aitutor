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
}

interface AnswerData {
  questionId: string
  userAnswer: string
  isCorrect?: boolean
  isSkipped: boolean
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
      } else {
        // 如果缓存没有，显示错误
        alert("试卷数据不存在，请重新上传")
        router.push("/exam")
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const currentQuestion = questions[currentIndex]
  const currentAnswer = answers[currentQuestion?.number]?.userAnswer || ""
  const currentResult = answers[currentQuestion?.number]?.isCorrect
  const currentSkipped = answers[currentQuestion?.number]?.isSkipped || false

  const handleAnswerChange = (value: string) => {
    if (submitted) return
    setAnswers({
      ...answers,
      [currentQuestion.number]: {
        questionId: currentQuestion.number.toString(),
        userAnswer: value,
        isSkipped: false,
      },
    })
  }

  const handleResultChange = (result: "correct" | "wrong" | "skipped") => {
    setAnswers({
      ...answers,
      [currentQuestion.number]: {
        questionId: currentQuestion.number.toString(),
        userAnswer: currentAnswer,
        isCorrect: result === "correct" ? true : result === "wrong" ? false : undefined,
        isSkipped: result === "skipped",
      },
    })
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
          逐题填写答案，标注对错
        </p>
      </div>

      {/* 进度 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              进度: {currentIndex + 1} / {questions.length}
            </span>
            <div className="flex gap-1">
              {questions.map((q, i) => {
                const answered = answers[q.number]?.userAnswer
                const isCorrect = answers[q.number]?.isCorrect
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
                          : "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {q.number}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
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

          {/* 结果标注 */}
          <div className="border-t pt-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              答题结果:
            </label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`result-${currentQuestion.number}`}
                  checked={currentResult === true && !currentSkipped}
                  onChange={() => handleResultChange("correct")}
                  className="w-4 h-4 text-green-600"
                />
                <span className="text-green-700 dark:text-green-400">✓ 正确</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`result-${currentQuestion.number}`}
                  checked={currentResult === false && !currentSkipped}
                  onChange={() => handleResultChange("wrong")}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-red-700 dark:text-red-400">✗ 错误</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`result-${currentQuestion.number}`}
                  checked={currentSkipped}
                  onChange={() => handleResultChange("skipped")}
                  className="w-4 h-4 text-gray-600"
                />
                <span className="text-gray-600">○ 未做</span>
              </label>
            </div>
          </div>

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
