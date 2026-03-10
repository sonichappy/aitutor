"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Loader2, Download } from "lucide-react"
import { DetailedAnalysisViewer } from "./DetailedAnalysisViewer"

export function EnglishDeepAnalysisButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisType, setAnalysisType] = useState<'comprehensive' | 'grammar' | 'vocabulary' | 'reading' | 'writing'>('comprehensive')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const analysisOptions = [
    { value: 'comprehensive', label: '综合分析', description: '全面分析语法、词汇、阅读、写作等各项能力' },
    { value: 'grammar', label: '语法分析', description: '深入分析语法知识掌握情况' },
    { value: 'vocabulary', label: '词汇分析', description: '评估词汇量和词汇运用能力' },
    { value: 'reading', label: '阅读分析', description: '分析阅读理解能力和策略' },
    { value: 'writing', label: '写作分析', description: '评估写作能力和常见问题' },
  ]

  const handleStartAnalysis = async () => {
    setIsAnalyzing(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/agent/english/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisType,
          timeframe: 'month'
        })
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.result)
      } else {
        setError(data.error || '分析失败')
      }
    } catch (err: any) {
      setError(err.message || '网络错误')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setResult(null)
    setError(null)
  }

  const handleExport = async (reportId: string) => {
    // 打开导出页面（会自动触发打印对话框）
    const exportUrl = `/api/reports/english/${reportId}/export?format=pdf`
    window.open(exportUrl, '_blank')
  }

  return (
    <>
      <Button
        size="sm"
        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90"
        onClick={() => setIsOpen(true)}
        data-deep-analysis-trigger="true"
      >
        开始分析
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🤖 英语学习深度分析</DialogTitle>
            <DialogDescription>
              AI 智能体将深入分析您的英语学习状况，提供个性化改进建议
            </DialogDescription>
          </DialogHeader>

          {!result && (
            <div className="space-y-4 py-4">
              {/* 选择分析类型 */}
              <div className="space-y-3">
                <Label>选择分析类型</Label>
                <div className="grid grid-cols-1 gap-2">
                  {analysisOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAnalysisType(option.value as any)}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        analysisType === option.value
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 功能说明 */}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <h4 className="font-medium mb-2">✨ 分析能力</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• 自主规划研究路径，多步推理分析</li>
                  <li>• 利用知识图谱分析知识点关联</li>
                  <li>• 识别错误模式，诊断根本原因</li>
                  <li>• 生成个性化学习计划和资源推荐</li>
                </ul>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-4 py-4">
              {/* 分析摘要 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-medium mb-2">📊 分析摘要</h4>
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {result.summary}
                </div>
              </div>

              {/* 详细分析 */}
              {result.detailedAnalysis && (
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">🔍 详细分析</h4>
                  <DetailedAnalysisViewer
                    data={result.detailedAnalysis}
                    analysisType={result.analysisType || analysisType}
                  />
                </div>
              )}

              {/* 建议 */}
              {result.recommendations && result.recommendations.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">💡 改进建议</h4>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    {result.recommendations.map((rec: string, i: number) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 后续步骤 */}
              {result.nextSteps && result.nextSteps.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">➡️ 后续步骤</h4>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    {result.nextSteps.map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 元数据 */}
              {result.metadata && (
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                  <span>
                    分析时间: {new Date(result.metadata.analysisTime).toLocaleString('zh-CN')} |
                    数据点: {result.metadata.dataPoints} |
                    置信度: {Math.round(result.metadata.confidenceLevel * 100)}%
                  </span>
                  {result.reportId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(result.reportId)}
                      className="h-7 text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      导出PDF
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {result ? (
              <>
                <Button variant="outline" onClick={() => setResult(null)}>
                  重新分析
                </Button>
                {result.reportId && (
                  <Button
                    variant="outline"
                    onClick={() => handleExport(result.reportId)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    导出报告
                  </Button>
                )}
                <Button onClick={handleClose}>
                  完成
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} disabled={isAnalyzing}>
                  取消
                </Button>
                <Button onClick={handleStartAnalysis} disabled={isAnalyzing}>
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    '开始分析'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
