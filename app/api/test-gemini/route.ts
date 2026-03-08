import { NextRequest, NextResponse } from "next/server"
import { callLLM, type ChatMessage } from "@/lib/ai/llm"

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    // 测试简单的文本请求
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: prompt || "你好，请用一句话介绍你自己",
      },
    ]

    const response = await callLLM(messages, {
      temperature: 0.7,
      maxTokens: 100,
    })

    return NextResponse.json({
      success: true,
      content: response.content,
      usage: response.usage,
      provider: process.env.AI_PROVIDER || "unknown",
      model: process.env.GEMINI_MODEL || "default",
    })
  } catch (error: any) {
    console.error("Test Gemini error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        provider: process.env.AI_PROVIDER || "unknown",
        model: process.env.GEMINI_MODEL || "default",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    provider: process.env.AI_PROVIDER || "unknown",
    hasKey: !!process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "default",
    keyPreview: process.env.GEMINI_API_KEY?.substring(0, 10) + "...",
  })
}
