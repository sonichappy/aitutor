import fs from 'fs/promises'
import path from 'path'
import { getSubjectFolderName, DEFAULT_SUBJECTS } from '@/types/subject'

// 数据存储根目录
const DATA_DIR = path.join(process.cwd(), 'data')
const EXAMS_DIR = path.join(DATA_DIR, 'exams')

// 获取学科的文件夹名称（使用设置中心配置的名称）
async function getSubjectFolderNameFromSettings(subjectName: string): Promise<string> {
  try {
    const subjectsFile = path.join(process.cwd(), 'data', 'subjects.json')
    const content = await fs.readFile(subjectsFile, 'utf-8')
    const data = JSON.parse(content)
    const subjects: any[] = data.subjects || []

    // 精确匹配学科名称
    const subject = subjects.find((s: any) => s.name === subjectName)
    if (subject?.folderName) {
      return subject.folderName
    }
  } catch (error) {
    console.error('Failed to read subjects.json:', error)
  }

  // 回退到硬编码的默认值
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
  examType?: string  // 试卷类型ID（可选）
  totalScore?: number  // 总分（可选）
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
    // 用户提供的自定义提示词
    customPrompt?: string
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
async function getExamDirPath(examId: string, subject?: string, createdAt?: string): Promise<string> {
  if (subject) {
    // 使用设置中心配置的文件夹名称（需要 await）
    const folderName = await getSubjectFolderNameFromSettings(subject)
    const dateFolder = getDateFolder(createdAt)
    return path.join(EXAMS_DIR, folderName, dateFolder, examId)
  }
  // 如果没有指定学科，返回旧路径（向后兼容）
  return path.join(EXAMS_DIR, examId)
}

// 保存试卷数据
export async function saveExamData(examId: string, data: ExamData) {
  await initStorage()
  const examDir = await getExamDirPath(examId, data.subject, data.createdAt)
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

  const examDir = await getExamDirPath(examId, subject, createdAt)
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

// 导出 REPORTS_DIR 供其他模块使用
export { REPORTS_DIR }

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
export async function getSubjectIdByName(subjectName: string): Promise<string> {
  // 使用设置中心配置的文件夹名称
  return await getSubjectFolderNameFromSettings(subjectName)
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

// ============================================
// Deep Research 深度分析报告
// ============================================

// 深度分析报告数据接口
export interface DeepResearchReport {
  id?: string  // 报告ID（可选，保存时自动生成）
  userId: string
  subject: string
  subjectId: string  // 学科ID，如 english, math
  analysisType: string  // 分析类型，支持所有学科的综合/专项分析
  generatedAt: string
  analysisTime: number  // 分析耗时（毫秒）

  // 报告内容
  summary: string  // 分析摘要
  detailedAnalysis: any  // 详细分析数据（JSON）
  recommendations: string[]  // 建议列表
  nextSteps: string[]  // 后续步骤
  reasoningChain?: any  // 推理链
  reflection?: any  // 自我反思

  // 扩展元数据
  reportMetadata?: {
    reportType?: string  // 报告类型：学科状态深入分析报告
    analysisTimeFormatted?: string  // 格式化的分析时间
    examTimeRange?: {  // 试卷时间范围
      start: string
      end: string
    }
    totalQuestions?: number  // 题目数量
    wrongQuestionsCount?: number  // 错题数量
    questionTypes?: string[]  // 题目类型
    knowledgePoints?: string[]  // 知识点范围
    modelName?: string  // 使用的大模型名称
    analysisDurationFormatted?: string  // 格式化的分析耗时
  }

  metadata: {
    subject: string
    analysisTime: number
    dataPoints: number
    confidenceLevel: number
  }
}

/**
 * 保存 Deep Research 深度分析报告
 * 保存路径: /data/reports/学科/deepresearch-年月日时分秒/report.md
 */
export async function saveDeepResearchReport(report: DeepResearchReport): Promise<DeepResearchReport> {
  await ensureReportsDir()

  // 生成报告ID和时间戳文件夹名
  const generatedDate = new Date(report.generatedAt)
  const timestamp = generateTimestampFolderName(generatedDate)
  const reportId = `deepresearch-${timestamp}`

  if (!report.id) {
    report.id = reportId
  }

  // 获取学科ID
  const subjectId = report.subjectId || await getSubjectIdByName(report.subject)
  report.subjectId = subjectId

  // 创建学科子目录
  const subjectDir = path.join(REPORTS_DIR, subjectId)
  await ensureDir(subjectDir)

  // 创建深度分析报告文件夹
  const reportDir = path.join(subjectDir, reportId)
  await ensureDir(reportDir)

  // 生成 Markdown 报告内容
  const markdownContent = generateDeepResearchMarkdown(report)

  // 保存报告为 report.md
  const mdPath = path.join(reportDir, 'report.md')
  await fs.writeFile(mdPath, markdownContent, 'utf-8')

  // 保存元数据为 meta.json
  const metaPath = path.join(reportDir, 'meta.json')
  const { summary, detailedAnalysis, recommendations, nextSteps, reasoningChain, reflection, metadata, ...meta } = report
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

  return report
}

/**
 * 生成 Deep Research 报告的 Markdown 内容
 */
function generateDeepResearchMarkdown(report: DeepResearchReport): string {
  const { subject, analysisType, summary, detailedAnalysis, recommendations, nextSteps, reasoningChain, reflection, metadata, reportMetadata } = report
  const generatedDate = new Date(report.generatedAt)

  // 分析类型映射
  const typeNames: Record<string, string> = {
    comprehensive: '综合分析',
    grammar: '语法分析',
    vocabulary: '词汇分析',
    reading: '阅读分析',
    writing: '写作分析'
  }

  const typeName = typeNames[analysisType] || '深度分析'
  const meta = reportMetadata || {}

  let md = `# ${subject}${typeName}报告\n\n`

  // 报告头部 - 丰富的元数据
  md += `## 📋 报告信息\n\n`
  md += `| 项目 | 内容 |\n`
  md += `|------|------|\n`
  md += `| **报告类型** | ${meta.reportType || '学科状态深入分析报告'} |\n`
  md += `| **学科** | ${subject} |\n`
  md += `| **分析类型** | ${typeName} |\n`
  md += `| **生成时间** | ${generatedDate.toLocaleString('zh-CN')} |\n`

  // 试卷时间范围
  if (meta.examTimeRange) {
    const startDate = new Date(meta.examTimeRange.start).toLocaleDateString('zh-CN')
    const endDate = new Date(meta.examTimeRange.end).toLocaleDateString('zh-CN')
    md += `| **试卷时间范围** | ${startDate} ~ ${endDate} |\n`
  }

  // 统计数据
  if (meta.totalQuestions !== undefined) {
    md += `| **题目数量** | ${meta.totalQuestions} 题 |\n`
  }
  if (meta.wrongQuestionsCount !== undefined) {
    md += `| **错题数量** | ${meta.wrongQuestionsCount} 题 |\n`
  }

  // 题目类型
  if (meta.questionTypes && meta.questionTypes.length > 0) {
    md += `| **题目类型** | ${meta.questionTypes.join('、')} |\n`
  }

  // 知识点
  if (meta.knowledgePoints && meta.knowledgePoints.length > 0) {
    md += `| **知识点范围** | ${meta.knowledgePoints.slice(0, 5).join('、')}${meta.knowledgePoints.length > 5 ? ' 等' : ''} |\n`
  }

  // AI 模型
  if (meta.modelName) {
    md += `| **AI 模型** | ${meta.modelName} |\n`
  }

  // 分析耗时
  const analysisDuration = meta.analysisDurationFormatted || `${(report.analysisTime / 1000).toFixed(1)}秒`
  md += `| **分析耗时** | ${analysisDuration} |\n`

  // 置信度
  md += `| **置信度** | ${Math.round(metadata.confidenceLevel * 100)}% |\n`
  md += `| **数据点** | ${metadata.dataPoints} |\n\n`

  md += `---\n\n`

  // 分析摘要
  md += `## 📊 分析摘要\n\n`
  md += `${summary}\n\n`

  md += `---\n\n`

  // 详细分析 - 根据 analysisType 生成不同格式
  md += `## 🔍 详细分析\n\n`

  // 解析 detailedAnalysis
  let parsedAnalysis: any = null
  if (typeof detailedAnalysis === 'string') {
    try {
      parsedAnalysis = JSON.parse(detailedAnalysis)
    } catch {
      parsedAnalysis = null
    }
  } else {
    parsedAnalysis = detailedAnalysis
  }

  if (parsedAnalysis) {
    // 根据分析类型生成不同的格式
    if (analysisType === 'comprehensive') {
      md += formatComprehensiveAnalysis(parsedAnalysis)
    } else if (analysisType === 'grammar') {
      md += formatGrammarAnalysis(parsedAnalysis)
    } else if (analysisType === 'vocabulary') {
      md += formatVocabularyAnalysis(parsedAnalysis)
    } else if (analysisType === 'reading') {
      md += formatReadingAnalysis(parsedAnalysis)
    } else if (analysisType === 'writing') {
      md += formatWritingAnalysis(parsedAnalysis)
    } else {
      // 默认格式：使用美化后的 JSON 显示
      md += formatDefaultAnalysis(parsedAnalysis)
    }
  }

  md += `---\n\n`

  // 改进建议
  if (recommendations && recommendations.length > 0) {
    md += `## 💡 改进建议\n\n`
    recommendations.forEach((rec, i) => {
      md += `${i + 1}. ${rec}\n`
    })
    md += `\n`
  }

  md += `---\n\n`

  // 后续步骤
  if (nextSteps && nextSteps.length > 0) {
    md += `## ➡️ 后续步骤\n\n`
    nextSteps.forEach((step, i) => {
      md += `${i + 1}. ${step}\n`
    })
    md += `\n`
  }

  md += `---\n\n`

  // 推理链（如果有的话）
  if (reasoningChain && reasoningChain.steps && reasoningChain.steps.length > 0) {
    md += `## 🧠 分析推理链\n\n`
    reasoningChain.steps.forEach((step: any, i: number) => {
      md += `### 步骤 ${i + 1}\n\n`
      md += `**思考**: ${step.thought}\n\n`
      if (step.action) md += `**行动**: ${step.action}\n\n`
      if (step.observation) md += `**观察**: ${step.observation}\n\n`
      if (step.nextThought) md += `**下一步**: ${step.nextThought}\n\n`
    })
    md += `**结论**: ${reasoningChain.conclusion}\n\n`
    md += `**置信度**: ${Math.round((reasoningChain.confidence || 0) * 100)}%\n\n`
    md += `---\n\n`
  }

  // 自我反思（如果有的话）
  if (reflection) {
    md += `## 🔄 自我反思\n\n`
    md += `**质量评估**: ${reflection.quality === 'high' ? '✅ 高' : reflection.quality === 'medium' ? '⚠️ 中' : '❌ 低'}\n\n`

    if (reflection.concerns && reflection.concerns.length > 0) {
      md += `**关注点**:\n`
      reflection.concerns.forEach((concern: string) => {
        md += `- ${concern}\n`
      })
      md += `\n`
    }

    if (reflection.improvements && reflection.improvements.length > 0) {
      md += `**改进方向**:\n`
      reflection.improvements.forEach((improvement: string) => {
        md += `- ${improvement}\n`
      })
      md += `\n`
    }

    md += `---\n\n`
  }

  // 报告尾部
  md += `<div align="center">\n`
  md += `  <p>🤖 <strong>本报告由 Deep Research 智能体自动生成</strong></p>\n`
  md += `  <p>📅 生成时间：${generatedDate.toLocaleString('zh-CN')}</p>\n`
  md += `  <p>💡 坚持练习，持续进步！</p>\n`
  md += `</div>`

  return md
}

/**
 * 格式化综合分析
 */
function formatComprehensiveAnalysis(data: any): string {
  let md = ''

  const findings = data.findings
  const diagnosis = data.diagnosis
  const recommendations = data.recommendations

  // 整体评估
  if (findings?.overallAssessment) {
    md += `### 📈 整体评估\n\n`
    const oa = findings.overallAssessment
    md += `| 指标 | 数值 |\n`
    md += `|------|------|\n`
    md += `| **水平评分** | **${oa.level || 'N/A'}/10** |\n`
    md += `| **等级** | ${oa.rank || '-'} |\n`
    md += `| **学习趋势** | ${oa.trend || '-'} |\n\n`
  }

  // 技能分析
  if (findings?.skillAnalysis) {
    md += `### 🎯 技能分析\n\n`
    md += `| 技能 | 评分 | 水平 | 主要问题 |\n`
    md += `|------|------|------|----------|\n`

    const skillNames: Record<string, string> = { grammar: '语法', vocabulary: '词汇', reading: '阅读', writing: '写作' }
    for (const [skill, info] of Object.entries(findings.skillAnalysis)) {
      const infoObj = info as any
      const skillName = skillNames[skill] || skill
      const issues = (infoObj.issues || []).slice(0, 2).join('; ')
      md += `| ${skillName} | ${infoObj.score || '-'}/10 | ${infoObj.level || '-'} | ${issues || '-'} |\n`
    }
    md += `\n`
  }

  // 关键发现
  if (findings?.keyFindings?.length > 0) {
    md += `### 🔑 关键发现\n\n`
    findings.keyFindings.forEach((item: any, i: number) => {
      const emoji = item.significance === '高' ? '🔴' : item.significance === '中' ? '🟡' : '🟢'
      md += `${emoji} **${item.area}**\n\n`
      md += `- **发现**: ${item.finding}\n`
      if (item.evidence) md += `- **证据**: ${item.evidence}\n`
      md += `- **重要性**: ${item.significance}\n\n`
    })
  }

  // 错误模式
  if (findings?.errorPatterns?.length > 0) {
    md += `### 🐛 错误模式分析\n\n`
    findings.errorPatterns.forEach((pattern: any) => {
      md += `#### ${pattern.pattern}\n\n`
      md += `- **频率**: ${pattern.frequency}\n`
      md += `- **根本原因**: ${pattern.rootCause}\n`
      md += `- **影响**: ${pattern.impact}\n\n`
    })
  }

  // 知识缺口
  if (findings?.knowledgeGaps?.length > 0) {
    md += `### 📚 知识缺口分析\n\n`
    findings.knowledgeGaps.forEach((gap: any) => {
      md += `#### ${gap.point}\n\n`
      if (gap.prerequisites?.length > 0) {
        md += `- **前置知识**: ${gap.prerequisites.join(', ')}\n`
      }
      if (gap.affectedAreas?.length > 0) {
        md += `- **影响领域**: ${gap.affectedAreas.join(', ')}\n`
      }
      md += `\n`
    })
  }

  // 诊断结论
  if (diagnosis) {
    md += `### 🏥 诊断结论\n\n`
    if (diagnosis.mainConclusion) {
      md += `**主要结论**: ${diagnosis.mainConclusion}\n\n`
    }
    if (diagnosis.strengths?.length > 0) {
      md += `**优势**:\n`
      diagnosis.strengths.forEach((s: string) => md += `- ${s}\n`)
      md += `\n`
    }
    if (diagnosis.weaknesses?.length > 0) {
      md += `**薄弱点**:\n`
      diagnosis.weaknesses.forEach((w: string) => md += `- ${w}\n`)
      md += `\n`
    }
    if (diagnosis.learningObstacles?.length > 0) {
      md += `**学习障碍**:\n`
      diagnosis.learningObstacles.forEach((o: string) => md += `- ${o}\n`)
      md += `\n`
    }
  }

  // 学习计划
  if (recommendations?.studyPlan?.length > 0) {
    md += `### 📅 学习计划\n\n`
    recommendations.studyPlan.forEach((phase: any) => {
      md += `#### ${phase.phase} (${phase.duration})\n\n`
      if (phase.goals?.length > 0) {
        md += `**目标**:\n`
        phase.goals.forEach((g: string) => md += `- ${g}\n`)
        md += `\n`
      }
      if (phase.actions?.length > 0) {
        md += `**行动**:\n`
        phase.actions.forEach((a: string) => md += `- ${a}\n`)
        md += `\n`
      }
      if (phase.resources?.length > 0) {
        md += `**资源**: ${phase.resources.join(', ')}\n\n`
      }
    })
  }

  return md
}

/**
 * 格式化语法分析
 */
function formatGrammarAnalysis(data: any): string {
  let md = ''

  const grammarAnalysis = data.grammarAnalysis
  if (!grammarAnalysis) return formatDefaultAnalysis(data)

  // 整体水平
  if (grammarAnalysis.overallLevel) {
    md += `### 语法整体水平\n\n`
    md += `**评分**: ${grammarAnalysis.overallLevel}/10\n\n`
  }

  // 错误分布
  if (grammarAnalysis.errorDistribution) {
    md += `### 错误分布\n\n`
    md += `| 错误类型 | 数量 | 占比 |\n`
    md += `|----------|------|------|\n`
    for (const [type, info] of Object.entries(grammarAnalysis.errorDistribution)) {
      const infoObj = info as { count: number; percentage?: number }
      md += `| ${type} | ${infoObj.count} | ${infoObj.percentage || '-'} |\n`
    }
    md += `\n`
  }

  // 主要错误
  if (grammarAnalysis.topErrors?.length > 0) {
    md += `### 主要错误\n\n`
    grammarAnalysis.topErrors.forEach((error: any) => {
      md += `#### ${error.point} (${error.errorCount}题)\n\n`
      md += `- **错误类型**: ${error.errorType}\n`
      md += `- **根本原因**: ${error.rootCause}\n`
      if (error.examples?.length > 0) {
        md += `- **示例**: ${error.examples.slice(0, 2).join(', ')}\n`
      }
      md += `- **影响**: ${error.impact}\n\n`
    })
  }

  // 知识缺口
  if (grammarAnalysis.knowledgeGaps?.length > 0) {
    md += `### 知识缺口\n\n`
    grammarAnalysis.knowledgeGaps.forEach((gap: any) => {
      md += `#### ${gap.point}\n\n`
      if (gap.prerequisites?.length > 0) {
        md += `- 前置知识: ${gap.prerequisites.join(', ')}\n`
      }
      if (gap.affectedPoints?.length > 0) {
        md += `- 受影响: ${gap.affectedPoints.join(', ')}\n`
      }
      md += `\n`
    })
  }

  // 建议
  if (grammarAnalysis.recommendations?.length > 0) {
    md += `### 改进建议\n\n`
    grammarAnalysis.recommendations.forEach((rec: any) => {
      md += `**[${rec.priority || ''}] ${rec.focus}**\n\n`
      md += `- 行动: ${rec.action}\n`
      md += `- 时间: ${rec.timeframe || '-'}\n`
      if (rec.resources?.length > 0) {
        md += `- 资源: ${rec.resources.join(', ')}\n`
      }
      md += `\n`
    })
  }

  return md
}

/**
 * 格式化词汇分析
 */
function formatVocabularyAnalysis(data: any): string {
  let md = ''

  const vocabAnalysis = data.vocabularyAnalysis
  if (!vocabAnalysis) return formatDefaultAnalysis(data)

  // 整体水平
  if (vocabAnalysis.overallLevel) {
    md += `### 词汇整体水平\n\n`
    md += `| 指标 | 数值 |\n`
    md += `|------|------|\n`
    md += `| **评分** | **${vocabAnalysis.overallLevel}/10** |\n`
    if (vocabAnalysis.vocabularySize) {
      md += `| **估算词汇量** | **${vocabAnalysis.vocabularySize}** |\n`
    }
    md += `\n`
  }

  // 错误分布
  if (vocabAnalysis.errorDistribution) {
    md += `### 错误分布\n\n`
    md += `| 错误类型 | 数量 |\n`
    md += `|----------|------|\n`
    for (const [type, count] of Object.entries(vocabAnalysis.errorDistribution)) {
      md += `| ${type} | ${count} |\n`
    }
    md += `\n`
  }

  // 能力评估
  if (vocabAnalysis.abilityAssessment) {
    md += `### 能力评估\n\n`
    const aa = vocabAnalysis.abilityAssessment
    md += `- **广度**: ${aa.breadth || '-'}\n`
    md += `- **深度**: ${aa.depth || '-'}\n`
    md += `- **运用**: ${aa.usage || '-'}\n\n`
  }

  // 学习问题
  if (vocabAnalysis.learningIssues?.length > 0) {
    md += `### 学习问题诊断\n\n`
    vocabAnalysis.learningIssues.forEach((issue: string) => {
      md += `- ${issue}\n`
    })
    md += `\n`
  }

  // 建议
  if (vocabAnalysis.recommendations?.length > 0) {
    md += `### 改进建议\n\n`
    vocabAnalysis.recommendations.forEach((rec: any) => {
      md += `#### ${rec.method}\n\n`
      md += `${rec.description}\n\n`
      if (rec.dailyPlan) {
        md += `**每日计划**: ${rec.dailyPlan}\n\n`
      }
    })
  }

  return md
}

/**
 * 格式化阅读分析
 */
function formatReadingAnalysis(data: any): string {
  let md = ''

  const readingAnalysis = data.readingAnalysis
  if (!readingAnalysis) return formatDefaultAnalysis(data)

  // 整体水平
  if (readingAnalysis.overallLevel) {
    md += `### 阅读整体水平\n\n`
    md += `**评分**: ${readingAnalysis.overallLevel}/10\n\n`
  }

  // 技能评估
  if (readingAnalysis.skillAssessment) {
    md += `### 技能评估\n\n`
    md += `| 技能 | 水平 |\n`
    md += `|------|------|\n`
    const sa = readingAnalysis.skillAssessment
    md += `| 略读 | ${sa.skimming || '-'} |\n`
    md += `| 扫读 | ${sa.scanning || '-'} |\n`
    md += `| 细读 | ${sa.intensiveReading || '-'} |\n`
    md += `| 推理 | ${sa.inference || '-'} |\n\n`
  }

  // 错误模式
  if (readingAnalysis.errorPatterns?.length > 0) {
    md += `### 错误模式\n\n`
    readingAnalysis.errorPatterns.forEach((pattern: any) => {
      md += `- **${pattern.type}**: ${pattern.frequency} - ${pattern.cause}\n`
    })
    md += `\n`
  }

  // 主要障碍
  if (readingAnalysis.mainBarriers?.length > 0) {
    md += `### 主要障碍\n\n`
    readingAnalysis.mainBarriers.forEach((barrier: string) => {
      md += `- ${barrier}\n`
    })
    md += `\n`
  }

  return md
}

/**
 * 格式化写作分析
 */
function formatWritingAnalysis(data: any): string {
  let md = ''

  const writingAnalysis = data.writingAnalysis
  if (!writingAnalysis) return formatDefaultAnalysis(data)

  // 整体水平
  if (writingAnalysis.overallLevel) {
    md += `### 写作整体水平\n\n`
    md += `**评分**: ${writingAnalysis.overallLevel}/10\n\n`
  }

  // 问题分类
  if (writingAnalysis.problemCategories) {
    md += `### 问题分类统计\n\n`
    md += `| 类别 | 数量 |\n`
    md += `|------|------|\n`
    const pc = writingAnalysis.problemCategories
    md += `| 句子结构 | ${pc.sentenceStructure || 0} |\n`
    md += `| 语法 | ${pc.grammar || 0} |\n`
    md += `| 词汇 | ${pc.vocabulary || 0} |\n`
    md += `| 衔接连贯 | ${pc.cohesion || 0} |\n`
    md += `| 内容组织 | ${pc.organization || 0} |\n\n`
  }

  // 能力评估
  if (writingAnalysis.abilityAssessment) {
    md += `### 能力评估\n\n`
    const aa = writingAnalysis.abilityAssessment
    md += `- **句式多样性**: ${aa.sentenceVariety || '-'}\n`
    md += `- **语法准确性**: ${aa.grammarAccuracy || '-'}\n`
    md += `- **词汇丰富度**: ${aa.vocabularyRichness || '-'}\n`
    md += `- **连贯性**: ${aa.coherence || '-'}\n\n`
  }

  // 主要问题
  if (writingAnalysis.mainIssues?.length > 0) {
    md += `### 主要问题\n\n`
    writingAnalysis.mainIssues.forEach((issue: string) => {
      md += `- ${issue}\n`
    })
    md += `\n`
  }

  return md
}

/**
 * 默认格式（美化后的缩进列表）
 */
function formatDefaultAnalysis(data: any): string {
  let md = ''

  function formatValue(key: string, value: any, indent: number = 0): string {
    const prefix = '  '.repeat(indent)
    let result = ''

    if (value === null || value === undefined) {
      return `${prefix}- **${key}**: (空)\n`
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      result += `${prefix}### ${key}\n\n`
      for (const [k, v] of Object.entries(value)) {
        result += formatValue(k, v, indent + 1)
      }
    } else if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object') {
        result += `${prefix}**${key}**:\n\n`
        value.forEach((item, idx) => {
          result += `${prefix}  ${idx + 1}.\n`
          for (const [k, v] of Object.entries(item)) {
            result += formatValue(k, v, indent + 2)
          }
        })
      } else {
        result += `${prefix}- **${key}**: ${value.join(', ') || '(空)'}\n`
      }
    } else {
      result += `${prefix}- **${key}**: ${value}\n`
    }

    return result
  }

  for (const [key, value] of Object.entries(data)) {
    md += formatValue(key, value, 0)
    md += '\n'
  }

  return md
}

/**
 * 获取某个学科的所有深度分析报告
 */
export async function getDeepResearchReports(subject: string): Promise<DeepResearchReport[]> {
  await ensureReportsDir()

  const reports: DeepResearchReport[] = []
  const subjectId = await getSubjectIdByName(subject)
  const subjectDir = path.join(REPORTS_DIR, subjectId)

  try {
    await fs.access(subjectDir)
  } catch {
    // 目录不存在，返回空数组
    return reports
  }

  const entries = await fs.readdir(subjectDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (!entry.name.startsWith('deepresearch-')) continue

    const reportDir = path.join(subjectDir, entry.name)
    const metaPath = path.join(reportDir, 'meta.json')
    const mdPath = path.join(reportDir, 'report.md')

    try {
      const [metaContent, mdContent] = await Promise.all([
        fs.readFile(metaPath, 'utf-8'),
        fs.readFile(mdPath, 'utf-8')
      ])

      reports.push({
        ...JSON.parse(metaContent),
        summary: JSON.parse(metaContent).summary,
        content: mdContent
      })
    } catch (error) {
      console.error(`Failed to read deep research report ${entry.name}:`, error)
    }
  }

  return reports.sort((a, b) => {
    return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  })
}

/**
 * 获取单个深度分析报告
 */
export async function getDeepResearchReport(subject: string, reportId: string): Promise<DeepResearchReport | null> {
  await ensureReportsDir()

  const subjectId = await getSubjectIdByName(subject)
  const reportDir = path.join(REPORTS_DIR, subjectId, reportId)

  try {
    const metaPath = path.join(reportDir, 'meta.json')
    const mdPath = path.join(reportDir, 'report.md')

    const [metaContent, mdContent] = await Promise.all([
      fs.readFile(metaPath, 'utf-8'),
      fs.readFile(mdPath, 'utf-8')
    ])

    return {
      ...JSON.parse(metaContent),
      content: mdContent
    }
  } catch (error) {
    console.error(`Failed to read deep research report ${reportId}:`, error)
    return null
  }
}
