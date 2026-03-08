/**
 * AI 配置检查工具
 */

import { getCurrentProvider } from "./llm"

export interface AIConfigStatus {
  provider: string
  configured: boolean
  hasApiKey: boolean
  hasModel: boolean
  missingEnvVars: string[]
}

/**
 * 检查当前 AI 配置状态
 */
export function checkAIConfig(): AIConfigStatus {
  const provider = getCurrentProvider()
  const missing: string[] = []
  let hasApiKey = false
  let hasModel = false

  switch (provider) {
    case "deepseek":
      hasApiKey = !!process.env.DEEPSEEK_API_KEY
      hasModel = !!process.env.DEEPSEEK_MODEL
      if (!hasApiKey) missing.push("DEEPSEEK_API_KEY")
      break
    case "dashscope":
      hasApiKey = !!process.env.DASHSCOPE_API_KEY
      hasModel = !!process.env.DASHSCOPE_MODEL
      if (!hasApiKey) missing.push("DASHSCOPE_API_KEY")
      break
    case "openai":
      hasApiKey = !!process.env.OPENAI_API_KEY
      hasModel = !!process.env.OPENAI_MODEL
      if (!hasApiKey) missing.push("OPENAI_API_KEY")
      break
    case "anthropic":
      hasApiKey = !!process.env.ANTHROPIC_API_KEY
      hasModel = !!process.env.ANTHROPIC_MODEL
      if (!hasApiKey) missing.push("ANTHROPIC_API_KEY")
      break
    case "gemini":
      hasApiKey = !!process.env.GEMINI_API_KEY
      hasModel = !!process.env.GEMINI_MODEL
      if (!hasApiKey) missing.push("GEMINI_API_KEY")
      break
  }

  return {
    provider,
    configured: hasApiKey,
    hasApiKey,
    hasModel,
    missingEnvVars: missing,
  }
}

/**
 * 获取配置说明
 */
export function getConfigHelp(provider: string): string {
  const helps: Record<string, string> = {
    deepseek: `
DeepSeek 配置：
1. 访问 https://platform.deepseek.com/
2. 注册账号并获取 API Key
3. 设置环境变量：
   DEEPSEEK_API_KEY=sk-xxx
   DEEPSEEK_MODEL=deepseek-chat (可选)
`,

    dashscope: `
通义千问配置：
1. 访问 https://dashscope.aliyuncs.com/
2. 注册账号并获取 API Key
3. 设置环境变量：
   DASHSCOPE_API_KEY=sk-xxx
   DASHSCOPE_MODEL=qwen-plus (可选)
`,

    openai: `
OpenAI 配置：
1. 访问 https://platform.openai.com/
2. 注册账号并获取 API Key
3. 设置环境变量：
   OPENAI_API_KEY=sk-xxx
   OPENAI_MODEL=gpt-4o (可选)
`,

    anthropic: `
Anthropic Claude 配置：
1. 访问 https://console.anthropic.com/
2. 注册账号并获取 API Key
3. 设置环境变量：
   ANTHROPIC_API_KEY=sk-xxx
   ANTHROPIC_MODEL=claude-sonnet-4-20250514 (可选)
`,

    gemini: `
Google Gemini 配置：
1. 访问 https://aistudio.google.com/app/apikey
2. 创建 API Key
3. 设置环境变量：
   GEMINI_API_KEY=AIzaxxx
   GEMINI_MODEL=gemini-2.0-flash-exp (可选)

推荐模型：
• gemini-2.0-flash-exp - 快速、便宜 (推荐试卷识别)
• gemini-2.5-pro-exp - 能力最强
• gemini-1.5-flash - 稳定版本
`,
  }

  return helps[provider] || "未知提供商"
}

/**
 * 打印配置状态（用于调试）
 */
export function printConfigStatus(): void {
  const status = checkAIConfig()

  console.log("=================================")
  console.log("AI 配置状态")
  console.log("=================================")
  console.log(`当前提供商: ${status.provider}`)
  console.log(`已配置: ${status.configured ? "✓" : "✗"}`)
  console.log(`API Key: ${status.hasApiKey ? "✓" : "✗"}`)
  console.log(`Model: ${status.hasModel ? "✓" : "✗ (使用默认)"}`)

  if (status.missingEnvVars.length > 0) {
    console.log("\n缺少环境变量:")
    status.missingEnvVars.forEach((v) => console.log(`  - ${v}`))
    console.log("\n" + getConfigHelp(status.provider))
  }

  console.log("=================================")
}
