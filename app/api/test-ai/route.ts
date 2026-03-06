import { NextResponse } from "next/server"
import { callLLM } from "@/lib/ai/llm"

export async function GET() {
  try {
    const provider = process.env.AI_PROVIDER || "deepseek"
    const apiKey = process.env.DEEPSEEK_API_KEY

    return NextResponse.json({
      status: "ok",
      provider,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? `${apiKey.slice(0, 8)}...` : "none",
    })
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      error: error.message,
    })
  }
}

export async function POST() {
  try {
    const response = await callLLM([
      { role: "user", content: "你好，请回复'测试成功'" }
    ], { temperature: 0.1, maxTokens: 50 })

    return NextResponse.json({
      status: "success",
      response: response.content,
    })
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      error: error.message,
      details: error.toString(),
    }, { status: 500 })
  }
}
