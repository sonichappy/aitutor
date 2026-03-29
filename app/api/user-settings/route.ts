/**
 * 用户设置 API
 * GET /api/user-settings - 获取用户设置
 * POST /api/user-settings - 保存用户设置
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'user-settings.json')

interface UserSettings {
  studentName?: string
  [key: string]: any
}

// 默认设置
const DEFAULT_SETTINGS: UserSettings = {
  studentName: '张同学'
}

// 读取设置文件
async function readSettings(): Promise<UserSettings> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(content) }
  } catch (error) {
    // 文件不存在，返回默认设置
    return { ...DEFAULT_SETTINGS }
  }
}

// 保存设置文件
async function writeSettings(settings: UserSettings): Promise<void> {
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true })
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
}

export async function GET(request: NextRequest) {
  try {
    const settings = await readSettings()
    return NextResponse.json({
      success: true,
      data: settings
    })
  } catch (error: any) {
    console.error('[获取用户设置] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取失败'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentName } = body

    if (studentName !== undefined && typeof studentName !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '学生姓名格式不正确'
        },
        { status: 400 }
      )
    }

    const currentSettings = await readSettings()

    if (studentName !== undefined) {
      currentSettings.studentName = studentName.trim() || DEFAULT_SETTINGS.studentName
    }

    await writeSettings(currentSettings)

    return NextResponse.json({
      success: true,
      message: '设置已保存',
      data: currentSettings
    })
  } catch (error: any) {
    console.error('[保存用户设置] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || '保存失败'
      },
      { status: 500 }
    )
  }
}
