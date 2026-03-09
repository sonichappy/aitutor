// 学科配置
export interface Subject {
  id: string
  name: string
  icon: string
  color: string
  enabled: boolean
  category: "理科" | "文科" | "其他"
  folderName: string  // 英文文件夹名称，用于存储数据
  reportPrompt?: string  // 自定义报告提示词（可选）
}

// 默认报告提示词模板
// 支持占位符：{subject} - 学科名称，{wrongQuestionsData} - 错题JSON数据

// 理科默认报告提示词
export const DEFAULT_SCIENCE_REPORT_PROMPT = `请作为资深教研员，对我提供的这些{subject}错题进行聚类分析。请不要逐题解析，而是产出以下维度的报告：

**错题数据：**
{wrongQuestionsData}

**请按以下格式输出JSON：**
{
  "knowledgeMatrix": {
    "description": "知识点覆盖矩阵",
    "topWeakPoints": [
      {"point": "二级知识点名称", "errorRate": 85, "count": 6}
    ]
  },
  "abilityAssessment": {
    "description": "能力维度评估",
    "mainIssue": "计算准确性|概念理解偏差|逻辑推理漏洞|实验分析能力弱",
    "analysis": "详细分析..."
  },
  "errorPatterns": {
    "description": "错误模式挖掘",
    "patterns": ["计算步骤错误", "公式应用错误", "单位换算错误"]
  },
  "prediction": {
    "description": "潜能与风险预判",
    "nextChapterRisks": ["可能遇到的学习障碍"],
    "recommendations": ["针对性建议"]
  }
}

请严格按照JSON格式输出，不要包含其他文字。`

// 文科默认报告提示词
export const DEFAULT_LIBERAL_ARTS_REPORT_PROMPT = `请作为资深教研员，对我提供的这些{subject}错题进行聚类分析。请不要逐题解析，而是产出以下维度的报告：

**错题数据：**
{wrongQuestionsData}

**请按以下格式输出JSON：**
{
  "knowledgeMatrix": {
    "description": "知识点覆盖矩阵",
    "topWeakPoints": [
      {"point": "二级知识点名称", "errorRate": 85, "count": 6}
    ]
  },
  "abilityAssessment": {
    "description": "能力维度评估",
    "mainIssue": "基础识记模糊|材料理解偏差|逻辑分析能力弱|语言表达不准确",
    "analysis": "详细分析..."
  },
  "errorPatterns": {
    "description": "错误模式挖掘",
    "patterns": ["知识点记忆错误", "材料理解偏差", "答题要点遗漏"]
  },
  "prediction": {
    "description": "潜能与风险预判",
    "nextChapterRisks": ["可能遇到的学习障碍"],
    "recommendations": ["针对性建议"]
  }
}

请严格按照JSON格式输出，不要包含其他文字。`

// 获取学科默认报告提示词
export function getDefaultReportPrompt(subject?: Subject): string {
  if (!subject) {
    return DEFAULT_SCIENCE_REPORT_PROMPT
  }
  if (subject.category === "理科") {
    return DEFAULT_SCIENCE_REPORT_PROMPT
  } else if (subject.category === "文科") {
    return DEFAULT_LIBERAL_ARTS_REPORT_PROMPT
  }
  return DEFAULT_SCIENCE_REPORT_PROMPT  // 默认使用理科模板
}

// 默认学科列表
export const DEFAULT_SUBJECTS: Subject[] = [
  { id: "math", name: "数学", icon: "📐", color: "blue", enabled: true, category: "理科", folderName: "math" },
  { id: "algebra", name: "代数", icon: "🔢", color: "blue", enabled: false, category: "理科", folderName: "algebra" },
  { id: "geometry", name: "几何", icon: "📐", color: "blue", enabled: false, category: "理科", folderName: "geometry" },
  { id: "chinese", name: "语文", icon: "📖", color: "red", enabled: true, category: "文科", folderName: "chinese" },
  { id: "english", name: "英语", icon: "🔤", color: "purple", enabled: true, category: "文科", folderName: "english" },
  { id: "physics", name: "物理", icon: "⚛️", color: "orange", enabled: false, category: "理科", folderName: "physics" },
  { id: "chemistry", name: "化学", icon: "🧪", color: "green", enabled: false, category: "理科", folderName: "chemistry" },
  { id: "biology", name: "生物", icon: "🧬", color: "lime", enabled: true, category: "理科", folderName: "biology" },
  { id: "history", name: "历史", icon: "📜", color: "amber", enabled: true, category: "文科", folderName: "history" },
  { id: "geography", name: "地理", icon: "🌍", color: "cyan", enabled: true, category: "文科", folderName: "geography" },
  { id: "politics", name: "道法", icon: "⚖️", color: "indigo", enabled: true, category: "文科", folderName: "politics" },
  { id: "politics2", name: "政治", icon: "🏛️", color: "indigo", enabled: false, category: "文科", folderName: "politics2" },
]

