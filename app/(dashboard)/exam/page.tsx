"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getEnabledSubjects, type Subject } from "@/types/subject"

export default function ExamPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"text" | "image">("text")
  const [content, setContent] = useState("")
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState("数学")
  const [examType, setExamType] = useState<"期中" | "期末" | "月考" | "练习" | "模拟">("期末")
  const [totalScore, setTotalScore] = useState("100")
  const [isParsing, setIsParsing] = useState(false)

  useEffect(() => {
    setSubjects(getEnabledSubjects())
    if (getEnabledSubjects().length > 0) {
      setSelectedSubject(getEnabledSubjects()[0].name)
    }
  }, [])

  const handleParse = async () => {
    if (!content.trim()) {
      alert("请输入试卷内容")
      return
    }

    setIsParsing(true)

    try {
      const response = await fetch("/api/exam/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          subject: selectedSubject,
          examType,
          totalScore: parseFloat(totalScore),
        }),
      })

      if (!response.ok) throw new Error("解析失败")

      const data = await response.json()
      router.push(`/exam/${data.examId}/answer`)
    } catch (error) {
      console.error(error)
      alert("试卷解析失败，请检查内容格式")
    } finally {
      setIsParsing(false)
    }
  }

  const exampleContent = `一、选择题（每题3分，共30分）
1. 下列函数中，是偶函数的是（  ）
A. y=x²    B. y=x³    C. y=2^x    D. y=x+1

2. 已知集合A={1,2,3}，B={2,3,4}，则A∩B=（  ）
A. {1}    B. {2,3}    C. {4}    D. {1,2,3,4}

3. 函数 f(x)=x²-4x+3 的顶点坐标是（  ）
A. (2,-1)    B. (2,1)    C. (-2,-1)    D. (-2,1)

二、填空题（每题4分，共20分）
11. 等差数列 {aₙ} 中，a₁=2，a₃=6，则 a₂=______

12. 计算：log₂8=______

三、解答题（共50分）
15.（10分）解方程：x²-5x+6=0

16.（12分）已知二次函数 f(x)=x²-4x+3
（1）求顶点坐标
（2）求与x轴的交点`

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          试卷分析
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          上传或粘贴试卷内容，AI 自动分析生成学习报告
        </p>
      </div>

      {/* 配置区域 */}
      <Card>
        <CardHeader>
          <CardTitle>试卷信息</CardTitle>
          <CardDescription>填写试卷基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">科目</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.name}>
                    {subject.icon} {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">试卷类型</label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as any)}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>期中</option>
                <option>期末</option>
                <option>月考</option>
                <option>练习</option>
                <option>模拟</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">总分</label>
              <Input
                type="number"
                value={totalScore}
                onChange={(e) => setTotalScore(e.target.value)}
                placeholder="100"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 录入方式选择 */}
      <Card>
        <CardHeader>
          <CardTitle>选择录入方式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={activeTab === "text" ? "default" : "outline"}
              onClick={() => setActiveTab("text")}
            >
              📝 文本粘贴
            </Button>
            <Button
              variant={activeTab === "image" ? "default" : "outline"}
              onClick={() => setActiveTab("image")}
              disabled
            >
              📷 图片上传（开发中）
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 文本录入 */}
      {activeTab === "text" && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>粘贴试卷内容</CardTitle>
                <CardDescription>
                  支持选择题、填空题、解答题等常见格式
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContent(exampleContent)}
              >
                填入示例
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="请粘贴试卷内容...

示例格式：
一、选择题
1. 题目内容？
A. 选项A    B. 选项B    C. 选项C    D. 选项D

二、填空题
11. ________

三、解答题
15. 题目内容..."
              className="w-full h-80 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                支持识别：选择题、填空题、解答题
              </p>
              <Button
                onClick={handleParse}
                disabled={isParsing || !content.trim()}
                size="lg"
              >
                {isParsing ? "解析中..." : "解析试卷"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 图片录入 */}
      {activeTab === "image" && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">📷</div>
            <h3 className="text-lg font-medium mb-2">图片上传功能开发中</h3>
            <p className="text-gray-500 mb-4">
              敬请期待 OCR 图片识别功能
            </p>
            <p className="text-sm text-gray-400">
              目前请使用文本粘贴方式录入试卷
            </p>
          </CardContent>
        </Card>
      )}

      {/* 无学科提示 */}
      {subjects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">
              尚未启用任何学科，请先在设置中启用学科
            </p>
            <Button onClick={() => router.push("/settings")}>
              前往设置
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
