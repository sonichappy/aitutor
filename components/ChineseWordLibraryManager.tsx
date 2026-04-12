"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { BookOpen, Plus, Upload, Trash2, Edit, CheckCircle2, AlertCircle, ChevronRight, Image as ImageIcon } from "lucide-react"

interface WordLibrary {
  id: string
  name: string
  description: string
  wordCount: number
  createdAt: string
  updatedAt: string
}

interface Word {
  id: string
  word: string
  pinyin: string
  meanings: string[]
  sourceImage?: string
  errorCount: number
  addedAt: string
}

interface LibraryDetail {
  library: WordLibrary
  words: Word[]
  batches: WordBatch[]
  images: string[]
}

interface WordBatch {
  id: string
  image: string
  uploadedAt: string
  wordCount: number
  words: Word[]
}

export function ChineseWordLibraryManager({ onBack }: { onBack: () => void }) {
  const [libraries, setLibraries] = useState<WordLibrary[]>([])
  const [selectedLibrary, setSelectedLibrary] = useState<LibraryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingLibrary, setEditingLibrary] = useState<WordLibrary | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // 新建/编辑表单
  const [libraryName, setLibraryName] = useState("")
  const [libraryDesc, setLibraryDesc] = useState("")

  // 加载字词库列表
  const loadLibraries = async () => {
    try {
      const response = await fetch('/api/knowledge-base/chinese/libraries')
      if (response.ok) {
        const data = await response.json()
        setLibraries(data.libraries || [])
      }
    } catch (error) {
      console.error('Failed to load libraries:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载字词库详情
  const loadLibraryDetail = async (libraryId: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/chinese/libraries/${libraryId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedLibrary(data.library)
      }
    } catch (error) {
      console.error('Failed to load library detail:', error)
    }
  }

  // 创建字词库
  const handleCreateLibrary = async () => {
    if (!libraryName.trim()) return

    try {
      const response = await fetch('/api/knowledge-base/chinese/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: libraryName,
          description: libraryDesc
        })
      })

      if (response.ok) {
        setShowCreateDialog(false)
        setLibraryName("")
        setLibraryDesc("")
        loadLibraries()
      }
    } catch (error) {
      console.error('Failed to create library:', error)
    }
  }

  // 更新字词库
  const handleUpdateLibrary = async () => {
    if (!editingLibrary || !libraryName.trim()) return

    try {
      const response = await fetch(`/api/knowledge-base/chinese/libraries/${editingLibrary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: libraryName,
          description: libraryDesc
        })
      })

      if (response.ok) {
        setShowEditDialog(false)
        setEditingLibrary(null)
        setLibraryName("")
        setLibraryDesc("")
        loadLibraries()
      }
    } catch (error) {
      console.error('Failed to update library:', error)
    }
  }

  // 删除字词库
  const handleDeleteLibrary = async (libraryId: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/chinese/libraries/${libraryId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setDeleteConfirm(null)
        if (selectedLibrary?.library.id === libraryId) {
          setSelectedLibrary(null)
        }
        loadLibraries()
      }
    } catch (error) {
      console.error('Failed to delete library:', error)
    }
  }

  // 上传图片并识别
  const handleImageUpload = async (libraryId: string, file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(`/api/knowledge-base/chinese/libraries/${libraryId}/upload`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Upload successful:', data)
        // 重新加载字词库详情
        if (selectedLibrary?.library.id === libraryId) {
          await loadLibraryDetail(libraryId)
        }
        // 更新列表中的字词数
        loadLibraries()
      }
    } catch (error) {
      console.error('Failed to upload image:', error)
    } finally {
      setUploading(false)
    }
  }

  // 增加错误次数
  const handleIncrementError = async (wordId: string) => {
    if (!selectedLibrary) return

    const word = selectedLibrary.words.find(w => w.id === wordId)
    if (!word) return

    try {
      const response = await fetch(
        `/api/knowledge-base/chinese/libraries/${selectedLibrary.library.id}/words/${wordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errorCount: word.errorCount + 1 })
        }
      )

      if (response.ok) {
        loadLibraryDetail(selectedLibrary.library.id)
      }
    } catch (error) {
      console.error('Failed to increment error count:', error)
    }
  }

  // 重置错误次数
  const handleResetError = async (wordId: string) => {
    if (!selectedLibrary) return

    try {
      const response = await fetch(
        `/api/knowledge-base/chinese/libraries/${selectedLibrary.library.id}/words/${wordId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errorCount: 0 })
        }
      )

      if (response.ok) {
        loadLibraryDetail(selectedLibrary.library.id)
      }
    } catch (error) {
      console.error('Failed to reset error count:', error)
    }
  }

  useEffect(() => {
    loadLibraries()
  }, [])

  // 字词库列表视图
  if (!selectedLibrary) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
            返回学科选择
          </Button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">语文字词库</h2>
            <p className="text-gray-600">管理和学习课本中的生字词</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建字词库
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">加载中...</div>
        ) : libraries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>还没有字词库</p>
              <p className="text-sm mt-2">点击上方按钮创建你的第一个字词库</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {libraries.map((library) => (
              <Card
                key={library.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => loadLibraryDetail(library.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{library.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {library.wordCount} 个字词
                      </CardDescription>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {library.description || '暂无描述'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    创建于 {new Date(library.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 创建字词库对话框 */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建字词库</DialogTitle>
              <DialogDescription>
                创建一个新的字词库来整理课本中的生字词
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">字词库名称 *</Label>
                <Input
                  id="name"
                  placeholder="例如：七年级上册第一单元"
                  value={libraryName}
                  onChange={(e) => setLibraryName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="description">描述（可选）</Label>
                <Textarea
                  id="description"
                  placeholder="描述这个字词库的内容..."
                  value={libraryDesc}
                  onChange={(e) => setLibraryDesc(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                取消
              </Button>
              <Button onClick={handleCreateLibrary} disabled={!libraryName.trim()}>
                创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // 字词库详情视图
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setSelectedLibrary(null)}>
          <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
          返回字词库列表
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{selectedLibrary.library.name}</h2>
          <p className="text-gray-600">{selectedLibrary.library.wordCount} 个字词</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingLibrary(selectedLibrary.library)
            setLibraryName(selectedLibrary.library.name)
            setLibraryDesc(selectedLibrary.library.description)
            setShowEditDialog(true)
          }}
        >
          <Edit className="w-4 h-4 mr-1" />
          编辑
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteConfirm(selectedLibrary.library.id)}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          删除
        </Button>
      </div>

      {/* 上传图片区域 */}
      <Card
        onPaste={async (e) => {
          const items = e.clipboardData.items
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              e.preventDefault()
              const file = items[i].getAsFile()
              if (file) {
                await handleImageUpload(selectedLibrary.library.id, file)
              }
              break
            }
          }
        }}
        className="cursor-pointer"
      >
        <CardHeader>
          <CardTitle className="text-lg">上传课本截图</CardTitle>
          <CardDescription>
            支持两种方式：1) 点击按钮选择图片 2) 直接粘贴剪贴板图片 (Ctrl+V)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="image-upload"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleImageUpload(selectedLibrary.library.id, file)
                }
              }}
            />
            <label htmlFor="image-upload">
              <Button disabled={uploading} onClick={() => document.getElementById('image-upload')?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? '识别中...' : '选择图片'}
              </Button>
            </label>
            <div className="flex-1">
              <p className="text-sm text-gray-700 font-medium mb-1">💡 使用技巧</p>
              <p className="text-xs text-gray-600">
                1. 点击"选择图片"从电脑选择图片文件
              </p>
              <p className="text-xs text-gray-600">
                2. 截图后直接按 Ctrl+V 粘贴图片
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 字词列表 - 按批次分组显示 */}
      <Card>
        <CardHeader>
          <CardTitle>字词列表</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedLibrary.batches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>还没有字词</p>
              <p className="text-sm mt-2">上传课本截图开始识别</p>
            </div>
          ) : (
            <div className="space-y-6">
              {selectedLibrary.batches.map((batch) => (
                <div key={batch.id} className="border rounded-lg p-4 space-y-4">
                  {/* 批次图片 */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700">批次图片</span>
                        <span className="text-xs text-gray-500">
                          {batch.wordCount} 个字词 · {new Date(batch.uploadedAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div className="inline-block border rounded-lg overflow-hidden">
                        <img
                          src={`/api/knowledge-base/chinese/libraries/${selectedLibrary.library.id}/images/${batch.image}`}
                          alt="批次图片"
                          className="max-w-full h-auto max-h-64 object-contain"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 该批次的字词列表 */}
                  {batch.words.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {batch.words.map((word) => (
                        <div
                          key={word.id}
                          className={`p-3 rounded-lg border ${
                            word.errorCount > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className={`text-xl font-bold ${word.errorCount > 0 ? 'text-red-600' : ''}`}>
                                {word.word}
                              </div>
                              <div className="text-sm text-gray-600">{word.pinyin}</div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleIncrementError(word.id)}
                                className="text-xs"
                              >
                                <AlertCircle className="w-3 h-3 mr-1" />
                                错误
                              </Button>
                              {word.errorCount > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResetError(word.id)}
                                  className="text-xs"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  重置
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            {word.meanings.map((meaning, idx) => (
                              <div key={idx} className="flex items-start gap-1">
                                <span className="text-gray-400">•</span>
                                <span>{meaning}</span>
                              </div>
                            ))}
                          </div>
                          {word.errorCount > 0 && (
                            <div className="mt-2 pt-2 border-t border-red-200 text-xs text-red-600">
                              错误 {word.errorCount} 次
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑字词库对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑字词库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-name">名称 *</Label>
              <Input
                id="edit-name"
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">描述</Label>
              <Textarea
                id="edit-description"
                value={libraryDesc}
                onChange={(e) => setLibraryDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateLibrary}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除字词库后，其中的所有字词和图片都将被删除，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteLibrary(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
