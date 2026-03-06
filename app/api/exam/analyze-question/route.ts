import { NextRequest, NextResponse } from "next/server"
import { callLLM, type ChatMessage } from "@/lib/ai/llm"

export async function POST(request: NextRequest) {
  try {
    const { question, userAnswer, subject } = await request.json()

    if (!question || !userAnswer) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    const prompt = `请分析以下${subject || ""}题目的学生作答情况：

【题目】
第${question.number}题（${question.type === "choice" ? "选择题" : question.type === "fill" ? "填空题" : "解答题"}）
${question.content}
${question.options ? "\n选项：\n" + question.options.map((o: string, i: number) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n") : ""}

【学生答案】
${userAnswer}

请按以下 JSON 格式返回分析结果：
{
  "isCorrect": true/false,  // 答案是否正确
  "correctAnswer": "正确答案",
  "errorAnalysis": "错误原因分析（如果答错了）",
  "weakPoints": ["薄弱知识点1", "薄弱知识点2"],  // 涉及的薄弱知识点
  "improvement": "具体的改进建议",
  "explanation": "详细解析和解题思路"
}

注意事项：
1. 仔细分析学生答案，判断是否正确
2. 如果答错，分析可能的错误原因（概念不清、计算错误、审题错误等）
3. 识别涉及的知识点，特别是学生可能薄弱的地方
4. 给出具体可操作的改进建议
5. 提供详细的解题思路和解析，帮助学生理解

只返回JSON，不要有其他内容。`

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `你是专业的中学教师分析系统。你的任务是分析学生的答题情况，找出错误原因，并给出改进建议。

你必须只返回有效的JSON格式，不要包含任何其他说明文字。

分析原则：
- 鼓励为主，批评为辅
- 具体指出问题所在
- 提供可操作的改进建议
- 帮助学生真正理解知识点`,
      },
      {
        role: "user",
        content: prompt,
      },
    ]

    const response = await callLLM(messages, {
      temperature: 0.2,
      maxTokens: 1500,
    })

    // 解析 AI 返回的 JSON
    let jsonStr = response.content.trim()

    // 清理可能的 markdown 代码块标记
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/^```json\n/, "")
        .replace(/^```\n/, "")
        .replace(/\n```$/, "")
        .replace(/```$/, "")
    }

    let parsed
    try {
      parsed = JSON.parse(jsonStr)
    } catch (e) {
      console.error("JSON parse error:", jsonStr)
      const match = jsonStr.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        throw new Error("AI 返回格式错误")
      }
    }

    return NextResponse.json({
      isCorrect: parsed.isCorrect ?? false,
      correctAnswer: parsed.correctAnswer || "",
      errorAnalysis: parsed.errorAnalysis || "",
      weakPoints: parsed.weakPoints || [],
      improvement: parsed.improvement || "",
      explanation: parsed.explanation || "",
    })
  } catch (error) {
    console.error("Question analysis error:", error)
    return NextResponse.json(
      { error: "AI分析失败，请重试" },
      { status: 500 }
    )
  }
}
