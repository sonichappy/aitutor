'use client'

/**
 * 语文字词表上传演示页面
 */

import { useState, useRef } from 'react'

export default function KnowledgeBaseUploadPage() {
  const [selectedTab, setSelectedTab] = useState<'chinese' | 'english'>('chinese')
  const [libraryName, setLibraryName] = useState('')
  const [description, setDescription] = useState('')
  const [markdownContent, setMarkdownContent] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 示例模板
  const chineseTemplate = `# 七年级上册字词表

## 第一单元

### 词语
- 侍弄（shì nòng）：照料；喂养
- 和蔼（hé ǎi）：态度温和，容易接近
- 骊歌（lí gē）：告别的歌
- 徜徉（cháng yáng）：闲游；安闲自在地步行
- 训诫（xùn jiè）：教导，告诫

### 生字
- 髫（tiáo）：小孩子垂下的头发
- 髦（máo）：古代称小孩子垂下来的头发

## 第二单元

### 词语
- 乃至（nǎi zhì）：甚至
- 脊梁（jǐ liáng）：脊背
- 傲然（ào rán）：坚强不屈的样子`

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 检查文件类型
    if (!file.name.endsWith('.md')) {
      alert('请选择 Markdown 文件（.md）')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setMarkdownContent(content)

      // 尝试从文件名提取知识库名称
      if (!libraryName) {
        const fileName = file.name.replace('.md', '')
        setLibraryName(fileName)
      }
    }
    reader.readAsText(file)
  }

  // 上传知识库
  const handleUpload = async () => {
    if (!markdownContent.trim()) {
      alert('请输入或上传 Markdown 内容')
      return
    }

    setIsUploading(true)
    setUploadResult(null)

    try {
      const response = await fetch('/api/knowledge-base/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedTab,
          name: libraryName || '未命名知识库',
          description,
          markdown: markdownContent
        })
      })

      const data = await response.json()

      if (data.success) {
        setUploadResult(data.data)
      } else {
        alert(`上传失败：${data.error}`)
      }
    } catch (error: any) {
      alert(`上传失败：${error.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  // 使用模板
  const useTemplate = () => {
    setMarkdownContent(chineseTemplate)
    if (!libraryName) {
      setLibraryName('七年级上册字词表')
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">📚 上传语文字词表</h1>

      {/* 学科选择 */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setSelectedTab('chinese')}
          className={`px-4 py-2 rounded ${
            selectedTab === 'chinese'
              ? 'bg-red-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          语文
        </button>
        <button
          onClick={() => setSelectedTab('english')}
          disabled
          className={`px-4 py-2 rounded ${
            selectedTab === 'english'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-200 text-gray-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          英语（即将推出）
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 左侧：上传表单 */}
        <div className="space-y-4">
          {/* 文件上传 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">方式一：上传文件</h2>
            <p className="text-sm text-gray-600 mb-4">
              选择 .md 格式的 Markdown 文件
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              选择文件
            </button>
          </div>

          {/* 基本信息 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">基本信息</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  知识库名称 *
                </label>
                <input
                  type="text"
                  value={libraryName}
                  onChange={(e) => setLibraryName(e.target.value)}
                  placeholder="例如：七年级上册字词表"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述（可选）
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简要描述这个知识库..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：Markdown 编辑 */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">方式二：直接编辑</h2>
              <button
                onClick={useTemplate}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                使用模板
              </button>
            </div>
            <textarea
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              placeholder="在此粘贴或输入 Markdown 格式的字词表..."
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="mt-2 text-xs text-gray-500">
              格式：- 词语（拼音）：释义
            </p>
          </div>
        </div>
      </div>

      {/* 上传按钮 */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleUpload}
          disabled={isUploading || !markdownContent.trim()}
          className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isUploading ? '上传中...' : '上传知识库'}
        </button>
      </div>

      {/* 上传结果 */}
      {uploadResult && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-green-600 mb-4">✅ 上传成功！</h2>
          <div className="space-y-2 text-sm">
            <p><strong>知识库名称：</strong>{uploadResult.name}</p>
            <p><strong>字词数量：</strong>{uploadResult.wordCount}</p>
            <p><strong>知识库 ID：</strong>{uploadResult.libraryId}</p>
            <p className="text-gray-600">{uploadResult.message}</p>
          </div>

          {/* 预览前5个字词 */}
          {uploadResult.words && uploadResult.words.length > 0 && (
            <div className="mt-4">
              <p className="font-medium mb-2">预览前 5 个字词：</p>
              <div className="bg-gray-50 rounded p-4 space-y-2">
                {uploadResult.words.map((word: any, index: number) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium">{word.word}</span>
                    <span className="text-gray-500 mx-2">（{word.pinyin}）</span>
                    <span className="text-gray-600">{word.meanings.join('；')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 格式说明 */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-4">📖 Markdown 格式说明</h2>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>基本格式：</strong></p>
          <pre className="bg-white rounded p-3 mt-2">
{`# 知识库名称

## 第一单元

### 词语
- 侍弄（shì nòng）：照料；喂养
- 和蔼（hé ǎi）：态度温和，容易接近

### 生字
- 髫（tiáo）：小孩子垂下的头发`}
          </pre>
          <p className="mt-4"><strong>注意事项：</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>拼音必须带声调符号（shì nòng）</li>
            <li>多个释义用分号分隔</li>
            <li>每个字词独立成行，以 "- " 开头</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
