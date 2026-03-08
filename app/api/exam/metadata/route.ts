import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

// 获取考试元数据配置
export async function GET(request: NextRequest) {
  try {
    const metadataPath = path.join(process.cwd(), 'data', 'exam-metadata.json')

    const data = await readFile(metadataPath, 'utf-8')
    const metadata = JSON.parse(data)

    return NextResponse.json(metadata)
  } catch (error: any) {
    console.error("Error reading exam metadata:", error)

    // 返回默认配置
    const defaultMetadata = {
      examTypes: [
        { id: "daily_homework", name: "日常作业", description: "日常练习作业", icon: "📝", color: "blue" },
        { id: "unit_test", name: "单元测试", description: "单元练习或测试", icon: "📋", color: "green" },
        { id: "midterm_exam", name: "期中考试", description: "期中阶段性考试", icon: "📊", color: "orange" },
        { id: "final_exam", name: "期末考试", description: "期末总结性考试", icon: "🎯", color: "red" },
        { id: "tutoring", name: "课外辅导", description: "课外辅导练习", icon: "👨‍🏫", color: "purple" },
      ],
      difficultyLevels: [],
      questionTypes: [],
    }

    return NextResponse.json(defaultMetadata)
  }
}