// 从 API 获取学科配置
async function fetchSubjects(): Promise<Subject[]> {
  try {
    const response = await fetch("/api/subjects")
    if (response.ok) {
      const data = await response.json()
      return data.subjects || DEFAULT_SUBJECTS
    }
  } catch (error) {
    console.error("Failed to fetch subjects from API:", error)
  }
  return DEFAULT_SUBJECTS
}

// 缓存学科配置
let subjectsCache: Subject[] | null = null

// 获取学科配置
export async function getSubjects(): Promise<Subject[]> {
  if (typeof window === "undefined") return DEFAULT_SUBJECTS

  // 如果有缓存，直接返回
  if (subjectsCache) {
    return subjectsCache
  }

  // 从 API 获取
  subjectsCache = await fetchSubjects()
  return subjectsCache
}

// 保存学科配置到服务器
export async function saveSubjects(subjects: Subject[]): Promise<void> {
  if (typeof window === "undefined") return

  try {
    const response = await fetch("/api/subjects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjects }),
    })

    if (response.ok) {
      // 更新缓存
      subjectsCache = subjects
    } else {
      throw new Error("保存失败")
    }
  } catch (error) {
    console.error("Failed to save subjects:", error)
    throw error
  }
}

// 获取启用的学科
export async function getEnabledSubjects(): Promise<Subject[]> {
  const subjects = await getSubjects()
  return subjects.filter(s => s.enabled)
}

// 根据 ID 获取学科
export async function getSubjectById(id: string): Promise<Subject | undefined> {
  const subjects = await getSubjects()
  return subjects.find(s => s.id === id)
}

// 根据名称查找学科（支持模糊匹配和别名）
export async function getSubjectByName(name: string): Promise<Subject | undefined> {
  // 服务器端：直接从文件读取
  if (typeof window === "undefined") {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const subjectsFile = path.join(process.cwd(), 'data', 'subjects.json')
      const content = await fs.readFile(subjectsFile, 'utf-8')
      const data = JSON.parse(content)
      const subjects: Subject[] = data.subjects || []

      // 精确匹配
      let subject = subjects.find(s => s.name === name)
      if (subject) return subject

      // 别名映射
      const aliases: Record<string, string> = {
        "数学": "math",
        "代数": "algebra",
        "几何": "geometry",
        "语文": "chinese",
        "英语": "english",
        "物理": "physics",
        "化学": "chemistry",
        "生物": "biology",
        "历史": "history",
        "地理": "geography",
        "道法": "politics",
        "政治": "politics2",
        "思想品德": "politics",
      }

      const mappedId = aliases[name]
      if (mappedId) {
        return subjects.find(s => s.id === mappedId)
      }

      // 模糊匹配
      return subjects.find(s => name.includes(s.name) || s.name.includes(name))
    } catch (error) {
      console.error("[getSubjectByName] Server-side read failed:", error)
    }
    return DEFAULT_SUBJECTS.find(s => s.name === name)
  }

  // 客户端：使用缓存和 fetch
  const subjects = await getSubjects()

  // 精确匹配
  let subject = subjects.find(s => s.name === name)
  if (subject) return subject

  // 别名映射
  const aliases: Record<string, string> = {
    "数学": "math",
    "代数": "algebra",
    "几何": "geometry",
    "语文": "chinese",
    "英语": "english",
    "物理": "physics",
    "化学": "chemistry",
    "生物": "biology",
    "历史": "history",
    "地理": "geography",
    "道法": "politics",
    "政治": "politics2",
    "思想品德": "politics",
  }

  const mappedId = aliases[name]
  if (mappedId) {
    return subjects.find(s => s.id === mappedId)
  }

  // 模糊匹配
  return subjects.find(s => name.includes(s.name) || s.name.includes(name))
}

