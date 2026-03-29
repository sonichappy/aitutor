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
  testDate?: string  // 测试日期
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
    const subjectTrends: { [key: string]: { date: string; score: number; examCount: number }[] } = {}
    const subjectExamCounts: { [key: string]: number } = {}

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

      // 按测试时间排序（如果没有测试时间，使用创建时间）
      exams.sort((a, b) => {
        const dateA = new Date(a.testDate || a.createdAt).getTime()
        const dateB = new Date(b.testDate || b.createdAt).getTime()
        return dateA - dateB
      })

      // 计算每次考试的分数（正确率）
      // 使用与试卷中心相同的计算逻辑
      const examScores = exams.map(exam => {
        if (!exam.questions || exam.questions.length === 0) {
          return {
            date: exam.testDate || exam.createdAt,  // 使用测试时间
            score: 100,  // 无题目的试卷默认满分
            questionCount: 0
          }
        }

        let correctCount = 0  // 明确标记为做对的数量
        let wrongCount = 0     // 标记为做错的数量
        let skippedCount = 0   // 标记为不会做的数量
        let markedCount = 0    // 已标记的数量
        let correctScore = 0   // 做对题目得分
        let totalScore = 0     // 题目总分

        exam.questions.forEach((q: any) => {
          totalScore += q.score || 0

          if (q.isCorrect === true) {
            correctCount++
            correctScore += q.score || 0
            markedCount++
          } else if (q.isCorrect === false) {
            wrongCount++
            markedCount++
          } else if (q.isSkipped) {
            skippedCount++
            markedCount++
          }
          // 未标记的题目不计入统计
        })

        // 如果没有任何标记过的题目，视为全对（100分）
        if (markedCount === 0) {
          return {
            date: exam.testDate || exam.createdAt,  // 使用测试时间
            score: 100,
            questionCount: exam.questions.length
          }
        }

        // 未标记的题目默认为做对
        const unmarkedCount = exam.questions.length - markedCount
        const totalCorrect = correctCount + unmarkedCount
        totalScore = exam.questions.reduce((sum: number, q: any) => sum + (q.score || 0), 0)

        // 计算正确率：做对题目得分 / 题目总分
        const finalCorrectScore = correctScore + unmarkedCount * (totalScore / exam.questions.length)
        const accuracy = totalScore > 0 ? Math.round((finalCorrectScore / totalScore) * 100) : 0

        return {
          date: exam.testDate || exam.createdAt,  // 使用测试时间
          score: accuracy,
          questionCount: exam.questions.length
        }
      })

      // 按日期分组，同一天的多份试卷做加权平均
      const dailyScores: { [date: string]: { totalScore: number; totalWeight: number; firstDate: string; examCount: number } } = {}

      examScores.forEach(exam => {
        const date = new Date(exam.date)
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

        if (!dailyScores[dateKey]) {
          dailyScores[dateKey] = {
            totalScore: 0,
            totalWeight: 0,
            firstDate: exam.date,
            examCount: 0
          }
        }

        // 使用题目数量作为权重
        dailyScores[dateKey].totalScore += exam.score * exam.questionCount
        dailyScores[dateKey].totalWeight += exam.questionCount
        dailyScores[dateKey].examCount += 1
      })

      // 转换为趋势数组
      const trend = Object.entries(dailyScores)
        .map(([dateKey, data]) => ({
          date: data.firstDate,
          score: Math.round(data.totalScore / data.totalWeight),
          examCount: data.examCount
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      // 计算总试卷数
      const totalExamCount = exams.length

      // 只保留至少有2次试卷记录的学科
      // 即使分数为0（未批改）也显示，因为这是真实的提交记录
      if (trend.length >= 2) {
        // 优先使用试卷中的学科名称，否则使用文件夹映射后的名称
        let subjectName = exams[0]?.subjectName
        if (!subjectName) {
          subjectName = subjectNameMap[subjectDir.name] || subjectDir.name
        }
        subjectTrends[subjectName] = trend
        subjectExamCounts[subjectName] = totalExamCount
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        subjectTrends,
        subjectExamCounts
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
