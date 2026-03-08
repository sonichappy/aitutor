import { NextRequest, NextResponse } from "next/server"
import { getSubjectReports, saveSubjectReport, getUserExams } from "@/lib/storage"
import { callLLM } from "@/lib/ai/llm"
import { getSubjectByName } from "@/types/subject"

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
    const reportList = reports.map(r => ({
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

    // 获取用户的所有试卷
    const allExams = await getUserExams(DEFAULT_USER_ID)

    // 筛选出该学科在指定时间范围内的试卷
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999) // 包含结束日期当天

    const filteredExams = allExams.filter(exam => {
      if (exam.subject !== decodedSubject) return false
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

    for (const exam of filteredExams) {
      if (exam.questions && Array.isArray(exam.questions)) {
        for (const question of exam.questions) {
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

    // AI 分析（如果有错题）
    let analysis = null
    if (wrongQuestions.length > 0) {
      const prompt = `请作为资深教研员，对我提供的这些${decodedSubject}错题进行聚类分析。请不要逐题解析，而是产出以下维度的报告：

**错题数据：**
${JSON.stringify(wrongQuestions, null, 2)}

**请按以下格式输出JSON：**
{
  "knowledgeMatrix": {
    "description": "知识点覆盖矩阵",
    "topWeakPoints": [
      {"point": "二级知识点名称", "errorRate": 85, "count": 6}
    ]
  },
  "abilityAssessment": {
    "description": "能力维度评估",
    "mainIssue": "基础识记模糊|逻辑转化受阻|抗干扰能力弱",
    "analysis": "详细分析..."
  },
  "errorPatterns": {
    "description": "错误模式挖掘",
    "patterns": ["习惯性错误1", "习惯性错误2"]
  },
  "prediction": {
    "description": "潜能与风险预判",
    "nextChapterRisks": ["可能遇到的学习障碍"],
    "recommendations": ["针对性建议"]
  }
}

请严格按照JSON格式输出，不要包含其他文字。`

      try {
        const aiResponse = await callLLM([{ role: "user", content: prompt }], {
          temperature: 0.7,
          maxTokens: 2000,
        })

        const content = typeof aiResponse === 'string' ? aiResponse : aiResponse.content
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0])
        }
      } catch (error) {
        console.error("AI analysis failed:", error)
      }
    }

    // 生成 Markdown 报告
    const reportContent = generateMarkdownReport({
      subject: decodedSubject,
      title: title || `${decodedSubject}学习报告`,
      startDate,
      endDate,
      stats,
      analysis,
      exams: filteredExams,
      wrongQuestions: wrongQuestions.slice(0, 20) // 最多显示20道错题
    })

    // 保存报告
    // 获取学科ID
    const subjectObj = await getSubjectByName(decodedSubject)
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
}): string {
  const { subject, title, startDate, endDate, stats, analysis, exams, wrongQuestions } = data

  let md = `# ${title}\n\n`
  md += `> 📚 **学科**: ${subject} | 📅 **时间范围**: ${startDate} ~ ${endDate} | 🕐 **生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`

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
