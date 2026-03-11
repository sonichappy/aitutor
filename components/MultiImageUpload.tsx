"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"

export interface ImageFile {
  file: File
  preview: string
  id: string
}

interface MultiImageUploadProps {
  onImagesChange: (images: ImageFile[]) => void
  images: ImageFile[]
}

export function MultiImageUpload({ onImagesChange, images }: MultiImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
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

  const processFiles = (newFiles: FileList) => {
    const fileArray = Array.from(newFiles).filter(file => file.type.startsWith("image/"))

    const promises = fileArray.map(file => {
      return new Promise<ImageFile>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          resolve({
            file,
            preview: reader.result as string,
            id: `${file.name}-${file.size}-${Date.now()}`
          })
        }
        reader.readAsDataURL(file)
      })
    })

    Promise.all(promises).then(newImages => {
      const updatedImages = [...images, ...newImages]
      onImagesChange(updatedImages)
    })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      processFiles(files)
    }
  }, [images])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processFiles(files)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemove = (id: string) => {
    const updatedImages = images.filter(img => img.id !== id)
    onImagesChange(updatedImages)
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
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* 拖拽上传区域 */}
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
            ${images.length > 0 ? "p-4" : "p-12"}
          `}
        >
          {images.length === 0 ? (
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
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 font-medium">
                  支持多图上传，自动合并为同一份试卷
                </p>
              </div>
              <p className="text-xs text-gray-400">
                支持 JPG、PNG 格式，建议图片清晰，光线充足
              </p>
            </div>
          ) : (
            <div className="text-center w-full">
              <p className="text-sm text-gray-500 mb-4">继续添加更多图片...</p>
              <p className="text-xs text-gray-400">点击或拖拽图片到此处</p>
            </div>
          )}
        </div>

        {/* 已选图片列表 */}
        {images.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                已选择 {images.length} 张图片
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onImagesChange([])
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ""
                  }
                }}
                className="text-xs text-red-600 hover:text-red-700"
              >
                清空全部
              </button>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {images.map((image, index) => (
                <div key={image.id} className="relative group">
                  <img
                    src={image.preview}
                    alt={`试卷图片 ${index + 1}`}
                    className="w-full h-24 object-cover rounded border border-gray-200"
                  />
                  <div className="absolute top-0 left-0 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-br">
                    第{index + 1}页
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(image.id)
                    }}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
