"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getEnabledSubjects, type Subject } from "@/types/subject"

interface WrongQuestion {
  id: string
  userId: string
  subject: string
  type: string
  content: string
  options?: string
  correctAnswer: string
  userAnswer: string
  knowledgePoints: string[]
  difficulty: number
  errorReason?: string
  errorAnalysis?: string
  weakPoints: string[]
  improvement?: string
  aiExplanation?: string
  reviewCount: number
  masteredAt?: string
  nextReviewAt?: string
  status: string
  createdAt: string
  updatedAt: string
}

export default function WrongQuestionsPage() {
  const [questions, setQuestions] = useState<WrongQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState("全部")
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "mastered" | "archived">("active")
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  const [subjects] = useState<Subject[]>(getEnabledSubjects())

  useEffect(() => {
    loadWrongQuestions()
  }, [])

  const loadWrongQuestions = () => {
    // 从缓存加载错题数据（模拟数据库）
    const cache = (global as any).wrongQuestionsCache || []
    setQuestions(cache)
    setLoading(false)
  }

  const handleMarkMastered = (questionId: string) => {
    if (!confirm("确定标记为已掌握吗？")) return

    const updated = questions.map(q =>
      q.id === questionId
        ? { ...q, status: "mastered", masteredAt: new Date().toISOString() }
        : q
    )
    setQuestions(updated)

    // 更新缓存
    if (typeof global !== "undefined") {
      (global as any).wrongQuestionsCache = updated
    }
  }

  const handleArchive = (questionId: string) => {
    if (!confirm("确定归档此错题吗？")) return

    const updated = questions.map(q =>
      q.id === questionId ? { ...q, status: "archived" } : q
    )
    setQuestions(updated)

    // 更新缓存
    if (typeof global !== "undefined") {
      (global as any).wrongQuestionsCache = updated
    }
  }

  const handleReview = (questionId: string) => {
    // 增加复习次数
    const question = questions.find(q => q.id === questionId)
    if (!question) return

    const newCount = question.reviewCount + 1
    // 艾宾浩斯遗忘曲线：5分钟、30分钟、12小时、1天、2天、4天、7天、15天
    const intervals = [5, 30, 720, 1440, 2880, 5760, 10080, 21600] // 分钟
    const nextMinutes = intervals[Math.min(newCount - 1, intervals.length - 1)]
    const nextReviewAt = new Date(Date.now() + nextMinutes * 60 * 1000).toISOString()

    const updated = questions.map(q =>
      q.id === questionId
        ? { ...q, reviewCount: newCount, nextReviewAt }
        : q
    )
    setQuestions(updated)

    // 更新缓存
    if (typeof global !== "undefined") {
      (global as any).wrongQuestionsCache = updated
    }

    alert("复习完成！下次复习时间：" + new Date(nextReviewAt).toLocaleString())
  }

  const handleDelete = (questionId: string) => {
    if (!confirm("确定删除此错题吗？此操作不可恢复。")) return

    const updated = questions.filter(q => q.id !== questionId)
    setQuestions(updated)

    // 更新缓存
    if (typeof global !== "undefined") {
      (global as any).wrongQuestionsCache = updated
    }
  }

  // 过滤题目
  const filteredQuestions = questions
    .filter(q => selectedSubject === "全部" || q.subject === selectedSubject)
    .filter(q => {
      if (selectedStatus === "all") return true
      return q.status === selectedStatus
    })
    .sort((a, b) => {
      // 待复习的排在前面
      const aNeedsReview = a.nextReviewAt && new Date(a.nextReviewAt) <= new Date()
      const bNeedsReview = b.nextReviewAt && new Date(b.nextReviewAt) <= new Date()
      if (aNeedsReview && !bNeedsReview) return -1
      if (!aNeedsReview && bNeedsReview) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  // 统计数据
  const stats = {
    total: questions.length,
    active: questions.filter(q => q.status === "active").length,
    mastered: questions.filter(q => q.status === "mastered").length,
    needReview: questions.filter(q =>
      q.nextReviewAt && new Date(q.nextReviewAt) <= new Date()
    ).length,
  }

  const getSubjectIcon = (subject: string) => {
    const s = subjects.find(sub => sub.name === subject)
    return s?.icon || "📚"
  }

  const getStatusBadge = (status: string, nextReviewAt?: string) => {
    const needsReview = nextReviewAt && new Date(nextReviewAt) <= new Date()

    if (status === "mastered") {
      return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">已掌握</span>
    }
    if (status === "archived") {
      return <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">已归档</span>
    }
    if (needsReview) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">待复习</span>
    }
    return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">复习中</span>
  }

  const getNextReviewTime = (nextReviewAt?: string) => {
    if (!nextReviewAt) return null
    const date = new Date(nextReviewAt)
    const now = new Date()
    const diff = date.getTime() - now.getTime()

    if (diff <= 0) {
      return <span className="text-red-600">立即复习</span>
    }

    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return <span className="text-gray-600">{days} 天后</span>
    }
    if (hours > 0) {
      return <span className="text-gray-600">{hours} 小时后</span>
    }
    return <span className="text-gray-600">{minutes} 分钟后</span>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          错题本
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          收集错题，定期复习，彻底掌握薄弱知识点
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>错题总数</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>复习中</CardDescription>
            <CardTitle className="text-3xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已掌握</CardDescription>
            <CardTitle className="text-3xl">{stats.mastered}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>待复习</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.needReview}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {/* 学科筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">学科:</span>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
              >
                <option value="全部">全部</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.name}>
                    {subject.icon} {subject.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 状态筛选 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">状态:</span>
              <div className="flex gap-1">
                <Button
                  variant={selectedStatus === "active" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("active")}
                >
                  复习中
                </Button>
                <Button
                  variant={selectedStatus === "mastered" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("mastered")}
                >
                  已掌握
                </Button>
                <Button
                  variant={selectedStatus === "archived" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("archived")}
                >
                  已归档
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错题列表 */}
      {filteredQuestions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-gray-500">
              {questions.length === 0
                ? "还没有错题记录，完成试卷分析后会自动添加"
                : "没有符合条件的错题"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((question) => (
            <Card
              key={question.id}
              className={expandedQuestion === question.id ? "ring-2 ring-blue-500" : ""}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getSubjectIcon(question.subject)}</span>
                      <span className="text-sm text-gray-600">{question.subject}</span>
                      {getStatusBadge(question.status, question.nextReviewAt)}
                    </div>
                    <CardTitle className="text-lg">
                      {question.content.slice(0, 100)}
                      {question.content.length > 100 && "..."}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      知识点: {question.knowledgePoints.join(", ") || "未分类"}
                      {" · "}
                      复习 {question.reviewCount} 次
                      {question.nextReviewAt && (
                        <>
                          {" · "}
                          下次复习: {getNextReviewTime(question.nextReviewAt)}
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedQuestion(
                      expandedQuestion === question.id ? null : question.id
                    )}
                  >
                    {expandedQuestion === question.id ? "收起" : "展开"}
                  </Button>
                </div>
              </CardHeader>

              {expandedQuestion === question.id && (
                <CardContent className="space-y-4">
                  {/* 题目内容 */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="font-medium mb-2">题目内容:</p>
                    <p className="whitespace-pre-wrap">{question.content}</p>
                    {question.options && (
                      <p className="mt-2 text-sm text-gray-600">选项: {question.options}</p>
                    )}
                  </div>

                  {/* 答案对比 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="font-medium text-red-700 dark:text-red-300 mb-1">
                        ❌ 你的答案:
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {question.userAnswer}
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="font-medium text-green-700 dark:text-green-300 mb-1">
                        ✓ 正确答案:
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {question.correctAnswer}
                      </p>
                    </div>
                  </div>

                  {/* AI 分析 */}
                  {question.errorAnalysis && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <p className="font-medium text-purple-700 dark:text-purple-300 mb-2">
                        🤖 AI 错误分析:
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {question.errorAnalysis}
                      </p>
                    </div>
                  )}

                  {/* 薄弱知识点 */}
                  {question.weakPoints && question.weakPoints.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">薄弱知识点:</p>
                      <div className="flex flex-wrap gap-2">
                        {question.weakPoints.map((point, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded"
                          >
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 改进建议 */}
                  {question.improvement && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                        💡 改进建议:
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {question.improvement}
                      </p>
                    </div>
                  )}

                  {/* 详细解析 */}
                  {question.aiExplanation && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                        📖 查看详细解析
                      </summary>
                      <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {question.aiExplanation}
                        </p>
                      </div>
                    </details>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {question.status === "active" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleReview(question.id)}
                        >
                          ✓ 标记已复习
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkMastered(question.id)}
                        >
                          🎯 标记已掌握
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleArchive(question.id)}
                    >
                      📁 归档
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(question.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      🗑️ 删除
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
