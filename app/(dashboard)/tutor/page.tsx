"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getEnabledSubjects, type Subject } from "@/types/subject"

interface SubjectAnalysis {
  hasData: boolean
  subject: string
  stats?: {
    totalExams: number
    totalQuestions: number
    wrongQuestions: number
    avgAccuracy: number
    recentExamDate: string
    difficultyDistribution: { easy: number; medium: number; hard: number }
  }
  analysis?: {
    knowledgeMatrix: {
      description: string
      topWeakPoints: Array<{ point: string; errorRate: number; count: number }>
    }
    abilityAssessment: {
      description: string
      mainIssue: string
      analysis: string
    }
    errorPatterns: {
      description: string
      patterns: string[]
    }
    prediction: {
      description: string
      nextChapterRisks: string[]
      recommendations: string[]
    }
  }
  wrongQuestions?: any[]
  error?: string
}

export default function SubjectCenterPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [analysis, setAnalysis] = useState<SubjectAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)

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

  // 当选择学科时，加载分析数据
  useEffect(() => {
    if (selectedSubject) {
      loadAnalysis(selectedSubject)
    }
  }, [selectedSubject])

  const loadAnalysis = async (subjectName: string) => {
    setIsLoadingAnalysis(true)
    try {
      const response = await fetch(`/api/subject/${encodeURIComponent(subjectName)}/analysis`)
      const data = await response.json()
      setAnalysis(data)
    } catch (error) {
      console.error("Failed to load analysis:", error)
      setAnalysis({ hasData: false, subject: subjectName, error: "加载失败" })
    } finally {
      setIsLoadingAnalysis(false)
    }
  }

  const getAbilityBadge = (mainIssue: string) => {
    const map: Record<string, { label: string; color: string }> = {
      "基础识记模糊": { label: "基础需巩固", color: "bg-orange-100 text-orange-700" },
      "逻辑转化受阻": { label: "逻辑待提升", color: "bg-blue-100 text-blue-700" },
      "抗干扰能力弱": { label: "专注力训练", color: "bg-purple-100 text-purple-700" },
    }
    const info = map[mainIssue] || { label: "待评估", color: "bg-gray-100 text-gray-700" }
    return <span className={`px-2 py-1 rounded text-xs ${info.color}`}>{info.label}</span>
  }

  // 没有启用学科时显示提示
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
    <div className="space-y-6">
      {/* 标题和学科选择 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            学科报告
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            基于过往试卷的智能评估与学习建议
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {subjects.map((subject) => (
            <Button
              key={subject.id}
              variant={selectedSubject === subject.name ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSubject(subject.name)}
              title={subject.name}
            >
              {subject.icon} {subject.name}
            </Button>
          ))}
        </div>
      </div>

      {/* 加载状态 */}
      {isLoadingAnalysis && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">AI 正在分析试卷数据...</p>
          </div>
        </div>
      )}

      {/* 分析结果 */}
      {!isLoadingAnalysis && analysis && (
        <>
          {/* 无数据提示 */}
          {!analysis.hasData && (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-gray-500 mb-2">
                  {analysis.error || `暂无 ${selectedSubject} 试卷数据`}
                </p>
                <p className="text-sm text-gray-400">
                  上传并完成{selectedSubject}试卷后，系统将自动生成评估报告
                </p>
                <Button className="mt-4" onClick={() => (window.location.href = "/exam")}>
                  前往试卷中心
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 有数据时显示分析报告 */}
          {analysis.hasData && analysis.stats && analysis.analysis && (
            <>
              {/* 统计概览 */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>试卷数量</CardDescription>
                    <CardTitle className="text-3xl">{analysis.stats.totalExams}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>错题数量</CardDescription>
                    <CardTitle className="text-3xl text-red-600">{analysis.stats.wrongQuestions}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>平均正确率</CardDescription>
                    <CardTitle className="text-3xl">
                      {(analysis.stats.avgAccuracy * 100).toFixed(0)}%
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>题目总数</CardDescription>
                    <CardTitle className="text-3xl">{analysis.stats.totalQuestions}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* 知识点覆盖矩阵 */}
              <Card>
                <CardHeader>
                  <CardTitle>📊 知识点覆盖矩阵</CardTitle>
                  <CardDescription>错误率最高的 Top 3 薄弱知识点</CardDescription>
                </CardHeader>
                <CardContent>
                  {analysis.analysis.knowledgeMatrix.topWeakPoints.length > 0 ? (
                    <div className="space-y-3">
                      {analysis.analysis.knowledgeMatrix.topWeakPoints.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-red-600">#{index + 1}</span>
                            <span className="font-medium">{item.point}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600">出现 {item.count} 次</span>
                            <span className="px-2 py-1 bg-red-600 text-white text-sm rounded">
                              {item.errorRate}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">暂无数据</p>
                  )}
                </CardContent>
              </Card>

              {/* 能力维度评估 */}
              <Card>
                <CardHeader>
                  <CardTitle>🎯 能力维度评估</CardTitle>
                  <CardDescription>分析学习中的主要障碍类型</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      {getAbilityBadge(analysis.analysis.abilityAssessment.mainIssue)}
                      <span className="text-sm text-gray-600">
                        主要问题类型
                      </span>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{analysis.analysis.abilityAssessment.analysis}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 错误模式挖掘 */}
              <Card>
                <CardHeader>
                  <CardTitle>🔍 错误模式挖掘</CardTitle>
                  <CardDescription>识别习惯性错误模式</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analysis.analysis.errorPatterns.patterns.map((pattern, index) => (
                      <span
                        key={index}
                        className="px-3 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg text-sm"
                      >
                        {pattern}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 潜能与风险预判 */}
              <Card>
                <CardHeader>
                  <CardTitle>🚀 潜能与风险预判</CardTitle>
                  <CardDescription>基于当前错题预测后续学习风险</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-red-600">⚠️ 可能遇到的学习障碍</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.analysis.prediction.nextChapterRisks.map((risk, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm"
                        >
                          {risk}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-green-600">💡 针对性建议</h4>
                    <div className="space-y-2">
                      {analysis.analysis.prediction.recommendations.map((rec, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                        >
                          <span className="text-green-600">✓</span>
                          <span className="text-sm">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 错题预览 */}
              {analysis.wrongQuestions && analysis.wrongQuestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>📝 错题预览</CardTitle>
                    <CardDescription>部分典型错题</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.wrongQuestions.slice(0, 5).map((q, index) => (
                      <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-gray-600">第 {q.questionNumber} 题</span>
                          <span className="text-xs text-gray-600">
                            难度: {"⭐".repeat(q.difficulty || 1)}
                          </span>
                        </div>
                        <p className="text-sm mb-2">{q.content}</p>
                        <div className="flex gap-4 text-xs">
                          <span className="text-red-600">你的答案: {q.userAnswer}</span>
                          <span className="text-green-600">正确答案: {q.correctAnswer}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 操作按钮 */}
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={() => (window.location.href = "/exam")}>
                  继续练习
                </Button>
                <Button onClick={() => (window.location.href = "/wrong-questions")}>
                  查看错题本
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
