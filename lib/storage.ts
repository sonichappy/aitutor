import fs from 'fs/promises'
import path from 'path'

// 数据存储根目录
const DATA_DIR = path.join(process.cwd(), 'data')
const EXAMS_DIR = path.join(DATA_DIR, 'exams')

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
}

export interface ExamData {
  id: string
  userId: string
  subject: string
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

// 保存试卷数据
export async function saveExamData(examId: string, data: ExamData) {
  await initStorage()
  const examDir = path.join(EXAMS_DIR, examId)
  await ensureDir(examDir)

  // 更新时间戳
  data.updatedAt = new Date().toISOString()

  // 保存数据文件
  const dataPath = path.join(examDir, 'data.json')
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8')

  return data
}

// 读取试卷数据
export async function getExamData(examId: string): Promise<ExamData | null> {
  try {
    const dataPath = path.join(EXAMS_DIR, examId, 'data.json')
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
  try {
    const dataPath = path.join(EXAMS_DIR, examId, 'data.json')
    await fs.access(dataPath)
    return true
  } catch {
    return false
  }
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
  const examDir = path.join(EXAMS_DIR, examId)
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
    const examDir = path.join(EXAMS_DIR, examId)

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
    const examDir = path.join(EXAMS_DIR, examId)
    await fs.rm(examDir, { recursive: true, force: true })
  } catch {
    // 忽略删除错误
  }
}

// 获取用户的所有试卷
export async function getUserExams(userId: string): Promise<ExamData[]> {
  await initStorage()
  const exams: ExamData[] = []

  try {
    const examDirs = await fs.readdir(EXAMS_DIR)
    for (const examId of examDirs) {
      const data = await getExamData(examId)
      if (data && data.userId === userId) {
        exams.push(data)
      }
    }
  } catch {
    // 忽略错误
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
