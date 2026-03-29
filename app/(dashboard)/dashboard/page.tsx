"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface SubjectTrend {
  date: string
  score: number
  examCount: number
}

export default function DashboardPage() {
  const [subjectTrends, setSubjectTrends] = useState<{ [key: string]: SubjectTrend[] }>({})
  const [subjectExamCounts, setSubjectExamCounts] = useState<{ [key: string]: number }>({})
  const [loadingTrends, setLoadingTrends] = useState(true)

  useEffect(() => {
    const loadSubjectTrends = async () => {
      setLoadingTrends(true)
      try {
        const response = await fetch('/api/analytics/subject-trends')
        if (response.ok) {
          const data = await response.json()
          setSubjectTrends(data.data?.subjectTrends || {})
          setSubjectExamCounts(data.data?.subjectExamCounts || {})
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

  // 学期结束日期（6月30日）
  const SEMESTER_END = new Date(new Date().getFullYear(), 5, 30)
  const TODAY = new Date()

  // 生成完整的时间轴数据（从第一次提交到6月30日）
  const generateSemesterData = (trends: SubjectTrend[]) => {
    if (trends.length === 0) return []

    // 找到第一次提交的日期
    const firstExamDate = new Date(trends[0].date)

    // 创建一个日期分数映射
    const scoreMap = new Map<string, number>()
    trends.forEach(trend => {
      const date = new Date(trend.date)
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      scoreMap.set(dateKey, trend.score)
    })

    // 生成从第一次提交到6月30日（或今天，取较早者）的所有日期
    const data = []
    let currentDate = new Date(firstExamDate)
    const endDate = new Date(Math.min(TODAY.getTime(), SEMESTER_END.getTime()))

    while (currentDate <= endDate) {
      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
      const month = String(currentDate.getMonth() + 1).padStart(2, '0')
      const day = String(currentDate.getDate()).padStart(2, '0')
      const dateStr = `${month}-${day}`

      data.push({
        name: dateStr,
        score: scoreMap.get(dateKey) ?? null, // 没有数据的日期为null
        fullDate: currentDate.toLocaleDateString('zh-CN')
      })

      // 移到下一天
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return data
  }

  // 格式化趋势数据用于图表显示
  const formatTrendData = (trends: SubjectTrend[]) => {
    return generateSemesterData(trends)
  }

  return (
    <div className="space-y-8">
      {/* 欢迎标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          欢迎回来
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          查看你的学习进度和统计信息
        </p>
      </div>

      {/* 学科成绩趋势 */}
      {!loadingTrends && Object.keys(subjectTrends).length > 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              本学期成绩变化趋势
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              基于试卷提交记录，横轴从首次提交至本学期末（6月30日），纵轴为正确率（至少2次试卷的学科）
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {Object.entries(subjectTrends).map(([subject, trends]) => {
              const chartData = formatTrendData(trends)
              return (
                <Card key={subject}>
                  <CardHeader>
                    <CardTitle className="text-lg">{subject}</CardTitle>
                    <CardDescription>
                      共 {subjectExamCounts[subject] || 0} 次试卷记录（{trends.length} 个学习日）
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          stroke="#6b7280"
                          interval={0}
                          tickFormatter={(value: string, index: number) => {
                            const date = new Date(chartData[index]?.fullDate || '')
                            const day = date.getDate()
                            // 只显示1日、15日和最后一天
                            return (day === 1 || day === 15 || index === chartData.length - 1) ? value : ''
                          }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 12 }}
                          stroke="#6b7280"
                          label={{ value: '正确率 (%)', angle: -90, position: 'insideLeft', offset: -5, style: { fontSize: 12 } }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px'
                          }}
                          formatter={(value: any, name: string, props: any) => {
                            if (value === null) return ['无数据', '']
                            if (name === 'score') {
                              return [`${value}%`, '正确率']
                            }
                            return [value, name]
                          }}
                          labelFormatter={(label: string) => {
                            const dataPoint = chartData.find(d => d.name === label)
                            return dataPoint?.fullDate || label
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke={subjectColors[subject] || "#6b7280"}
                          strokeWidth={2}
                          dot={{ fill: subjectColors[subject] || "#6b7280", r: 4 }}
                          label={(props: any) => {
                            const { x, y, value } = props
                            // 只在有数据的点显示标签
                            if (value === null || value === undefined) {
                              return <></>
                            }
                            return (
                              <text x={x} y={y - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill={subjectColors[subject] || "#6b7280"}>
                                {value}%
                              </text>
                            )
                          }}
                          connectNulls={true}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* 加载中状态 */}
      {loadingTrends && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">加载中...</p>
          </CardContent>
        </Card>
      )}

      {/* 无数据提示 */}
      {!loadingTrends && Object.keys(subjectTrends).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              还没有足够的试卷数据
            </h3>
            <p className="text-gray-500 mb-6">
              至少需要2次试卷记录才能显示趋势图
            </p>
            <Link href="/exam">
              <Button>添加试卷</Button>
            </Link>
          </CardContent>
        </Card>
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
