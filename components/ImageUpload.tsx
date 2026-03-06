"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"

interface ImageUploadProps {
  onImageSelect: (file: File, preview: string) => void
  onImageRemove: () => void
}

export function ImageUpload({ onImageSelect, onImageRemove }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type.startsWith("image/")) {
        processFile(file)
      }
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      processFile(file)
    }
  }

  const processFile = (file: File) => {
    // 创建预览
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
      onImageSelect(file, reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemove = () => {
    setPreview(null)
    onImageRemove()
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-8
            flex flex-col items-center justify-center
            cursor-pointer transition-all
            ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"}
            hover:border-blue-400
            ${preview ? "p-2" : "p-12"}
          `}
        >
          {preview ? (
            <div className="relative w-full">
              <img
                src={preview}
                alt="试卷预览"
                className="w-full h-auto max-h-[400px] object-contain rounded"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0l-8 8a2 2 0 01-2.828 0l-8 8a2 2 0 01-2.828 0L6 14m8 0l8-8" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 16l-4.586 4.586a2 2 0 012.828 0l8-8a2 2 0 01-2.828 0l-8-8a2 2 0 01-2.828 0L6 14m0 0l8 8" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  上传试卷图片
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  拖拽图片到这里，或点击选择文件
                </p>
              </div>
              <p className="text-xs text-gray-400">
                支持 JPG、PNG 格式，建议图片清晰，光线充足
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
