"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getEnabledSubjects } from "@/types/subject"

export default function EnglishSubjectPage() {
  const [wordCount, setWordCount] = useState(0)
  const [reviewingWords, setReviewingWords] = useState(0)
  const [grammarCount, setGrammarCount] = useState(0)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = () => {
    // 从缓存加载统计数据（模拟数据库）
    const wordCache = (global as any).englishWordsCache || []
    const grammarCache = (global as any).englishGrammarCache || []

    setWordCount(wordCache.length)
    setReviewingWords(
      wordCache.filter((w: any) =>
        w.nextReviewAt && new Date(w.nextReviewAt) <= new Date()
      ).length
    )
    setGrammarCount(grammarCache.length)
  }

  const modules = [
    {
      id: "vocabulary",
      title: "单词记忆",
      description: "科学记忆，艾宾浩斯遗忘曲线复习",
      icon: "📚",
      color: "from-blue-500 to-blue-600",
      stats: `${wordCount} 个单词`,
      action: "开始学习",
      href: "/subject/english/vocabulary",
    },
    {
      id: "grammar",
      title: "语法学习",
      description: "系统梳理，从基础到高级",
      icon: "📝",
      color: "from-green-500 to-green-600",
      stats: `${grammarCount} 个语法点`,
      action: "开始学习",
      href: "/subject/english/grammar",
    },
    {
      id: "reading",
      title: "阅读训练",
      description: "精选文章，提升阅读能力",
      icon: "📖",
      color: "from-purple-500 to-purple-600",
      stats: "开发中",
      action: "敬请期待",
      href: "#",
      disabled: true,
    },
    {
      id: "listening",
      title: "听力训练",
      description: "真实场景，提高听力水平",
      icon: "🎧",
      color: "from-orange-500 to-orange-600",
      stats: "开发中",
      action: "敬请期待",
      href: "#",
      disabled: true,
    },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 标题 */}
      <div>
        <div className="flex items-center gap-3">
          <span className="text-4xl">🔤</span>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              英语
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              系统学习，稳步提升
            </p>
          </div>
        </div>
      </div>

      {/* 学习统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>单词总量</CardDescription>
            <CardTitle className="text-3xl">{wordCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>待复习</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{reviewingWords}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>语法点</CardDescription>
            <CardTitle className="text-3xl">{grammarCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 学习模块 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          学习模块
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((module) => (
            <Card
              key={module.id}
              className={`hover:shadow-lg transition-all ${
                module.disabled ? "opacity-60" : ""
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center text-white text-2xl`}>
                      {module.icon}
                    </div>
                    <div>
                      <CardTitle>{module.title}</CardTitle>
                      <CardDescription>{module.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {module.stats}
                  </span>
                  {module.disabled ? (
                    <Button variant="outline" size="sm" disabled>
                      {module.action}
                    </Button>
                  ) : (
                    <Link
                      href={module.href}
                      className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-gradient-to-r ${module.color} hover:opacity-90 h-9 px-4 py-2`}
                    >
                      {module.action}
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/subject/english/vocabulary?mode=add"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input bg-background hover:bg-accent hover:text-accent-foreground h-20 flex flex-col items-center justify-center gap-2"
          >
            <span className="text-2xl">➕</span>
            <span className="text-sm">添加单词</span>
          </Link>
          <Link
            href="/subject/english/vocabulary?mode=review"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input bg-background hover:bg-accent hover:text-accent-foreground h-20 flex flex-col items-center justify-center gap-2"
          >
            <span className="text-2xl">🔄</span>
            <span className="text-sm">复习单词</span>
          </Link>
          <Link
            href="/subject/english/vocabulary?mode=practice"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input bg-background hover:bg-accent hover:text-accent-foreground h-20 flex flex-col items-center justify-center gap-2"
          >
            <span className="text-2xl">🎯</span>
            <span className="text-sm">单词测试</span>
          </Link>
          <Link
            href="/subject/english/grammar"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input bg-background hover:bg-accent hover:text-accent-foreground h-20 flex flex-col items-center justify-center gap-2"
          >
            <span className="text-2xl">📖</span>
            <span className="text-sm">语法学习</span>
          </Link>
        </CardContent>
      </Card>

      {/* 返回其他学科 */}
      <Card className="bg-gray-50 dark:bg-gray-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                查看其他学科
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                数学、语文、地理、历史、生物、道法
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
              返回首页
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
