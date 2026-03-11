"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getEnabledSubjects, clearSubjectsCache, getDefaultReportPrompt, saveSubjects, type Subject } from "@/types/subject"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Loader2, Brain, Sparkles, Calendar, BookOpen } from "lucide-react"
import { DetailedAnalysisViewer } from "@/app/(dashboard)/subject/english/DetailedAnalysisViewer"

// 普通报告接口
interface Report {
  id: string
  subject: string
  title: string
  startDate: string
  endDate: string
  generatedAt: string
  stats: {
    totalExams: number
    totalQuestions: number
    wrongQuestions: number
    avgAccuracy: number
  }
  hasAnalysis: boolean
}

// 深度分析报告接口
interface DeepResearchReport {
  id: string
  subject: string
  subjectId: string
  analysisType: string
  generatedAt: string
  analysisTime: number
  summary: string
  reportMetadata?: {
    reportType?: string
    examTimeRange?: { start: string; end: string }
    totalQuestions?: number
    wrongQuestionsCount?: number
    questionTypes?: string[]
    knowledgePoints?: string[]
    modelName?: string
    analysisDurationFormatted?: string
  }
  metadata: {
    subject: string
    analysisTime: number
    dataPoints: number
    confidenceLevel: number
  }
}

interface SubjectReports {
  subject: string
  reports: Report[]
  total: number
}

interface SubjectDeepReports {
  subject: string
  reports: DeepResearchReport[]
  total: number
}

