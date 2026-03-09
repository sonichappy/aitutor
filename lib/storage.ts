import fs from 'fs/promises'
import path from 'path'
import { getSubjectFolderName, DEFAULT_SUBJECTS } from '@/types/subject'

// 数据存储根目录
const DATA_DIR = path.join(process.cwd(), 'data')
const EXAMS_DIR = path.join(DATA_DIR, 'exams')

// 获取学科的文件夹名称（使用设置中心配置的名称）
function getSubjectFolderNameFromSettings(subjectName: string): string {
  return getSubjectFolderName(subjectName)
}

// 从日期字符串生成日期文件夹（YYYYMMDD格式）
function getDateFolder(dateString?: string): string {
  const date = dateString ? new Date(dateString) : new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

// 确保目录存在
async function ensureDir(dir: string) {
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
  }
}

// 初始化存储目录
export async function initStorage() {
  await ensureDir(DATA_DIR)
  await ensureDir(EXAMS_DIR)
}

// 试卷数据接口
export interface ExamQuestion {
  number: number
  type: string
  content: string
  options?: string[]
  score: number
  difficulty: number
  knowledgePoints: string[]
  bbox?: { x: number; y: number; width: number; height: number }
  // 作文相关字段
  essayGenre?: string  // 作文体裁：记叙文、议论文、说明文、应用文等
  wordCount?: number  // 预估字数
  // 答题标记字段（记录在每道题中）
  userAnswer?: string  // 用户答案
  isCorrect?: boolean  // 是否正确（undefined=未标记，true=正确，false=错误）
  isSkipped?: boolean  // 是否跳过
  markedAt?: string  // 标记时间
  // AI 分析结果字段
  correctAnswer?: string  // 正确答案
  errorReason?: string  // 错误原因（旧字段，兼容保留）
  errorAnalysis?: string  // 错误原因分析
  weakPoints?: string[]  // 薄弱知识点
  improvement?: string  // 改进建议
  aiExplanation?: string  // 详细解析
}

export interface ExamData {
  id: string
  userId: string
  subject: string
  subjectName?: string  // 学科中文名称（用于显示）
  examType: string
  totalScore: number
  imageUrl?: string  // base64 图片数据
  rawText?: string
  questions: ExamQuestion[]
  answers?: any[]
  analysis?: any
  createdAt: string
  updatedAt?: string
  // 元数据
  metadata?: {
    detectedSubject?: string  // AI 识别的科目
    overallDifficulty?: number  // 整体难度 1-5
    estimatedTime?: number  // 预估完成时间（分钟）
    knowledgePointsSummary?: string[]  // 主要知识点汇总
    tags?: string[]  // 标签
    questionTypeStats?: Record<string, number>  // 题目类型统计
    // 作文相关
    isEssay?: boolean  // 是否是作文试卷
    essayType?: string  // "语文作文" 或 "英语作文"
  }
  // 答题统计（在答题后更新）
  answerStats?: {
    correct?: number
    wrong?: number
    skipped?: number
    total?: number
    accuracy?: number  // 正确率百分比
    completedAt?: string
  }
}

// 获取试卷目录路径（按学科和日期分类）
function getExamDirPath(examId: string, subject?: string, createdAt?: string): string {
  if (subject) {
    // 使用设置中心配置的文件夹名称
    const folderName = getSubjectFolderNameFromSettings(subject)
    const dateFolder = getDateFolder(createdAt)
    return path.join(EXAMS_DIR, folderName, dateFolder, examId)
  }
  // 如果没有指定学科，返回旧路径（向后兼容）
  return path.join(EXAMS_DIR, examId)
}

// 保存试卷数据
export async function saveExamData(examId: string, data: ExamData) {
  await initStorage()
  const examDir = getExamDirPath(examId, data.subject, data.createdAt)
  await ensureDir(examDir)

  // 更新时间戳
  data.updatedAt = new Date().toISOString()

  // 保存数据文件
  const dataPath = path.join(examDir, 'data.json')
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8')

  return data
}

