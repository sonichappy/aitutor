import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// 数据存储根目录
const CHINESE_BASE_DIR = path.join(process.cwd(), 'data', 'knowledge-base', 'chinese')
const LIBRARIES_INDEX_FILE = path.join(CHINESE_BASE_DIR, 'libraries.json')

// 确保目录存在
async function ensureDirectories() {
  if (!existsSync(CHINESE_BASE_DIR)) {
    await mkdir(CHINESE_BASE_DIR, { recursive: true })
  }
  if (!existsSync(LIBRARIES_INDEX_FILE)) {
    await writeFile(LIBRARIES_INDEX_FILE, JSON.stringify({ libraries: [] }, null, 2))
  }
}

// 读取字词库列表
async function getLibraries(): Promise<any[]> {
  try {
    const content = await readFile(LIBRARIES_INDEX_FILE, 'utf-8')
    const data = JSON.parse(content)
    return data.libraries || []
  } catch (error) {
    return []
  }
}

// 保存字词库列表
async function saveLibraries(libraries: any[]) {
  await writeFile(LIBRARIES_INDEX_FILE, JSON.stringify({ libraries }, null, 2))
}

// GET - 获取所有字词库列表
export async function GET() {
  try {
    await ensureDirectories()
    const libraries = await getLibraries()

    return NextResponse.json({
      success: true,
      libraries
    })
  } catch (error) {
    console.error('[API] Failed to get libraries:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get libraries'
    }, { status: 500 })
  }
}

// POST - 创建新字词库
export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Library name is required'
      }, { status: 400 })
    }

    await ensureDirectories()

    // 生成唯一ID
    const id = `lib-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const timestamp = new Date().toISOString()

    // 创建字词库目录
    const libraryDir = path.join(CHINESE_BASE_DIR, id)
    const imagesDir = path.join(libraryDir, 'images')

    await mkdir(libraryDir, { recursive: true })
    await mkdir(imagesDir, { recursive: true })

    // 创建 metadata.json
    const metadata = {
      id,
      name: name.trim(),
      description: description?.trim() || '',
      createdAt: timestamp,
      updatedAt: timestamp,
      wordCount: 0
    }
    await writeFile(
      path.join(libraryDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    )

    // 创建空的 words.json
    await writeFile(
      path.join(libraryDir, 'words.json'),
      JSON.stringify([], null, 2)
    )

    // 更新 libraries.json
    const libraries = await getLibraries()
    libraries.push({
      id,
      subject: 'chinese',
      name: name.trim(),
      description: description?.trim() || '',
      wordCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    await saveLibraries(libraries)

    return NextResponse.json({
      success: true,
      library: metadata
    })
  } catch (error) {
    console.error('[API] Failed to create library:', error)
    console.error('[API] Error details:', error instanceof Error ? error.message : 'Unknown error')
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: 'Failed to create library',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
