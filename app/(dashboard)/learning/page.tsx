"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getEnabledSubjects, type Subject } from "@/types/subject"
import { ChevronDown, ChevronUp, BookOpen, CheckCircle2, AlertCircle, Clock, FileText, Loader2 } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import { Checkbox } from "@/components/ui/checkbox"

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

interface DeepReport {
  id: string
  generatedAt: string
  summary: string
}

interface WeakPoint {
  point: string
  severity: number
  reason: string
  priority: number
  sourceReports: string[]  // 来源报告ID列表
}

// 步骤枚举
type Step = 'select' | 'review' | 'generate' | 'practice'

export default function LearningPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [userAnswer, setUserAnswer] = useState("")

  // UI 状态
  const [currentStep, setCurrentStep] = useState<Step>('select')
  const [generating, setGenerating] = useState(false)

  // 报告选择相关
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'all'>('all')
  const [deepReports, setDeepReports] = useState<DeepReport[]>([])
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set())

  // 薄弱知识点相关
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([])
  const [extracting, setExtracting] = useState(false)
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set())
  const [generateContent, setGenerateContent] = useState<'both' | 'content' | 'questions'>('both')

  // 学习资料相关
  const [materials, setMaterials] = useState<ExerciseMaterial[]>([])
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

  // 切换学科时重置状态
  useEffect(() => {
    if (selectedSubject) {
      setCurrentStep('select')
      setWeakPoints([])
      setMaterials([])
      setSelectedPoints(new Set())
      setSelectedReports(new Set())
    }
  }, [selectedSubject])

  // 加载深入分析报告
  const loadDeepReports = async () => {
    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/deep-reports?timeRange=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        setDeepReports(data.reports || [])
      }
    } catch (error) {
      console.error("Failed to load deep reports:", error)
    }
  }

  // 提取薄弱知识点
  const handleExtractWeakPoints = async () => {
    if (selectedReports.size === 0) {
      alert("请先选择至少一份深入分析报告")
      return
    }

    setExtracting(true)
    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/extract-weak-points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportIds: Array.from(selectedReports)
        })
      })

      if (response.ok) {
        const data = await response.json()
        // 去重薄弱知识点
        const uniquePoints = data.weakPoints.filter((point: WeakPoint, index: number, self: any) =>
          index === self.findIndex((p: WeakPoint) => p.point === point.point)
        )
        setWeakPoints(uniquePoints)
        setCurrentStep('review')
      } else {
        const error = await response.json()
        alert(error.error || "提取薄弱知识点失败")
      }
    } catch (error: any) {
      console.error("Failed to extract weak points:", error)
      alert("提取薄弱知识点失败：" + error.message)
    } finally {
      setExtracting(false)
    }
  }

  // 生成学习内容
  const handleGenerateContent = async () => {
    if (selectedPoints.size === 0) {
      alert("请先选择至少一个薄弱知识点")
      return
    }

    setGenerating(true)
    setCurrentStep('generate')

    try {
      const selectedPointsList = Array.from(selectedPoints)
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/generate-materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weakPoints: selectedPointsList.map(p => ({ point: p })),
          generateContent,
          generateQuestions: generateContent === 'both' || generateContent === 'questions'
        })
      })

      if (response.ok) {
        const data = await response.json()

        // 加载生成后的材料
        await loadLearningPlan()

        // 如果只生成了讲解，跳转到练习视图
        if (generateContent === 'content') {
          alert(`学习资料已生成！包含 ${data.materialCount} 个知识点的讲解内容`)
        } else if (generateContent === 'questions') {
          alert(`练习题已生成！包含 ${data.materialCount} 个知识点的练习题`)
        } else {
          alert(`学习内容已生成！包含 ${data.materialCount} 个知识点的讲解和练习题`)
        }
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

  // 加载学习计划/材料
  const loadLearningPlan = async () => {
    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/materials`)
      if (response.ok) {
        const data = await response.json()
        setMaterials(data.materials || [])
        if (data.materials && data.materials.length > 0) {
          setCurrentStep('practice')
        }
      }
    } catch (error) {
      console.error("Failed to load materials:", error)
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

  const toggleReportSelection = (reportId: string) => {
    const newSelected = new Set(selectedReports)
    if (newSelected.has(reportId)) {
      newSelected.delete(reportId)
    } else {
      newSelected.add(reportId)
    }
    setSelectedReports(newSelected)
  }

  const togglePointSelection = (point: string) => {
    const newSelected = new Set(selectedPoints)
    if (newSelected.has(point)) {
      newSelected.delete(point)
    } else {
      newSelected.add(point)
    }
    setSelectedPoints(newSelected)
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
    <div className="space-y-8">
      {/* 标题和进度指示 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">个性化学习</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            根据您的薄弱点生成专属学习计划和练习题
          </p>
        </div>

        {/* 进度指示器 */}
        <div className="flex items-center gap-2 text-sm">
          <span className={currentStep === 'select' ? "text-blue-600 font-medium" : "text-gray-400"}>
            1. 选择报告
          </span>
          <span className="text-gray-300">→</span>
          <span className={currentStep === 'review' ? "text-blue-600 font-medium" : "text-gray-400"}>
            2. 选择知识点
          </span>
          <span className="text-gray-300">→</span>
          <span className={currentStep === 'generate' ? "text-blue-600 font-medium" : "text-gray-400"}>
            3. 生成内容
          </span>
          <span className="text-gray-300">→</span>
          <span className={currentStep === 'practice' ? "text-blue-600 font-medium" : "text-gray-400"}>
            4. 开始练习
          </span>
        </div>
      </div>

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

      {/* 步骤 1: 选择报告 */}
      {currentStep === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle>选择深入分析报告</CardTitle>
            <CardDescription>选择要分析的时间范围和报告，系统将从中提取薄弱知识点</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 时间范围选择 */}
            <div>
              <label className="text-sm font-medium mb-3 block">时间范围</label>
              <div className="flex gap-2">
                <Button
                  variant={timeRange === 'week' ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setTimeRange('week'); loadDeepReports() }}
                >
                  最近一周
                </Button>
                <Button
                  variant={timeRange === 'month' ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setTimeRange('month'); loadDeepReports() }}
                >
                  最近一个月
                </Button>
                <Button
                  variant={timeRange === 'quarter' ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setTimeRange('quarter'); loadDeepReports() }}
                >
                  最近三个月
                </Button>
                <Button
                  variant={timeRange === 'all' ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setTimeRange('all'); loadDeepReports() }}
                >
                  全部
                </Button>
              </div>
            </div>

            {/* 报告列表 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">
                  深入分析报告 ({deepReports.length} 份)
                </label>
                {deepReports.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allIds = new Set(deepReports.map(r => r.id))
                      setSelectedReports(
                        selectedReports.size === deepReports.length ? new Set() : allIds
                      )
                    }}
                  >
                    {selectedReports.size === deepReports.length ? "取消全选" : "全选"}
                  </Button>
                )}
              </div>

              {deepReports.length === 0 ? (
                <div className="py-8 text-center text-gray-500 border-2 border-dashed rounded-lg">
                  <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>该时间段内没有深入分析报告</p>
                  <p className="text-sm mt-1">请先到"学科报告"页面生成深入分析报告</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {deepReports.map((report) => (
                    <div
                      key={report.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedReports.has(report.id)
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                      onClick={() => toggleReportSelection(report.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedReports.has(report.id)}
                            onCheckedChange={() => toggleReportSelection(report.id)}
                          />
                          <div>
                            <p className="text-sm font-medium">深入分析报告</p>
                            <p className="text-xs text-gray-500">
                              {new Date(report.generatedAt).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2">
              <Button
                onClick={handleExtractWeakPoints}
                disabled={selectedReports.size === 0 || extracting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    提取中...
                  </>
                ) : "下一步：提取薄弱知识点"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 步骤 2: 选择知识点 */}
      {currentStep === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle>选择薄弱知识点</CardTitle>
            <CardDescription>已从 {selectedReports.size} 份报告中提取出 {weakPoints.length} 个薄弱知识点</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 知识点列表 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">
                  薄弱知识点列表
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allPoints = new Set(weakPoints.map(p => p.point))
                      setSelectedPoints(
                        selectedPoints.size === weakPoints.length ? new Set() : allPoints
                      )
                    }}
                  >
                    {selectedPoints.size === weakPoints.length ? "取消全选" : "全选"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep('select')}
                  >
                    返回
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {weakPoints.map((wp, index) => (
                  <div
                    key={wp.point}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedPoints.has(wp.point)
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}
                    onClick={() => togglePointSelection(wp.point)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox
                            checked={selectedPoints.has(wp.point)}
                            onCheckedChange={() => togglePointSelection(wp.point)}
                          />
                          <span className="font-medium">{wp.point}</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(wp.severity)}`}>
                            {getSeverityLabel(wp.severity)}
                          </span>
                        </div>
                        {wp.reason && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {wp.reason}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">#{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 生成选项 */}
            <div>
              <label className="text-sm font-medium mb-3 block">生成内容类型</label>
              <div className="flex gap-2">
                <Button
                  variant={generateContent === 'both' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGenerateContent('both')}
                >
                  📚 讲解 + 习题
                </Button>
                <Button
                  variant={generateContent === 'content' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGenerateContent('content')}
                >
                  📖 仅讲解
                </Button>
                <Button
                  variant={generateContent === 'questions' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGenerateContent('questions')}
                >
                  ✏️ 仅习题
                </Button>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2">
              <Button
                onClick={handleGenerateContent}
                disabled={selectedPoints.size === 0 || generating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : `生成学习内容 (${selectedPoints.size} 个知识点)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 步骤 3: 生成进度 */}
      {currentStep === 'generate' && generating && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-medium">正在生成学习内容...</p>
              <p className="text-sm text-gray-500 mt-2">这可能需要几分钟时间，请耐心等待</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 步骤 4: 练习界面 */}
      {currentStep === 'practice' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：学习资料列表 */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">学习资料</CardTitle>
                <CardDescription>
                  {materials.length} 个知识点
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{material.knowledgePoint}</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(material.severity)}`}>
                            {getSeverityLabel(material.severity)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
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
              </CardContent>
            </Card>

            {/* 重新生成按钮 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">更多操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setCurrentStep('select')}
                >
                  🔄 生成新的学习计划
                </Button>
              </CardContent>
            </Card>
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
                        <p>请从左侧选择学习资料开始练习</p>
                      </div>
                    )}
                  </CardContent>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
