/**
 * 手写识别 API
 * POST /api/handwriting/recognize
 */

import { NextRequest, NextResponse } from 'next/server'
import { recognizeHandwriting } from '@/lib/handwriting/ocr-service'
import { OCRProvider } from '@/types/handwriting'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { image, provider } = body

    // 验证请求
    if (!image) {
      return NextResponse.json(
        { success: false, error: '缺少图片数据' },
        { status: 400 }
      )
    }

    // 验证图片格式
    if (!image.startsWith('data:image/')) {
      return NextResponse.json(
        { success: false, error: '图片格式错误，请提供 base64 格式的图片' },
        { status: 400 }
      )
    }

    // 调用 OCR 识别
    const result = await recognizeHandwriting(image, provider as OCRProvider)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('[手写识别 API] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '识别失败，请稍后重试'
      },
      { status: 500 }
    )
  }
}
