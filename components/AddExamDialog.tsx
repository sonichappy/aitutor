"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MultiImageUpload, type ImageFile } from "@/components/MultiImageUpload"

interface AddExamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddExamDialog({ open, onOpenChange }: AddExamDialogProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"text" | "image">("image")
  const [content, setContent] = useState("")
  const [customPrompt, setCustomPrompt] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([])

  const handleParse = async () => {
    if (activeTab === "text" && !content.trim()) {
      alert("请输入试卷内容")
      return
    }
    if (activeTab === "image" && imageFiles.length === 0) {
      alert("请上传试卷图片")
      return
    }

    setIsParsing(true)

    try {
      let response: Response
      let errorMsg = ""

      if (activeTab === "image") {
        // 使用多图合并解析 API
        const formData = new FormData()
        imageFiles.forEach(img => {
          formData.append("files", img.file)
        })
        if (customPrompt.trim()) {
          formData.append("customPrompt", customPrompt.trim())
        }

        response = await fetch("/api/exam/parse-merge", {
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
            customPrompt: customPrompt.trim() || undefined,
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

      // 重置表单
      setContent("")
      setCustomPrompt("")
      setImageFiles([])

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

  const handleClose = () => {
    if (!isParsing) {
      onOpenChange(false)
      // 重置表单
      setContent("")
      setCustomPrompt("")
      setImageFiles([])
      setActiveTab("image")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加新试卷</DialogTitle>
          <DialogDescription>
            上传试卷图片或粘贴试卷内容，AI 自动分析生成学习报告
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 个性化提示词 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">AI 识别提示词（可选）</h3>
            <div className="space-y-2">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="可选：输入针对当前试卷的个性化识别要求，例如：&#10;- 这是八年级数学几何单元测试&#10;- 重点识别图形中的角度关系&#10;- 选项是 A. B. C. D. 格式"
                className="w-full h-24 p-3 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                💡 提示：如果试卷格式特殊或需要重点识别某些内容，可以在这里说明。留空则使用通用识别规则。
              </p>
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
                  📷 支持多图上传，多页试卷会自动合并为同一份试卷
                  <span className="font-semibold ml-1">（推荐按页码顺序上传）</span>
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
              <MultiImageUpload
                images={imageFiles}
                onImagesChange={setImageFiles}
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
              disabled={isParsing || (activeTab === "text" && !content.trim()) || (activeTab === "image" && imageFiles.length === 0)}
            >
              {isParsing ? "解析中..." : `开始解析${activeTab === "image" && imageFiles.length > 1 ? ` (${imageFiles.length}张图片)` : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
