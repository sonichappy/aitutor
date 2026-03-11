"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, BookOpen, Loader2 } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import { Checkbox } from "@/components/ui/checkbox"

interface Subject {
  id: string
  name: string
  icon: string
  color: string
  enabled: boolean
  category: string
  folderName: string
}

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

interface SavedWeakPoint {
  point: string
  severity: number
  reason: string
  priority: number
  count: number
  sourceReports: string[]
  addedAt: string
}

export default function LearningPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [userAnswer, setUserAnswer] = useState("")

  // 薄弱知识点相关
  const [savedWeakPoints, setSavedWeakPoints] = useState<SavedWeakPoint[]>([])
  const [selectedWeakPoints, setSelectedWeakPoints] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [generateContentType, setGenerateContentType] = useState<'both' | 'content' | 'questions'>('both')

  // 学习资料相关
  const [materials, setMaterials] = useState<ExerciseMaterial[]>([])
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<ExerciseMaterial | null>(null)

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const response = await fetch('/api/subjects')
        if (response.ok) {
          const data = await response.json()
          const enabledSubjects = data.subjects?.filter((s: Subject) => s.enabled) || []
          setSubjects(enabledSubjects)
          if (enabledSubjects.length > 0) {
            setSelectedSubject(enabledSubjects[0].name)
          }
        }
      } catch (error) {
        console.error("Failed to load subjects:", error)
      }
    }
    loadSubjects()
  }, [])

  // 切换学科时重置状态
  useEffect(() => {
    if (selectedSubject) {
      loadSavedWeakPoints()
      loadMaterials()
      setSelectedWeakPoints(new Set())
      setExpandedMaterial(null)
      setSelectedMaterial(null)
      setCurrentQuestion(0)
      setShowAnswer(false)
      setUserAnswer("")
    }
  }, [selectedSubject])

  // 加载保存的薄弱知识点列表
  const loadSavedWeakPoints = async () => {
    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/weak-points`)
      if (response.ok) {
        const data = await response.json()
        const points = data.weakPoints || []
        // 按优先级排序（priority 数字越小优先级越高）
        setSavedWeakPoints(points.sort((a: SavedWeakPoint, b: SavedWeakPoint) => a.priority - b.priority))
      }
    } catch (error) {
      console.error("Failed to load saved weak points:", error)
    }
  }

  // 加载学习材料
  const loadMaterials = async () => {
    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/materials`)
      if (response.ok) {
        const data = await response.json()
        setMaterials(data.materials || [])
      }
    } catch (error) {
      console.error("Failed to load materials:", error)
    }
  }

  // 生成学习内容
  const handleGenerateContent = async () => {
    if (selectedWeakPoints.size === 0) {
      alert("请先选择至少一个薄弱知识点")
      return
    }

    setGenerating(true)

    try {
      const selectedPointsList = savedWeakPoints.filter(wp => selectedWeakPoints.has(wp.point))
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/generate-materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weakPoints: selectedPointsList.map(wp => ({
            point: wp.point,
            severity: wp.severity,
            reason: wp.reason,
            priority: wp.priority
          })),
          generateContent: generateContentType === 'both' || generateContentType === 'content',
          generateQuestions: generateContentType === 'both' || generateContentType === 'questions'
        })
      })

      if (response.ok) {
        const data = await response.json()
        await loadMaterials()
        alert(`学习内容已生成！包含 ${data.materialCount} 个知识点的学习资料`)
      } else {
        const error = await response.json()
        alert(error.error || "生成学习内容失败")
      }
    } catch (error: any) {
      console.error("Failed to generate content:", error)
      alert("生成学习内容失败：" + error.message)
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

  const toggleWeakPointSelection = (point: string) => {
    const newSelected = new Set(selectedWeakPoints)
    if (newSelected.has(point)) {
      newSelected.delete(point)
    } else {
      newSelected.add(point)
    }
    setSelectedWeakPoints(newSelected)
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

  const currentQ = selectedMaterial?.questions?.[currentQuestion]

  if (subjects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-gray-500 mb-4">尚未启用任何学科，请先在设置中启用学科</p>
            <Button onClick={() => (window.location.href = "/settings")}>前往设置</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 标题和学科选择 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">个性化学习</h1>

        {/* 学科选择 */}
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
      </div>

      {/* 主内容区域：两栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：薄弱知识点列表 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">薄弱知识点</CardTitle>
                  <CardDescription>
                    {savedWeakPoints.length} 个薄弱项
                  </CardDescription>
                </div>
                {savedWeakPoints.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allPoints = new Set(savedWeakPoints.map(p => p.point))
                      setSelectedWeakPoints(
                        selectedWeakPoints.size === savedWeakPoints.length ? new Set() : allPoints
                      )
                    }}
                  >
                    {selectedWeakPoints.size === savedWeakPoints.length ? "取消全选" : "全选"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {savedWeakPoints.length === 0 ? (
                <div className="py-8 text-center text-gray-500 border-2 border-dashed rounded-lg">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>暂无薄弱知识点</p>
                  <p className="text-sm mt-1">请先到"学科报告"页面从报告中提取薄弱点</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {savedWeakPoints.map((wp) => (
                    <div
                      key={wp.point}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedWeakPoints.has(wp.point)
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                      onClick={() => toggleWeakPointSelection(wp.point)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedWeakPoints.has(wp.point)}
                          onCheckedChange={() => toggleWeakPointSelection(wp.point)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-sm">{wp.point}</span>
                            <span className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(wp.severity)}`}>
                              {getSeverityLabel(wp.severity)}
                            </span>
                            <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              出现 {wp.count} 次
                            </span>
                          </div>
                          {wp.reason && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                              {wp.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 生成内容按钮 */}
              {savedWeakPoints.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">生成内容类型</label>
                    <div className="flex gap-2">
                      <Button
                        variant={generateContentType === 'both' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGenerateContentType('both')}
                      >
                        讲解+习题
                      </Button>
                      <Button
                        variant={generateContentType === 'content' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGenerateContentType('content')}
                      >
                        仅讲解
                      </Button>
                      <Button
                        variant={generateContentType === 'questions' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGenerateContentType('questions')}
                      >
                        仅习题
                      </Button>
                    </div>
                  </div>
                  <Button
                    onClick={handleGenerateContent}
                    disabled={selectedWeakPoints.size === 0 || generating}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : `生成学习内容 (${selectedWeakPoints.size} 个)`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：学习资料 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">学习资料</CardTitle>
              <CardDescription>
                {materials.length} 个知识点已生成
              </CardDescription>
            </CardHeader>
            <CardContent>
              {materials.length === 0 ? (
                <div className="py-8 text-center text-gray-500 border-2 border-dashed rounded-lg">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>暂无学习资料</p>
                  <p className="text-sm mt-1">选择左侧薄弱点生成学习内容</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {materials.map((material, index) => (
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
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{material.knowledgePoint}</span>
                            <span className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(material.severity)}`}>
                              {getSeverityLabel(material.severity)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {material.questions?.length || 0} 道练习题
                            {material.learningContent && " · 有讲解"}
                          </p>
                        </div>
                        {expandedMaterial === (material.id || index) ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>

                      {/* 展开的学习内容 */}
                      {expandedMaterial === (material.id || index) && material.learningContent && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{material.learningContent}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 练习题区域 */}
      {selectedMaterial && selectedMaterial.questions && selectedMaterial.questions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>练习题目</CardTitle>
                <CardDescription>
                  {selectedMaterial.knowledgePoint} · 第 {currentQuestion + 1} / {selectedMaterial.questions?.length || 0} 题
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
              <div className="py-8 text-center text-gray-500">
                已做完所有练习题
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