export default function SubjectsPage() {
  const router = useRouter()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectReports, setSubjectReports] = useState<Record<string, SubjectReports>>({})
  const [subjectDeepReports, setSubjectDeepReports] = useState<Record<string, SubjectDeepReports>>({})
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState<string | null>(null)

  // 普通报告生成对话框状态
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showPromptDialog, setShowPromptDialog] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [reportTitle, setReportTitle] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [promptValue, setPromptValue] = useState("")

  // 深度分析对话框状态
  const [showDeepAnalysisDialog, setShowDeepAnalysisDialog] = useState(false)
  const [deepAnalyzing, setDeepAnalyzing] = useState(false)
  const [analysisType, setAnalysisType] = useState<string>('comprehensive')
  const [deepAnalysisTimeRange, setDeepAnalysisTimeRange] = useState<'all' | 'custom'>('all')
  const [deepAnalysisStartDate, setDeepAnalysisStartDate] = useState("")
  const [deepAnalysisEndDate, setDeepAnalysisEndDate] = useState("")
  const [deepAnalysisResult, setDeepAnalysisResult] = useState<any>(null)
  const [deepAnalysisError, setDeepAnalysisError] = useState<string | null>(null)

  // 从报告生成学习内容状态
  const [generatingLearning, setGeneratingLearning] = useState<string | null>(null) // reportId

  useEffect(() => {
    loadSubjects()
  }, [])

  useEffect(() => {
    if (subjects.length > 0) {
      loadReportsForAllSubjects()
      loadDeepReportsForAllSubjects()
    }
  }, [subjects])

  const loadSubjects = async () => {
    try {
      clearSubjectsCache()
      const enabledSubjects = await getEnabledSubjects()
      setSubjects(enabledSubjects)
    } catch (error) {
      console.error("Failed to load subjects:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadReportsForAllSubjects = async () => {
    const reportsData: Record<string, SubjectReports> = {}

    for (const subject of subjects) {
      try {
        const response = await fetch(`/api/reports/${encodeURIComponent(subject.name)}`)
        if (response.ok) {
          const data = await response.json()
          reportsData[subject.name] = data
        }
      } catch (error) {
        console.error(`Failed to load reports for ${subject.name}:`, error)
      }
    }

    setSubjectReports(reportsData)
  }

  const loadDeepReportsForAllSubjects = async () => {
    const reportsData: Record<string, SubjectDeepReports> = {}

    for (const subject of subjects) {
      try {
        const response = await fetch(`/api/reports/${encodeURIComponent(subject.name)}/deep-research`)
        if (response.ok) {
          const data = await response.json()
          reportsData[subject.name] = data
        }
      } catch (error) {
        console.error(`Failed to load deep reports for ${subject.name}:`, error)
      }
    }

    setSubjectDeepReports(reportsData)
  }

  const handleGenerateReport = async () => {
    if (!selectedSubject || !startDate || !endDate) {
      alert("请填写完整信息")
      return
    }

    setGeneratingReport(selectedSubject.name)

    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(selectedSubject.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          title: reportTitle || undefined
        })
      })

      if (response.ok) {
        const result = await response.json()
        await loadReportsForAllSubjects()
        setShowGenerateDialog(false)
        setReportTitle("")
        setStartDate("")
        setEndDate("")
        router.push(`/subjects/${encodeURIComponent(selectedSubject.name)}/report/${result.report.id}`)
      } else {
        const error = await response.json()
        alert(error.error || "生成报告失败")
      }
    } catch (error) {
      console.error("Failed to generate report:", error)
      alert("生成报告失败")
    } finally {
      setGeneratingReport(null)
    }
  }

  const openGenerateDialog = (subject: Subject) => {
    setSelectedSubject(subject)
    setReportTitle(`${subject.name}学习报告`)

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    setEndDate(now.toISOString().split('T')[0])
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0])

    setShowGenerateDialog(true)
  }

  const openDeepAnalysisDialog = (subject: Subject) => {
    setSelectedSubject(subject)
    setDeepAnalysisResult(null)
    setDeepAnalysisError(null)
    setShowDeepAnalysisDialog(true)
  }

  const handleStartDeepAnalysis = async () => {
    if (!selectedSubject) return

    setDeepAnalyzing(true)
    setDeepAnalysisError(null)
    setDeepAnalysisResult(null)

    try {
      const requestBody: any = {
        analysisType,
        subjectName: selectedSubject.name,  // 传递实际学科名称（如"几何"、"代数"等）
        subjectId: selectedSubject.id      // 传递学科ID（如"geometry"、"algebra"等）
      }

      // 如果选择自定义时间范围，添加时间参数
      if (deepAnalysisTimeRange === 'custom' && deepAnalysisStartDate && deepAnalysisEndDate) {
        requestBody.timeRange = {
          start: new Date(deepAnalysisStartDate).toISOString(),
          end: new Date(deepAnalysisEndDate).toISOString()
        }
      }

      // 根据学科选择不同的 API 端点
      const subjectKey = selectedSubject.folderName || selectedSubject.name.toLowerCase()
      let apiPath = '/api/agent/english/analyze'

      // 数学相关学科（代数、几何等）使用数学 API
      if (['math', '数学', 'algebra', '代数', 'geometry', '几何'].includes(subjectKey)) {
        apiPath = '/api/agent/math/analyze'
      } else if (subjectKey === 'english' || subjectKey === '英语') {
        apiPath = '/api/agent/english/analyze'
      }

      const response = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (data.success) {
        setDeepAnalysisResult(data.result)
        // 重新加载深度分析报告列表
        await loadDeepReportsForAllSubjects()
      } else {
        setDeepAnalysisError(data.error || '分析失败')
      }
    } catch (err: any) {
      setDeepAnalysisError(err.message || '网络错误')
    } finally {
      setDeepAnalyzing(false)
    }
  }

  const openPromptDialog = (subject: Subject) => {
    setSelectedSubject(subject)
    const defaultPrompt = getDefaultReportPrompt(subject)
    setPromptValue(subject.reportPrompt || defaultPrompt)
    setShowPromptDialog(true)
  }

  const handleSavePrompt = async () => {
    if (!selectedSubject) return

    const updated = subjects.map(s =>
      s.id === selectedSubject.id ? { ...s, reportPrompt: promptValue.trim() || undefined } : s
    )
    setSubjects(updated)

    try {
      await saveSubjects(updated)
      alert("提示词已保存")
    } catch (error) {
      console.error("Failed to save prompt:", error)
      alert("保存失败，请重试")
    }

    setShowPromptDialog(false)
  }

  const handleResetPrompt = () => {
    if (selectedSubject) {
      const defaultPrompt = getDefaultReportPrompt(selectedSubject)
      setPromptValue(defaultPrompt)
    }
  }

  // 从深入分析报告生成学习内容
  const handleGenerateLearningFromReport = async (subject: Subject, reportId: string) => {
    setGeneratingLearning(reportId)

    try {
      // 调用 API 生成学习内容
      const response = await fetch(`/api/learning/${encodeURIComponent(subject.name)}/generate-from-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId })
      })

      if (response.ok) {
        const result = await response.json()
        // 跳转到学习页面
        router.push('/learning')
      } else {
        const error = await response.json()
        alert(error.error || '生成学习内容失败')
      }
    } catch (error) {
      console.error('Failed to generate learning content:', error)
      alert('生成学习内容失败')
    } finally {
      setGeneratingLearning(null)
    }
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.9) return "bg-green-100 text-green-800"
    if (accuracy >= 0.8) return "bg-blue-100 text-blue-800"
    if (accuracy >= 0.7) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getAnalysisTypeName = (type: string) => {
    const names: Record<string, string> = {
      comprehensive: '综合分析',
      grammar: '语法分析',
      vocabulary: '词汇分析',
      reading: '阅读分析',
      writing: '写作分析',
      algebra: '代数分析',
      geometry: '几何分析',
      function: '函数分析',
      statistics: '统计概率分析'
    }
    return names[type] || type
  }

  // 获取特定学科的分析类型选项
  const getAnalysisTypesForSubject = (subject: Subject) => {
    const subjectKey = subject.folderName || subject.name.toLowerCase()

    // 数学相关学科（代数、几何等）
    if (['math', '数学', 'algebra', '代数', 'geometry', '几何'].includes(subjectKey)) {
      return [
        { value: 'comprehensive', label: '综合分析', desc: '全面分析各项能力' },
        { value: 'algebra', label: '代数分析', desc: '运算与方程' },
        { value: 'geometry', label: '几何分析', desc: '图形与证明' },
        { value: 'function', label: '函数分析', desc: '函数与图像' },
        { value: 'statistics', label: '统计概率', desc: '数据分析与概率' }
      ]
    }

    if (subjectKey === 'english' || subjectKey === '英语') {
      return [
        { value: 'comprehensive', label: '综合分析', desc: '全面分析各项能力' },
        { value: 'grammar', label: '语法分析', desc: '深入分析语法知识' },
        { value: 'vocabulary', label: '词汇分析', desc: '评估词汇量和运用' },
        { value: 'reading', label: '阅读分析', desc: '分析阅读理解能力' },
        { value: 'writing', label: '写作分析', desc: '评估写作能力' }
      ]
    }

    // 默认选项
    return [
      { value: 'comprehensive', label: '综合分析', desc: '全面分析各项能力' }
    ]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* 头部 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">学科报告</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            查看各学科的学习报告，获取针对性的分析和建议
          </p>
        </div>
      </div>

      {subjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2">尚未启用任何学科</h3>
            <p className="text-gray-500 mb-6">请先在设置中启用您想要学习的学科</p>
            <Button onClick={() => router.push("/settings")}>
              前往设置
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {subjects.map((subject) => {
            const reports = subjectReports[subject.name]
            const deepReports = subjectDeepReports[subject.name]
            const hasReports = reports && reports.reports.length > 0
            const hasDeepReports = deepReports && deepReports.reports.length > 0

            return (
              <Card key={subject.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{subject.icon}</div>
                      <div>
                        <CardTitle className="text-xl">{subject.name}</CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {subject.category === "理科" ? "理科" : subject.category === "文科" ? "文科" : "其他"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPromptDialog(subject)}
                        className={subject.reportPrompt ? "border-blue-500 text-blue-600" : ""}
                      >
                        {subject.reportPrompt ? "✏️ 已自定义" : "⚙️ 提示词"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeepAnalysisDialog(subject)}
                        className="border-purple-500 text-purple-600 hover:bg-purple-50"
                      >
                        <Brain className="w-4 h-4 mr-1" />
                        深入分析
                      </Button>
                      <Button
                        onClick={() => openGenerateDialog(subject)}
                        disabled={generatingReport === subject.name}
                      >
                        {generatingReport === subject.name ? "生成中..." : "+ 生成报告"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 深度分析报告区域 */}
                  {hasDeepReports && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <h3 className="text-sm font-semibold text-purple-600">深入分析报告</h3>
                        <span className="text-xs text-gray-500">({deepReports.total} 份)</span>
                      </div>
                      <div className="space-y-3">
                        {deepReports.reports.map((report) => (
                          <div
                            key={report.id}
                            className="border border-purple-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-gradient-to-r from-purple-50/50 to-transparent"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 cursor-pointer" onClick={() => router.push(`/subjects/${encodeURIComponent(subject.name)}/report/${report.id}`)}>
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-purple-900">
                                    {getAnalysisTypeName(report.analysisType)}
                                  </h4>
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                    Deep Research
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                  <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                      🤖 {report.reportMetadata?.modelName || 'AI'}
                                    </span>
                                    {report.reportMetadata?.totalQuestions && (
                                      <span>📝 {report.reportMetadata.totalQuestions} 题</span>
                                    )}
                                    {report.reportMetadata?.wrongQuestionsCount !== undefined && (
                                      <span className="text-red-600">❌ {report.reportMetadata.wrongQuestionsCount} 错</span>
                                    )}
                                    {report.metadata?.confidenceLevel && (
                                      <span>✓ {Math.round(report.metadata.confidenceLevel * 100)}%</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {formatDate(report.generatedAt)} · 分析耗时 {report.reportMetadata?.analysisDurationFormatted || `${(report.analysisTime / 1000).toFixed(1)}秒`}
                                  </div>
                                  {report.summary && (
                                    <div className="text-xs text-gray-600 dark:text-gray-500 mt-2 line-clamp-2">
                                      {report.summary.slice(0, 100)}...
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleGenerateLearningFromReport(subject, report.id)
                                  }}
                                  disabled={generatingLearning === report.id}
                                  className="border-green-500 text-green-600 hover:bg-green-50"
                                >
                                  {generatingLearning === report.id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      生成中
                                    </>
                                  ) : (
                                    <>
                                      <BookOpen className="w-3 h-3 mr-1" />
                                      生成学习内容
                                    </>
                                  )}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => router.push(`/subjects/${encodeURIComponent(subject.name)}/report/${report.id}`)}>
                                  查看 →
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 普通报告区域 */}
                  {hasReports && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-gray-600">学习报告</span>
                        <span className="text-xs text-gray-500">({reports.total} 份)</span>
                      </div>
                      <div className="space-y-3">
                        {reports.reports.map((report) => (
                          <div
                            key={report.id}
                            className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => router.push(`/subjects/${encodeURIComponent(subject.name)}/report/${report.id}`)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold">{report.title}</h4>
                                  {report.hasAnalysis && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">AI分析</span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 space-y-1">
                                  <div>时间范围: {report.startDate} ~ {report.endDate}</div>
                                  {report.stats ? (
                                    <div className="flex items-center gap-4 mt-2">
                                      <span>{report.stats.totalExams ?? 0} 份试卷</span>
                                      <span>{report.stats.totalQuestions ?? 0} 道题目</span>
                                      <span className="text-red-600">{report.stats.wrongQuestions ?? 0} 道错题</span>
                                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getAccuracyColor(report.stats.avgAccuracy ?? 0)}`}>
                                        正确率: {((report.stats.avgAccuracy ?? 0) * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-500 mt-2">无统计数据</div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500">{formatDate(report.generatedAt)}</div>
                                <Button variant="ghost" size="sm" className="mt-1">
                                  查看 →
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!hasReports && !hasDeepReports && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">📊</div>
                      <p>暂无报告，点击上方按钮生成第一份报告</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 普通报告生成对话框 */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>生成{selectedSubject?.name}学习报告</DialogTitle>
            <DialogDescription>
              选择时间范围，系统将基于该时间段内的试卷数据生成分析报告
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">报告标题</Label>
              <input
                id="title"
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                placeholder={`${selectedSubject?.name}学习报告`}
              />
            </div>
            <div>
              <Label htmlFor="startDate">开始日期</Label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <Label htmlFor="endDate">结束日期</Label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleGenerateReport}
              disabled={generatingReport !== null || !startDate || !endDate}
            >
              {generatingReport ? "生成中..." : "生成报告"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 深度分析对话框 */}
      <Dialog open={showDeepAnalysisDialog} onOpenChange={setShowDeepAnalysisDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              {selectedSubject?.name} 深入分析
            </DialogTitle>
            <DialogDescription>
              AI 智能体将深入分析学习状况，提供个性化改进建议
            </DialogDescription>
          </DialogHeader>

          {!deepAnalysisResult && (
            <div className="space-y-4 py-4">
              {/* 选择分析类型 */}
              <div className="space-y-3">
                <Label>选择分析类型</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedSubject && getAnalysisTypesForSubject(selectedSubject).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAnalysisType(option.value)}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        analysisType === option.value
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-gray-500">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 时间范围选择 */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  分析时间范围
                </Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="timeRange"
                      checked={deepAnalysisTimeRange === 'all'}
                      onChange={() => setDeepAnalysisTimeRange('all')}
                      className="text-purple-600"
                    />
                    <span className="text-sm">全部数据</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="timeRange"
                      checked={deepAnalysisTimeRange === 'custom'}
                      onChange={() => setDeepAnalysisTimeRange('custom')}
                      className="text-purple-600"
                    />
                    <span className="text-sm">自定义范围</span>
                  </label>
                </div>
                {deepAnalysisTimeRange === 'custom' && (
                  <div className="flex gap-4 mt-2">
                    <div className="flex-1">
                      <Label htmlFor="deepStartDate" className="text-xs">开始日期</Label>
                      <input
                        id="deepStartDate"
                        type="date"
                        value={deepAnalysisStartDate}
                        onChange={(e) => setDeepAnalysisStartDate(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="deepEndDate" className="text-xs">结束日期</Label>
                      <input
                        id="deepEndDate"
                        type="date"
                        value={deepAnalysisEndDate}
                        onChange={(e) => setDeepAnalysisEndDate(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 功能说明 */}
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  深入分析能力
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• 自主规划研究路径，多步推理分析</li>
                  <li>• 利用知识图谱分析知识点关联</li>
                  <li>• 识别错误模式，诊断根本原因</li>
                  <li>• 生成个性化学习计划和资源推荐</li>
                </ul>
              </div>

              {deepAnalysisError && (
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{deepAnalysisError}</p>
                </div>
              )}
            </div>
          )}

          {deepAnalysisResult && (
            <div className="space-y-4 py-4">
              {/* 分析摘要 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-medium mb-2">📊 分析摘要</h4>
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {deepAnalysisResult.summary}
                </div>
              </div>

              {/* 详细分析 */}
              {deepAnalysisResult.detailedAnalysis && (
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">🔍 详细分析</h4>
                  <DetailedAnalysisViewer
                    data={deepAnalysisResult.detailedAnalysis}
                    analysisType={deepAnalysisResult.analysisType || analysisType}
                  />
                </div>
              )}

              {/* 建议 */}
              {deepAnalysisResult.recommendations && deepAnalysisResult.recommendations.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">💡 改进建议</h4>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    {deepAnalysisResult.recommendations.map((rec: string, i: number) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 元数据 */}
              <div className="text-xs text-gray-500 dark:text-gray-400">
                分析完成 · 数据点: {deepAnalysisResult.metadata?.dataPoints} · 置信度: {Math.round((deepAnalysisResult.metadata?.confidenceLevel || 0) * 100)}%
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            {deepAnalysisResult ? (
              <>
                <Button variant="outline" onClick={() => setDeepAnalysisResult(null)}>
                  重新分析
                </Button>
                <Button onClick={() => setShowDeepAnalysisDialog(false)}>
                  完成
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowDeepAnalysisDialog(false)} disabled={deepAnalyzing}>
                  取消
                </Button>
                <Button onClick={handleStartDeepAnalysis} disabled={deepAnalyzing} className="bg-purple-600 hover:bg-purple-700">
                  {deepAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    '开始分析'
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 提示词编辑对话框 */}
      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑{selectedSubject?.name}报告提示词</DialogTitle>
            <DialogDescription>
              自定义AI分析错题时使用的提示词模板。支持占位符：<code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{"{subject}"}</code>、<code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{"{wrongQuestionsData}"}</code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="prompt-template">提示词模板</Label>
              <textarea
                id="prompt-template"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                className="w-full h-64 mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="输入提示词模板..."
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleResetPrompt}>
                重置为默认
              </Button>
              <div className="flex-1"></div>
              <Button variant="outline" onClick={() => setShowPromptDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSavePrompt}>
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
