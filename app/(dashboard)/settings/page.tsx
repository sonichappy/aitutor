"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getSubjects,
  saveSubjects,
  resetSubjects,
  DEFAULT_SUBJECTS,
  clearSubjectsCache,
  getDefaultReportPrompt,
  type Subject
} from "@/types/subject"

export default function SettingsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [folderValue, setFolderValue] = useState("")

  // 用户设置相关状态
  const [studentName, setStudentName] = useState("张同学")
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // 提示词编辑相关状态
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [editingPromptSubject, setEditingPromptSubject] = useState<Subject | null>(null)
  const [promptValue, setPromptValue] = useState("")
  const [promptHasChanges, setPromptHasChanges] = useState(false)

  useEffect(() => {
    loadSubjects()
    loadUserSettings()
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

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/user-settings')
      if (response.ok) {
        const data = await response.json()
        if (data.data?.studentName) {
          setStudentName(data.data.studentName)
        }
      }
    } catch (error) {
      console.error("Failed to load user settings:", error)
    }
  }

  const handleSaveUserSettings = async () => {
    setIsSavingSettings(true)
    try {
      const response = await fetch('/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName })
      })
      if (response.ok) {
        alert('学生姓名已保存')
      } else {
        alert('保存失败，请重试')
      }
    } catch (error) {
      console.error("Failed to save user settings:", error)
      alert('保存失败，请重试')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleToggle = (id: string) => {
    const updated = subjects.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    )
    setSubjects(updated)
    setHasChanges(true)
  }

  const handleStartEditFolder = (subject: Subject) => {
    setEditingFolder(subject.id)
    setFolderValue(subject.folderName)
  }

  const handleSaveFolder = (subjectId: string) => {
    const updated = subjects.map(s =>
      s.id === subjectId ? { ...s, folderName: folderValue.trim() || s.id } : s
    )
    setSubjects(updated)
    setHasChanges(true)
    setEditingFolder(null)
    setFolderValue("")
  }

  const handleCancelEditFolder = () => {
    setEditingFolder(null)
    setFolderValue("")
  }

  // 提示词编辑处理函数
  const handleOpenPromptEdit = (subject: Subject) => {
    setEditingPromptSubject(subject)
    setPromptValue(subject.reportPrompt || getDefaultReportPrompt(subject))
    setPromptHasChanges(false)
    setPromptModalOpen(true)
  }

  const handleClosePromptModal = () => {
    if (promptHasChanges) {
      if (confirm("提示词已修改但未保存，确定要关闭吗？")) {
        setPromptModalOpen(false)
        setEditingPromptSubject(null)
        setPromptValue("")
        setPromptHasChanges(false)
      }
    } else {
      setPromptModalOpen(false)
      setEditingPromptSubject(null)
      setPromptValue("")
      setPromptHasChanges(false)
    }
  }

  const handleSavePrompt = () => {
    if (!editingPromptSubject) return

    const updated = subjects.map(s =>
      s.id === editingPromptSubject.id
        ? { ...s, reportPrompt: promptValue.trim() || undefined }
        : s
    )
    setSubjects(updated)
    setHasChanges(true)
    setPromptHasChanges(false)
    setPromptModalOpen(false)
    setEditingPromptSubject(null)
    setPromptValue("")
  }

  const handleResetPrompt = () => {
    if (!editingPromptSubject) return
    if (confirm("确定要重置为默认提示词吗？")) {
      const defaultPrompt = getDefaultReportPrompt(editingPromptSubject)
      setPromptValue(defaultPrompt)
      setPromptHasChanges(true)
    }
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

  const renderSubjectCard = (subject: Subject) => (
    <div
      key={subject.id}
      className={`p-4 rounded-lg border-2 transition-all ${
        subject.enabled
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-200 dark:border-gray-700 opacity-60"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{subject.icon}</span>
          <span className="font-medium">{subject.name}</span>
        </div>
        <button
          onClick={() => handleToggle(subject.id)}
          className={`w-12 h-6 rounded-full transition-colors ${
            subject.enabled ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
              subject.enabled ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* 文件夹名称编辑 */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px]">文件夹:</span>
        {editingFolder === subject.id ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={folderValue}
              onChange={(e) => setFolderValue(e.target.value)}
              className="h-7 text-sm flex-1"
              placeholder="英文名称"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveFolder(subject.id)
                if (e.key === "Escape") handleCancelEditFolder()
              }}
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => handleSaveFolder(subject.id)}
            >
              ✓
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={handleCancelEditFolder}
            >
              ✗
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <code className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              {subject.folderName}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-gray-500 hover:text-gray-700"
              onClick={() => handleStartEditFolder(subject)}
            >
              编辑
            </Button>
          </div>
        )}
      </div>

      {/* 提示词编辑按钮 */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px]">报告提示:</span>
        <span className={`text-xs ${subject.reportPrompt ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"}`}>
          {subject.reportPrompt ? "自定义" : "默认"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
          onClick={() => handleOpenPromptEdit(subject)}
        >
          编辑提示词
        </Button>
      </div>
    </div>
  )

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

      {/* 个人信息设置 */}
      <Card>
        <CardHeader>
          <CardTitle>个人信息</CardTitle>
          <CardDescription>
            设置您的称呼，将显示在首页欢迎信息中
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-sm">
              <Label htmlFor="student-name" className="mb-2 block">学生姓名</Label>
              <Input
                id="student-name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="请输入姓名"
                className="max-w-sm"
              />
            </div>
            <Button
              onClick={handleSaveUserSettings}
              disabled={isSavingSettings}
              className="mt-6"
            >
              {isSavingSettings ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 学科列表 */}
      <Card>
        <CardHeader>
          <CardTitle>学科列表</CardTitle>
          <CardDescription>
            点击切换开关来启用或禁用学科，编辑文件夹名称用于数据存储
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
                .map(renderSubjectCard)}
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
                .map(renderSubjectCard)}
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
          <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-500"></span>
              <span>已启用</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600"></span>
              <span>已禁用</span>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            禁用的学科将在学科报告、试卷中心等功能中隐藏。
          </p>
          <p className="text-sm text-gray-500 mt-2">
            文件夹名称用于试卷和报告的存储分类，建议使用英文命名，修改后现有数据不会自动迁移。
          </p>
          <p className="text-sm text-gray-500 mt-2">
            报告提示词用于生成 AI 学科分析报告，可根据学科特点自定义分析维度。支持占位符：{"{subject}"}（学科名称）、{"{wrongQuestionsData}"}（错题数据）。
          </p>
        </CardContent>
      </Card>

      {/* 提示词编辑对话框 */}
      <Dialog open={promptModalOpen} onOpenChange={(open) => !open && handleClosePromptModal()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              编辑报告提示词 - {editingPromptSubject?.name}
            </DialogTitle>
            <DialogDescription>
              自定义该学科的 AI 分析提示词。支持占位符：{"{subject}"}、{"{wrongQuestionsData}"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-input">提示词内容</Label>
              <Textarea
                id="prompt-input"
                value={promptValue}
                onChange={(e) => {
                  setPromptValue(e.target.value)
                  setPromptHasChanges(true)
                }}
                placeholder="输入自定义提示词..."
                className="min-h-[300px] font-mono text-sm"
                spellCheck={false}
              />
              <p className="text-xs text-gray-500">
                当前使用：{editingPromptSubject?.reportPrompt ? "自定义提示词" : "默认提示词"}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">支持的占位符：</p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li><code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">{"{subject}"}</code> - 学科中文名称</li>
                <li><code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">{"{wrongQuestionsData}"}</code> - 错题 JSON 数据</li>
                <li><code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">{"{writingData}"}</code> - 作文类题目数据</li>
                <li><code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">{"{allQuestionsData}"}</code> - 所有题目数据</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleResetPrompt}
            >
              重置为默认
            </Button>
            <Button
              variant="outline"
              onClick={handleClosePromptModal}
            >
              取消
            </Button>
            <Button
              onClick={handleSavePrompt}
              disabled={!promptHasChanges}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
