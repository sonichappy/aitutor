/**
 * LLM 调用模块
 * 支持多个 AI 提供商，通过 AI_PROVIDER 环境变量配置
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LLMResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
}

// 支持的 AI 提供商类型
export type AIProvider = "deepseek" | "dashscope" | "openai" | "anthropic"

// 从环境变量获取当前配置的提供商
function getProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) || "deepseek"
}

// 获取默认参数
function getDefaultOptions(): LLMOptions {
  return {
    temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || "1500"),
  }
}

/**
 * DeepSeek API 调用
 */
async function callDeepSeek(
  messages: ChatMessage[],
  options: LLMOptions
): Promise<LLMResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat"

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set")
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  return {
    content: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
  }
}

/**
 * 通义千问 API 调用
 */
async function callDashScope(
  messages: ChatMessage[],
  options: LLMOptions
): Promise<LLMResponse> {
  const apiKey = process.env.DASHSCOPE_API_KEY
  const model = process.env.DASHSCOPE_MODEL || "qwen-plus"

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not set")
  }

  const response = await fetch(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`DashScope API error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  return {
    content: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
  }
}

/**
 * OpenAI API 调用
 */
async function callOpenAI(
  messages: ChatMessage[],
  options: LLMOptions
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  const model = process.env.OPENAI_MODEL || "gpt-4o"

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set")
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  return {
    content: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
  }
}

/**
 * Anthropic Claude API 调用
 */
async function callAnthropic(
  messages: ChatMessage[],
  options: LLMOptions
): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514"

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set")
  }

  // Claude API 使用不同的消息格式
  const systemMessage = messages.find(m => m.role === "system")
  const chatMessages = messages.filter(m => m.role !== "system")

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      messages: chatMessages,
      system: systemMessage?.content,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  return {
    content: data.content[0].text,
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
  }
}

/**
 * 提供商调用映射
 */
const PROVIDER_CALLERS: Record<AIProvider, (messages: ChatMessage[], options: LLMOptions) => Promise<LLMResponse>> = {
  deepseek: callDeepSeek,
  dashscope: callDashScope,
  openai: callOpenAI,
  anthropic: callAnthropic,
}

/**
 * 统一的 LLM 调用接口
 * 根据 AI_PROVIDER 环境变量自动选择提供商
 *
 * @param messages - 对话消息列表
 * @param options - 可选参数
 * @param options.provider - 强制指定提供商（覆盖环境变量）
 * @param options.temperature - 温度参数（0-1）
 * @param options.maxTokens - 最大生成 token 数
 */
export async function callLLM(
  messages: ChatMessage[],
  options?: LLMOptions & { provider?: AIProvider }
): Promise<LLMResponse> {
  const provider = options?.provider || getProvider()
  const mergedOptions = { ...getDefaultOptions(), ...options }

  console.log(`[LLM] Using provider: ${provider}`)

  try {
    return await PROVIDER_CALLERS[provider](messages, mergedOptions)
  } catch (error) {
    console.error(`[LLM] Provider ${provider} failed:`, error)
    throw error
  }
}

/**
 * 获取当前配置的 AI 提供商
 */
export function getCurrentProvider(): AIProvider {
  return getProvider()
}

/**
 * 创建教学用的 System Prompt
 */
export function createTutorSystemPrompt(subject: string): string {
  const subjectContexts: Record<string, string> = {
    数学: "你是专业的中学数学教师，擅长代数、几何、函数等知识点。",
    物理: "你是专业的中学物理教师，擅长力学、电学、光学等知识点。",
    化学: "你是专业的中学化学教师，擅长无机化学、有机化学、化学反应原理等。",
    英语: "你是专业的中学英语教师，擅长语法、词汇、阅读理解等。",
  }

  const basePrompt = `${subjectContexts[subject] || "你是专业的中学教师。"}

你的教学原则：
1. 采用苏格拉底式教学法，引导学生思考，而不是直接给出答案
2. 鼓励学生提问，耐心解答每个疑问
3. 用通俗易懂的语言解释复杂概念
4. 适当举例帮助理解
5. 注意学生的年级水平，避免超出范围的内容
6. 当学生完全理解后，可以给出类似的练习题巩固

回复格式：
- 先分析学生的理解程度
- 逐步引导思考
- 给出适当的提示
- 确认学生理解后再继续`

  return basePrompt
}

/**
 * 创建学习分析用的 System Prompt
 */
export function createAnalysisSystemPrompt(): string {
  return `你是专业的学习分析系统。你的任务是分析学生的学习数据，提供个性化的学习建议。

分析维度：
1. 知识点掌握程度
2. 常见错误类型
3. 学习薄弱环节
4. 学习进步趋势

输出要求：
- 数据准确，结论客观
- 建议具体可操作
- 优先级清晰
- 语言鼓励积极`
}
