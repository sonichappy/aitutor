"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface AnalysisData {
  summary: {
    totalScore: number
    obtainedScore: number
    correctRate: number
  }
  knowledgeAnalysis: {
    name: string
    correctRate: number
    questionCount: number
  }[]
  weakPoints: string[]
  strongPoints: string[]
  suggestions: string[]
  aiReport?: string
}

export default function ExamReportPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string

  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalysis()
  }, [examId])

  const loadAnalysis = async () => {
    try {
      // 从缓存获取
      const examData = (global as any).examCache?.[examId]
      if (examData?.analysis) {
        setAnalysis(examData.analysis)
      } else {
        // 尝试从 API 获取
        const response = await fetch(`/api/exam/${examId}/analyze`)
        if (response.ok) {
          const data = await response.json()
          setAnalysis(data)
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">生成报告中...</p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">报告不存在</p>
        <Button onClick={() => router.push("/exam")} className="mt-4">
          返回
        </Button>
      </div>
    )
  }

  const { summary, knowledgeAnalysis, weakPoints, strongPoints, suggestions, aiReport } = analysis

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 标题 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            试卷分析报告
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            AI 智能分析 · 个性化学习建议
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/exam")}>
          返回
        </Button>
      </div>

      {/* 成绩概览 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>得分</CardDescription>
            <CardTitle className="text-3xl">
              {summary.obtainedScore} / {summary.totalScore}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>正确率</CardDescription>
            <CardTitle className="text-3xl">
              {(summary.correctRate * 100).toFixed(0)}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>评级</CardDescription>
            <CardTitle className="text-3xl">
              {summary.correctRate >= 0.9 ? "优秀" : summary.correctRate >= 0.8 ? "良好" : summary.correctRate >= 0.6 ? "及格" : "需加油"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 知识点分析 */}
      <Card>
        <CardHeader>
          <CardTitle>知识点掌握分析</CardTitle>
          <CardDescription>各知识点得分率统计</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {knowledgeAnalysis
            .sort((a, b) => a.correctRate - b.correctRate)
            .map((kp) => (
              <div key={kp.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{kp.name}</span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {(kp.correctRate * 100).toFixed(0)}% ({kp.questionCount}题)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      kp.correctRate >= 0.8
                        ? "bg-green-500"
                        : kp.correctRate >= 0.6
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${kp.correctRate * 100}%` }}
                  />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* 薄弱点与优势 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">
              需要加强
            </CardTitle>
            <CardDescription>薄弱知识点</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {weakPoints.map((point) => (
                <span
                  key={point}
                  className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full text-sm"
                >
                  {point}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-green-600 dark:text-green-400">
              掌握较好
            </CardTitle>
            <CardDescription>优势知识点</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {strongPoints.map((point) => (
                <span
                  key={point}
                  className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-sm"
                >
                  {point}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI 学习建议 */}
      {aiReport && (
        <Card>
          <CardHeader>
            <CardTitle>AI 学习建议</CardTitle>
            <CardDescription>基于试卷智能分析生成的个性化建议</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
              {aiReport}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 快速行动 */}
      <Card>
        <CardHeader>
          <CardTitle>下一步行动</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <span className="text-sm">{suggestion}</span>
              <Button size="sm" variant="outline">
                去练习
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={() => router.push("/learning")}>
          开始针对性学习
        </Button>
        <Button onClick={() => router.push("/tutor")}>
          AI 辅导答疑
        </Button>
      </div>
    </div>
  )
}
