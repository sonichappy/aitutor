import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

export async function GET(request: NextRequest) {
  try {
    const configPath = path.join(process.cwd(), 'data', 'accuracy-colors.json')
    const data = await readFile(configPath, 'utf-8')
    const config = JSON.parse(data)
    return NextResponse.json(config)
  } catch (error: any) {
    console.error("Error reading accuracy colors config:", error)
    // 返回默认配置
    const defaultConfig = {
      levels: [
        {
          id: "perfect",
          name: "完全正确",
          minAccuracy: 100,
          maxAccuracy: 100,
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          textColor: "text-green-800",
        },
        {
          id: "excellent",
          name: "优秀",
          minAccuracy: 85,
          maxAccuracy: 99,
          bgColor: "bg-lime-50",
          borderColor: "border-lime-200",
          textColor: "text-lime-800",
        },
        {
          id: "good",
          name: "良好",
          minAccuracy: 60,
          maxAccuracy: 84,
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          textColor: "text-yellow-800",
        },
        {
          id: "poor",
          name: "需努力",
          minAccuracy: 0,
          maxAccuracy: 59,
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          textColor: "text-red-800",
        },
      ],
    }
    return NextResponse.json(defaultConfig)
  }
}
