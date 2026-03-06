"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { EnglishWord, WordMeaning, WordExample } from "@/types/english"
import { WORD_CATEGORIES, PARTS_OF_SPEECH } from "@/types/english"

type ViewMode = "list" | "flashcard" | "add" | "review"

export default function EnglishVocabularyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = (searchParams.get("mode") as ViewMode) || "list"

  const [words, setWords] = useState<EnglishWord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Flashcard 状态
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)

  // 添加单词表单状态
  const [newWord, setNewWord] = useState("")
  const [phonetic, setPhonetic] = useState("")
  const [meanings, setMeanings] = useState<WordMeaning[]>([{ part: "n.", meaning: "" }])
  const [examples, setExamples] = useState<WordExample[]>([{ sentence: "", translation: "" }])
  const [category, setCategory] = useState("课本")

  useEffect(() => {
    loadWords()
  }, [])

  const loadWords = () => {
    const cache = (global as any).englishWordsCache || []
    setWords(cache)
    setLoading(false)
  }

  const filteredWords = words.filter(w =>
    w.word.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Flashcard 当前单词
  const currentWord = filteredWords[currentIndex]
  const currentWordMeanings = currentWord ? JSON.parse(currentWord.meanings) : []
  const currentWordExamples = currentWord?.exampleSentences ? JSON.parse(currentWord.exampleSentences) : []

  // 添加单词
  const handleAddWord = () => {
    if (!newWord.trim() || meanings.some(m => !m.meaning.trim())) {
      alert("请填写单词和释义")
      return
    }

    const word: EnglishWord = {
      id: `word-${Date.now()}`,
      userId: "user-1",
      word: newWord.trim(),
      phonetic: phonetic || undefined,
      partOfSpeech: meanings[0]?.part,
      meanings: JSON.stringify(meanings),
      exampleSentences: examples.some(e => e.sentence) ? JSON.stringify(examples) : undefined,
      category,
      tags: [],
      masteryLevel: 0,
      reviewCount: 0,
      correctCount: 0,
      easeFactor: 2.5,
      interval: 0,
      status: "learning",
      nextReviewAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updated = [...words, word]
    setWords(updated)
    ;(global as any).englishWordsCache = updated

    // 重置表单
    setNewWord("")
    setPhonetic("")
    setMeanings([{ part: "n.", meaning: "" }])
    setExamples([{ sentence: "", translation: "" }])

    alert("单词添加成功！")
  }

  // 复习操作
  const handleReviewResult = (correct: boolean) => {
    if (!currentWord) return

    // SM2 算法简化版
    let { easeFactor, interval, reviewCount, correctCount } = currentWord

    if (correct) {
      correctCount++
      if (reviewCount === 0) {
        interval = 1
      } else if (reviewCount === 1) {
        interval = 6
      } else {
        interval = Math.round(interval * easeFactor)
      }
      easeFactor = easeFactor + 0.1
    } else {
      easeFactor = Math.max(1.3, easeFactor - 0.2)
      interval = 1
      reviewCount = 0
    }

    reviewCount++

    const nextReviewAt = new Date()
    nextReviewAt.setDate(nextReviewAt.getDate() + interval)

    // 更新单词
    const updated = words.map(w =>
      w.id === currentWord.id
        ? {
            ...w,
            easeFactor,
            interval,
            reviewCount,
            correctCount,
            nextReviewAt: nextReviewAt.toISOString(),
            lastReviewedAt: new Date().toISOString(),
            masteryLevel: correctCount / Math.max(reviewCount, 1),
          }
        : w
    )
    setWords(updated)
    ;(global as any).englishWordsCache = updated

    // 下一个单词
    setFlipped(false)
    setShowAnswer(false)
    if (currentIndex < filteredWords.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      alert("复习完成！")
      router.push("/subject/english")
    }
  }

  // 删除单词
  const handleDeleteWord = (wordId: string) => {
    if (!confirm("确定删除这个单词吗？")) return

    const updated = words.filter(w => w.id !== wordId)
    setWords(updated)
    ;(global as any).englishWordsCache = updated
  }

  if (mode === "flashcard" || mode === "review") {
    const reviewWords = mode === "review"
      ? words.filter(w => w.nextReviewAt && new Date(w.nextReviewAt) <= new Date())
      : words.filter(w => w.status === "learning")

    if (reviewWords.length === 0) {
      return (
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-lg font-medium mb-2">
                {mode === "review" ? "暂无需要复习的单词" : "单词本为空"}
              </h3>
              <p className="text-gray-500 mb-4">
                {mode === "review" ? "太棒了，继续保持！" : "先添加一些单词吧"}
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => router.push("/subject/english/vocabulary?mode=add")}>
                  添加单词
                </Button>
                <Button variant="outline" onClick={() => router.push("/subject/english")}>
                  返回
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {mode === "review" ? "复习单词" : "单词学习"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              进度: {currentIndex + 1} / {reviewWords.length}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/subject/english")}>
            返回
          </Button>
        </div>

        {/* 进度条 */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / reviewWords.length) * 100}%` }}
          />
        </div>

        {/* 单词卡片 */}
        {currentWord && (
          <Card
            className={`min-h-[400px] flex items-center justify-center cursor-pointer transition-all ${
              flipped ? "bg-blue-50 dark:bg-blue-900/20" : ""
            }`}
            onClick={() => {
              if (!showAnswer) {
                setShowAnswer(true)
              } else {
                setFlipped(!flipped)
              }
            }}
          >
            <CardContent className="text-center p-8">
              {!showAnswer ? (
                <>
                  <p className="text-gray-500 text-sm mb-4">点击查看释义</p>
                  <h2 className="text-5xl font-bold text-gray-900 dark:text-white">
                    {currentWord.word}
                  </h2>
                  {currentWord.phonetic && (
                    <p className="text-xl text-gray-600 dark:text-gray-400 mt-2">
                      [{currentWord.phonetic}]
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                      {currentWord.word}
                    </h2>
                    {currentWord.phonetic && (
                      <p className="text-lg text-gray-600 dark:text-gray-400">
                        [{currentWord.phonetic}] · {currentWord.partOfSpeech}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {currentWordMeanings.map((m: WordMeaning, i: number) => (
                      <p key={i} className="text-xl">
                        <span className="text-blue-600">{m.part}</span> {m.meaning}
                      </p>
                    ))}
                  </div>

                  {currentWordExamples.length > 0 && (
                    <div className="text-left bg-white dark:bg-gray-800 p-4 rounded-lg">
                      <p className="text-sm font-medium mb-2">例句：</p>
                      {currentWordExamples.map((ex: WordExample, i: number) => (
                        <div key={i} className="mb-2 last:mb-0">
                          <p className="text-gray-900 dark:text-white">{ex.sentence}</p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">{ex.translation}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-sm text-gray-500">
                    复习次数: {currentWord.reviewCount} · 掌握度: {Math.round(currentWord.masteryLevel * 100)}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 操作按钮 */}
        {showAnswer && (
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              variant="outline"
              className="border-red-500 text-red-600 hover:bg-red-50"
              onClick={() => handleReviewResult(false)}
            >
              ✗ 不认识
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-green-500 text-green-600 hover:bg-green-50"
              onClick={() => handleReviewResult(true)}
            >
              ✓ 认识
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (mode === "add") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            添加单词
          </h1>
          <Button variant="outline" onClick={() => router.push("/subject/english/vocabulary")}>
            返回
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* 单词和音标 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium">单词 *</label>
                <Input
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="例：apple"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">音标</label>
                <Input
                  value={phonetic}
                  onChange={(e) => setPhonetic(e.target.value)}
                  placeholder="例：ˈæpl"
                  className="mt-1"
                />
              </div>
            </div>

            {/* 分类 */}
            <div>
              <label className="text-sm font-medium">分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full mt-1 h-10 rounded-md border border-gray-300 bg-white px-3 py-2"
              >
                {WORD_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* 释义 */}
            <div>
              <label className="text-sm font-medium">释义 *</label>
              {meanings.map((m, i) => (
                <div key={i} className="flex gap-2 mt-2">
                  <select
                    value={m.part}
                    onChange={(e) => {
                      const updated = [...meanings]
                      updated[i].part = e.target.value
                      setMeanings(updated)
                    }}
                    className="w-24 h-10 rounded-md border border-gray-300 bg-white px-2 text-sm"
                  >
                    {PARTS_OF_SPEECH.map((pos) => (
                      <option key={pos.value} value={pos.value}>{pos.label}</option>
                    ))}
                  </select>
                  <Input
                    value={m.meaning}
                    onChange={(e) => {
                      const updated = [...meanings]
                      updated[i].meaning = e.target.value
                      setMeanings(updated)
                    }}
                    placeholder="中文释义"
                  />
                  {meanings.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMeanings(meanings.filter((_, idx) => idx !== i))}
                    >
                      删除
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setMeanings([...meanings, { part: "n.", meaning: "" }])}
              >
                + 添加释义
              </Button>
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
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setExamples([...examples, { sentence: "", translation: "" }])}
              >
                + 添加例句
              </Button>
            </div>

            <Button onClick={handleAddWord} className="w-full">
              添加单词
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 列表模式
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            单词本
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            共 {words.length} 个单词
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/subject/english/vocabulary?mode=review")}>
            🔄 复习 ({words.filter(w => w.nextReviewAt && new Date(w.nextReviewAt) <= new Date()).length})
          </Button>
          <Button onClick={() => router.push("/subject/english/vocabulary?mode=add")}>
            ➕ 添加单词
          </Button>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索单词..."
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* 单词列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredWords.map((word) => (
          <Card key={word.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{word.word}</CardTitle>
                  {word.phonetic && (
                    <CardDescription>{word.phonetic}</CardDescription>
                  )}
                </div>
                <div className="flex gap-1">
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                    {word.partOfSpeech}
                  </span>
                  {word.category && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded">
                      {word.category}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                {JSON.parse(word.meanings).map((m: WordMeaning, i: number) => (
                  <p key={i} className="text-sm">
                    <span className="text-blue-600">{m.part}</span> {m.meaning}
                  </p>
                ))}
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${word.masteryLevel * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{Math.round(word.masteryLevel * 100)}%</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteWord(word.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  删除
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredWords.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-gray-500 mb-4">
              {searchTerm ? "没有找到匹配的单词" : "单词本为空，开始添加单词吧！"}
            </p>
            <Button onClick={() => router.push("/subject/english/vocabulary?mode=add")}>
              添加第一个单词
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
