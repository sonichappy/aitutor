import { NextRequest, NextResponse } from "next/server"
import { callLLM, type ChatMessage } from "@/lib/ai/llm"
import { getExamData, saveExamData, saveWrongQuestion, wrongQuestionExists, type ExamQuestion } from "@/lib/storage"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params
    const { answers, questions } = await request.json()

    // 从文件系统读取试卷数据
    const examData = await getExamData(examId)
    if (!examData) {
      return NextResponse.json(
        { error: "试卷不存在" },
        { status: 404 }
      )
    }

    // 将答题数据合并到 questions 数组中
    const questionsWithAnswers: ExamQuestion[] = questions.map((q: any) => {
      const answer = answers.find((a: any) => parseInt(a.questionId) === q.number)
      if (!answer) return q

      return {
        ...q,
        userAnswer: answer.userAnswer || undefined,
        isCorrect: answer.isCorrect,
        isSkipped: answer.isSkipped || false,
        markedAt: answer.markedAt,
        correctAnswer: answer.correctAnswer,
        errorAnalysis: answer.errorAnalysis,
        weakPoints: answer.weakPoints,
        improvement: answer.improvement,
        aiExplanation: answer.aiExplanation,
      }
    })

    // 计算得分
    let totalScore = 0
    let obtainedScore = 0
    const answeredQuestions: any[] = []

    questionsWithAnswers.forEach((question: any) => {
      totalScore += question.score || 0
      if (question.isCorrect === true) {
        obtainedScore += question.score || 0
      }

      // 统计知识点
      if (question.isCorrect !== undefined) {
        question.knowledgePoints?.forEach((kp: string) => {
          answeredQuestions.push({
            knowledgePoint: kp,
            score: question.score,
            obtained: question.isCorrect ? question.score : 0,
          })
        })
      }
    })

    const correctRate = totalScore > 0 ? obtainedScore / totalScore : 0

    // 聚合知识点数据
    const kpMap = new Map<string, { total: number; obtained: number; count: number }>()
    answeredQuestions.forEach((item) => {
      const existing = kpMap.get(item.knowledgePoint) || { total: 0, obtained: 0, count: 0 }
      existing.total += item.score
      existing.obtained += item.obtained
      existing.count += 1
      kpMap.set(item.knowledgePoint, existing)
    })

    const knowledgeAnalysis = Array.from(kpMap.entries()).map(([name, data]) => ({
      name,
      correctRate: data.total > 0 ? data.obtained / data.total : 0,
      questionCount: data.count,
    }))

    // 找出薄弱点和优势点
    const sorted = [...knowledgeAnalysis].sort((a, b) => a.correctRate - b.correctRate)
    const weakPoints = sorted.slice(0, 3).map((k) => k.name)
    const strongPoints = sorted.slice(-3).reverse().map((k) => k.name)

    // 生成 AI 详细报告
    const prompt = `请根据以下考试数据，生成一份详细的学习分析报告：

考试信息：
- 科目：${examData.subject}
- 试卷类型：${examData.examType}
- 总分：${examData.totalScore}
- 得分：${obtainedScore}
- 正确率：${(correctRate * 100).toFixed(1)}%

知识点掌握情况：
${knowledgeAnalysis.map((k) => `- ${k.name}: ${(k.correctRate * 100).toFixed(0)}%`).join("\n")}

薄弱知识点：
${weakPoints.join(", ")}

优势知识点：
${strongPoints.join(", ")}

请生成一份包含以下内容的报告：
1. 总体评价（用鼓励的语气）
2. 具体的薄弱知识点分析
3. 每个薄弱点的改进建议
4. 推荐的学习顺序
5. 鼓励性的总结

报告要具体、有针对性，语言要亲切鼓励。`

    const aiMessages: ChatMessage[] = [
      {
        role: "system",
        content: `你是专业的学习分析专家，擅长通过考试数据发现学生的学习问题，并给出具体可行的改进建议。
你的语气要亲切、鼓励，同时也要客观指出问题。建议要具体可操作。`,
      },
      {
        role: "user",
        content: prompt,
      },
    ]

    let aiReport = ""
    try {
      const aiResponse = await callLLM(aiMessages, {
        temperature: 0.7,
        maxTokens: 2000,
      })
      aiReport = aiResponse.content
    } catch (e) {
      console.error("AI report generation failed:", e)
    }

    // 保存分析结果
    const analysisData = {
      id: `analysis-${examId}`,
      examId,
      summary: {
        totalScore,
        obtainedScore,
        correctRate,
      },
      knowledgeAnalysis,
      weakPoints,
      strongPoints,
      suggestions: [
        `重点复习：${weakPoints[0] || "基础知识点"}`,
        "加强错题整理和归纳",
        "针对性练习薄弱知识点",
      ],
      aiReport,
    }

    // 保存分析结果到文件（答题数据保存在题目对象中）
    await saveExamData(examId, {
      ...examData,
      questions: questionsWithAnswers,
      analysis: analysisData,
    })

    // 从题目对象中创建错题
    let wrongQuestionsAdded = 0
    for (const question of questionsWithAnswers) {
      if (question.isCorrect === false && question.userAnswer) {
        // 检查是否已存在
        const exists = await wrongQuestionExists(
          DEFAULT_USER_ID,
          question.content,
          question.userAnswer
        )
        if (exists) continue

        const wrongQuestion = {
          id: `wq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: DEFAULT_USER_ID,
          subject: examData.subject,
          type: question.type,
          content: question.content,
          options: question.options ? JSON.stringify(question.options) : undefined,
          correctAnswer: question.correctAnswer || "",
          userAnswer: question.userAnswer,
          knowledgePoints: question.knowledgePoints || [],
          difficulty: question.difficulty || 3,
          errorReason: question.errorReason,
          errorAnalysis: question.errorAnalysis,
          weakPoints: question.weakPoints || [],
          improvement: question.improvement,
          aiExplanation: question.aiExplanation,
          reviewCount: 0,
          nextReviewAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          originalExamId: examId,
          originalQuestionId: question.number.toString(),
        }

        await saveWrongQuestion(wrongQuestion)
        wrongQuestionsAdded++
      }
    }

    return NextResponse.json({
      success: true,
      analysis: analysisData,
      wrongQuestionsAdded,
    })
  } catch (error) {
    console.error("Exam analysis error:", error)
    return NextResponse.json(
      { error: "分析失败，请重试" },
      { status: 500 }
    )
  }
}

// GET 获取分析结果
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params
  const examData = await getExamData(examId)

  if (!examData?.analysis) {
    return NextResponse.json(
      { error: "分析结果不存在" },
      { status: 404 }
    )
  }

  return NextResponse.json(examData.analysis)
}
