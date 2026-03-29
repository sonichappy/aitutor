'use client'

/**
 * 知识库导入页面
 * 从 data/exercises/chinese 目录导入字词表
 */

import { useState } from 'react'

export default function KnowledgeBaseImportPage() {
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [existingLibraries, setExistingLibraries] = useState<any[]>([])

  // 导入字词表
  const handleImport = async () => {
    if (!confirm('确定要从 data/exercises/chinese 目录导入所有字词表吗？')) {
      return
    }

    setIsImporting(true)
    setImportResult(null)

    try {
      const response = await fetch('/api/knowledge-base/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'chinese' })
      })

      const data = await response.json()

      if (data.success) {
        setImportResult(data.data)
        // 刷新现有知识库列表
        fetchExistingLibraries()
      } else {
        alert(`导入失败：${data.error}`)
      }
    } catch (error: any) {
      alert(`导入失败：${error.message}`)
    } finally {
      setIsImporting(false)
    }
  }

  // 获取现有知识库
  const fetchExistingLibraries = async () => {
    try {
      const response = await fetch('/api/knowledge-base/import')
      const data = await response.json()

      if (data.success) {
        setExistingLibraries(data.data.libraries || [])
      }
    } catch (error) {
      console.error('获取知识库列表失败:', error)
    }
  }

  // 页面加载时获取现有知识库
  useState(() => {
    fetchExistingLibraries()
  })

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">📚 导入语文字词表</h1>

      {/* 导入说明 */}
      <div className="bg-blue-50 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">📖 导入说明</h2>
        <p className="text-sm text-blue-800 mb-2">
          系统将从 <code className="bg-blue-100 px-2 py-1 rounded">data/exercises/chinese</code> 目录
          读取所有 Markdown 格式的字词表文件，并自动导入到知识库中。
        </p>
        <p className="text-sm text-blue-800">
          支持的格式：
        </p>
        <ul className="list-disc list-inside text-sm text-blue-800 mt-2 space-y-1">
          <li>表格格式：<code>| 字词 | 拼音 | 释义 |</code></li>
          <li>列表格式：<code>- {词语}（{拼音}）：{释义}</code></li>
        </ul>
      </div>

      {/* 现有知识库 */}
      {existingLibraries.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">已有知识库 ({existingLibraries.length})</h2>
          <div className="space-y-3">
            {existingLibraries.map((lib, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded flex justify-between items-center">
                <div>
                  <p className="font-medium">{lib.name}</p>
                  <p className="text-sm text-gray-600">
                    {lib.wordCount} 个字词 | {new Date(lib.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                <span className="text-xs text-gray-500">{lib.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 导入按钮 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">执行导入</h2>
        <button
          onClick={handleImport}
          disabled={isImporting}
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isImporting ? '导入中...' : '🚀 开始导入字词表'}
        </button>
      </div>

      {/* 导入结果 */}
      {importResult && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-green-600 mb-4">✅ 导入成功！</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded">
                <p className="text-2xl font-bold text-blue-900">{importResult.libraries.length}</p>
                <p className="text-sm text-blue-700">知识库数量</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded">
                <p className="text-2xl font-bold text-green-900">{importResult.totalWords}</p>
                <p className="text-sm text-green-700">总字词数</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded">
                <p className="text-2xl font-bold text-purple-900">{importResult.libraries[0]?.name.split(' ')[0] || '完成'}</p>
                <p className="text-sm text-purple-700">导入状态</p>
              </div>
            </div>

            <div>
              <p className="font-medium mb-2">导入详情：</p>
              <div className="space-y-2">
                {importResult.libraries.map((lib: any, index: number) => (
                  <div key={index} className="p-3 bg-gray-50 rounded text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{lib.name}</p>
                        <p className="text-gray-600 text-xs">{lib.sourceFile}</p>
                      </div>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                        {lib.wordCount} 字词
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 源文件预览 */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">📄 源文件预览</h2>
        <div className="text-sm text-gray-600">
          <p className="mb-2"><strong>检测到的源文件：</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <code className="bg-gray-100 px-2 py-1 rounded">
                data/exercises/chinese/七年级下1-4章字词表/七年级下1-4章字词表.md
              </code>
              <span className="ml-2 text-gray-500">（约 61 个字词）</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