// 查找试卷所在目录（搜索所有学科文件夹和日期文件夹）
async function findExamDir(examId: string): Promise<string | null> {
  try {
    // 首先尝试直接读取（旧格式兼容）
    const oldPath = path.join(EXAMS_DIR, examId, 'data.json')
    try {
      await fs.access(oldPath)
      return path.join(EXAMS_DIR, examId)
    } catch {
      // 旧格式不存在，继续搜索学科文件夹
    }

    // 搜索所有学科文件夹
    const subjects = await fs.readdir(EXAMS_DIR)
    for (const subject of subjects) {
      const subjectPath = path.join(EXAMS_DIR, subject)
      const stat = await fs.stat(subjectPath)
      if (stat.isDirectory()) {
        // 首先尝试直接在学科文件夹下查找（向后兼容）
        const examPathNoDate = path.join(subjectPath, examId, 'data.json')
        try {
          await fs.access(examPathNoDate)
          return path.join(subjectPath, examId)
        } catch {
          // 继续搜索日期文件夹
        }

        // 搜索日期文件夹
        try {
          const dateFolders = await fs.readdir(subjectPath)
          for (const dateFolder of dateFolders) {
            const datePath = path.join(subjectPath, dateFolder)
            const dateStat = await fs.stat(datePath)
            if (dateStat.isDirectory()) {
              const examPath = path.join(datePath, examId, 'data.json')
              try {
                await fs.access(examPath)
                return path.join(datePath, examId)
              } catch {
                continue
              }
            }
          }
        } catch {
          // 读取日期文件夹失败，继续
        }
      }
    }
  } catch {
    // 忽略错误
  }
  return null
}

// 读取试卷数据
export async function getExamData(examId: string): Promise<ExamData | null> {
  try {
    const examDir = await findExamDir(examId)
    if (!examDir) {
      console.error(`[Storage] Exam ${examId} not found`)
      return null
    }

    const dataPath = path.join(examDir, 'data.json')
    console.log(`[Storage] Reading exam data from: ${dataPath}`)
    const content = await fs.readFile(dataPath, 'utf-8')
    const data = JSON.parse(content)
    console.log(`[Storage] Successfully read exam ${examId}`)
    return data
  } catch (error) {
    console.error(`[Storage] Failed to read exam ${examId}:`, error)
    return null
  }
}

// 检查试卷是否存在
export async function examExists(examId: string): Promise<boolean> {
  const examDir = await findExamDir(examId)
  return examDir !== null
}

// 更新试卷题目
export async function updateExamQuestions(examId: string, questions: ExamQuestion[]) {
  const data = await getExamData(examId)
  if (!data) {
    throw new Error('试卷不存在')
  }

  data.questions = questions
  return await saveExamData(examId, data)
}

// 保存试卷图片
export async function saveExamImage(examId: string, base64Image: string) {
  await initStorage()

  // 获取试卷数据以确定学科和创建时间
  const examData = await getExamData(examId)
  const subject = examData?.subject
  const createdAt = examData?.createdAt

  const examDir = getExamDirPath(examId, subject, createdAt)
  await ensureDir(examDir)

  // 解析 mime 类型
  const mimeType = base64Image.match(/data:([^;]+);/)?.[1] || 'image/jpeg'
  const ext = mimeType.split('/')[1] || 'jpg'

  // 提取 base64 数据
  const base64Data = base64Image.includes('base64,')
    ? base64Image.split('base64,')[1]
    : base64Image

  // 保存图片
  const imagePath = path.join(examDir, `image.${ext}`)
  await fs.writeFile(imagePath, Buffer.from(base64Data, 'base64'))

  return {
    path: imagePath,
    mimeType,
    ext
  }
}

// 读取试卷图片
export async function getExamImage(examId: string): Promise<{ data: Buffer; mimeType: string } | null> {
  try {
    const examDir = await findExamDir(examId)
    if (!examDir) {
      return null
    }

    // 尝试不同的图片格式
    const formats = ['jpg', 'jpeg', 'png', 'webp']
    for (const ext of formats) {
      try {
        const imagePath = path.join(examDir, `image.${ext}`)
        const data = await fs.readFile(imagePath)
        const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
        return { data, mimeType }
      } catch {
        continue
      }
    }

    return null
  } catch {
    return null
  }
}

