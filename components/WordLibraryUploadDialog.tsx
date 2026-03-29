"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface WordLibraryUploadDialogProps {
  open: boolean
  onClose: () => void
  onUpload: (name: string, description: string, markdown: string) => Promise<void>
}

export function WordLibraryUploadDialog({ open, onClose, onUpload }: WordLibraryUploadDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [markdown, setMarkdown] = useState("")
  const [uploading, setUploading] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("请输入字词库名称")
      return
    }

    if (!markdown.trim()) {
      alert("请输入字词内容（Markdown格式）")
      return
    }

    setUploading(true)
    try {
      await onUpload(name, description, markdown)

      // 重置表单
      setName("")
      setDescription("")
      setMarkdown("")
    } catch (error) {
      console.error("Upload failed:", error)
    } finally {
      setUploading(false)
    }
  }

  const handleLoadExample = () => {
    setName("七年级下册 - 第一单元字词")
    setDescription("第一单元重点字词")

    setMarkdown(`## 第一单元字词表

### 1. 亢奋
**拼音**：kàng fèn
**释义**：极度兴奋

### 2. 晦暗
**拼音**：huì àn
**释义**：昏暗，不明显

### 3. 羁绊
**拼音**：jī bàn
**释义**：缠住了不能脱身
`)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>上传字词库</DialogTitle>
          <DialogDescription>
            上传语文字词列表，支持Markdown格式。字词将自动解析并添加到字词库中。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 字词库名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">字词库名称 *</Label>
            <Input
              id="name"
              placeholder="例如：七年级下册 - 第一单元字词"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Input
              id="description"
              placeholder="简短描述这个字词库的内容"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Markdown 内容 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="markdown">字词内容（Markdown格式）*</Label>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={handleLoadExample}
              >
                加载示例
              </Button>
            </div>
            <Textarea
              id="markdown"
              placeholder={`## 第一单元字词表

### 1. 亢奋
**拼音**：kàng fèn
**释义**：极度兴奋

### 2. 晦暗
**拼音**：huì àn
**释义**：昏暗，不明显`}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">
              格式说明：每个字词使用二级标题（###）开始，包含拼音和释义字段
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                上传中...
              </>
            ) : (
              "上传字词库"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
