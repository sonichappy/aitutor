/**
 * 报告导出 API
 *
 * 支持将 Markdown 报告导出为 PDF 格式
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { REPORTS_DIR, getSubjectIdByName } from '@/lib/storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string; reportId: string }> }
) {
  try {
    const { subject, reportId } = await params
    const subjectId = await getSubjectIdByName(subject)

    // 检查报告类型（普通报告或深度分析报告）
    const reportDir = path.join(REPORTS_DIR, subjectId, reportId)
    const mdPath = path.join(reportDir, 'report.md')
    const metaPath = path.join(reportId.startsWith('deepresearch-') ? reportDir : path.join(REPORTS_DIR, subjectId, reportId), 'meta.json')

    try {
      await fs.access(mdPath)
    } catch {
      return NextResponse.json(
        { success: false, error: '报告不存在' },
        { status: 404 }
      )
    }

    // 读取 Markdown 内容
    const mdContent = await fs.readFile(mdPath, 'utf-8')

    // 获取格式参数
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'pdf'

    if (format === 'md') {
      // 导出为 Markdown 文件
      return new NextResponse(mdContent, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${reportId}.md"`
        }
      })
    }

    if (format === 'pdf') {
      // 生成 HTML 版本用于 PDF 转换
      const htmlContent = generatePrintableHTML(mdContent, subject, reportId)

      // 返回 HTML（客户端可以打印为 PDF）
      return new NextResponse(htmlContent, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          // 提示客户端打印
          'X-Print-Ready': 'true'
        }
      })
    }

    return NextResponse.json(
      { success: false, error: '不支持的格式' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('[Export API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: '导出失败',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * 将 Markdown 转换为可打印的 HTML
 */
function generatePrintableHTML(mdContent: string, subject: string, reportId: string): string {
  // 简单的 Markdown 到 HTML 转换
  let html = mdContent

  // 标题转换
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')

  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // 斜体
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // 代码块
  html = html.replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>')

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // 引用块
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

  // 水平线
  html = html.replace(/^---$/gm, '<hr>')

  // 无序列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // 表格（简单处理）
  const tableRegex = /\|(.+)\|\n\|[-|\s:]+\|\n((?:\|.+\|\n?)+)/g
  html = html.replace(tableRegex, (match: string, header: string, body: string) => {
    const headers = header.split('|').filter((h: string) => h.trim()).map((h: string) => `<th>${h.trim()}</th>`).join('')
    const rows = body.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('')
      return `<tr>${cells}</tr>`
    }).join('')
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`
  })

  // 段落处理
  html = html.replace(/^(?!<[h|u|o|t|b|p|d|hr])(.+)$/gm, '<p>$1</p>')

  // 清理空标签
  html = html.replace(/<p>\s*<\/p>/g, '')
  html = html.replace(/<p>(<h[1-6]>)/g, '$1')
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1')
  html = html.replace(/<p>(<ul>)/g, '$1')
  html = html.replace(/(<\/ul>)<\/p>/g, '$1')
  html = html.replace(/<p>(<table>)/g, '$1')
  html = html.replace(/(<\/table>)<\/p>/g, '$1')
  html = html.replace(/<p>(<blockquote>)/g, '$1')
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1')
  html = html.replace(/<p>(<hr>)/g, '$1')
  html = html.replace(/(<hr>)<\/p>/g, '$1')
  html = html.replace(/<p>(<pre>)/g, '$1')
  html = html.replace(/(<\/pre>)<\/p>/g, '$1')

  // 生成完整的 HTML 文档
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject} - 深入分析报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.8;
      color: #1a1a1a;
      background: #fff;
      padding: 20px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      margin: 30px 0 20px;
      color: #1a1a1a;
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 10px;
    }

    h2 {
      font-size: 22px;
      font-weight: 600;
      margin: 25px 0 15px;
      color: #374151;
    }

    h3 {
      font-size: 18px;
      font-weight: 600;
      margin: 20px 0 10px;
      color: #4b5563;
    }

    h4 {
      font-size: 16px;
      font-weight: 600;
      margin: 15px 0 8px;
      color: #6b7280;
    }

    p {
      margin: 10px 0;
      text-align: justify;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 14px;
    }

    th, td {
      border: 1px solid #d1d5db;
      padding: 10px 12px;
      text-align: left;
    }

    th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }

    ul, ol {
      margin: 10px 0;
      padding-left: 25px;
    }

    li {
      margin: 6px 0;
    }

    blockquote {
      border-left: 4px solid #6366f1;
      padding: 10px 15px;
      margin: 15px 0;
      background: #f9fafb;
      color: #4b5563;
    }

    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: "JetBrains Mono", "Fira Code", monospace;
      font-size: 13px;
      color: #dc2626;
    }

    pre {
      background: #1f2937;
      color: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 15px 0;
    }

    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
    }

    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 25px 0;
    }

    strong {
      font-weight: 600;
      color: #1f2937;
    }

    em {
      font-style: italic;
      color: #6b7280;
    }

    /* 打印样式 */
    @media print {
      body {
        padding: 0;
      }

      h1 {
        page-break-after: avoid;
      }

      h2, h3 {
        page-break-after: avoid;
      }

      table, blockquote, pre {
        page-break-inside: avoid;
      }

      .no-print {
        display: none;
      }
    }

    /* 页眉页脚 */
    @page {
      margin: 20mm 15mm;
      @bottom-center {
        content: "第 " counter(page) " 页";
        font-size: 10pt;
        color: #9ca3af;
      }
    }

    /* 报告信息表格样式 */
    .report-info {
      background: #f9fafb;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }

    .report-info table {
      margin: 0;
    }

    .report-info td:first-child {
      font-weight: 600;
      color: #6b7280;
      width: 150px;
      background: transparent;
      border: none;
      padding-left: 0;
    }

    .report-info td:last-child {
      border: none;
      padding-right: 0;
    }

    /* 分隔线样式 */
    .divider {
      border: none;
      border-top: 2px solid #e5e7eb;
      margin: 20px 0;
    }

    /* 页脚 */
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    ${html}
    <div class="footer">
      <p>🤖 本报告由 Deep Research 智能体自动生成 | 报告ID: ${reportId}</p>
    </div>
  </div>

  <script>
    // 页面加载后自动触发打印对话框
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`
}
