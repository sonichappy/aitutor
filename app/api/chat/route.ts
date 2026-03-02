import { NextRequest, NextResponse } from "next/server"
import { callLLM, createTutorSystemPrompt, type ChatMessage } from "@/lib/ai/llm"

// 默认用户ID
const DEFAULT_USER_ID = "user-1"

export async function POST(request: NextRequest) {
  try {
    const { message, subject, history } = await request.json()

    if (!message || !subject) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    // 构建 AI 消息列表
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: createTutorSystemPrompt(subject),
      },
      // 添加历史对话（最近10条）
      ...(history || []).slice(-10).map((msg: ChatMessage) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user",
        content: message,
      },
    ]

    // 调用 LLM
    const response = await callLLM(messages, {
      temperature: 0.7,
      maxTokens: 1500,
    })

    // TODO: 保存对话记录到数据库
    // await saveChatMessage(DEFAULT_USER_ID, subject, message, response.content)

    return NextResponse.json({
      content: response.content,
      usage: response.usage,
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      { error: "处理请求时出错，请稍后重试" },
      { status: 500 }
    )
  }
}
