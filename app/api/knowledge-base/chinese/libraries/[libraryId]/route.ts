import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const CHINESE_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge-base', 'chinese')
const LIBRARIES_INDEX_FILE = path.join(CHINESE_BASE_DIR, 'libraries.json')

// GET - 获取字词库详情
export async function GET(
  _request: NextRequest,
  { params }: { params: { libraryId: string } }
) {
  try {
    const { libraryId } = params
    const libraryDir = path.join(CHINESE_BASE_DIR, libraryId)

    if (!existsSync(libraryDir)) {
      return NextResponse.json({
        success: false,
        error: 'Library not found'
      }, { status: 404 })
    }

    // 读取元数据
    const metadataPath = path.join(libraryDir, 'metadata.json')
    const metadataContent = await readFile(metadataPath, 'utf-8')
    const metadata = JSON.parse(metadataContent)

    // 读取字词列表
    const wordsPath = path.join(libraryDir, 'words.json')
    const wordsContent = await readFile(wordsPath, 'utf-8')
    const words = JSON.parse(wordsContent)

    // 获取图片列表并创建批次信息
    const imagesDir = path.join(libraryDir, 'images')
    let batches: any[] = []
    if (existsSync(imagesDir)) {
      const fs = await import('fs/promises')
      const files = await fs.readdir(imagesDir)
      const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'))

      // 为每个图片创建一个批次
      batches = imageFiles.map(imageFile => {
        const imageWords = words.filter((w: any) => w.sourceImage === imageFile)
        return {
          id: `batch-${imageFile.split('.')[0]}`,
          image: imageFile,
          uploadedAt: words.find((w: any) => w.sourceImage === imageFile)?.addedAt || new Date().toISOString(),
          wordCount: imageWords.length,
          words: imageWords
        }
      }).sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()) // 按时间正序，先解析的在前
    }

    return NextResponse.json({
      success: true,
      library: {
        library: metadata,
        words,
        batches,
        images: batches.map(b => b.image)
      }
    })
  } catch (error) {
    console.error('[API] Failed to get library:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get library'
    }, { status: 500 })
  }
}

// DELETE - 删除字词库
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { libraryId: string } }
) {
  try {
    const { libraryId } = params
    const libraryDir = path.join(CHINESE_BASE_DIR, libraryId)

    if (!existsSync(libraryDir)) {
      return NextResponse.json({
        success: false,
        error: 'Library not found'
      }, { status: 404 })
    }

    // 删除整个目录
    await rm(libraryDir, { recursive: true, force: true })

    // 更新 libraries.json
    const librariesContent = await readFile(LIBRARIES_INDEX_FILE, 'utf-8')
    const librariesData = JSON.parse(librariesContent)
    librariesData.libraries = librariesData.libraries.filter((lib: any) => lib.id !== libraryId)
    await writeFile(LIBRARIES_INDEX_FILE, JSON.stringify(librariesData, null, 2))

    return NextResponse.json({
      success: true,
      message: 'Library deleted successfully'
    })
  } catch (error) {
    console.error('[API] Failed to delete library:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete library'
    }, { status: 500 })
  }
}

// PATCH - 更新字词库元数据
export async function PATCH(
  request: NextRequest,
  { params }: { params: { libraryId: string } }
) {
  try {
    const { libraryId } = params
    const { name, description } = await request.json()

    const libraryDir = path.join(CHINESE_BASE_DIR, libraryId)

    if (!existsSync(libraryDir)) {
      return NextResponse.json({
        success: false,
        error: 'Library not found'
      }, { status: 404 })
    }

    // 读取并更新元数据
    const metadataPath = path.join(libraryDir, 'metadata.json')
    const metadataContent = await readFile(metadataPath, 'utf-8')
    const metadata = JSON.parse(metadataContent)

    if (name !== undefined) metadata.name = name.trim()
    if (description !== undefined) metadata.description = description.trim()
    metadata.updatedAt = new Date().toISOString()

    await writeFile(metadataPath, JSON.stringify(metadata, null, 2))

    // 更新 libraries.json
    const librariesContent = await readFile(LIBRARIES_INDEX_FILE, 'utf-8')
    const librariesData = JSON.parse(librariesContent)
    const libraryIndex = librariesData.libraries.findIndex((lib: any) => lib.id === libraryId)
    if (libraryIndex !== -1) {
      librariesData.libraries[libraryIndex].name = metadata.name
      librariesData.libraries[libraryIndex].description = metadata.description
      librariesData.libraries[libraryIndex].updatedAt = metadata.updatedAt
      await writeFile(LIBRARIES_INDEX_FILE, JSON.stringify(librariesData, null, 2))
    }

    return NextResponse.json({
      success: true,
      library: metadata
    })
  } catch (error) {
    console.error('[API] Failed to update library:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update library'
    }, { status: 500 })
  }
}