// 切换学科启用状态
export async function toggleSubject(id: string): Promise<void> {
  const subjects = await getSubjects()
  const index = subjects.findIndex(s => s.id === id)
  if (index !== -1) {
    subjects[index].enabled = !subjects[index].enabled
    await saveSubjects(subjects)
  }
}

// 重置为默认配置
export async function resetSubjects(): Promise<void> {
  await saveSubjects(DEFAULT_SUBJECTS)
}

// 清除缓存（用于测试）
export function clearSubjectsCache(): void {
  subjectsCache = null
}

// 获取学科图标（带默认值）- 同步版本，用于快速获取
export function getSubjectIcon(name: string, subjects?: Subject[]): string {
  if (subjects) {
    const subject = subjects.find(s => s.name === name)
    return subject?.icon || "📚"
  }

  // 同步回退：检查默认学科列表
  const subject = DEFAULT_SUBJECTS.find(s => s.name === name)
  return subject?.icon || "📚"
}

// 根据学科名称获取文件夹名称（同步版本）
export function getSubjectFolderName(subjectName: string): string {
  const subject = DEFAULT_SUBJECTS.find(s => s.name === subjectName)
  return subject?.folderName || subjectName.toLowerCase().replace(/\s+/g, '-')
}

// 根据学科ID获取文件夹名称
export function getFolderNameById(subjectId: string): string {
  const subject = DEFAULT_SUBJECTS.find(s => s.id === subjectId)
  return subject?.folderName || subjectId
}

// 根据文件夹名称获取学科
export function getSubjectByFolderName(folderName: string): Subject | undefined {
  return DEFAULT_SUBJECTS.find(s => s.folderName === folderName)
}

// ========== 服务器端学科匹配函数 ==========

// 从文件系统读取学科配置（服务器端专用）
async function loadSubjectsFromFile(): Promise<Subject[]> {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const subjectsFile = path.join(process.cwd(), 'data', 'subjects.json')
    const content = await fs.readFile(subjectsFile, 'utf-8')
    const data = JSON.parse(content)
    return data.subjects || DEFAULT_SUBJECTS
  } catch (error) {
    console.error("[loadSubjectsFromFile] Failed to load subjects:", error)
    return DEFAULT_SUBJECTS
  }
}

// 学科别名映射（用于智能匹配）
const SUBJECT_ALIASES: Record<string, string[]> = {
  "math": ["数学", "math", "mathematics"],
  "algebra": ["代数", "algebra"],
  "geometry": ["几何", "geometry"],
  "chinese": ["语文", "chinese", "语文作文"],
  "english": ["英语", "english", "english作文", "英语写作"],
  "physics": ["物理", "physics"],
  "chemistry": ["化学", "chemistry"],
  "biology": ["生物", "biology"],
  "history": ["历史", "history"],
  "geography": ["地理", "geography"],
  "politics": ["道法", "政治", "思想品德", "politics", "politics2"],
}

