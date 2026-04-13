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
  pronunciation: string
  partOfSpeech: string
  meanings: string[]
  example?: string
  sourceImage?: string
  errorCount: number
  addedAt: string
  pastForm?: string
  pastParticiple?: string
  presentParticiple?: string
  isIrregularVerb?: boolean
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

export function EnglishWordLibraryManager({ onBack }: { onBack: () => void }) {
  const [libraries, setLibraries] = useState<WordLibrary[]>([])
  const [selectedLibrary, setSelectedLibrary] = useState<LibraryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingLibrary, setEditingLibrary] = useState<WordLibrary | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteBatchConfirm, setDeleteBatchConfirm] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [reprocessingBatch, setReprocessingBatch] = useState<string | null>(null)
  const [currentBatchPage, setCurrentBatchPage] = useState(0)
  const [uploadType, setUploadType] = useState<'normal' | 'irregular'>('normal')

  // 新建/编辑表单
  const [libraryName, setLibraryName] = useState("")
  const [libraryDesc, setLibraryDesc] = useState("")

  // 加载字词库列表
  const loadLibraries = async () => {
    try {
      const response = await fetch('/api/knowledge-base/english/libraries')
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
      const response = await fetch(`/api/knowledge-base/english/libraries/${libraryId}`)
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
      const response = await fetch('/api/knowledge-base/english/libraries', {
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
      const response = await fetch(`/api/knowledge-base/english/libraries/${editingLibrary.id}`, {
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
        if (selectedLibrary?.library.id === editingLibrary.id) {
          loadLibraryDetail(editingLibrary.id)
        }
      }
    } catch (error) {
      console.error('Failed to update library:', error)
    }
  }

  // 删除字词库
  const handleDeleteLibrary = async (libraryId: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/english/libraries/${libraryId}`, {
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

      const endpoint = uploadType === 'irregular'
        ? `/api/knowledge-base/english/libraries/${libraryId}/upload-irregular`
        : `/api/knowledge-base/english/libraries/${libraryId}/upload`

      const response = await fetch(endpoint, {
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
      } else {
        const error = await response.json()
        console.error('上传失败:', error.error || '未知错误')
      }
    } catch (error: any) {
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
        `/api/knowledge-base/english/libraries/${selectedLibrary.library.id}/words/${wordId}`,
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
        `/api/knowledge-base/english/libraries/${selectedLibrary.library.id}/words/${wordId}`,
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

  // 删除批次（包括图片和所有相关单词）
  const handleDeleteBatch = async (batchImage: string) => {
    if (!selectedLibrary) return

    try {
      const response = await fetch(
        `/api/knowledge-base/english/libraries/${selectedLibrary.library.id}/batches/${encodeURIComponent(batchImage)}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        setDeleteBatchConfirm(null)
        await loadLibraryDetail(selectedLibrary.library.id)
        loadLibraries()
      }
    } catch (error) {
      console.error('Failed to delete batch:', error)
    }
  }

  // 重新识别批次
  const handleReprocessBatch = async (batchImage: string) => {
    if (!selectedLibrary) return

    setReprocessingBatch(batchImage)
    try {
      const response = await fetch(
        `/api/knowledge-base/english/libraries/${selectedLibrary.library.id}/reprocess`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: batchImage })
        }
      )

      if (response.ok) {
        await loadLibraryDetail(selectedLibrary.library.id)
        loadLibraries()
      } else {
        const error = await response.json()
        console.error('重新识别失败:', error.error || '未知错误')
      }
    } catch (error) {
      console.error('Failed to reprocess batch:', error)
    } finally {
      setReprocessingBatch(null)
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
            <h2 className="text-2xl font-bold">英语单词库</h2>
            <p className="text-gray-600">管理和学习课本中的英语单词</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建单词库
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">加载中...</div>
        ) : libraries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>还没有单词库</p>
              <p className="text-sm mt-2">点击上方按钮创建你的第一个单词库</p>
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
                        {library.wordCount} 个单词
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
              <DialogTitle>新建单词库</DialogTitle>
              <DialogDescription>
                创建一个新的英语单词库来整理课本中的生词
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">单词库名称 *</Label>
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
                  placeholder="描述这个单词库的内容..."
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
          返回单词库列表
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{selectedLibrary.library.name}</h2>
          <p className="text-gray-600">{selectedLibrary.library.wordCount} 个单词</p>
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
          try {
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
          } catch (error) {
            console.error('Failed to paste image:', error)
            // 不显示alert，因为handleImageUpload已经处理了
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
          <div className="space-y-4">
            {/* 上传类型选择 */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">识别类型：</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={uploadType === 'normal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUploadType('normal')}
                >
                  普通单词/词组
                </Button>
                <Button
                  type="button"
                  variant={uploadType === 'irregular' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUploadType('irregular')}
                >
                  不规则动词表格
                </Button>
              </div>
            </div>

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
          </div>
        </CardContent>
      </Card>

      {/* 单词列表 - 按批次分组显示 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>单词列表</CardTitle>
            {selectedLibrary.batches.length > 0 && (
              <div className="text-sm text-gray-600">
                批次 {currentBatchPage + 1} / {selectedLibrary.batches.length}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {selectedLibrary.batches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>还没有单词</p>
              <p className="text-sm mt-2">上传课本截图开始识别</p>
            </div>
          ) : (
            <>
              {/* 上方分页控制 */}
              <div className="flex items-center justify-between pb-4 border-b mb-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentBatchPage(Math.max(0, currentBatchPage - 1))}
                  disabled={currentBatchPage === 0}
                >
                  上一批次
                </Button>
                <div className="text-sm text-gray-600">
                  {selectedLibrary.batches.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentBatchPage(idx)}
                      className={`mx-1 px-2 py-1 rounded ${
                        currentBatchPage === idx
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setCurrentBatchPage(Math.min(selectedLibrary.batches.length - 1, currentBatchPage + 1))}
                  disabled={currentBatchPage === selectedLibrary.batches.length - 1}
                >
                  下一批次
                </Button>
              </div>

              {/* 当前批次的显示 */}
              {selectedLibrary.batches.slice(currentBatchPage, currentBatchPage + 1).map((batch) => (
                <div key={batch.id} className="border rounded-lg p-4">
                  {/* 批次标题和操作按钮 */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700">批次图片</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {batch.wordCount} 个单词 · {new Date(batch.uploadedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReprocessBatch(batch.image)}
                        disabled={reprocessingBatch === batch.image}
                      >
                        {reprocessingBatch === batch.image ? '识别中...' : '重新识别'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteBatchConfirm(batch.image)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        删除批次
                      </Button>
                    </div>
                  </div>

                  {/* 左右布局：左侧图片，右侧单词列表 */}
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* 左侧：批次图片 */}
                    <div className="md:w-1/3 lg:w-1/4">
                      <div className="border rounded-lg overflow-hidden bg-white">
                        <img
                          src={`/api/knowledge-base/english/libraries/${selectedLibrary.library.id}/images/${batch.image}`}
                          alt="批次图片"
                          className="w-full h-auto object-contain"
                        />
                      </div>
                    </div>

                    {/* 右侧：单词列表 */}
                    <div className="flex-1">
                      {batch.words.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                          <p>该批次没有识别出单词</p>
                          <p className="text-sm mt-1">点击"重新识别"重新处理</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {batch.words.map((word) => (
                            <div
                              key={word.id}
                              className={`p-3 rounded-lg border ${
                                word.errorCount > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-baseline gap-3 mb-1">
                                    <div className={`text-lg font-bold ${word.errorCount > 0 ? 'text-red-600' : ''}`}>
                                      {word.word}
                                    </div>
                                    <div className="text-sm text-gray-600">{word.pronunciation}</div>
                                    <div className="text-xs text-blue-600">{word.partOfSpeech}</div>
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    <span className="text-gray-400">释义：</span>
                                    {word.meanings.join('；')}
                                  </div>
                                  {word.isIrregularVerb && word.pastForm && (
                                    <div className="text-xs text-purple-700 mt-1">
                                      <span className="text-purple-400">过去式：</span>
                                      {word.pastForm}
                                      {word.pastParticiple && (
                                        <span>
                                          <span className="text-gray-400 mx-1">·</span>
                                          <span className="text-purple-400">过去分词：</span>
                                          {word.pastParticiple}
                                        </span>
                                      )}
                                      {word.presentParticiple && (
                                        <span>
                                          <span className="text-gray-400 mx-1">·</span>
                                          <span className="text-purple-400">现在分词：</span>
                                          {word.presentParticiple}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {word.example && (
                                    <div className="text-xs text-gray-500 italic mt-1">
                                      例句：{word.example}
                                    </div>
                                  )}
                                  {word.errorCount > 0 && (
                                    <div className="text-xs text-red-600 mt-1">
                                      错误 {word.errorCount} 次
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1 ml-2">
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
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* 分页控制 */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentBatchPage(Math.max(0, currentBatchPage - 1))}
                  disabled={currentBatchPage === 0}
                >
                  上一批次
                </Button>
                <div className="text-sm text-gray-600">
                  {selectedLibrary.batches.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentBatchPage(idx)}
                      className={`mx-1 px-2 py-1 rounded ${
                        currentBatchPage === idx
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setCurrentBatchPage(Math.min(selectedLibrary.batches.length - 1, currentBatchPage + 1))}
                  disabled={currentBatchPage === selectedLibrary.batches.length - 1}
                >
                  下一批次
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 编辑字词库对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑单词库</DialogTitle>
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
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除单词库后，其中的所有单词和图片都将被删除，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button
              onClick={() => deleteConfirm && handleDeleteLibrary(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除批次确认对话框 */}
      <Dialog open={!!deleteBatchConfirm} onOpenChange={() => setDeleteBatchConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除批次</DialogTitle>
            <DialogDescription>
              删除该批次后，该批次的所有单词和图片都将被删除，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBatchConfirm(null)}>
              取消
            </Button>
            <Button
              onClick={() => deleteBatchConfirm && handleDeleteBatch(deleteBatchConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
