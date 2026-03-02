"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function LearningPage() {
  const [selectedSubject, setSelectedSubject] = useState<"数学" | "物理" | "化学" | "英语">("数学")
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [userAnswer, setUserAnswer] = useState("")

  // 模拟题目数据 - 实际应从题库获取
  const questions = [
    {
      id: 1,
      subject: "数学",
      knowledgePoint: "二次函数",
      difficulty: 3,
      content: "已知二次函数 f(x) = x² - 4x + 3，求该函数的顶点坐标和与x轴的交点。",
      options: ["顶点(2,-1), 交点(1,0)和(3,0)", "顶点(2,1), 交点(1,0)和(3,0)", "顶点(-2,-1), 交点(-1,0)和(-3,0)", "顶点(2,-1), 交点(-1,0)和(-3,0)"],
      correctAnswer: 0,
      explanation: "二次函数 f(x) = x² - 4x + 3 可以写成顶点式 f(x) = (x-2)² - 1，所以顶点坐标是 (2, -1)。\n\n令 f(x) = 0，得 x² - 4x + 3 = 0，(x-1)(x-3) = 0，所以与x轴的交点是 (1,0) 和 (3,0)。",
    },
    {
      id: 2,
      subject: "数学",
      knowledgePoint: "三角函数",
      difficulty: 2,
      content: "已知 sin(α) = 3/5，且 α 为第一象限角，求 cos(α) 的值。",
      options: ["4/5", "3/5", "1/5", "2/5"],
      correctAnswer: 0,
      explanation: "根据三角恒等式 sin²(α) + cos²(α) = 1，\ncos²(α) = 1 - sin²(α) = 1 - (3/5)² = 1 - 9/25 = 16/25\n\n因为 α 在第一象限，cos(α) > 0，所以 cos(α) = 4/5",
    },
    {
      id: 3,
      subject: "物理",
      knowledgePoint: "牛顿第二定律",
      difficulty: 2,
      content: "一个质量为 2kg 的物体受到 10N 的水平推力作用，求物体的加速度是多少？",
      options: ["2 m/s²", "5 m/s²", "10 m/s²", "20 m/s²"],
      correctAnswer: 1,
      explanation: "根据牛顿第二定律 F = ma，\na = F/m = 10N / 2kg = 5 m/s²",
    },
  ]

  const currentQ = questions[currentQuestion]
  const subjectQuestions = questions.filter((q) => q.subject === selectedSubject)

  const handleSubjectChange = (subject: typeof selectedSubject) => {
    setSelectedSubject(subject)
    setCurrentQuestion(0)
    setShowAnswer(false)
    setUserAnswer("")
  }

  const handleAnswerSelect = (index: number) => {
    setUserAnswer(index.toString())
  }

  const handleSubmit = () => {
    setShowAnswer(true)
  }

  const handleNext = () => {
    if (currentQuestion < subjectQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setShowAnswer(false)
      setUserAnswer("")
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
      setShowAnswer(false)
      setUserAnswer("")
    }
  }

  return (
    <div className="space-y-8">
      {/* 标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          个性化学习
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          根据你的水平推荐的练习内容
        </p>
      </div>

      {/* 科目选择 */}
      <div className="flex gap-2 flex-wrap">
        {(["数学", "物理", "化学", "英语"] as const).map((subject) => (
          <Button
            key={subject}
            variant={selectedSubject === subject ? "default" : "outline"}
            onClick={() => handleSubjectChange(subject)}
          >
            {subject}
          </Button>
        ))}
      </div>

      {/* 学习内容 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 题目卡片 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>练习题目</CardTitle>
                  <CardDescription>
                    {selectedSubject} · {currentQ?.knowledgePoint} · 难度:{"⭐".repeat(currentQ?.difficulty || 1)}
                  </CardDescription>
                </div>
                <span className="text-sm text-gray-500">
                  {currentQuestion + 1} / {subjectQuestions.length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentQ && (
                <>
                  {/* 题目内容 */}
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="text-lg">{currentQ.content}</p>
                  </div>

                  {/* 选项 */}
                  <div className="space-y-3">
                    {currentQ.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => !showAnswer && handleAnswerSelect(index)}
                        disabled={showAnswer}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          showAnswer
                            ? index === currentQ.correctAnswer
                              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                              : userAnswer === index.toString()
                              ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                              : "border-gray-200 dark:border-gray-700"
                            : userAnswer === index.toString()
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <span className="font-medium mr-2">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>

                  {/* 答案解析 */}
                  {showAnswer && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h4 className="font-medium mb-2">📝 答案解析</h4>
                      <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                        {currentQ.explanation}
                      </p>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={currentQuestion === 0}
                    >
                      上一题
                    </Button>
                    <div className="flex gap-2">
                      {!showAnswer ? (
                        <Button
                          onClick={handleSubmit}
                          disabled={!userAnswer}
                        >
                          提交答案
                        </Button>
                      ) : (
                        <Button
                          onClick={handleNext}
                          disabled={currentQuestion === subjectQuestions.length - 1}
                        >
                          下一题
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 侧边栏 - 推荐内容 */}
        <div className="space-y-6">
          {/* 今日学习目标 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">今日学习目标</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked className="rounded" />
                <span className="text-sm">完成5道二次函数题目</span>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">复习三角函数基础</span>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">学习力学综合题</span>
              </div>
            </CardContent>
          </Card>

          {/* 待学习知识点 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">推荐学习</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {["二次函数图像", "三角函数公式", "牛顿运动定律"].map((item, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start text-sm"
                >
                  {item}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* 学习统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">本周统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">完成题目</span>
                <span className="font-medium">23 题</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">正确率</span>
                <span className="font-medium">78%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">学习时长</span>
                <span className="font-medium">3.5 小时</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
