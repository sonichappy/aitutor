"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SubjectStats {
  totalExams: number
  totalQuestions: number
  wrongQuestions: number
  avgAccuracy: number
  recentExamDate: string
  difficultyDistribution: {
    easy: number
    medium: number
    hard: number
  }
}

interface Analysis {
  knowledgeMatrix: {
    description: string
    topWeakPoints: Array<{
      point: string
      errorRate: number
      count: number
    }>
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

interface WrongQuestion {
  questionNumber: number
  content: string
  type: string
  options?: string[]
  userAnswer?: string
  correctAnswer?: string
  knowledgePoints: string[]
  difficulty: number
  score: number
  examId: string
  examDate: string
}

export default function SubjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const subject = decodeURIComponent(params.subject as string)

  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [data, setData] = useState<{
    hasData: boolean
    stats?: SubjectStats
    analysis?: Analysis
    wrongQuestions?: WrongQuestion[]
  } | null>(null)

  useEffect(() => {
    loadAnalysis()
  }, [subject])

  const loadAnalysis = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/subject/${encodeURIComponent(subject)}/analysis`)
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error("Failed to load analysis:", error)
      setData({ hasData: false })
    } finally {
      setLoading(false)
    }
  }

  const handleReanalyze = async () => {
    setAnalyzing(true)
    await loadAnalysis()
    setAnalyzing(false)
  }

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return "bg-green-100 text-green-800"
    if (difficulty === 3) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty <= 2) return "简单"
    if (difficulty === 3) return "中等"
    return "困难"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* 头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/subjects")}
              className="mb-4"
            >
              ← 返回学科报告
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">{subject}</h1>
            <p className="text-gray-600 mt-2">
              {data?.hasData ? "学科学习分析与改进建议" : "暂无该学科的试卷数据"}
            </p>
          </div>
          {data?.hasData && (
            <Button
              onClick={handleReanalyze}
              disabled={analyzing}
              variant="outline"
            >
              {analyzing ? "分析中..." : "重新分析"}
            </Button>
          )}
        </div>
      </div>

      {!data?.hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">暂无数据</h3>
            <p className="text-gray-500 mb-6">
              请先添加{subject}试卷，系统将自动分析您的学习情况
            </p>
            <Button onClick={() => router.push("/exam")}>
              添加试卷
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 统计概览 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{data.stats?.totalExams || 0}</div>
                  <div className="text-sm text-gray-600 mt-1">试卷总数</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{data.stats?.totalQuestions || 0}</div>
                  <div className="text-sm text-gray-600 mt-1">题目总数</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{data.stats?.wrongQuestions || 0}</div>
                  <div className="text-sm text-gray-600 mt-1">错题数量</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {Math.round((data.stats?.avgAccuracy || 0) * 100)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">平均正确率</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 知识点矩阵 */}
          {data.analysis?.knowledgeMatrix && (
            <Card>
              <CardHeader>
                <CardTitle>知识点分析</CardTitle>
                <CardDescription>识别薄弱环节，精准定位问题</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-3">薄弱知识点 TOP3</h4>
                    <div className="space-y-2">
                      {data.analysis.knowledgeMatrix.topWeakPoints?.map((point, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant={index === 0 ? "destructive" : index === 1 ? "default" : "secondary"}>
                              #{index + 1}
                            </Badge>
                            <span className="font-medium">{point.point}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600">{point.count} 题</span>
                            <span className="text-sm font-semibold text-red-600">{point.errorRate}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 能力评估 */}
          {data.analysis?.abilityAssessment && (
            <Card>
              <CardHeader>
                <CardTitle>能力评估</CardTitle>
                <CardDescription>分析学习中的主要问题</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">主要问题</h4>
                    <Alert>
                      <AlertDescription>
                        {data.analysis.abilityAssessment.mainIssue}
                      </AlertDescription>
                    </Alert>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">详细分析</h4>
                    <p className="text-gray-700 leading-relaxed">
                      {data.analysis.abilityAssessment.analysis}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 错误模式 */}
          {data.analysis?.errorPatterns && (
            <Card>
              <CardHeader>
                <CardTitle>错误模式</CardTitle>
                <CardDescription>发现习惯性错误类型</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.analysis.errorPatterns.patterns?.map((pattern, index) => (
                    <Badge key={index} variant="outline" className="px-3 py-1">
                      {pattern}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 学习建议 */}
          {data.analysis?.prediction && (
            <Card>
              <CardHeader>
                <CardTitle>学习建议</CardTitle>
                <CardDescription>针对性提高计划</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.analysis.prediction.nextChapterRisks && data.analysis.prediction.nextChapterRisks.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">⚠️ 潜在风险</h4>
                      <ul className="space-y-1">
                        {data.analysis.prediction.nextChapterRisks.map((risk, index) => (
                          <li key={index} className="text-gray-700 flex items-start gap-2">
                            <span>•</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.analysis.prediction.recommendations && data.analysis.prediction.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">💡 改进建议</h4>
                      <ul className="space-y-1">
                        {data.analysis.prediction.recommendations.map((rec, index) => (
                          <li key={index} className="text-gray-700 flex items-start gap-2">
                            <span>•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 错题预览 */}
          {data.wrongQuestions && data.wrongQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>近期错题</CardTitle>
                <CardDescription>最近做错的题目（显示前10题）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.wrongQuestions.map((question, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge>第{question.questionNumber}题</Badge>
                          <Badge variant={getDifficultyColor(question.difficulty) as any}>
                            {getDifficultyLabel(question.difficulty)}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500">{question.score}分</span>
                      </div>
                      <p className="text-gray-800 mb-2">{question.content}</p>
                      {question.options && question.options.length > 0 && (
                        <div className="text-sm text-gray-600 mb-2">
                          {question.options.map((opt, i) => (
                            <span key={i} className="mr-2">{String.fromCharCode(65 + i)}. {opt}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-red-600">你的答案: {question.userAnswer || "未作答"}</span>
                        <span className="text-green-600">正确答案: {question.correctAnswer}</span>
                      </div>
                      {question.knowledgePoints && question.knowledgePoints.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {question.knowledgePoints.map((kp, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {kp}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
