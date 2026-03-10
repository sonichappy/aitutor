"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

interface DetailedAnalysisViewerProps {
  data: any
  analysisType?: string
}

/**
 * 递归渲染 JSON 数据为可折叠的树形结构
 */
function JsonTreeNode({
  data,
  keyName = "",
  level = 0
}: {
  data: any
  keyName?: string
  level?: number
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2)

  const isObject = data !== null && typeof data === "object"
  const isArray = Array.isArray(data)
  const isEmpty = isObject && Object.keys(data).length === 0

  // 基础类型值渲染
  if (!isObject) {
    return (
      <div className="py-0.5">
        {keyName && <span className="font-medium text-indigo-600 dark:text-indigo-400">{keyName}: </span>}
        <span className={
          typeof data === "number" ? "text-blue-600 dark:text-blue-400" :
          typeof data === "boolean" ? "text-green-600 dark:text-green-400" :
          "text-gray-700 dark:text-gray-300"
        }>
          {String(data)}
        </span>
      </div>
    )
  }

  // 空对象/数组
  if (isEmpty) {
    return (
      <div className="py-0.5">
        {keyName && <span className="font-medium text-indigo-600 dark:text-indigo-400">{keyName}: </span>}
        <span className="text-gray-500 dark:text-gray-500">{isArray ? "[]" : "{}"}</span>
      </div>
    )
  }

  const bgColor = level % 2 === 0
    ? "bg-white dark:bg-gray-800"
    : "bg-gray-50/50 dark:bg-gray-900/50"

  return (
    <div className={level > 0 ? `ml-4 pl-2 border-l-2 border-gray-200 dark:border-gray-700 ${bgColor}` : ""}>
      {keyName && (
        <div
          className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 -mx-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
          <span className="font-medium text-indigo-600 dark:text-indigo-400">{keyName}</span>
          <span className="text-xs text-gray-500 dark:text-gray-500">
            {isArray ? `[${data.length}]` : `{${Object.keys(data).length}}`}
          </span>
        </div>
      )}

      {isExpanded && (
        <div className="mt-1 space-y-0.5">
          {isArray ? (
            data.map((item: any, index: number) => (
              <JsonTreeNode
                key={index}
                data={item}
                keyName={`[${index}]`}
                level={level + 1}
              />
            ))
          ) : (
            Object.entries(data).map(([key, value]) => (
              <JsonTreeNode
                key={key}
                data={value}
                keyName={key}
                level={level + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 技能分析卡片 - 用于综合分析中的各技能评分
 */
function SkillScoreCard({ label, score, issues = [] }: { label: string; score: number; issues?: string[] }) {
  const percentage = Math.round(score * 10)
  const color = percentage >= 80 ? "green" : percentage >= 60 ? "yellow" : "red"

  return (
    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900 dark:text-white">{label}</span>
        <span className={`text-sm font-bold ${
          color === "green" ? "text-green-600" :
          color === "yellow" ? "text-yellow-600" :
          "text-red-600"
        }`}>
          {score}/10
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all ${
            color === "green" ? "bg-green-500" :
            color === "yellow" ? "bg-yellow-500" :
            "bg-red-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {issues.length > 0 && (
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
          {issues.slice(0, 3).map((issue, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-red-500">•</span>
              <span>{issue}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * 错误分布展示 - 饼图样式的条形图
 */
function ErrorDistribution({ distribution }: { distribution: Record<string, { count: number; percentage?: number }> }) {
  const entries = Object.entries(distribution).sort((a, b) => b[1].count - a[1].count)
  const total = entries.reduce((sum, [, v]) => sum + v.count, 0)

  if (entries.length === 0) return <div className="text-gray-500">暂无错误数据</div>

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const percentage = total > 0 ? Math.round((value.count / total) * 100) : 0
        return (
          <div key={key} className="flex items-center gap-3">
            <div className="w-24 text-sm text-gray-700 dark:text-gray-300 truncate" title={key}>
              {key}
            </div>
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-red-500 flex items-center justify-end pr-2"
                style={{ width: `${Math.max(percentage, 5)}%` }}
              >
                {percentage >= 15 && (
                  <span className="text-xs font-bold text-white">{percentage}%</span>
                )}
              </div>
            </div>
            <div className="w-16 text-right text-sm text-gray-600 dark:text-gray-400">
              {value.count}题
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 综合分析专用展示
 */
function ComprehensiveAnalysis({ data }: { data: any }) {
  const findings = data.findings || {}
  const skillAnalysis = findings.skillAnalysis || {}

  return (
    <div className="space-y-4">
      {/* 整体评估 */}
      {findings.overallAssessment && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
          <h5 className="font-semibold text-gray-900 dark:text-white mb-2">整体评估</h5>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {findings.overallAssessment.level || "N/A"}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">水平评分</div>
            </div>
            {findings.overallAssessment.trend && (
              <div className="flex-1">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  趋势: <span className="font-medium">{findings.overallAssessment.trend}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 技能分析 */}
      {Object.keys(skillAnalysis).length > 0 && (
        <div>
          <h5 className="font-semibold text-gray-900 dark:text-white mb-3">技能分析</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {skillAnalysis.grammar && (
              <SkillScoreCard
                label="语法"
                score={skillAnalysis.grammar.score || 0}
                issues={skillAnalysis.grammar.issues || []}
              />
            )}
            {skillAnalysis.vocabulary && (
              <SkillScoreCard
                label="词汇"
                score={skillAnalysis.vocabulary.score || 0}
                issues={skillAnalysis.vocabulary.issues || []}
              />
            )}
            {skillAnalysis.reading && (
              <SkillScoreCard
                label="阅读"
                score={skillAnalysis.reading.score || 0}
                issues={skillAnalysis.reading.issues || []}
              />
            )}
            {skillAnalysis.writing && (
              <SkillScoreCard
                label="写作"
                score={skillAnalysis.writing.score || 0}
                issues={skillAnalysis.writing.issues || []}
              />
            )}
          </div>
        </div>
      )}

      {/* 关键发现 */}
      {findings.keyFindings && findings.keyFindings.length > 0 && (
        <div>
          <h5 className="font-semibold text-gray-900 dark:text-white mb-2">关键发现</h5>
          <div className="space-y-2">
            {findings.keyFindings.map((finding: any, i: number) => (
              <div key={i} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-2">
                  <span className="text-lg">{finding.significance === "高" ? "🔴" : finding.significance === "中" ? "🟡" : "🟢"}</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">{finding.area}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{finding.finding}</div>
                    {finding.evidence && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">证据: {finding.evidence}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 错误模式 */}
      {findings.errorPatterns && findings.errorPatterns.length > 0 && (
        <div>
          <h5 className="font-semibold text-gray-900 dark:text-white mb-2">错误模式</h5>
          <div className="space-y-2">
            {findings.errorPatterns.map((pattern: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">{pattern.pattern}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">原因: {pattern.rootCause}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 dark:text-gray-500">频率</div>
                  <div className="text-sm font-medium text-orange-600">{pattern.frequency}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 知识缺口 */}
      {findings.knowledgeGaps && findings.knowledgeGaps.length > 0 && (
        <div>
          <h5 className="font-semibold text-gray-900 dark:text-white mb-2">知识缺口</h5>
          <div className="space-y-2">
            {findings.knowledgeGaps.map((gap: any, i: number) => (
              <div key={i} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                <div className="font-medium text-red-900 dark:text-red-300">{gap.point}</div>
                {gap.prerequisites && gap.prerequisites.length > 0 && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    前置知识: {gap.prerequisites.join(", ")}
                  </div>
                )}
                {gap.affectedAreas && gap.affectedAreas.length > 0 && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    影响: {gap.affectedAreas.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 其他数据使用 JSON 树形展示 */}
      {(data.diagnosis || data.recommendations || data.reflection) && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
            查看完整分析数据
          </summary>
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <JsonTreeNode data={data} />
          </div>
        </details>
      )}
    </div>
  )
}

/**
 * 语法分析专用展示
 */
function GrammarAnalysis({ data }: { data: any }) {
  const grammarAnalysis = data.grammarAnalysis || {}

  return (
    <div className="space-y-4">
      {/* 整体水平 */}
      {grammarAnalysis.overallLevel && (
        <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">语法整体水平</div>
          <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
            {grammarAnalysis.overallLevel}/10
          </div>
        </div>
      )}

      {/* 错误分布 */}
      {grammarAnalysis.errorDistribution && (
        <div>
          <h5 className="font-semibold text-gray-900 dark:text-white mb-2">错误分布</h5>
          <ErrorDistribution distribution={grammarAnalysis.errorDistribution} />
        </div>
      )}

      {/* 主要错误 */}
      {grammarAnalysis.topErrors && grammarAnalysis.topErrors.length > 0 && (
        <div>
          <h5 className="font-semibold text-gray-900 dark:text-white mb-2">主要错误</h5>
          <div className="space-y-2">
            {grammarAnalysis.topErrors.map((error: any, i: number) => (
              <div key={i} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">{error.point}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      类型: {error.errorType} | 原因: {error.rootCause}
                    </div>
                    {error.examples && error.examples.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        示例: {error.examples.join("; ")}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600">{error.errorCount}</div>
                    <div className="text-xs text-gray-500">题</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 其他数据 */}
      {(grammarAnalysis.knowledgeGaps || grammarAnalysis.abilityAssessment || grammarAnalysis.recommendations) && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600">
            查看详细数据
          </summary>
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <JsonTreeNode data={data} />
          </div>
        </details>
      )}
    </div>
  )
}

/**
 * 词汇分析专用展示
 */
function VocabularyAnalysis({ data }: { data: any }) {
  const vocabAnalysis = data.vocabularyAnalysis || {}

  return (
    <div className="space-y-4">
      {/* 整体评估 */}
      <div className="grid grid-cols-2 gap-3">
        {vocabAnalysis.overallLevel && (
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">词汇水平</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {vocabAnalysis.overallLevel}/10
            </div>
          </div>
        )}
        {vocabAnalysis.vocabularySize && (
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">估算词汇量</div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {vocabAnalysis.vocabularySize}
            </div>
          </div>
        )}
      </div>

      {/* 能力评估 */}
      {vocabAnalysis.abilityAssessment && (
        <div>
          <h5 className="font-semibold text-gray-900 dark:text-white mb-2">能力评估</h5>
          <div className="space-y-2">
            {vocabAnalysis.abilityAssessment.breadth && (
              <div className="flex items-center gap-2">
                <span className="w-20 text-sm text-gray-600 dark:text-gray-400">广度</span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: "70%" }} />
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{vocabAnalysis.abilityAssessment.breadth}</span>
              </div>
            )}
            {vocabAnalysis.abilityAssessment.depth && (
              <div className="flex items-center gap-2">
                <span className="w-20 text-sm text-gray-600 dark:text-gray-400">深度</span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: "60%" }} />
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{vocabAnalysis.abilityAssessment.depth}</span>
              </div>
            )}
            {vocabAnalysis.abilityAssessment.usage && (
              <div className="flex items-center gap-2">
                <span className="w-20 text-sm text-gray-600 dark:text-gray-400">运用</span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: "50%" }} />
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{vocabAnalysis.abilityAssessment.usage}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 其他数据 */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600">
          查看完整分析
        </summary>
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <JsonTreeNode data={data} />
        </div>
      </details>
    </div>
  )
}

/**
 * 详细分析查看器主组件
 */
export function DetailedAnalysisViewer({ data, analysisType }: DetailedAnalysisViewerProps) {
  // 如果数据是字符串，尝试解析
  let parsedData = data
  if (typeof data === "string") {
    try {
      parsedData = JSON.parse(data)
    } catch {
      return (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">无法解析分析数据</p>
        </div>
      )
    }
  }

  // 根据分析类型选择专门的展示组件
  const type = analysisType || "comprehensive"

  if (type === "comprehensive" && (parsedData.findings || parsedData.researchSummary)) {
    return <ComprehensiveAnalysis data={parsedData} />
  }

  if (type === "grammar" && parsedData.grammarAnalysis) {
    return <GrammarAnalysis data={parsedData} />
  }

  if (type === "vocabulary" && parsedData.vocabularyAnalysis) {
    return <VocabularyAnalysis data={parsedData} />
  }

  // 默认使用 JSON 树形展示
  return <JsonTreeNode data={parsedData} />
}
