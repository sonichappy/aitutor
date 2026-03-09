// 服务器端学科匹配工具
// 此文件仅用于服务器端，使用了 Node.js 的 fs 模块

import { type Subject } from "@/types/subject"

// 默认学科列表
const DEFAULT_SUBJECTS: Subject[] = [
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

// 从文件系统读取学科配置
export async function loadSubjectsFromFile(): Promise<Subject[]> {
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

// 根据学科名称获取文件夹名称
export function getSubjectFolderName(subjectName: string): string {
  const subject = DEFAULT_SUBJECTS.find(s => s.name === subjectName)
  return subject?.folderName || subjectName.toLowerCase().replace(/\s+/g, '-')
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
  questionContext?: string,
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
