import { NextRequest, NextResponse } from "next/server"
import { readFile, writeFile } from "fs/promises"
import path from "path"

const DATA_DIR = path.join(process.cwd(), 'data')
const SUBJECTS_FILE = path.join(DATA_DIR, 'subjects.json')

// 确保目录和文件存在
async function ensureSubjectsFile() {
  try {
    await readFile(SUBJECTS_FILE, 'utf-8')
  } catch {
    // 文件不存在，创建默认配置
    const defaultSubjects = {
      subjects: [
        { id: "math", name: "数学", icon: "📐", color: "blue", enabled: true, category: "理科" },
        { id: "algebra", name: "代数", icon: "🔢", color: "blue", enabled: false, category: "理科" },
        { id: "geometry", name: "几何", icon: "📐", color: "blue", enabled: false, category: "理科" },
        { id: "chinese", name: "语文", icon: "📖", color: "red", enabled: true, category: "文科" },
        { id: "english", name: "英语", icon: "🔤", color: "purple", enabled: true, category: "文科" },
        { id: "physics", name: "物理", icon: "⚛️", color: "orange", enabled: false, category: "理科" },
        { id: "chemistry", name: "化学", icon: "🧪", color: "green", enabled: false, category: "理科" },
        { id: "biology", name: "生物", icon: "🧬", color: "lime", enabled: true, category: "理科" },
        { id: "history", name: "历史", icon: "📜", color: "amber", enabled: true, category: "文科" },
        { id: "geography", name: "地理", icon: "🌍", color: "cyan", enabled: true, category: "文科" },
        { id: "politics", name: "道法", icon: "⚖️", color: "indigo", enabled: true, category: "文科" },
        { id: "politics2", name: "政治", icon: "🏛️", color: "indigo", enabled: false, category: "文科" },
      ]
    }
    await writeFile(SUBJECTS_FILE, JSON.stringify(defaultSubjects, null, 2), 'utf-8')
  }
}

// GET - 获取学科配置
export async function GET(request: NextRequest) {
  try {
    await ensureSubjectsFile()

    const content = await readFile(SUBJECTS_FILE, 'utf-8')
    const data = JSON.parse(content)

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Failed to load subjects:", error)
    return NextResponse.json(
      { error: "获取学科配置失败", details: error.message },
      { status: 500 }
    )
  }
}

// PUT - 更新学科配置
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()

    // 验证数据格式
    if (!data.subjects || !Array.isArray(data.subjects)) {
      return NextResponse.json(
        { error: "无效的学科配置格式" },
        { status: 400 }
      )
    }

    // 保存到文件
    await writeFile(SUBJECTS_FILE, JSON.stringify(data, null, 2), 'utf-8')

    return NextResponse.json({
      success: true,
      subjects: data.subjects
    })
  } catch (error: any) {
    console.error("Failed to save subjects:", error)
    return NextResponse.json(
      { error: "保存学科配置失败", details: error.message },
      { status: 500 }
    )
  }
}