// 删除试卷
export async function deleteExam(examId: string) {
  try {
    const examDir = await findExamDir(examId)
    if (examDir) {
      await fs.rm(examDir, { recursive: true, force: true })
    }
  } catch {
    // 忽略删除错误
  }
}

// 获取用户的所有试卷
export async function getUserExams(userId: string): Promise<ExamData[]> {
  await initStorage()
  const exams: ExamData[] = []

  try {
    // 读取exams目录下的所有内容（包括学科文件夹和直接的考试文件夹）
    const entries = await fs.readdir(EXAMS_DIR, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const entryPath = path.join(EXAMS_DIR, entry.name)

        // 检查是否是学科文件夹（包含data.json的文件夹直接视为考试文件夹）
        // 学科文件夹内会包含多个考试文件夹
        const isExamFolder = await checkIfExamFolder(entryPath)

        if (isExamFolder) {
          // 这是直接的考试文件夹（旧格式）
          const data = await getExamData(entry.name)
          if (data && data.userId === userId) {
            exams.push(data)
          }
        } else {
          // 这是学科文件夹，读取其中的考试（包括日期文件夹）
          try {
            await scanSubjectFolderForExams(entryPath, userId, exams)
          } catch {
            // 忽略读取错误
          }
        }
      }
    }
  } catch {
    // 忽略错误
  }

  return exams.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

// 递归扫描学科文件夹下的考试（支持日期文件夹）
async function scanSubjectFolderForExams(folderPath: string, userId: string, exams: ExamData[]): Promise<void> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name)

    if (entry.isDirectory()) {
      // 检查是否是考试文件夹（包含data.json）
      const isExam = await checkIfExamDir(entryPath)
      if (isExam) {
        // 这是考试文件夹，读取数据
        const examId = entry.name
        const data = await getExamData(examId)
        if (data && data.userId === userId) {
          exams.push(data)
        }
      } else {
        // 这是日期文件夹，继续递归
        await scanSubjectFolderForExams(entryPath, userId, exams)
      }
    }
  }
}

// 检查是否是考试文件夹（包含data.json）
async function checkIfExamDir(folderPath: string): Promise<boolean> {
  try {
    const dataPath = path.join(folderPath, 'data.json')
    await fs.access(dataPath)
    return true
  } catch {
    return false
  }
}

// 检查是否是考试文件夹（兼容旧版本）
async function checkIfExamFolder(folderPath: string): Promise<boolean> {
  return checkIfExamDir(folderPath)
}

