import { NextRequest } from "next/server"
import { handleMergeParse } from "@/lib/skills/parse-exam/api-adapter"

/**
 * 试卷多图合并解析 API
 *
 * 支持上传多张试卷图片，自动合并为同一份试卷
 *
 * POST /api/exam/parse-merge
 *
 * 请求参数 (FormData):
 * - files: File[] - 试卷图片文件（多个）
 * - subject?: string - 学科名称（可选）
 * - customPrompt?: string - 自定义提示词（可选）
 *
 * 响应:
 * {
 *   success: true,
 *   examId: string,
 *   title: string,
 *   questionCount: number,
 *   pageCount: number,
 *   questions: Question[],
 *   examData: ExamData
 * }
 */
export async function POST(request: NextRequest) {
  return handleMergeParse(request)
}
