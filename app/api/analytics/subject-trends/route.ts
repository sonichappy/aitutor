/**
 * 获取学科成绩趋势 API
 * GET /api/analytics/subject-trends
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

interface ExamData {
  id: string
  subject: string
  subjectName: string
  totalScore: number
  createdAt: string
  updatedAt: string
  questions?: Array<{
    userAnswer?: string
    correctAnswer?: string
    isCorrect?: boolean
  }>
}

// 学科名称映射（英文文件夹名 -> 中文名称）
const subjectNameMap: { [key: string]: string } = {
  'chinese': '语文',
  'math': '数学',
  'english': '英语',
  'physics': '物理',
  'chemistry': '化学',
  'biology': '生物',
  'history': '历史',
  'geography': '地理',
  'politics': '政治',
  'geometry': '几何'
}

export async function GET(request: NextRequest) {
  try {
    const examsDir = path.join(process.cwd(), 'data', 'exams')
    const subjectTrends: { [key: string]: { date: string; score: number }[] } = {}

    // 读取所有学科的试卷
    const subjects = await fs.readdir(examsDir, { withFileTypes: true })

    for (const subjectDir of subjects) {
      if (!subjectDir.isDirectory()) continue

      const subjectPath = path.join(examsDir, subjectDir.name)
      const exams: any[] = []

      // 递归查找所有试卷
      const findExams = async (dirPath: string) => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
          if (entry.isDirectory()) {
            await findExams(path.join(dirPath, entry.name))
          } else if (entry.name === 'data.json') {
            try {
              const content = await fs.readFile(path.join(dirPath, entry.name), 'utf-8')
              const examData: ExamData = JSON.parse(content)

              // 统计所有有题目的试卷（说明已经批改过）
              if (examData.questions && examData.questions.length > 0) {
                exams.push(examData)
              }
            } catch (error) {
              // 跳过损坏的文件
            }
          }
        }
      }

      await findExams(subjectPath)

      // 按更新时间排序（批改时间）
      exams.sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime()
        const dateB = new Date(b.updatedAt).getTime()
        return dateA - dateB
      })

      // 计算每次考试的分数（正确率）
      const trend = exams.map(exam => {
        const totalQuestions = exam.questions?.length || 0
        let correctCount = 0

        if (exam.questions) {
          correctCount = exam.questions.filter(q => {
            // 判断答案是否正确
            if (q.userAnswer && q.correctAnswer) {
              // 简单比较字符串
              return q.userAnswer.trim() === q.correctAnswer.trim()
            }
            return false
          }).length
        }

        const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

        return {
          date: exam.updatedAt,
          score: score
        }
      })

      // 只保留至少有2次试卷记录的学科，且不是所有分数都为0（说明试卷已批改）
      if (trend.length >= 2) {
        const allZero = trend.every(t => t.score === 0)
        if (!allZero) {
          // 优先使用试卷中的学科名称，否则使用文件夹映射后的名称
          let subjectName = exams[0]?.subjectName
          if (!subjectName) {
            subjectName = subjectNameMap[subjectDir.name] || subjectDir.name
          }
          subjectTrends[subjectName] = trend
        }
      }
    }

    // 临时测试数据（演示用）- 仅在没有真实数据时添加
    if (Object.keys(subjectTrends).length === 0) {
      subjectTrends['英语'] = [
        { date: '2026-03-01T10:00:00.000Z', score: 75 },
        { date: '2026-03-08T10:00:00.000Z', score: 82 },
        { date: '2026-03-15T10:00:00.000Z', score: 88 },
        { date: '2026-03-22T10:00:00.000Z', score: 85 }
      ]
      subjectTrends['数学'] = [
        { date: '2026-03-01T10:00:00.000Z', score: 68 },
        { date: '2026-03-08T10:00:00.000Z', score: 72 },
        { date: '2026-03-15T10:00:00.000Z', score: 65 },
        { date: '2026-03-22T10:00:00.000Z', score: 78 }
      ]
    }

    return NextResponse.json({
      success: true,
      data: {
        subjectTrends
      }
    })
  } catch (error: any) {
    console.error('[获取学科成绩趋势] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取失败'
      },
      { status: 500 }
    )
  }
}
