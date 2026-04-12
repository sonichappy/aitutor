import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const CHINESE_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge-base', 'chinese')

// GET - 获取字词库图片
export async function GET(
  request: NextRequest,
  { params }: { params: { libraryId: string; image: string } }
) {
  try {
    const { libraryId, image } = params
    const imagePath = path.join(CHINESE_BASE_DIR, libraryId, 'images', image)

    if (!existsSync(imagePath)) {
      return NextResponse.json({
        success: false,
        error: 'Image not found'
      }, { status: 404 })
    }

    const imageBuffer = await readFile(imagePath)
    const ext = path.extname(image).toLowerCase()
    const contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch (error) {
    console.error('[API] Failed to get image:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get image'
    }, { status: 500 })
  }
}
