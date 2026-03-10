"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getEnabledSubjects } from "@/types/subject"
import { EnglishDeepAnalysisButton } from "./EnglishDeepAnalysisButton"
import { KnowledgeGraphView } from "./KnowledgeGraphView"

export default function EnglishSubjectPage() {
  const [wordCount, setWordCount] = useState(0)
  const [reviewingWords, setReviewingWords] = useState(0)
  const [grammarCount, setGrammarCount] = useState(0)
  const [graphCategory, setGraphCategory] = useState<"all" | "grammar" | "vocabulary" | "reading" | "writing">("all")
  const [graphLevel, setGraphLevel] = useState<"all" | "basic" | "intermediate" | "advanced">("all")

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
      id: "deep-analysis",
      title: "AI 深度分析",
      description: "智能诊断，个性化学习方案",
      icon: "🤖",
      color: "from-indigo-500 to-purple-600",
      stats: "AI 驱动",
      action: "开始分析",
      component: <EnglishDeepAnalysisButton />,
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
                  ) : 'component' in module ? (
                    <div>{module.component}</div>
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

      {/* 知识图谱 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>英语知识图谱</CardTitle>
              <CardDescription>
                可视化展示知识点及其关联关系，点击节点查看详情
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* 类别筛选 */}
              <select
                value={graphCategory}
                onChange={(e) => setGraphCategory(e.target.value as typeof graphCategory)}
                className="px-3 py-1.5 text-sm border rounded-md bg-white"
              >
                <option value="all">全部类别</option>
                <option value="grammar">语法</option>
                <option value="vocabulary">词汇</option>
                <option value="reading">阅读</option>
                <option value="writing">写作</option>
              </select>
              {/* 难度筛选 */}
              <select
                value={graphLevel}
                onChange={(e) => setGraphLevel(e.target.value as typeof graphLevel)}
                className="px-3 py-1.5 text-sm border rounded-md bg-white"
              >
                <option value="all">全部难度</option>
                <option value="basic">基础</option>
                <option value="intermediate">中级</option>
                <option value="advanced">高级</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <KnowledgeGraphView category={graphCategory} level={graphLevel} />
        </CardContent>
      </Card>

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
          <div
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 h-20 flex flex-col items-center justify-center gap-2 text-white cursor-pointer"
            onClick={() => {
              const trigger = document.querySelector('[data-deep-analysis-trigger]') as HTMLButtonElement
              trigger?.click()
            }}
          >
            <span className="text-2xl">🤖</span>
            <span className="text-sm">AI 分析</span>
          </div>
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
