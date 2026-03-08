"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ImageUpload } from "@/components/ImageUpload"
import { getEnabledSubjects, clearSubjectsCache, type Subject } from "@/types/subject"

interface ExamType {
  id: string
  name: string
  description: string
  icon: string
  color: string
}

interface AddExamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddExamDialog({ open, onOpenChange }: AddExamDialogProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"text" | "image">("image")
  const [content, setContent] = useState("")
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [examTypes, setExamTypes] = useState<ExamType[]>([])
  const [selectedExamType, setSelectedExamType] = useState("")
  const [totalScore, setTotalScore] = useState("100")
  const [isParsing, setIsParsing] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    loadExamMetadata()
    loadSubjects()
  }, [])

  const loadSubjects = async () => {
    try {
      const enabledSubjects = await getEnabledSubjects()
      setSubjects(enabledSubjects)
      if (enabledSubjects.length > 0) {
        setSelectedSubject(enabledSubjects[0].name)
      }
    } catch (error) {
      console.error("Failed to load subjects:", error)
    }
  }

  const loadExamMetadata = async () => {
    try {
      const response = await fetch("/api/exam/metadata")
      if (response.ok) {
        const data = await response.json()
        setExamTypes(data.examTypes || [])
        if (data.examTypes && data.examTypes.length > 0) {
          setSelectedExamType(data.examTypes[0].id)
        }
      }
    } catch (error) {
      console.error("Failed to load exam metadata:", error)
    }
  }

  const handleParse = async () => {
    if (activeTab === "text" && !content.trim()) {
      alert("请输入试卷内容")
      return
    }
    if (activeTab === "image" && !imageFile) {
      alert("请上传试卷图片")
      return
    }

    setIsParsing(true)

    try {
      let response: Response
      let errorMsg = ""

      if (activeTab === "image") {
        const formData = new FormData()
        formData.append("file", imageFile!)
        formData.append("subject", selectedSubject)
        formData.append("examType", selectedExamType)
        formData.append("totalScore", totalScore)

        response = await fetch("/api/exam/parse-image", {
          method: "POST",
          body: formData,
        })
        errorMsg = "图片解析失败"
      } else {
        response = await fetch("/api/exam/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            subject: selectedSubject,
            examType: selectedExamType,
            totalScore: parseFloat(totalScore),
          }),
        })
        errorMsg = "试卷解析失败"
      }

      if (!response.ok) {
        // 尝试读取错误信息
        let errorData: any = { error: response.statusText }
        try {
          const text = await response.text()
          console.error("Parse error response:", text)
          if (text) {
            try {
              errorData = JSON.parse(text)
            } catch {
              errorData = { error: text }
            }
          }
        } catch {
          // 如果读取失败，使用默认错误
        }

        console.error("Parse error:", errorData)
        const errorMessage = errorData.error || errorMsg
        const details = errorData.details ? `\n详细信息: ${errorData.details}` : ""
        const provider = errorData.provider ? `\n当前模型: ${errorData.provider}` : ""
        throw new Error(errorMessage + details + provider)
      }

      const data = await response.json()

      // 存储完整数据到 sessionStorage
      if (data.examData) {
        sessionStorage.setItem(`exam_${data.examId}`, JSON.stringify(data.examData))
      }

      // 关闭对话框并跳转到确认页面
      onOpenChange(false)
      router.push(`/exam/${data.examId}/review`)
    } catch (error: any) {
      console.error("Parse error:", error)
      alert(`${activeTab === "image" ? "图片" : "试卷"}解析失败：${error.message || "请检查网络连接和API配置"}`)
    } finally {
      setIsParsing(false)
    }
  }

  const handleImageSelect = (file: File, preview: string) => {
    setImageFile(file)
    setImagePreview(preview)
  }

  const handleImageRemove = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleClose = () => {
    if (!isParsing) {
      onOpenChange(false)
      // 重置表单
      setContent("")
      setImageFile(null)
      setImagePreview(null)
      setActiveTab("image")
    }
  }

  if (subjects.length === 0) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>无法添加试卷</DialogTitle>
            <DialogDescription>
              尚未启用任何学科，请先在设置中启用学科
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Button onClick={() => router.push("/settings")}>
              前往设置
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加新试卷</DialogTitle>
          <DialogDescription>
            上传试卷图片或粘贴试卷内容，AI 自动分析生成学习报告
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 配置区域 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">试卷信息</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">科目</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.name}>
                      {subject.icon} {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">试卷类型</label>
                <select
                  value={selectedExamType}
                  onChange={(e) => setSelectedExamType(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {examTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.icon} {type.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  {examTypes.find(t => t.id === selectedExamType)?.description}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">总分</label>
                <Input
                  type="number"
                  value={totalScore}
                  onChange={(e) => setTotalScore(e.target.value)}
                  placeholder="100"
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* 录入方式选择 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">选择录入方式</h3>
            <div className="flex gap-3">
              <Button
                variant={activeTab === "text" ? "default" : "outline"}
                onClick={() => setActiveTab("text")}
                size="sm"
              >
                📝 文本粘贴
              </Button>
              <Button
                variant={activeTab === "image" ? "default" : "outline"}
                onClick={() => setActiveTab("image")}
                size="sm"
              >
                📷 图片上传
              </Button>
            </div>
            {activeTab === "image" && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  📷 图片上传功能需要使用支持视觉的 AI 模型。支持的模型：
                  <span className="font-semibold"> Gemini（推荐）、通义千问 VL、GPT-4o、Claude 3.5</span>
                </p>
              </div>
            )}
          </div>

          {/* 文本录入 */}
          {activeTab === "text" && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">粘贴试卷内容</h3>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="请粘贴试卷内容...
支持选择题、填空题、解答题等常见格式"
                className="w-full h-48 p-3 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 图片录入 */}
          {activeTab === "image" && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">上传试卷图片</h3>
              <ImageUpload
                onImageSelect={handleImageSelect}
                onImageRemove={handleImageRemove}
              />
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isParsing}>
              取消
            </Button>
            <Button
              onClick={handleParse}
              disabled={isParsing || (activeTab === "text" && !content.trim()) || (activeTab === "image" && !imageFile)}
            >
              {isParsing ? "解析中..." : "开始解析"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
