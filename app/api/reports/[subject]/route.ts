import { NextRequest, NextResponse } from "next/server"
import { getSubjectReports, saveSubjectReport, getUserExams } from "@/lib/storage"
import { callLLM, getModelInfo } from "@/lib/ai/llm"
import { getSubjectByName, getDefaultReportPrompt, getSubjectFolderName, type Subject } from "@/types/subject"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

// GET - 获取某个学科的所有报告
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params
  const decodedSubject = decodeURIComponent(subject)

  try {
    const reports = await getSubjectReports(decodedSubject)

    // 只返回报告列表，不返回完整内容
    // 过滤掉深度分析报告（deepresearch-开头的报告ID）
    const reportList = reports
      .filter(r => !r.id?.startsWith('deepresearch-'))
      .map(r => ({
        id: r.id,
        userId: r.userId,
        subject: r.subject,
        title: r.title,
        startDate: r.startDate,
        endDate: r.endDate,
        generatedAt: r.generatedAt,
        stats: r.stats,
        hasAnalysis: !!r.analysis
      }))

    return NextResponse.json({
      subject: decodedSubject,
      reports: reportList,
      total: reportList.length
    })
  } catch (error: any) {
    console.error("[Reports GET] Error:", error)
    return NextResponse.json(
      { error: "获取报告列表失败", details: error.message },
      { status: 500 }
    )
  }
}

