"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AddExamDialog } from "@/components/AddExamDialog"
import { getEnabledSubjects, getSubjectByName, type Subject } from "@/types/subject"
import { clsx } from "clsx"
import { Trash2, CheckSquare, Square, X } from "lucide-react"

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

interface AccuracyLevel {
  id: string
  name: string
  minAccuracy: number
  maxAccuracy: number
  bgColor: string
  borderColor: string
  textColor: string
  description: string
}

interface AccuracyColorsConfig {
  levels: AccuracyLevel[]
}

interface ExamListItem {
  id: string
  subject: string
  examType: string
  totalScore: number
  questionCount: number
  imageUrl?: string
  createdAt: string
  updatedAt?: string
  metadata?: {
    detectedSubject?: string
    overallDifficulty?: number
    estimatedTime?: number
    knowledgePointsSummary?: string[]
    questionTypeStats?: Record<string, number>
    isEssay?: boolean
    essayType?: string
  }
  answerStats?: {
    correct?: number
    wrong?: number
    skipped?: number
    total?: number
    accuracy?: number
    completedAt?: string
  }
}

export default function ExamPage() {
  const router = useRouter()
  const [exams, setExams] = useState<ExamListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<string>("all")
  const [examMetadata, setExamMetadata] = useState<ExamMetadata | null>(null)
  const [accuracyColors, setAccuracyColors] = useState<AccuracyColorsConfig | null>(null)

  // 管理模式相关状态
  const [isManageMode, setIsManageMode] = useState(false)
  const [selectedExams, setSelectedExams] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    loadSubjects()
    loadExams()
    loadExamMetadata()
    loadAccuracyColors()
  }, [])

  const loadSubjects = () => {
    const enabledSubjects = getEnabledSubjects()
    setSubjects(enabledSubjects)
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

  const loadAccuracyColors = async () => {
    try {
      const response = await fetch("/api/config")
      if (response.ok) {
        const data = await response.json()
        setAccuracyColors(data)
      }
    } catch (error) {
      console.error("Failed to load accuracy colors:", error)
    }
  }

  function getAccuracyLevel(accuracy: number | undefined) {
    if (!accuracyColors || accuracy === undefined) return null
    return accuracyColors.levels.find(
      level => accuracy >= level.minAccuracy && accuracy <= level.maxAccuracy
    )
  }

  const loadExams = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/exam/list")
      if (response.ok) {
        const data = await response.json()
        const exams = data.exams || []

        // 从 sessionStorage 读取每张试卷的题目标记状态并计算正确率
        const examsWithStats = exams.map((exam: ExamListItem) => {
          const marks = sessionStorage.getItem(`exam_marks_${exam.id}`)
          const examData = sessionStorage.getItem(`exam_${exam.id}`)
          const questions = examData ? JSON.parse(examData).questions : []

          // 计算统计数据（未标记的题目默认为做对）
          let correctCount = 0  // 明确标记为做对的数量
          let wrongCount = 0     // 标记为做错的数量
          let skippedCount = 0   // 标记为不会做的数量
          let unmarkedCount = 0  // 未标记的数量（也视为做对）
          let correctScore = 0   // 做对题目得分
          let totalScore = 0     // 题目总分

          questions.forEach((q: any) => {
            totalScore += q.score
            const mark = marks ? JSON.parse(marks)[q.number] : null

            if (mark === 'correct') {
              correctCount++
              correctScore += q.score
            } else if (mark === 'wrong') {
              wrongCount++
            } else if (mark === 'skipped') {
              skippedCount++
            } else {
              // 未标记，默认为做对
              unmarkedCount++
              correctScore += q.score
            }
          })

          // 正确率 = 做对题目得分 / 题目总分
          // 做对题目得分 = (明确标记做对 + 未标记题目) 的得分
          const accuracy = totalScore > 0 ? Math.round((correctScore / totalScore) * 100) : 0

          return {
            ...exam,
            answerStats: {
              correct: correctCount + unmarkedCount,  // 包括未标记的
              wrong: wrongCount,
              skipped: skippedCount,
              total: questions.length,
              accuracy,
            },
          }
        })

        setExams(examsWithStats)
      }
    } catch (error) {
      console.error("Failed to load exams:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExamClick = (examId: string) => {
    router.push(`/exam/${examId}/review`)
  }

  // 管理模式相关函数
  const toggleManageMode = () => {
    setIsManageMode(!isManageMode)
    setSelectedExams(new Set())
  }

  const toggleExamSelection = (examId: string) => {
    const newSelected = new Set(selectedExams)
    if (newSelected.has(examId)) {
      newSelected.delete(examId)
    } else {
      newSelected.add(examId)
    }
    setSelectedExams(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedExams.size === exams.length) {
      // 全部取消选中
      setSelectedExams(new Set())
    } else {
      // 全部选中
      setSelectedExams(new Set(exams.map(e => e.id)))
    }
  }

  const handleDeleteConfirm = async () => {
    if (selectedExams.size === 0) {
      alert("请先选择要删除的试卷")
      return
    }

    const examCount = selectedExams.size
    if (!confirm(`确定要删除选中的 ${examCount} 份试卷吗？此操作不可恢复。`)) {
      return
    }

    try {
      // 调用删除API
      const response = await fetch("/api/exam/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examIds: Array.from(selectedExams)
        }),
      })

      if (!response.ok) {
        throw new Error("删除失败")
      }

      // 从本地状态中移除已删除的试卷
      setExams(exams.filter(e => !selectedExams.has(e.id)))

      // 退出管理模式
      setIsManageMode(false)
      setSelectedExams(new Set())

      alert(`成功删除 ${examCount} 份试卷`)
    } catch (error) {
      console.error("Delete error:", error)
      alert("删除失败，请重试")
    }
  }

  const handleCardClick = (examId: string) => {
    if (isManageMode) {
      toggleExamSelection(examId)
    } else {
      handleExamClick(examId)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    // 返回年-月-日格式，如 2025-03-08
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\//g, '-')
  }

  // 获取题目分类统计
  const getQuestionTypeStats = (exam: ExamListItem) => {
    // 从 metadata 获取题目分类统计，如果没有则返回空对象
    return exam.metadata?.questionTypeStats || {}
  }

  const getSubjectInfo = (subjectName: string) => {
    return getSubjectByName(subjectName)
  }

  const getExamTypeInfo = (exam: ExamListItem) => {
    if (!examMetadata) return null
    return examMetadata.examTypes?.find(t => t.id === exam.examType)
  }

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return "text-green-600 bg-green-50"
    if (difficulty === 3) return "text-yellow-600 bg-yellow-50"
    return "text-red-600 bg-red-50"
  }

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty <= 2) return "简单"
    if (difficulty === 3) return "中等"
    return "困难"
  }

  // 按科目分组试卷，每个科目内按时间从新往旧排序
  const groupedExams = selectedSubject === "all"
    ? exams.reduce((acc, exam) => {
        const subject = exam.subject || "未分类"
        if (!acc[subject]) acc[subject] = []
        acc[subject].push(exam)
        return acc
      }, {} as Record<string, ExamListItem[]>)
    : { [selectedSubject]: exams.filter(e => e.subject === selectedSubject) }

  // 对每个科目的试卷按时间从新往旧排序
  Object.keys(groupedExams).forEach(subject => {
    groupedExams[subject].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  })

  // 获取所有科目的排序列表（按试卷数量，多的在前）
  const subjectList = Object.keys(groupedExams).sort((a, b) => {
    return groupedExams[b].length - groupedExams[a].length
  })

  // 获取所有科目选项（包括 all）
  const allSubjects = ["all", ...Array.from(new Set(exams.map(e => e.subject)))]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            试卷分析
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            管理和分析你的试卷
          </p>
        </div>
        <div className="flex gap-2">
          {exams.length > 0 && (
            <>
              {isManageMode ? (
                <>
                  <Button
                    variant="outline"
                    onClick={toggleSelectAll}
                    disabled={exams.length === 0}
                  >
                    {selectedExams.size === exams.length ? "取消全选" : "全选"}
                  </Button>
                  {selectedExams.size > 0 && (
                    <Button
                      variant="destructive"
                      onClick={handleDeleteConfirm}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      删除 ({selectedExams.size})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={toggleManageMode}
                  >
                    <X className="w-4 h-4 mr-1" />
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={toggleManageMode}
                >
                  管理
                </Button>
              )}
            </>
          )}
          <Button onClick={() => setIsAddDialogOpen(true)} size="lg">
            + 添加试卷
          </Button>
        </div>
      </div>

      {/* 管理模式提示 */}
      {isManageMode && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            💡 管理模式：点击试卷卡片进行选择，选中后可批量删除
          </p>
        </div>
      )}

      {/* 科目筛选 */}
      {exams.length > 0 && !isManageMode && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedSubject === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSubject("all")}
          >
            全部 ({exams.length})
          </Button>
          {allSubjects.slice(1).map((subject) => {
            const subjectInfo = getSubjectInfo(subject)
            const count = exams.filter(e => e.subject === subject).length
            return (
              <Button
                key={subject}
                variant={selectedSubject === subject ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSubject(subject)}
              >
                {subjectInfo?.icon || "📚"} {subject} ({count})
              </Button>
            )
          })}
        </div>
      )}

      {/* 无学科提示 */}
      {subjects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">
              尚未启用任何学科，请先在设置中启用学科
            </p>
            <Button onClick={() => router.push("/settings")}>
              前往设置
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 试卷列表 */}
      {subjects.length > 0 && (
        <>
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">加载中...</p>
              </CardContent>
            </Card>
          ) : exams.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="text-6xl mb-4">📄</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  还没有添加任何试卷
                </h3>
                <p className="text-gray-500 mb-6">
                  点击"添加试卷"按钮开始添加你的第一份试卷
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  添加试卷
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {subjectList.map((subject) => {
                const subjectInfo = getSubjectInfo(subject)
                const subjectExams = groupedExams[subject]

                return (
                  <div key={subject}>
                    {/* 科目标题 */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">{subjectInfo?.icon || "📚"}</span>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          {subject}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {subjectExams.length} 份试卷
                        </p>
                      </div>
                    </div>

                    {/* 试卷卡片 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subjectExams.map((exam) => {
                        const accuracyLevel = getAccuracyLevel(exam.answerStats?.accuracy)
                        return (
                          <Card
                            key={exam.id}
                            className={clsx(
                              "cursor-pointer hover:shadow-lg transition-shadow relative",
                              exam.answerStats?.accuracy !== undefined && (exam.answerStats.total ?? 0) > 0 && accuracyLevel?.bgColor,
                              exam.answerStats?.accuracy !== undefined && (exam.answerStats.total ?? 0) > 0 && accuracyLevel?.borderColor,
                              isManageMode && selectedExams.has(exam.id) && "ring-2 ring-blue-500"
                            )}
                            onClick={() => handleCardClick(exam.id)}
                          >
                            {/* 管理模式：选择框 */}
                            {isManageMode && (
                              <div className="absolute top-3 left-3 z-10">
                                <div className="w-6 h-6 rounded border-2 flex items-center justify-center bg-white shadow-sm">
                                  {selectedExams.has(exam.id) ? (
                                    <CheckSquare className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            )}

                            <CardHeader className={clsx("pb-3", isManageMode && "pl-12")}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <CardTitle className="text-base">
                                    {getExamTypeInfo(exam)?.icon && <span className="mr-1">{getExamTypeInfo(exam)?.icon}</span>}
                                    {getExamTypeInfo(exam)?.name || exam.examType}
                                  </CardTitle>
                                  {/* 日期 - 突出显示 */}
                                  <div className="text-sm font-semibold text-blue-600 mt-1">
                                    {formatDate(exam.createdAt)}
                                </div>
                              </div>
                              {/* 正确率（如果已完成） */}
                              {exam.answerStats?.completedAt && (
                                <div className="flex flex-col items-end">
                                  <div className={`text-2xl font-bold ${
                                    exam.answerStats.accuracy! >= 80
                                      ? "text-green-600"
                                      : exam.answerStats.accuracy! >= 60
                                        ? "text-yellow-600"
                                        : "text-red-600"
                                  }`}>
                                    {exam.answerStats.accuracy}%
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    正确率
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {/* 元数据标签 */}
                              <div className="flex flex-wrap gap-2">
                                {exam.metadata?.overallDifficulty && (
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(exam.metadata.overallDifficulty)}`}>
                                    难度: {getDifficultyLabel(exam.metadata.overallDifficulty)}
                                  </span>
                                )}
                                {exam.answerStats?.accuracy !== undefined && (exam.answerStats.total ?? 0) > 0 && (
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    exam.answerStats.accuracy >= 80
                                      ? 'bg-green-100 text-green-700'
                                      : exam.answerStats.accuracy >= 60
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                  }`}>
                                    正确率: {exam.answerStats.accuracy}%
                                  </span>
                                )}
                              </div>

                              {/* 统计信息 - 题目数量和分类合并显示 */}
                              <div className="text-sm">
                                <span className="text-gray-600 dark:text-gray-400">题目：</span>
                                <span className="font-medium text-gray-900 dark:text-white ml-1">
                                  {exam.questionCount} 题
                                </span>
                                {exam.metadata?.questionTypeStats && Object.keys(exam.metadata.questionTypeStats).length > 0 && (
                                  <span className="ml-2">
                                    {Object.entries(exam.metadata.questionTypeStats).map(([type, count], index) => {
                                      const typeLabels: Record<string, string> = {
                                        'choice': '选择',
                                        'fill': '填空',
                                        'answer': '解答',
                                        'calculation': '计算',
                                        'essay': '作文',
                                        'reading': '阅读',
                                        'unknown': '其他',
                                      }
                                      return (
                                        <span key={type} className="text-xs text-gray-600 dark:text-gray-400">
                                          {index > 0 && ' · '}
                                          {typeLabels[type] || type} {count}
                                        </span>
                                      )
                                    })}
                                  </span>
                                )}
                              </div>

                              {/* 作文类型标识 */}
                              {exam.metadata?.isEssay && (
                                <div className="pt-2 border-t">
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    exam.metadata.essayType === '英语作文'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    ✍️ {exam.metadata.essayType || '作文'}
                                  </span>
                                </div>
                              )}

                              {/* 知识点 */}
                              {exam.metadata?.knowledgePointsSummary && exam.metadata.knowledgePointsSummary.length > 0 && (
                                <div className="pt-2 border-t">
                                  <p className="text-xs text-gray-500 mb-1">主要知识点：</p>
                                  <div className="flex flex-wrap gap-1">
                                    {exam.metadata.knowledgePointsSummary.slice(0, 3).map((kp, i) => (
                                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                        {kp}
                                      </span>
                                    ))}
                                    {exam.metadata.knowledgePointsSummary.length > 3 && (
                                      <span className="text-xs text-gray-400">
                                        +{exam.metadata.knowledgePointsSummary.length - 3}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* 完成状态 - 仅显示已完成 */}
                              {exam.answerStats?.completedAt && (
                                <div className="pt-2 border-t">
                                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                    ✓ 已完成
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* 添加试卷对话框 */}
      <AddExamDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </div>
  )
}