// 获取指定学科的试卷
export async function getUserExamsBySubject(userId: string, subject: string): Promise<ExamData[]> {
  await initStorage()
  const exams: ExamData[] = []

  try {
    const subjectPath = path.join(EXAMS_DIR, subject)
    await fs.access(subjectPath)

    // 递归扫描学科文件夹（支持日期文件夹）
    await scanSubjectFolderForExams(subjectPath, userId, exams)
  } catch {
    // 学科文件夹不存在或读取错误，返回空数组
  }

  return exams.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

// ============================================
// 错题管理
// ============================================

const WRONG_QUESTIONS_DIR = path.join(DATA_DIR, 'wrong-questions')

// 错题接口
export interface WrongQuestion {
  id: string
  userId: string
  subject: string
  type: string
  content: string
  options?: string
  correctAnswer: string
  userAnswer: string
  knowledgePoints: string[]
  difficulty: number
  errorReason?: string
  errorAnalysis?: string
  weakPoints: string[]
  improvement?: string
  aiExplanation?: string
  reviewCount: number
  nextReviewAt: string
  status: string
  originalExamId?: string
  originalQuestionId?: string
  createdAt: string
  updatedAt: string
}

// 保存错题
export async function saveWrongQuestion(question: WrongQuestion) {
  await initStorage()
  await ensureDir(WRONG_QUESTIONS_DIR)

  const filePath = path.join(WRONG_QUESTIONS_DIR, `${question.id}.json`)
  await fs.writeFile(filePath, JSON.stringify(question, null, 2), 'utf-8')

  return question
}

// 获取用户的所有错题
export async function getUserWrongQuestions(userId: string): Promise<WrongQuestion[]> {
  await initStorage()
  const questions: WrongQuestion[] = []

  try {
    const files = await fs.readdir(WRONG_QUESTIONS_DIR)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const filePath = path.join(WRONG_QUESTIONS_DIR, file)
      const content = await fs.readFile(filePath, 'utf-8')
      const question = JSON.parse(content) as WrongQuestion
      if (question.userId === userId) {
        questions.push(question)
      }
    }
  } catch {
    // 忽略错误
  }

  return questions.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

// 检查错题是否已存在
export async function wrongQuestionExists(
  userId: string,
  content: string,
  userAnswer: string
): Promise<boolean> {
  const questions = await getUserWrongQuestions(userId)
  return questions.some(
    q => q.content === content && q.userAnswer === userAnswer
  )
}

// ============================================
// 学科报告管理
// ============================================

const REPORTS_DIR = path.join(DATA_DIR, 'reports')

// 报告数据接口
export interface SubjectReport {
  id?: string  // 报告ID（可选，保存时自动生成）
  userId: string
  subject: string
  subjectId: string  // 学科ID，如 english, math
  title: string
  startDate: string
  endDate: string
  generatedAt: string
  stats: {
    totalExams: number
    totalQuestions: number
    markedQuestions: number
    correctQuestions: number
    wrongQuestions: number
    skippedQuestions: number
    avgAccuracy: number
  }
  analysis?: {
    knowledgeMatrix?: {
      description: string
      topWeakPoints: Array<{
        point: string
        errorRate: number
        count: number
      }>
    }
    abilityAssessment?: {
      description: string
      mainIssue: string
      analysis: string
    }
    errorPatterns?: {
      description: string
      patterns: string[]
    }
    prediction?: {
      description: string
      nextChapterRisks: string[]
      recommendations: string[]
    }
  }
  content: string  // Markdown 格式的报告内容
}

// 初始化报告目录
async function ensureReportsDir() {
  await initStorage()
  await ensureDir(REPORTS_DIR)
}

// 根据学科名称获取学科ID（文件夹名称）
async function getSubjectIdByName(subjectName: string): Promise<string> {
  // 使用设置中心配置的文件夹名称
  return getSubjectFolderNameFromSettings(subjectName)
}

// 生成时间戳格式的文件夹名 (YYYYMMDDHHmmss)
function generateTimestampFolderName(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

// 保存学科报告
export async function saveSubjectReport(report: SubjectReport): Promise<SubjectReport> {
  await ensureReportsDir()

  // 生成报告ID和时间戳文件夹名
  const generatedDate = new Date(report.generatedAt)
  const timestamp = generateTimestampFolderName(generatedDate)

  if (!report.id) {
    report.id = timestamp
  }

  // 获取学科ID
  const subjectId = report.subjectId || await getSubjectIdByName(report.subject)
  report.subjectId = subjectId

  // 创建学科子目录
  const subjectDir = path.join(REPORTS_DIR, subjectId)
  await ensureDir(subjectDir)

  // 创建报告文件夹
  const reportDir = path.join(subjectDir, timestamp)
  await ensureDir(reportDir)

  // 保存报告为 report.md
  const mdPath = path.join(reportDir, 'report.md')
  await fs.writeFile(mdPath, report.content, 'utf-8')

  // 保存元数据为 meta.json
  const metaPath = path.join(reportDir, 'meta.json')
  const { content, ...meta } = report
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

  return report
}

// 获取某个学科的所有报告
export async function getSubjectReports(subject: string): Promise<SubjectReport[]> {
  await ensureReportsDir()

  const reports: SubjectReport[] = []
  const subjectId = await getSubjectIdByName(subject)
  const subjectDir = path.join(REPORTS_DIR, subjectId)

  try {
    await fs.access(subjectDir)
  } catch {
    // 目录不存在，返回空数组
    return reports
  }

  try {
    const folders = await fs.readdir(subjectDir)

    for (const folder of folders) {
      try {
        const reportDirPath = path.join(subjectDir, folder)
        const stat = await fs.stat(reportDirPath)

        // 只处理目录
        if (!stat.isDirectory()) continue

        // 尝试新格式: meta.json 和 report.md
        let metaPath = path.join(reportDirPath, 'meta.json')
        let mdPath = path.join(reportDirPath, 'report.md')
        let metaContent: string | null = null
        let mdContent: string | null = null

        try {
          [metaContent, mdContent] = await Promise.all([
            fs.readFile(metaPath, 'utf-8'),
            fs.readFile(mdPath, 'utf-8')
          ])
        } catch {
          // 新格式不存在，尝试旧格式
          const files = await fs.readdir(reportDirPath)
          const metaFile = files.find(f => f.endsWith('.meta.json'))
          const mdFile = files.find(f => f.endsWith('.md'))

          if (metaFile && mdFile) {
            try {
              [metaContent, mdContent] = await Promise.all([
                fs.readFile(path.join(reportDirPath, metaFile), 'utf-8'),
                fs.readFile(path.join(reportDirPath, mdFile), 'utf-8')
              ])
            } catch (err) {
              console.error(`Failed to read old format report ${folder}:`, err)
              continue
            }
          } else {
            console.error(`No valid report files found in ${folder}`)
            continue
          }
        }

        if (!metaContent || !mdContent) {
          console.error(`Missing content for report ${folder}`)
          continue
        }

        const meta = JSON.parse(metaContent) as Omit<SubjectReport, 'content'>

        // 为旧报告添加 subjectId 字段
        if (!meta.subjectId) {
          meta.subjectId = subjectId
        }

        reports.push({
          ...meta,
          content: mdContent
        })
      } catch (error) {
        console.error(`Failed to read report ${folder}:`, error)
      }
    }
  } catch (error) {
    console.error(`Failed to read reports for ${subject}:`, error)
  }

  // 按生成时间倒序排列
  return reports.sort((a, b) =>
    new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  )
}

// 获取单个报告
export async function getSubjectReport(subject: string, reportId: string): Promise<SubjectReport | null> {
  const subjectId = await getSubjectIdByName(subject)
  const subjectDir = path.join(REPORTS_DIR, subjectId)
  const reportDir = path.join(subjectDir, reportId)

  try {
    // 尝试新格式
    let metaPath = path.join(reportDir, 'meta.json')
    let mdPath = path.join(reportDir, 'report.md')
    let metaContent: string | null = null
    let mdContent: string | null = null

    try {
      [metaContent, mdContent] = await Promise.all([
        fs.readFile(metaPath, 'utf-8'),
        fs.readFile(mdPath, 'utf-8')
      ])
    } catch {
      // 新格式不存在，尝试旧格式
      const files = await fs.readdir(reportDir)
      const metaFile = files.find(f => f.endsWith('.meta.json'))
      const mdFile = files.find(f => f.endsWith('.md'))

      if (metaFile && mdFile) {
        [metaContent, mdContent] = await Promise.all([
          fs.readFile(path.join(reportDir, metaFile), 'utf-8'),
          fs.readFile(path.join(reportDir, mdFile), 'utf-8')
        ])
      }
    }

    if (!metaContent || !mdContent) {
      return null
    }

    const meta = JSON.parse(metaContent) as Omit<SubjectReport, 'content'>

    // 为旧报告添加 subjectId 字段
    if (!meta.subjectId) {
      (meta as any).subjectId = subjectId
    }

    return {
      ...meta,
      content: mdContent
    }
  } catch (error) {
    console.error(`Failed to read report ${reportId}:`, error)
    return null
  }
}

// 删除报告
export async function deleteSubjectReport(subject: string, reportId: string): Promise<void> {
  const subjectId = await getSubjectIdByName(subject)
  const reportDir = path.join(REPORTS_DIR, subjectId, reportId)

  try {
    await fs.rm(reportDir, { recursive: true, force: true })
  } catch (error) {
    console.error(`Failed to delete report ${reportId}:`, error)
  }
}