// POST - 生成新报告
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params
  const decodedSubject = decodeURIComponent(subject)

  try {
    const body = await request.json()
    const { startDate, endDate, title } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "请选择时间范围" },
        { status: 400 }
      )
    }

    // 获取学科对象和文件夹名称
    // 注意：exam.subject 存储的是文件夹名称（如 geometry），而 decodedSubject 是中文名称（如 几何）
    const subjectObj = await getSubjectByName(decodedSubject)
    const subjectFolderName = subjectObj?.folderName || decodedSubject

    // 获取用户的所有试卷
    const allExams = await getUserExams(DEFAULT_USER_ID)

    // 筛选出该学科在指定时间范围内的试卷
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999) // 包含结束日期当天

    const filteredExams = allExams.filter(exam => {
      // 使用文件夹名称进行匹配
      if (exam.subject !== subjectFolderName && exam.subject !== decodedSubject) return false
      const examDate = new Date(exam.createdAt)
      return examDate >= start && examDate <= end
    })

    if (filteredExams.length === 0) {
      return NextResponse.json(
        { error: `该时间范围内没有${decodedSubject}试卷数据` },
        { status: 400 }
      )
    }

    // 收集数据
    const wrongQuestions: any[] = []
    const markedQuestions: any[] = []
    const allQuestions: any[] = []  // 收集所有题目数据（用于作文等特殊题型）

    for (const exam of filteredExams) {
      if (exam.questions && Array.isArray(exam.questions)) {
        for (const question of exam.questions) {
          // 收集所有题目（用于 AI 分析作文等）
          allQuestions.push({
            number: question.number,
            content: question.content,
            type: question.type,
            options: question.options,
            userAnswer: question.userAnswer,
            correctAnswer: question.correctAnswer,
            knowledgePoints: question.knowledgePoints || [],
            difficulty: question.difficulty,
            score: question.score,
            essayGenre: question.essayGenre,  // 作文体裁
            wordCount: question.wordCount,  // 作文字数
            examId: exam.id,
            examDate: exam.createdAt,
            metadata: exam.metadata,  // 试卷元数据（是否作文等）
          })

          // 收集所有已标记的题目
          if (question.isCorrect !== undefined || question.isSkipped) {
            markedQuestions.push({
              question: question,
              examId: exam.id,
              createdAt: exam.createdAt
            })

            // 收集错题
            if (question.isCorrect === false && !question.isSkipped) {
              wrongQuestions.push({
                questionNumber: question.number,
                content: question.content,
                type: question.type,
                options: question.options,
                userAnswer: question.userAnswer,
                correctAnswer: question.correctAnswer,
                knowledgePoints: question.knowledgePoints || [],
                difficulty: question.difficulty,
                score: question.score,
                examId: exam.id,
                examDate: exam.createdAt,
              })
            }
          }
        }
      }
    }

    // 计算统计数据
    let totalCorrect = 0
    let totalSkipped = 0
    let totalWrong = 0
    let totalMarked = 0
    let totalScoreObtained = 0
    let totalScorePossible = 0

    for (const item of markedQuestions) {
      const question = item.question
      const score = question.score || 0
      totalScorePossible += score

      if (question.isCorrect === true) {
        totalCorrect++
        totalMarked++
        totalScoreObtained += score
      } else if (question.isCorrect === false) {
        totalWrong++
        totalMarked++
      } else if (question.isSkipped) {
        totalSkipped++
        totalMarked++
      }
    }

    const totalQuestions = filteredExams.reduce((sum, exam) => sum + (exam.questions?.length || 0), 0)
    const avgAccuracy = totalMarked > 0
      ? (totalCorrect + (totalQuestions - totalMarked)) / totalQuestions
      : 1

    const stats = {
      totalExams: filteredExams.length,
      totalQuestions,
      markedQuestions: totalMarked,
      correctQuestions: totalCorrect,
      wrongQuestions: wrongQuestions.length,
      skippedQuestions: totalSkipped,
      avgAccuracy
    }

    // AI 分析（如果有试卷数据）
    let analysis = null
    let aiAnalysisTime = 0
    let aiModelInfo = getModelInfo()

    // 只要有试卷数据就进行 AI 分析（支持作文等非错题类型）
    if (filteredExams.length > 0 && allQuestions.length > 0) {
      // 获取学科对象以获取自定义提示词
      const subjectObj: Subject | undefined = await getSubjectByName(decodedSubject)

      // 获取提示词模板（优先使用自定义，否则使用默认）
      const promptTemplate = subjectObj?.reportPrompt || getDefaultReportPrompt(subjectObj)

      // 准备作文数据
      const writingQuestions = allQuestions.filter(q =>
        q.type === 'essay' || q.essayGenre || q.metadata?.isEssay
      )

      // 替换占位符生成最终提示词
      const prompt = promptTemplate
        .replace(/{subject}/g, decodedSubject)
        .replace(/{wrongQuestionsData}/g, JSON.stringify(wrongQuestions.length > 0 ? wrongQuestions : allQuestions.slice(0, 5), null, 2))
        .replace(/{writingData}/g, JSON.stringify(writingQuestions.length > 0 ? writingQuestions : allQuestions.slice(0, 3), null, 2))
        .replace(/{allQuestionsData}/g, JSON.stringify(allQuestions, null, 2))

      console.log(`[Report] Generating AI analysis for ${decodedSubject}: ${allQuestions.length} questions, ${writingQuestions.length} writing questions`)

      try {
        const aiStart = Date.now()
        const aiResponse = await callLLM([{ role: "user", content: prompt }], {
          temperature: 0.3,  // 降低温度以获得更稳定的 JSON 输出
          maxTokens: 4000,   // 增加 token 限制以支持更复杂的输出
        })
        aiAnalysisTime = Date.now() - aiStart

        const content = typeof aiResponse === 'string' ? aiResponse : aiResponse.content

        // 记录原始响应用于调试
        console.log(`[Report] AI response length: ${content?.length || 0}`)
        console.log(`[Report] AI response (first 500 chars):`, content?.substring(0, 500))

        // 尝试提取并清理 JSON
        let jsonStr = content?.trim() || ""

        // 清理 markdown 代码块标记
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr
            .replace(/^```json\n/, "")
            .replace(/^```\n/, "")
            .replace(/\n```$/, "")
            .replace(/```$/, "")
        }

        // 提取 JSON 对象（处理可能的额外文字）
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonStr = jsonMatch[0]
        }

        // 清理 JSON 中的常见问题
        // 1. 移除未闭合的注释
        jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, "")
        jsonStr = jsonStr.replace(/\/\/.*/g, "")

        // 2. 修复尾随逗号
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1")

        // 3. 修复控制字符（除了换行、制表符等）
        jsonStr = jsonStr.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")

        console.log(`[Report] Attempting to parse JSON...`)
        analysis = JSON.parse(jsonStr)
        console.log(`[Report] JSON parsed successfully`)
      } catch (error: any) {
        console.error("[Report] AI analysis failed:", error.message)

        // 输出更多调试信息
        if (error.message.includes("JSON")) {
          console.error("[Report] JSON parse error details:", {
            errorMessage: error.message,
            position: error.message.match(/position (\d+)/)?.[1],
          })
        }
      }
    }

    const reportStartTime = Date.now()

    // 生成 Markdown 报告
    const reportContent = generateMarkdownReport({
      subject: decodedSubject,
      title: title || `${decodedSubject}学习报告`,
      startDate,
      endDate,
      stats,
      analysis,
      exams: filteredExams,
      wrongQuestions: wrongQuestions.slice(0, 20), // 最多显示20道错题
      aiModelInfo,
      aiAnalysisTime
    })

    const totalGenerationTime = Date.now() - reportStartTime

    // 保存报告
    // 获取学科ID
    const subjectId = subjectObj?.id || decodedSubject.toLowerCase()

    const report = await saveSubjectReport({
      userId: DEFAULT_USER_ID,
      subject: decodedSubject,
      subjectId,
      title: title || `${decodedSubject}学习报告`,
      startDate,
      endDate,
      generatedAt: new Date().toISOString(),
      stats,
      analysis,
      content: reportContent
    })

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        title: report.title,
        generatedAt: report.generatedAt,
        stats: report.stats
      }
    })
  } catch (error: any) {
    console.error("[Reports POST] Error:", error)
    return NextResponse.json(
      { error: "生成报告失败", details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - 删除报告
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params
  const decodedSubject = decodeURIComponent(subject)

  try {
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('id')

    if (!reportId) {
      return NextResponse.json(
        { error: "缺少报告ID" },
        { status: 400 }
      )
    }

    const { deleteSubjectReport } = await import("@/lib/storage")
    await deleteSubjectReport(decodedSubject, reportId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Reports DELETE] Error:", error)
    return NextResponse.json(
      { error: "删除报告失败", details: error.message },
      { status: 500 }
    )
  }
}

// 生成 Markdown 报告内容
function generateMarkdownReport(data: {
  subject: string
  title: string
  startDate: string
  endDate: string
  stats: any
  analysis: any
  exams: any[]
  wrongQuestions: any[]
  aiModelInfo?: { provider: string; model: string }
  aiAnalysisTime?: number
}): string {
  const { subject, title, startDate, endDate, stats, analysis, exams, wrongQuestions, aiModelInfo, aiAnalysisTime } = data

  let md = `# ${title}\n\n`
  md += `> 📚 **学科**: ${subject} | 📅 **时间范围**: ${startDate} ~ ${endDate} | 🕐 **生成时间**: ${new Date().toLocaleString('zh-CN')}\n`

  // AI 模型信息
  if (aiModelInfo) {
    md += `\n> 🤖 **AI 模型**: ${aiModelInfo.provider} (${aiModelInfo.model})`
    if (aiAnalysisTime !== undefined && aiAnalysisTime > 0) {
      md += ` | ⏱️ **分析耗时**: ${(aiAnalysisTime / 1000).toFixed(1)}秒`
    }
    md += `\n`
  }

  md += `\n---\n\n`

  md += `---\n\n`

  // 统计概览
  md += `## 📊 学习统计概览\n\n`
  md += `| 指标 | 数值 |\n`
  md += `|------|------|\n`
  md += `| 📝 试卷数量 | **${stats.totalExams}** 份 |\n`
  md += `| ❓ 题目总数 | **${stats.totalQuestions}** 题 |\n`
  md += `| ✅ 已标记题目 | **${stats.markedQuestions}** 题 |\n`
  md += `| ✅ 正确 | **${stats.correctQuestions}** 题 |\n`
  md += `| ❌ 错误 | **${stats.wrongQuestions}** 题 |\n`
  md += `| ⏭️ 跳过 | **${stats.skippedQuestions}** 题 |\n`
  md += `| 🎯 正确率 | **${(stats.avgAccuracy * 100).toFixed(1)}%** |\n\n`

  // AI 分析
  if (analysis) {
    md += `---\n\n`

    if (analysis.knowledgeMatrix?.topWeakPoints?.length > 0) {
      md += `## 📉 薄弱知识点分析\n\n`
      md += `以下是你在该时间段内最容易出错的知识点，需要重点关注：\n\n`
      analysis.knowledgeMatrix.topWeakPoints.forEach((point: any, index: number) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
        md += `### ${medal} ${point.point}\n\n`
        md += `- **错误题数**: ${point.count} 题\n`
        md += `- **错误率**: **${point.errorRate}%**\n`
        md += `- **优先级**: ${point.errorRate >= 80 ? '🔴 高' : point.errorRate >= 60 ? '🟡 中' : '🟢 低'}\n\n`
      })
    }

    if (analysis.abilityAssessment) {
      md += `---\n\n`
      md += `## 🧠 能力评估\n\n`
      md += `### 🎯 主要问题\n\n`
      md += `**${analysis.abilityAssessment.mainIssue}**\n\n`
      md += `### 📝 详细分析\n\n`
      md += `${analysis.abilityAssessment.analysis}\n\n`
    }

    if (analysis.errorPatterns?.patterns?.length > 0) {
      md += `---\n\n`
      md += `## 🔍 错误模式识别\n\n`
      md += `系统发现了以下**习惯性错误模式**：\n\n`
      analysis.errorPatterns.patterns.forEach((pattern: string, index: number) => {
        md += `${index + 1}. ${pattern}\n`
      })
      md += `\n`
    }

    if (analysis.prediction) {
      md += `---\n\n`
      md += `## 💡 学习建议与改进计划\n\n`

      if (analysis.prediction.nextChapterRisks?.length > 0) {
        md += `### ⚠️ 潜在学习风险\n\n`
        analysis.prediction.nextChapterRisks.forEach((risk: string) => {
          md += `- ${risk}\n`
        })
        md += `\n`
      }

      if (analysis.prediction.recommendations?.length > 0) {
        md += `### 📈 改进建议\n\n`
        analysis.prediction.recommendations.forEach((rec: string) => {
          md += `- ${rec}\n`
        })
        md += `\n`
      }
    }
  }

  // 错题列表
  if (wrongQuestions.length > 0) {
    md += `---\n\n`
    md += `## 📝 错题详情（前${Math.min(wrongQuestions.length, 20)}题）\n\n`
    md += `> 以下是你在该时间段内做错的题目，建议重点复习。\n\n`

    wrongQuestions.slice(0, 20).forEach((q: any, index: number) => {
      md += `### 第 ${index + 1} 题\n\n`
      md += `| 项目 | 内容 |\n`
      md += `|------|------|\n`
      md += `| 📋 题号 | ${q.questionNumber} |\n`
      md += `| 🎯 难度 | ${q.difficulty <= 2 ? '🟢 简单' : q.difficulty === 3 ? '🟡 中等' : '🔴 困难'} |\n`
      md += `| 💯 分值 | ${q.score} 分 |\n\n`

      md += `**题目内容**：\n\n${q.content}\n\n`

      if (q.options && q.options.length > 0) {
        md += `**选项**：\n\n`
        q.options.forEach((opt: string, i: number) => {
          const letter = String.fromCharCode(65 + i)
          md += `${letter}. ${opt}  `
        })
        md += `\n\n`
      }

      md += `| 你的答案 | 正确答案 |\n`
      md += `|----------|----------|\n`
      md += `| ❌ ${q.userAnswer || '未作答'} | ✅ ${q.correctAnswer} |\n\n`

      if (q.knowledgePoints && q.knowledgePoints.length > 0) {
        md += `**🏷️ 知识点**：${q.knowledgePoints.join('、')}\n\n`
      }

      md += `---\n\n`
    })
  }

  // 试卷列表
  md += `## 📋 试卷清单\n\n`
  md += `该报告基于以下试卷数据生成：\n\n`
  exams.forEach((exam: any, index: number) => {
    const date = new Date(exam.createdAt).toLocaleDateString('zh-CN')
    md += `${index + 1}. **${exam.examType || '试卷'}** (${date})\n`
  })

  md += `\n\n---\n\n`
  md += `<div align="center">\n`
  md += `  <p>✨ <strong>本报告由 AI 导师自动生成</strong></p>\n`
  md += `  <p>📅 生成时间：${new Date().toLocaleString('zh-CN')}</p>\n`
  md += `  <p>💡 坚持练习，持续进步！</p>\n`
  md += `</div>`

  return md
}
