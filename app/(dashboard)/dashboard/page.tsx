"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getEnabledSubjects, type Subject } from "@/types/subject"

export default function DashboardPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])

  useEffect(() => {
    const loadSubjects = async () => {
      const enabledSubjects = await getEnabledSubjects()
      setSubjects(enabledSubjects)
    }
    loadSubjects()
  }, [])

  // 模拟各科目进度数据
  const subjectProgress: Record<string, number> = {
    "数学": 75,
    "语文": 82,
    "英语": 80,
    "物理": 60,
    "化学": 45,
    "生物": 70,
    "历史": 65,
    "地理": 72,
    "道法": 85,
  }

  const subjectColors: Record<string, string> = {
    "数学": "bg-blue-500",
    "语文": "bg-red-500",
    "英语": "bg-purple-500",
    "物理": "bg-green-500",
    "化学": "bg-orange-500",
    "生物": "bg-lime-500",
    "历史": "bg-amber-500",
    "地理": "bg-cyan-500",
    "道法": "bg-indigo-500",
  }

  // 模拟数据 - 实际应从数据库获取
  const stats = {
    todayStudyTime: 45, // 分钟
    totalQuestions: 128,
    correctRate: 0.82,
    streakDays: 5,
  }

  const weakPoints = [
    "二次函数",
    "三角函数",
    "力学综合",
    "氧化还原反应",
  ]

  return (
    <div className="space-y-8">
      {/* 欢迎信息 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          欢迎回来，张同学！
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          今天也是充满收获的一天，继续加油！
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>今日学习</CardDescription>
            <CardTitle className="text-3xl">{stats.todayStudyTime}分钟</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>累计练习</CardDescription>
            <CardTitle className="text-3xl">{stats.totalQuestions}题</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>正确率</CardDescription>
            <CardTitle className="text-3xl">{(stats.correctRate * 100).toFixed(0)}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>连续学习</CardDescription>
            <CardTitle className="text-3xl">{stats.streakDays}天</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 各科目进度 */}
      <Card>
        <CardHeader>
          <CardTitle>各科目学习进度</CardTitle>
          <CardDescription>点击科目进入专栏学习</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subjects.length > 0 ? (
            subjects.map((subject) => {
              const progress = subjectProgress[subject.name] || 50
              const color = subjectColors[subject.name] || "bg-gray-500"
              // 英语有专门的专栏页面
              const subjectPath = subject.name === "英语" ? "/subject/english" : `/dashboard`
              return (
                <Link key={subject.id} href={subjectPath} className="block">
                  <div className="space-y-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {subject.icon} {subject.name}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`${color} h-2 rounded-full transition-all`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </Link>
              )
            })
          ) : (
            <p className="text-gray-500 text-center py-4">
              还没有启用任何学科，前往
              <Link href="/settings" className="text-blue-600 hover:underline mx-1">
                设置
              </Link>
              页面配置
            </p>
          )}
        </CardContent>
      </Card>

      {/* 薄弱知识点 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>待加强知识点</CardTitle>
              <CardDescription>基于你的练习情况分析</CardDescription>
            </div>
            <Link href="/analysis">
              <Button variant="outline" size="sm">
                查看详情
              </Button>
            </Link>
          </div>
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
