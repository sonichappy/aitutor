/**
 * 手写识别相关类型定义
 */

// OCR 服务商类型
export type OCRProvider = 'tencent' | 'baidu' | 'aliyun' | 'google'

// OCR 配置
export interface OCRConfig {
  provider: OCRProvider
  // 腾讯云配置
  tencent?: {
    secretId: string
    secretKey: string
    region?: string
  }
  // 百度云配置
  baidu?: {
    apiKey: string
    secretKey: string
  }
  // 阿里云配置
  aliyun?: {
    accessKeyId: string
    accessKeySecret: string
    endpoint?: string
  }
  // Google Cloud 配置
  google?: {
    apiKey: string
  }
}

// 手写识别请求
export interface HandwritingRecognizeRequest {
  image: string // base64 图片数据
  provider?: OCRProvider // 指定服务商，可选
  expectedAnswer?: string // 期望答案，用于优化识别
}

// OCR 识别结果
export interface OCRRecognizeResult {
  text: string // 识别文本
  confidence: number // 置信度 0-1
  provider: OCRProvider // 服务商
  alternatives?: Array<{
    // 备选结果
    text: string
    confidence: number
  }>
}

// 手写判题结果
export interface HandwritingJudgeResult {
  success: boolean
  isCorrect: boolean
  recognizedText: string
  confidence: number
  similarity: number // 相似度 0-1
  feedback: string
  provider: OCRProvider
}

// 手写笔画数据
export interface StrokePoint {
  x: number
  y: number
  timestamp: number
}

export interface Stroke {
  points: StrokePoint[]
}

// 手写画板配置
export interface HandwritingCanvasConfig {
  width: number
  height: number
  strokeWidth?: number
  strokeColor?: string
  backgroundColor?: string
  enableTouch?: boolean
}
