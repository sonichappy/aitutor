import { NextRequest } from "next/server"
import { handleParseExamPost } from "@/lib/skills/parse-exam/api-adapter"

/**
 * 试卷图片解析 API
 *
 * 使用 lib/skills/parse-exam 模块的核心解析能力
 *
 * POST /api/exam/parse-image
 *
 * 请求参数 (FormData):
 * - file: File - 试卷图片文件
 * - subject?: string - 学科名称（可选）
 * - customPrompt?: string - 自定义提示词（可选）
 *
 * 响应:
 * {
 *   success: true,
 *   examId: string,
 *   title: string,
 *   questionCount: number,
 *   questions: Question[],
 *   examData: ExamData
 * }
 */
export async function POST(request: NextRequest) {
  // 直接使用适配器处理请求
  return handleParseExamPost(request)
}
