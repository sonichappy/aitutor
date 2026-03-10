"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Brain, Loader2 } from "lucide-react"

interface AnalysisResult {
  summary: string
  detailedAnalysis: string
  recommendations: string[]
  nextSteps: string[]
  metadata: {
    subject: string
    analysisTime: number
    dataPoints: number
    confidenceLevel: number
  }
  reportId: string
  reportPath: string
}

export function MathDeepAnalysisButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisType, setAnalysisType] = useState<string>("comprehensive")
  const [timeRange, setTimeRange] = useState<string>("all")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/agent/math/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisType,
          timeRange: timeRange === 'all' ? undefined : getTimeRangeDates(timeRange)
        })
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.result)
      } else {
        setError(data.error || '分析失败')
      }
    } catch (err: any) {
      setError(err.message || '分析失败，请重试')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getTimeRangeDates = (range: string) => {
    const end = new Date()
    const start = new Date()

    switch (range) {
      case 'week':
        start.setDate(end.getDate() - 7)
        break
      case 'month':
        start.setMonth(end.getMonth() - 1)
        break
      case 'quarter':
        start.setMonth(end.getMonth() - 3)
        break
      default:
        start.setFullYear(end.getFullYear() - 1)
    }

    return {
      start: start.toISOString(),
      end: end.toISOString()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-purple-500 text-purple-600 hover:bg-purple-50"
        >
          <Brain className="w-4 h-4 mr-1" />
          深入分析
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>数学学科深入分析</DialogTitle>
          <DialogDescription>
            基于 Deep Research Agent 的智能学习诊断
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 分析类型选择 */}
          <div>
            <Label className="text-sm font-medium mb-3 block">分析类型</Label>
            <RadioGroup value={analysisType} onValueChange={setAnalysisType}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent">
                  <RadioGroupItem value="comprehensive" id="comprehensive" />
                  <Label htmlFor="comprehensive" className="cursor-pointer flex-1">
                    <div className="font-medium">综合分析</div>
                    <div className="text-xs text-muted-foreground">全面分析各项能力</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent">
                  <RadioGroupItem value="algebra" id="algebra" />
                  <Label htmlFor="algebra" className="cursor-pointer flex-1">
                    <div className="font-medium">代数分析</div>
                    <div className="text-xs text-muted-foreground">运算与方程</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent">
                  <RadioGroupItem value="geometry" id="geometry" />
                  <Label htmlFor="geometry" className="cursor-pointer flex-1">
                    <div className="font-medium">几何分析</div>
                    <div className="text-xs text-muted-foreground">图形与证明</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent">
                  <RadioGroupItem value="function" id="function" />
                  <Label htmlFor="function" className="cursor-pointer flex-1">
                    <div className="font-medium">函数分析</div>
                    <div className="text-xs text-muted-foreground">函数与图像</div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* 时间范围选择 */}
          <div>
            <Label className="text-sm font-medium mb-3 block">数据范围</Label>
            <RadioGroup value={timeRange} onValueChange={setTimeRange}>
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all-time" />
                  <Label htmlFor="all-time" className="cursor-pointer">全部数据</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="week" id="week" />
                  <Label htmlFor="week" className="cursor-pointer">最近一周</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="month" id="month" />
                  <Label htmlFor="month" className="cursor-pointer">最近一个月</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="quarter" id="quarter" />
                  <Label htmlFor="quarter" className="cursor-pointer">最近三个月</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* 分析按钮 */}
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90"
            data-deep-analysis-trigger="true"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                正在分析中...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                开始深入分析
              </>
            )}
          </Button>

          {/* 错误提示 */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* 分析结果 */}
          {result && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">分析摘要</h4>
                <div className="text-sm text-gray-600 whitespace-pre-line bg-gray-50 p-3 rounded-lg">
                  {result.summary}
                </div>
              </div>

              {result.recommendations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">改进建议</h4>
                  <ul className="text-sm space-y-1">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="text-gray-600">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>置信度: {Math.round(result.metadata.confidenceLevel * 100)}%</span>
                <span>数据点: {result.metadata.dataPoints}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    // 打开详细报告
                    window.open(result.reportPath, '_blank')
                  }}
                >
                  查看完整报告
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResult(null)
                    setIsOpen(false)
                  }}
                >
                  关闭
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
