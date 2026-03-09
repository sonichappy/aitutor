"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Report {
  id: string
  userId: string
  subject: string
  title: string
  startDate: string
  endDate: string
  generatedAt: string
  stats: any
  analysis?: any
  content: string
}

export default function ReportDetailPage() {
  const router = useRouter()
  const params = useParams()
  const subject = decodeURIComponent(params.subject as string)
  const reportId = params.reportId as string

  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadReport()
  }, [subject, reportId])

  const loadReport = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(subject)}/${reportId}`)
      if (response.ok) {
        const data = await response.json()
        setReport(data)
      } else {
        alert("报告不存在")
        router.push("/subjects")
      }
    } catch (error) {
      console.error("Failed to load report:", error)
      alert("加载报告失败")
      router.push("/subjects")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("确定要删除这份报告吗？")) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(subject)}/${reportId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.push("/subjects")
      } else {
        alert("删除失败")
      }
    } catch (error) {
      console.error("Failed to delete report:", error)
      alert("删除失败")
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = () => {
    if (!report) return

    // 创建下载链接
    const blob = new Blob([report.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.title}_${report.generatedAt.split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!report) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* 头部 */}
        <div className="mb-8 flex items-center justify-between bg-white rounded-2xl shadow-sm p-6">
          <div className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/subjects")}
              className="mb-3 hover:bg-gray-100"
            >
              ← 返回学科报告
            </Button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {report.title}
            </h1>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <span className="text-lg">📚</span>
                {report.subject}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-lg">📅</span>
                {report.startDate} ~ {report.endDate}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-lg">🕐</span>
                {new Date(report.generatedAt).toLocaleString('zh-CN')}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              className="hover:bg-blue-50 hover:border-blue-300"
            >
              📥 导出
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="hover:bg-red-600"
            >
              {deleting ? "删除中..." : "🗑️ 删除"}
            </Button>
          </div>
        </div>

        {/* 报告内容 */}
        <Card className="shadow-xl border-0">
          <CardContent className="p-8 md:p-12">
            <style jsx global>{`
              .report-content h1 {
                font-size: 2.25rem;
                font-weight: bold;
                margin-bottom: 2rem;
                padding-bottom: 1rem;
                border-bottom: 4px solid;
                border-image: linear-gradient(to right, #3b82f6, #a855f7) 1;
              }
              .report-content h2 {
                font-size: 1.5rem;
                font-weight: bold;
                margin-top: 3rem;
                margin-bottom: 1.5rem;
                background: linear-gradient(to right, #eff6ff, #faf5ff);
                padding: 0.75rem 1.5rem;
                border-radius: 0.75rem;
                border-left: 4px solid #3b82f6;
              }
              .report-content h3 {
                font-size: 1.25rem;
                font-weight: 600;
                margin-top: 2rem;
                margin-bottom: 1rem;
                color: #1f2937;
              }
              .report-content p {
                color: #374151;
                line-height: 1.75;
                margin-bottom: 1rem;
                font-size: 1rem;
              }
              .report-content strong {
                color: #1d4ed8;
                font-weight: 600;
                background: #eff6ff;
                padding: 0.125rem 0.375rem;
                border-radius: 0.25rem;
              }
              .report-content em {
                color: #7c3aed;
              }
              .report-content ul, .report-content ol {
                list-style: none;
                padding-left: 0;
                margin-bottom: 1rem;
              }
              .report-content li {
                position: relative;
                padding-left: 1.5rem;
                margin-bottom: 0.75rem;
                color: #374151;
              }
              .report-content ul li::before {
                content: "•";
                position: absolute;
                left: 0;
                color: #3b82f6;
                font-size: 1.25rem;
                font-weight: bold;
              }
              .report-content ol {
                counter-reset: list-item;
              }
              .report-content ol li::before {
                content: counter(list-item) ".";
                position: absolute;
                left: 0;
                color: #3b82f6;
                font-weight: bold;
              }
              .report-content code {
                background: linear-gradient(to bottom right, #f3f4f6, #e5e7eb);
                padding: 0.5rem 0.625rem;
                border-radius: 0.5rem;
                font-size: 0.875rem;
                font-family: monospace;
                color: #1f2937;
                box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                border: 1px solid #d1d5db;
              }
              .report-content pre {
                background: linear-gradient(to bottom right, #111827, #1f2937);
                color: #f9fafb;
                padding: 1.5rem;
                border-radius: 0.75rem;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                border: 1px solid #374151;
                overflow-x: auto;
              }
              .report-content blockquote {
                background: linear-gradient(to right, #fffbeb, #ffedd5);
                border-left: 4px solid #f59e0b;
                padding: 1rem 1.5rem;
                border-radius: 0 0.75rem 0.75rem 0;
                font-style: italic;
                color: #92400e;
                margin-bottom: 1rem;
              }
              .report-content a {
                color: #2563eb;
                font-weight: 500;
                border-bottom: 2px solid #93c5fd;
                text-decoration: none;
                transition: all 0.2s;
              }
              .report-content a:hover {
                border-bottom-color: #2563eb;
              }
              .report-content hr {
                border-color: #e5e7eb;
                border-style: dashed;
                margin: 3rem 0;
              }
              .report-content table {
                overflow: hidden;
                border-radius: 0.75rem;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                border: 1px solid #e5e7eb;
                margin-bottom: 2rem;
              }
              .report-content thead {
                background: linear-gradient(to right, #3b82f6, #a855f7);
                color: white;
              }
              .report-content th {
                padding: 1rem 1.5rem;
                font-weight: 600;
              }
              .report-content td {
                padding: 1rem 1.5rem;
                background: white;
                border-bottom: 1px solid #e5e7eb;
              }
              .report-content tr:hover td {
                background: #f9fafb;
              }
            `}</style>
            <div className="report-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>

        {/* 页脚 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>✨ 本报告由 AI 导师自动生成，数据基于您的试卷练习情况</p>
        </div>
      </div>
    </div>
  )
}
