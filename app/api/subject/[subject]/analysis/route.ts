import { NextRequest, NextResponse } from "next/server"
import { getUserExams } from "@/lib/storage"
import { callLLM } from "@/lib/ai/llm"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subject: string }> }
) {
  const { subject } = await params
  const decodedSubject = decodeURIComponent(subject)

  try {
    // 获取用户的所有试卷
    const allExams = await getUserExams(DEFAULT_USER_ID)

    // 筛选出该学科的试卷
    const subjectExams = allExams.filter(exam => exam.subject === decodedSubject)

    if (subjectExams.length === 0) {
      return NextResponse.json({
        error: `该学科(${decodedSubject})暂无试卷数据`,
        hasData: false
      })
    }

    // 收集所有错题数据
    const wrongQuestions: any[] = []
    const markedQuestions: any[] = []

    for (const exam of subjectExams) {
      if (exam.questions && Array.isArray(exam.questions)) {
        for (const question of exam.questions) {
          // 检查是否有错题标记
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

          // 收集所有已标记的题目（包括正确和跳过的）
          if (question.isCorrect !== undefined || question.isSkipped) {
            markedQuestions.push({
              question: question,
              examId: exam.id,
              createdAt: exam.createdAt
            })
          }
        }
      }
    }

    // 检查是否有标记数据（不是必须有错题）
    const hasMarkedData = markedQuestions.length > 0

    if (!hasMarkedData) {
      return NextResponse.json({
        error: `该学科(${decodedSubject})暂无答题记录`,
        hasData: false
      })
    }

    // 只有在有错题时才进行 AI 分析
    let analysis = null
    if (wrongQuestions.length > 0) {
      // 构建AI分析提示词
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

      // 调用AI生成分析报告
      const aiResponse = await callLLM([{ role: "user", content: prompt }], {
        temperature: 0.7,
        maxTokens: 2000,
      })

      // 解析AI响应
      try {
        const content = typeof aiResponse === 'string' ? aiResponse : aiResponse.content
        // 尝试提取JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0])
        } else {
          throw new Error("未找到JSON响应")
        }
      } catch (error) {
        console.error("Failed to parse AI response:", aiResponse)
        // 如果解析失败，返回基础数据
        analysis = {
          knowledgeMatrix: {
            description: "知识点覆盖矩阵",
            topWeakPoints: extractTopWeakPoints(wrongQuestions)
          },
          abilityAssessment: {
            description: "能力维度评估",
            mainIssue: "待分析",
            analysis: "AI分析暂时不可用，建议咨询专业教师"
          },
          errorPatterns: {
            description: "错误模式挖掘",
            patterns: ["待分析"]
          },
          prediction: {
            description: "潜能与风险预判",
            nextChapterRisks: ["待分析"],
            recommendations: ["建议多做练习巩固基础"]
          }
        }
      }
    }

    // 计算统计信息
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
        // 错题不得分
      } else if (question.isSkipped) {
        totalSkipped++
        totalMarked++
      }
    }

    // 计算正确率：基于已标记的题目，未标记的按正确计算
    const totalAnswered = totalCorrect + totalWrong
    const avgAccuracy = totalMarked > 0 ? (totalCorrect + (subjectExams.reduce((sum, exam) => sum + (exam.questions?.length || 0), 0) - totalMarked)) / subjectExams.reduce((sum, exam) => sum + (exam.questions?.length || 0), 0) : 1

    const stats = {
      totalExams: subjectExams.length,
      totalQuestions: subjectExams.reduce((sum, exam) => sum + (exam.questions?.length || 0), 0),
      markedQuestions: totalMarked,
      correctQuestions: totalCorrect,
      wrongQuestions: wrongQuestions.length,
      skippedQuestions: totalSkipped,
      avgAccuracy: avgAccuracy,
      recentExamDate: subjectExams[0]?.createdAt,
      difficultyDistribution: calculateDifficultyDist(wrongQuestions)
    }

    return NextResponse.json({
      hasData: true,
      subject: decodedSubject,
      stats,
      analysis,
      wrongQuestions: wrongQuestions.slice(0, 10) // 只返回前10个错题作为预览
    })

  } catch (error: any) {
    console.error("[Subject Analysis] Error:", error)
    return NextResponse.json(
      { error: "学科分析失败", details: error.message, hasData: false },
      { status: 500 }
    )
  }
}

// 辅助函数：提取薄弱知识点
function extractTopWeakPoints(wrongQuestions: any[]) {
  const pointMap = new Map<string, { count: number; total: number }>()

  for (const q of wrongQuestions) {
    for (const point of q.knowledgePoints) {
      const current = pointMap.get(point) || { count: 0, total: 0 }
      current.count++
      current.total++
      pointMap.set(point, current)
    }
  }

  return Array.from(pointMap.entries())
    .map(([point, data]) => ({
      point,
      errorRate: Math.round((data.count / wrongQuestions.length) * 100),
      count: data.count
    }))
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 3)
}

// 辅助函数：计算难度分布
function calculateDifficultyDist(wrongQuestions: any[]) {
  const dist = { easy: 0, medium: 0, hard: 0 }
  for (const q of wrongQuestions) {
    if (q.difficulty <= 2) dist.easy++
    else if (q.difficulty === 3) dist.medium++
    else dist.hard++
  }
  return dist
}
