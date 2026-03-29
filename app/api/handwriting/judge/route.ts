/**
 * 手写判题 API
 * POST /api/handwriting/judge
 */

import { NextRequest, NextResponse } from 'next/server'
import { judgeHandwriting } from '@/lib/handwriting/judge'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { image, correctAnswer, options } = body

    // 验证请求
    if (!image) {
      return NextResponse.json(
        { success: false, error: '缺少图片数据' },
        { status: 400 }
      )
    }

    if (!correctAnswer) {
      return NextResponse.json(
        { success: false, error: '缺少正确答案' },
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

    // 调用判题逻辑
    const result = await judgeHandwriting(image, correctAnswer, options)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('[手写判题 API] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '判题失败，请稍后重试'
      },
      { status: 500 }
    )
  }
}