// 智能匹配学科（服务器端）
// 将AI检测到的学科名称匹配到用户配置的已启用学科
export async function matchSubjectToIntelligent(
  detectedSubject: string,
  questionContext?: string,  // 题目内容，用于更精确的判断
  userSelectedFolder?: string
): Promise<{ folderName: string; matchedSubject?: Subject }> {
  // 1. 首先尝试精确匹配用户配置的已启用学科
  const allSubjects = await loadSubjectsFromFile()
  const enabledSubjects = allSubjects.filter(s => s.enabled)

  // 标准化检测到的学科名称（去除空格、转小写）
  const normalizedDetected = detectedSubject.trim().toLowerCase()

  // 2. 特殊处理：如果识别出"数学"但没有单独的数学学科，需要根据内容判断是代数还是几何
  if (normalizedDetected === "数学" || normalizedDetected === "math" || normalizedDetected === "mathematics") {
    // 检查是否有单独的数学学科
    const mathSubject = enabledSubjects.find(s => s.id === "math")
    if (!mathSubject) {
      // 没有单独的数学学科，需要判断是代数还是几何
      const hasGeometry = enabledSubjects.some(s => s.id === "geometry")
      const hasAlgebra = enabledSubjects.some(s => s.id === "algebra")

      if (hasGeometry && hasAlgebra && questionContext) {
        // 根据题目内容判断
        const lowerContext = questionContext.toLowerCase()
        const geometryKeywords = [
          "三角形", "四边形", "圆", "角度", "平行", "垂直", "相似", "全等",
          "triangle", "angle", "parallel", "perpendicular", "similar", "congruent",
          "几何", "图形", "证明", "作图", "尺规", "坐标", "向量", "旋转", "对称"
        ]
        const algebraKeywords = [
          "方程", "不等式", "函数", "因式分解", "分式", "根式", "代数",
          "equation", "inequality", "function", "factor", "algebraic",
          "未知数", "求解", "化简", "代数式"
        ]

        const geometryScore = geometryKeywords.filter(kw => lowerContext.includes(kw)).length
        const algebraScore = algebraKeywords.filter(kw => lowerContext.includes(kw)).length

        console.log(`[matchSubject] Math subject detected - geometry score: ${geometryScore}, algebra score: ${algebraScore}`)

        if (geometryScore > algebraScore) {
          const geometrySubject = enabledSubjects.find(s => s.id === "geometry")!
          console.log(`[matchSubject] Matched to geometry based on content analysis`)
          return { folderName: geometrySubject.folderName, matchedSubject: geometrySubject }
        } else if (algebraScore > geometryScore) {
          const algebraSubject = enabledSubjects.find(s => s.id === "algebra")!
          console.log(`[matchSubject] Matched to algebra based on content analysis`)
          return { folderName: algebraSubject.folderName, matchedSubject: algebraSubject }
        }
      }

      // 默认优先使用几何（因为通常几何题更明显）
      if (hasGeometry) {
        const geometrySubject = enabledSubjects.find(s => s.id === "geometry")!
        console.log(`[matchSubject] Math detected, defaulting to geometry`)
        return { folderName: geometrySubject.folderName, matchedSubject: geometrySubject }
      }
      if (hasAlgebra) {
        const algebraSubject = enabledSubjects.find(s => s.id === "algebra")!
        console.log(`[matchSubject] Math detected, using algebra`)
        return { folderName: algebraSubject.folderName, matchedSubject: algebraSubject }
      }
    }
  }

  // 3. 尝试通过别名匹配
  for (const subject of enabledSubjects) {
    const aliases = SUBJECT_ALIASES[subject.id] || []
    if (aliases.some(alias => alias.toLowerCase() === normalizedDetected)) {
      console.log(`[matchSubject] Matched "${detectedSubject}" to enabled subject: ${subject.name} (${subject.folderName})`)
      return { folderName: subject.folderName, matchedSubject: subject }
    }
  }

  // 4. 尝试精确匹配中文名称
  const nameMatch = enabledSubjects.find(s => s.name === detectedSubject)
  if (nameMatch) {
    console.log(`[matchSubject] Matched "${detectedSubject}" by exact name: ${nameMatch.name} (${nameMatch.folderName})`)
    return { folderName: nameMatch.folderName, matchedSubject: nameMatch }
  }

  // 5. 尝试模糊匹配（包含关系）
  const fuzzyMatch = enabledSubjects.find(s =>
    normalizedDetected.includes(s.name.toLowerCase()) ||
    s.name.toLowerCase().includes(normalizedDetected)
  )
  if (fuzzyMatch) {
    console.log(`[matchSubject] Matched "${detectedSubject}" by fuzzy match: ${fuzzyMatch.name} (${fuzzyMatch.folderName})`)
    return { folderName: fuzzyMatch.folderName, matchedSubject: fuzzyMatch }
  }

  // 6. 如果有用户选择的学科，使用它作为后备
  if (userSelectedFolder) {
    const userSelected = enabledSubjects.find(s => s.folderName === userSelectedFolder)
    if (userSelected) {
      console.log(`[matchSubject] Using user-selected subject: ${userSelected.name} (${userSelected.folderName})`)
      return { folderName: userSelected.folderName, matchedSubject: userSelected }
    }
  }

  // 7. 最后的后备：使用第一个已启用学科
  if (enabledSubjects.length > 0) {
    const firstSubject = enabledSubjects[0]
    console.log(`[matchSubject] No match found, using first enabled subject: ${firstSubject.name} (${firstSubject.folderName})`)
    return { folderName: firstSubject.folderName, matchedSubject: firstSubject }
  }

  // 8. 如果没有任何已启用学科，使用默认处理
  console.log(`[matchSubject] No enabled subjects, using default folder name for: ${detectedSubject}`)
  return { folderName: getSubjectFolderName(detectedSubject) }
}
