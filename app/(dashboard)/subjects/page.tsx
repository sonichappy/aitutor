"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getEnabledSubjects, clearSubjectsCache, type Subject } from "@/types/subject"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

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

interface SubjectReports {
  subject: string
  reports: Report[]
  total: number
}

export default function SubjectsPage() {
  const router = useRouter()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectReports, setSubjectReports] = useState<Record<string, SubjectReports>>({})
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState<string | null>(null)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [reportTitle, setReportTitle] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    loadSubjects()
  }, [])

  useEffect(() => {
    if (subjects.length > 0) {
      loadReportsForAllSubjects()
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
        } else {
          console.error(`Failed to load reports for ${subject.name}:`, response.status)
        }
      } catch (error) {
        console.error(`Failed to load reports for ${subject.name}:`, error)
      }
    }

    setSubjectReports(reportsData)
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
        // 重新加载报告列表
        await loadReportsForAllSubjects()
        setShowGenerateDialog(false)
        setReportTitle("")
        setStartDate("")
        setEndDate("")
        // 跳转到报告详情页
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

    // 设置默认日期范围（最近30天）
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    setEndDate(now.toISOString().split('T')[0])
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0])

    setShowGenerateDialog(true)
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
          <h1 className="text-3xl font-bold text-gray-900">学科中心</h1>
          <p className="text-gray-600 mt-2">
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
            const hasReports = reports && reports.reports.length > 0

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
                    <Button
                      onClick={() => openGenerateDialog(subject)}
                      disabled={generatingReport === subject.name}
                    >
                      {generatingReport === subject.name ? "生成中..." : "+ 生成报告"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!hasReports ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">📊</div>
                      <p>暂无报告，点击上方按钮生成第一份报告</p>
                    </div>
                  ) : (
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
                                <div>
                                  时间范围: {report.startDate} ~ {report.endDate}
                                </div>
                                <div className="flex items-center gap-4 mt-2">
                                  <span>{report.stats.totalExams} 份试卷</span>
                                  <span>{report.stats.totalQuestions} 道题目</span>
                                  <span className="text-red-600">{report.stats.wrongQuestions} 道错题</span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getAccuracyColor(report.stats.avgAccuracy)}`}>
                                    正确率: {(report.stats.avgAccuracy * 100).toFixed(1)}%
                                  </span>
                                </div>
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
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 生成报告对话框 */}
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
    </div>
  )
}
