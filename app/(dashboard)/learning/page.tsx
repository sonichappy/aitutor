"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getEnabledSubjects, type Subject } from "@/types/subject"
import { ChevronDown, ChevronUp, BookOpen, CheckCircle2, AlertCircle } from "lucide-react"
import ReactMarkdown from 'react-markdown'

interface ExerciseQuestion {
  id: string
  type: string
  content: string
  options?: string[]
  correctAnswer: string
  explanation?: string
  difficulty: number
  knowledgePoint: string
}

interface ExerciseMaterial {
  id: string
  knowledgePoint: string
  severity: number
  learningContent: string
  questions: ExerciseQuestion[]
  sources: string[]
  createdAt: string
}

interface LearningPlan {
  subject: string
  subjectFolder: string
  weakPoints: Array<{
    point: string
    severity: number
    errorCount?: number
  }>
  materials: ExerciseMaterial[]
  createdAt: string
  planId: string
}

export default function LearningPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [userAnswer, setUserAnswer] = useState("")

  // 学习计划相关状态
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<ExerciseMaterial | null>(null)

  useEffect(() => {
    const loadSubjects = async () => {
      const enabledSubjects = await getEnabledSubjects()
      setSubjects(enabledSubjects)
      if (enabledSubjects.length > 0) {
        setSelectedSubject(enabledSubjects[0].name)
      }
    }
    loadSubjects()
  }, [])

  // 切换学科时加载学习计划
  useEffect(() => {
    if (selectedSubject) {
      loadLearningPlan()
    }
  }, [selectedSubject])

  const loadLearningPlan = async () => {
    setLoadingPlan(true)
    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/materials`)
      if (response.ok) {
        const data = await response.json()
        setLearningPlan(data.plan)
      }
    } catch (error) {
      console.error("Failed to load learning plan:", error)
    } finally {
      setLoadingPlan(false)
    }
  }

  const handleGeneratePlan = async () => {
    setGenerating(true)
    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/generate-plan`, {
        method: "POST"
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          await loadLearningPlan()
          alert(data.message)
        } else {
          alert(data.error || "生成学习计划失败")
        }
      } else {
        const error = await response.json()
        alert(error.error || "生成学习计划失败")
      }
    } catch (error: any) {
      console.error("Failed to generate plan:", error)
      alert("生成学习计划失败：" + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSelectMaterial = (material: ExerciseMaterial) => {
    setSelectedMaterial(material)
    setCurrentQuestion(0)
    setShowAnswer(false)
    setUserAnswer("")
    setExpandedMaterial(material.id)
  }

  const currentQ = selectedMaterial?.questions?.[currentQuestion]

  const handleAnswerSelect = (index: number) => {
    setUserAnswer(index.toString())
  }

  const handleSubmit = () => {
    setShowAnswer(true)
  }

  const handleNext = () => {
    if (currentQuestion < (selectedMaterial?.questions?.length || 0) - 1) {
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

  const getSeverityColor = (severity: number) => {
    if (severity >= 4) return "text-red-600 bg-red-50"
    if (severity >= 3) return "text-orange-600 bg-orange-50"
    return "text-yellow-600 bg-yellow-50"
  }

  const getSeverityLabel = (severity: number) => {
    if (severity >= 4) return "严重薄弱"
    if (severity >= 3) return "较薄弱"
    return "需加强"
  }

  if (subjects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-gray-500 mb-4">
              尚未启用任何学科，请先在设置中启用学科
            </p>
            <Button onClick={() => (window.location.href = "/settings")}>
              前往设置
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            个性化学习
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            根据您的薄弱点生成专属学习计划和练习题
          </p>
        </div>
        <Button
          onClick={handleGeneratePlan}
          disabled={generating}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          {generating ? "生成中..." : "🎯 生成学习计划"}
        </Button>
      </div>

      {/* 科目选择 */}
      <div className="flex gap-2 flex-wrap">
        {subjects.map((subject) => (
          <Button
            key={subject.id}
            variant={selectedSubject === subject.name ? "default" : "outline"}
            onClick={() => setSelectedSubject(subject.name)}
          >
            {subject.icon} {subject.name}
          </Button>
        ))}
      </div>

      {/* 学习内容 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：学习资料列表 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">学习资料</CardTitle>
              <CardDescription>
                {loadingPlan ? "加载中..." : learningPlan ? `${learningPlan.materials?.length || 0} 个薄弱知识点` : "暂无学习计划"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {learningPlan?.materials && learningPlan.materials.length > 0 ? (
                learningPlan.materials.map((material, index) => (
                  <div
                    key={material.id || index}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      expandedMaterial === (material.id || index)
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}
                    onClick={() => handleSelectMaterial(material)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{material.knowledgePoint}</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(material.severity)}`}>
                            {getSeverityLabel(material.severity)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {material.questions?.length || 0} 道练习题
                        </p>
                      </div>
                      {expandedMaterial === (material.id || index) ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>

                    {/* 展开的学习内容 */}
                    {expandedMaterial === (material.id || index) && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{material.learningContent}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-gray-500">
                  {loadingPlan ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                      加载中...
                    </div>
                  ) : (
                    <div>
                      <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>请先点击"生成学习计划"按钮</p>
                      <p className="text-xs mt-1">系统会根据您的错题情况生成专属学习内容</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 薄弱知识点概览 */}
          {learningPlan?.weakPoints && learningPlan.weakPoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">薄弱知识点</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {learningPlan.weakPoints.map((wp, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                      <span className="text-sm">{wp.point}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(wp.severity)}`}>
                        {getSeverityLabel(wp.severity)}
                      </span>
                      {wp.errorCount && (
                        <span className="text-xs text-gray-500">{wp.errorCount}题</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：练习题区域 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>练习题目</CardTitle>
                  <CardDescription>
                    {selectedMaterial ? (
                      <>
                        {selectedMaterial.knowledgePoint} · 第 {currentQuestion + 1} / {selectedMaterial.questions?.length || 0} 题
                      </>
                    ) : (
                      "请从左侧选择学习资料"
                    )}
                  </CardDescription>
                </div>
                {currentQ && (
                  <span className="text-sm text-gray-500">
                    难度: {"⭐".repeat(Math.min(currentQ.difficulty || 1, 5))}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentQ ? (
                <>
                  {/* 题目内容 */}
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="text-lg">{currentQ.content}</p>
                  </div>

                  {/* 选项 */}
                  {currentQ.options && (
                    <div className="space-y-3">
                      {currentQ.options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => !showAnswer && handleAnswerSelect(index)}
                          disabled={showAnswer}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            showAnswer
                              ? currentQ.correctAnswer === String.fromCharCode(65 + index)
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
                          {showAnswer && currentQ.correctAnswer === String.fromCharCode(65 + index) && (
                            <CheckCircle2 className="w-5 h-5 text-green-600 inline ml-2" />
                          )}
                          {showAnswer && userAnswer === index.toString() && currentQ.correctAnswer !== String.fromCharCode(65 + index) && (
                            <AlertCircle className="w-5 h-5 text-red-600 inline ml-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 答案解析 */}
                  {showAnswer && currentQ.explanation && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h4 className="font-medium mb-2">📝 答案解析</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
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
                          disabled={currentQuestion === (selectedMaterial?.questions?.length || 0) - 1}
                        >
                          下一题
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <CardContent className="py-12 text-center text-gray-500">
                  {selectedMaterial ? (
                    "已做完所有练习题"
                  ) : (
                    <div>
                      <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p className="mb-2">请从左侧选择学习资料开始练习</p>
                      <p className="text-sm">或点击上方"生成学习计划"按钮</p>
                    </div>
                  )}
                </CardContent>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
