import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const ENGLISH_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge-base', 'english')

// DELETE - 删除批次（图片和所有相关单词）
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; batch: string }> }
) {
  try {
    const { libraryId, batch } = await params
    const batchImage = decodeURIComponent(batch)

    const libraryDir = path.join(ENGLISH_BASE_DIR, libraryId)
    if (!existsSync(libraryDir)) {
      return NextResponse.json({
        success: false,
        error: 'Library not found'
      }, { status: 404 })
    }

    // 删除图片文件
    const imagePath = path.join(libraryDir, 'images', batchImage)
    if (existsSync(imagePath)) {
      await unlink(imagePath)
      console.log('[Batch Delete] Image deleted:', batchImage)
    }

    // 读取现有的words.json
    const wordsPath = path.join(libraryDir, 'words.json')
    if (!existsSync(wordsPath)) {
      return NextResponse.json({
        success: false,
        error: 'Words file not found'
      }, { status: 404 })
    }

    const wordsContent = await readFile(wordsPath, 'utf-8')
    let words = JSON.parse(wordsContent)

    // 删除所有sourceImage等于该批次图片的单词
    const originalCount = words.length
    words = words.filter((w: any) => w.sourceImage !== batchImage)
    const deletedCount = originalCount - words.length

    await writeFile(wordsPath, JSON.stringify(words, null, 2))

    // 更新元数据
    const timestampStr = new Date().toISOString()
    const metadataPath = path.join(libraryDir, 'metadata.json')
    const metadataContent = await readFile(metadataPath, 'utf-8')
    const metadata = JSON.parse(metadataContent)
    metadata.wordCount = words.length
    metadata.updatedAt = timestampStr
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2))

    // 同步更新 libraries.json
    const librariesIndexPath = path.join(ENGLISH_BASE_DIR, 'libraries.json')
    const librariesIndexContent = await readFile(librariesIndexPath, 'utf-8')
    const librariesIndex = JSON.parse(librariesIndexContent)
    const libraryIndex = librariesIndex.libraries.findIndex((lib: any) => lib.id === libraryId)
    if (libraryIndex !== -1) {
      librariesIndex.libraries[libraryIndex].wordCount = words.length
      librariesIndex.libraries[libraryIndex].updatedAt = timestampStr
      await writeFile(librariesIndexPath, JSON.stringify(librariesIndex, null, 2))
    }

    console.log('[Batch Delete] Batch deleted successfully:', batchImage, '-', deletedCount, 'words')

    return NextResponse.json({
      success: true,
      message: `已删除批次和 ${deletedCount} 个单词`,
      remainingWords: words.length
    })
  } catch (error) {
    console.error('[API] Failed to delete batch:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete batch'
    }, { status: 500 })
  }
}
