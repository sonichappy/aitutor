'use client'

/**
 * 语文字词库查看页面
 */

import { useState, useEffect } from 'react'

interface ChineseWord {
  id: string
  word: string
  pinyin: string
  meanings: string[]
  category?: string
  sourceUnit?: string
}

interface KnowledgeLibrary {
  id: string
  name: string
  description?: string
  wordCount: number
  createdAt: string
  sourceFile?: string
}

export default function KnowledgeBaseViewPage() {
  const [libraries, setLibraries] = useState<KnowledgeLibrary[]>([])
  const [selectedLibrary, setSelectedLibrary] = useState<KnowledgeLibrary | null>(null)
  const [words, setWords] = useState<ChineseWord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 加载知识库列表
  useEffect(() => {
    fetchLibraries()
  }, [])

  const fetchLibraries = async () => {
    try {
      const response = await fetch('/api/knowledge-base/libraries?subject=chinese')
      const data = await response.json()

      if (data.success) {
        setLibraries(data.data.libraries || [])
      }
    } catch (error) {
      console.error('加载知识库失败:', error)
    }
  }

  // 选择知识库并加载字词
  const selectLibrary = async (library: KnowledgeLibrary) => {
    setSelectedLibrary(library)
    setIsLoading(true)

    try {
      const response = await fetch(`/api/knowledge-base/${library.id}`)
      const data = await response.json()

      if (data.success) {
        setWords(data.data.words || [])
      }
    } catch (error) {
      console.error('加载字词失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 过滤字词
  const filteredWords = words.filter(word =>
    word.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
    word.pinyin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    word.meanings.some(m => m.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">📚 语文字词库</h1>

      <div className="grid md:grid-cols-3 gap-6">
        {/* 左侧：知识库列表 */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">知识库列表 ({libraries.length})</h2>

            <div className="space-y-2">
              {libraries.map((library) => (
                <div
                  key={library.id}
                  onClick={() => selectLibrary(library)}
                  className={`p-3 rounded cursor-pointer transition-colors ${
                    selectedLibrary?.id === library.id
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <p className="font-medium text-sm">{library.name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {library.wordCount} 个字词
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(library.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              ))}
            </div>

            {libraries.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>暂无知识库</p>
                <p className="text-sm mt-2">请先导入字词表</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：字词列表 */}
        <div className="md:col-span-2">
          {selectedLibrary ? (
            <div className="bg-white rounded-lg shadow p-6">
              {/* 头部 */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold">{selectedLibrary.name}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedLibrary.description}
                </p>
                <p className="text-sm text-gray-500">
                  共 {words.length} 个字词
                </p>
              </div>

              {/* 搜索框 */}
              <div className="mb-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索字词、拼音或释义..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 字词列表 */}
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="mt-2 text-gray-600">加载中...</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    显示 {filteredWords.length} / {words.length} 个字词
                  </p>

                  <div className="grid gap-3 max-h-[600px] overflow-y-auto">
                    {filteredWords.map((word) => (
                      <div
                        key={word.id}
                        className="p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-baseline gap-3">
                              <h3 className="text-xl font-semibold text-blue-900">
                                {word.word}
                              </h3>
                              <span className="text-sm text-gray-600">
                                {word.pinyin}
                              </span>
                            </div>

                            <div className="mt-2">
                              <p className="text-sm text-gray-700">
                                {word.meanings.join('；')}
                              </p>
                            </div>

                            {word.category && (
                              <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                {word.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredWords.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>未找到匹配的字词</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">选择一个知识库</h2>
              <p className="text-gray-500">
                从左侧列表中选择一个知识库查看字词
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
