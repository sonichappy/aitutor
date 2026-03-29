"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface SubjectTrend {
  date: string
  score: number
}

export default function DashboardPage() {
  const [subjectTrends, setSubjectTrends] = useState<{ [key: string]: SubjectTrend[] }>({})
  const [loadingTrends, setLoadingTrends] = useState(true)

  useEffect(() => {
    const loadSubjectTrends = async () => {
      setLoadingTrends(true)
      try {
        const response = await fetch('/api/analytics/subject-trends')
        if (response.ok) {
          const data = await response.json()
          setSubjectTrends(data.data?.subjectTrends || {})
        }
      } catch (error) {
        console.error("Failed to load subject trends:", error)
      } finally {
        setLoadingTrends(false)
      }
    }
    loadSubjectTrends()
  }, [])

  const subjectColors: Record<string, string> = {
    "数学": "#3b82f6",
    "语文": "#ef4444",
    "英语": "#a855f7",
    "物理": "#22c55e",
    "化学": "#f97316",
    "生物": "#84cc16",
    "历史": "#f59e0b",
    "地理": "#06b6d4",
    "道法": "#6366f1",
  }

  // 格式化趋势数据用于图表显示
  const formatTrendData = (trends: SubjectTrend[]) => {
    return trends.map((trend, index) => ({
      name: `第${index + 1}次`,
      score: trend.score,
      date: new Date(trend.date).toLocaleDateString('zh-CN')
    }))
  }

  return (
    <div className="space-y-8">
      {/* 学科成绩趋势 */}
      {!loadingTrends && Object.keys(subjectTrends).length > 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              本学期成绩变化趋势
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              基于试卷提交记录（至少2次试卷的学科）
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(subjectTrends).map(([subject, trends]) => (
              <Card key={subject}>
                <CardHeader>
                  <CardTitle className="text-lg">{subject}</CardTitle>
                  <CardDescription>
                    共 {trends.length} 次试卷记录
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart
                      data={formatTrendData(trends)}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        stroke="#6b7280"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                        stroke="#6b7280"
                        label={{ value: '分数', angle: -90, position: 'insideLeft', offset: -5, style: { fontSize: 12 } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px'
                        }}
                        formatter={(value: any) => [`${value}分`, '分数']}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke={subjectColors[subject] || "#6b7280"}
                        strokeWidth={2}
                        dot={{ fill: subjectColors[subject] || "#6b7280", r: 4 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 快速入口 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/subjects" className="block">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <CardTitle>学科报告</CardTitle>
              <CardDescription>
                基于试卷数据的智能评估与学习建议
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/learning" className="block">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <CardTitle>开始学习</CardTitle>
              <CardDescription>
                根据你的水平推荐学习内容
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/exam" className="block">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <CardTitle>试卷中心</CardTitle>
              <CardDescription>
                上传试卷，AI 自动分析
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
