"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getSubjects, saveSubjects, resetSubjects, DEFAULT_SUBJECTS, clearSubjectsCache, type Subject } from "@/types/subject"

export default function SettingsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSubjects()
  }, [])

  const loadSubjects = async () => {
    setIsLoading(true)
    try {
      const data = await getSubjects()
      setSubjects(data)
      setHasChanges(false)
    } catch (error) {
      console.error("Failed to load subjects:", error)
      // 使用默认值
      setSubjects(DEFAULT_SUBJECTS)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = (id: string) => {
    const updated = subjects.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    )
    setSubjects(updated)
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      await saveSubjects(subjects)
      setHasChanges(false)
      clearSubjectsCache()
      alert("学科设置已保存")
    } catch (error) {
      console.error("Failed to save subjects:", error)
      alert("保存失败，请重试")
    }
  }

  const handleReset = async () => {
    if (confirm("确定要重置为默认设置吗？")) {
      try {
        await resetSubjects()
        await loadSubjects()
        clearSubjectsCache()
      } catch (error) {
        console.error("Failed to reset subjects:", error)
        alert("重置失败，请重试")
      }
    }
  }

  const enabledCount = subjects.filter(s => s.enabled).length
  const scienceCount = subjects.filter(s => s.enabled && s.category === "理科").length
  const liberalCount = subjects.filter(s => s.enabled && s.category === "文科").length

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    green: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    lime: "bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          学科管理
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          管理你关注的学科，启用的学科将在应用中显示
        </p>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已启用</CardDescription>
            <CardTitle className="text-3xl">{enabledCount} 个</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>理科</CardDescription>
            <CardTitle className="text-3xl">{scienceCount} 个</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>文科</CardDescription>
            <CardTitle className="text-3xl">{liberalCount} 个</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 学科列表 */}
      <Card>
        <CardHeader>
          <CardTitle>学科列表</CardTitle>
          <CardDescription>
            点击切换开关来启用或禁用学科
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 理科 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              理科
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjects
                .filter(s => s.category === "理科")
                .map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => handleToggle(subject.id)}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      subject.enabled
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{subject.icon}</span>
                      <span className="font-medium">{subject.name}</span>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-colors ${
                      subject.enabled ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
                    }`}>
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          subject.enabled ? "translate-x-6" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* 文科 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 mt-6">
              文科
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjects
                .filter(s => s.category === "文科")
                .map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => handleToggle(subject.id)}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      subject.enabled
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{subject.icon}</span>
                      <span className="font-medium">{subject.name}</span>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-colors ${
                      subject.enabled ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
                    }`}>
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          subject.enabled ? "translate-x-6" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleReset}>
          重置默认
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges}>
          {hasChanges ? "保存更改" : "已保存"}
        </Button>
      </div>

      {/* 提示信息 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500"></span>
              <span>已启用</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600"></span>
              <span>已禁用</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            禁用的学科将在学科中心、试卷中心等功能中隐藏。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
