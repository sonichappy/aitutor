"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { GrammarPoint, GrammarExample } from "@/types/english"
import { GRAMMAR_CATEGORIES, GRAMMAR_LEVELS } from "@/types/english"

type ViewMode = "list" | "detail" | "add"

export default function EnglishGrammarPage() {
  const router = useRouter()
  const [mode, setMode] = useState<ViewMode>("list")
  const [grammars, setGrammars] = useState<GrammarPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGrammar, setSelectedGrammar] = useState<GrammarPoint | null>(null)

  // 筛选状态
  const [selectedCategory, setSelectedCategory] = useState("全部")
  const [selectedLevel, setSelectedLevel] = useState("全部")

  // 添加语法表单
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("时态")
  const [subcategory, setSubcategory] = useState("")
  const [level, setLevel] = useState("初级")
  const [explanation, setExplanation] = useState("")
  const [formulas, setFormulas] = useState("")
  const [examples, setExamples] = useState<GrammarExample[]>([
    { sentence: "", translation: "", highlight: "" }
  ])
  const [commonErrors, setCommonErrors] = useState("")

  useEffect(() => {
    loadGrammars()
  }, [])

  const loadGrammars = () => {
    const cache = (global as any).englishGrammarCache || []
    setGrammars(cache)
    setLoading(false)
  }

  const categories = ["全部", ...GRAMMAR_CATEGORIES.map(c => c.value)]
  const levels = ["全部", ...GRAMMAR_LEVELS.map(l => l.value)]

  const filteredGrammars = grammars.filter(g => {
    if (selectedCategory !== "全部" && g.category !== selectedCategory) return false
    if (selectedLevel !== "全部" && g.level !== selectedLevel) return false
    return true
  })

  const handleViewGrammar = (grammar: GrammarPoint) => {
    setSelectedGrammar(grammar)
    setMode("detail")
  }

  const handleAddGrammar = () => {
    if (!title.trim() || !explanation.trim()) {
      alert("请填写标题和讲解内容")
      return
    }

    const grammar: GrammarPoint = {
      id: `grammar-${Date.now()}`,
      userId: "user-1",
      title: title.trim(),
      category: subcategory ? `${category}/${subcategory}` : category,
      level,
      explanation,
      formulas: formulas || undefined,
      examples: examples.some(e => e.sentence) ? JSON.stringify(examples) : undefined,
      commonErrors: commonErrors || undefined,
      relatedWords: [],
      masteryLevel: 0,
      practiceCount: 0,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updated = [...grammars, grammar]
    setGrammars(updated)
    ;(global as any).englishGrammarCache = updated

    // 重置表单
    setTitle("")
    setCategory("时态")
    setSubcategory("")
    setLevel("初级")
    setExplanation("")
    setFormulas("")
    setExamples([{ sentence: "", translation: "" }])
    setCommonErrors("")

    setMode("list")
    alert("语法点添加成功！")
  }

  const handleDeleteGrammar = (grammarId: string) => {
    if (!confirm("确定删除这个语法点吗？")) return

    const updated = grammars.filter(g => g.id !== grammarId)
    setGrammars(updated)
    ;(global as any).englishGrammarCache = updated
  }

  // 获取当前类别的子类别
  const currentCategory = GRAMMAR_CATEGORIES.find(c => c.value === category)
  const subcategories = currentCategory?.subcategories || []

  if (mode === "detail" && selectedGrammar) {
    const grammarExamples = selectedGrammar.examples ? JSON.parse(selectedGrammar.examples) : []

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 返回 */}
        <Button variant="outline" onClick={() => setMode("list")}>
          ← 返回列表
        </Button>

        {/* 标题 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm rounded">
              {selectedGrammar.category}
            </span>
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm rounded">
              {selectedGrammar.level}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {selectedGrammar.title}
          </h1>
        </div>

        {/* 讲解 */}
        <Card>
          <CardHeader>
            <CardTitle>语法讲解</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap">{selectedGrammar.explanation}</p>
            </div>
            {selectedGrammar.formulas && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-medium mb-2">结构公式：</p>
                <p className="font-mono text-sm whitespace-pre-wrap">{selectedGrammar.formulas}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 例句 */}
        {grammarExamples.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>例句</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {grammarExamples.map((ex: GrammarExample, i: number) => (
                <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-gray-900 dark:text-white">
                    {ex.highlight ? (
                      <>
                        {ex.sentence.split(ex.highlight).map((part, idx) => (
                          <span key={idx}>
                            {idx > 0 && <mark className="bg-yellow-200 dark:bg-yellow-800">{ex.highlight}</mark>}
                            {part}
                          </span>
                        ))}
                      </>
                    ) : (
                      ex.sentence
                    )}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                    {ex.translation}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 常见错误 */}
        {selectedGrammar.commonErrors && (
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">常见错误</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-red-700 dark:text-red-400">
                  {selectedGrammar.commonErrors}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 学习进度 */}
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 dark:text-green-300">学习进度</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  已练习 {selectedGrammar.practiceCount} 次
                </p>
              </div>
              <Button size="sm" onClick={() => {
                const updated = grammars.map(g =>
                  g.id === selectedGrammar.id
                    ? { ...g, practiceCount: g.practiceCount + 1 }
                    : g
                )
                setGrammars(updated)
                ;(global as any).englishGrammarCache = updated
                setSelectedGrammar({ ...selectedGrammar, practiceCount: selectedGrammar.practiceCount + 1 })
                alert("已记录学习次数！")
              }}>
                + 标记已学习
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (mode === "add") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            添加语法点
          </h1>
          <Button variant="outline" onClick={() => setMode("list")}>
            返回
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* 标题 */}
            <div>
              <label className="text-sm font-medium">标题 *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：一般现在时的用法"
                className="mt-1"
              />
            </div>

            {/* 分类 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">分类</label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    setSubcategory("")
                  }}
                  className="w-full mt-1 h-10 rounded-md border border-gray-300 bg-white px-3 py-2"
                >
                  {GRAMMAR_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">难度</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full mt-1 h-10 rounded-md border border-gray-300 bg-white px-3 py-2"
                >
                  {GRAMMAR_LEVELS.map((lvl) => (
                    <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 子分类 */}
            {subcategories.length > 0 && (
              <div>
                <label className="text-sm font-medium">子分类</label>
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full mt-1 h-10 rounded-md border border-gray-300 bg-white px-3 py-2"
                >
                  <option value="">选择子分类</option>
                  {subcategories.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 讲解 */}
            <div>
              <label className="text-sm font-medium">语法讲解 *</label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="详细讲解这个语法点..."
                className="w-full h-40 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
              />
            </div>

            {/* 公式 */}
            <div>
              <label className="text-sm font-medium">结构公式（可选）</label>
              <textarea
                value={formulas}
                onChange={(e) => setFormulas(e.target.value)}
                placeholder="例：主语 + be动词 + 现在分词..."
                className="w-full h-20 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
              />
            </div>

            {/* 例句 */}
            <div>
              <label className="text-sm font-medium">例句（可选）</label>
              {examples.map((ex, i) => (
                <div key={i} className="space-y-2 mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Input
                    value={ex.sentence}
                    onChange={(e) => {
                      const updated = [...examples]
                      updated[i].sentence = e.target.value
                      setExamples(updated)
                    }}
                    placeholder="英文例句"
                  />
                  <Input
                    value={ex.translation}
                    onChange={(e) => {
                      const updated = [...examples]
                      updated[i].translation = e.target.value
                      setExamples(updated)
                    }}
                    placeholder="中文翻译"
                  />
                  <Input
                    value={ex.highlight || ""}
                    onChange={(e) => {
                      const updated = [...examples]
                      updated[i].highlight = e.target.value
                      setExamples(updated)
                    }}
                    placeholder="要高亮的语法点（可选）"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setExamples([...examples, { sentence: "", translation: "", highlight: "" }])}
              >
                + 添加例句
              </Button>
            </div>

            {/* 常见错误 */}
            <div>
              <label className="text-sm font-medium">常见错误（可选）</label>
              <textarea
                value={commonErrors}
                onChange={(e) => setCommonErrors(e.target.value)}
                placeholder="学生学习时容易犯的错误..."
                className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
              />
            </div>

            <Button onClick={handleAddGrammar} className="w-full">
              添加语法点
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 列表模式
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            语法学习
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            共 {grammars.length} 个语法点
          </p>
        </div>
        <Button onClick={() => setMode("add")}>
          ➕ 添加语法点
        </Button>
      </div>

      {/* 筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-sm font-medium mr-2">分类：</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat === "全部" ? cat : GRAMMAR_CATEGORIES.find(c => c.value === cat)?.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mr-2">难度：</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {levels.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 语法列表 */}
      {filteredGrammars.length > 0 ? (
        <div className="space-y-4">
          {filteredGrammars.map((grammar) => (
            <Card
              key={grammar.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleViewGrammar(grammar)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{grammar.title}</CardTitle>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                        {grammar.category}
                      </span>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">
                        {grammar.level}
                      </span>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {grammar.explanation.slice(0, 100)}...
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right text-sm">
                      <p className="text-gray-500">练习 {grammar.practiceCount} 次</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteGrammar(grammar.id)
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-gray-500 mb-4">
              {loading ? "加载中..." : "还没有语法点，开始添加吧！"}
            </p>
            {!loading && (
              <Button onClick={() => setMode("add")}>
                添加第一个语法点
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
