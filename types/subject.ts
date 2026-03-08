// 学科配置
export interface Subject {
  id: string
  name: string
  icon: string
  color: string
  enabled: boolean
  category: "理科" | "文科" | "其他"
}

// 默认学科列表
export const DEFAULT_SUBJECTS: Subject[] = [
  { id: "math", name: "数学", icon: "📐", color: "blue", enabled: true, category: "理科" },
  { id: "algebra", name: "代数", icon: "🔢", color: "blue", enabled: false, category: "理科" },
  { id: "geometry", name: "几何", icon: "📐", color: "blue", enabled: false, category: "理科" },
  { id: "chinese", name: "语文", icon: "📖", color: "red", enabled: true, category: "文科" },
  { id: "english", name: "英语", icon: "🔤", color: "purple", enabled: true, category: "文科" },
  { id: "physics", name: "物理", icon: "⚛️", color: "orange", enabled: false, category: "理科" },
  { id: "chemistry", name: "化学", icon: "🧪", color: "green", enabled: false, category: "理科" },
  { id: "biology", name: "生物", icon: "🧬", color: "lime", enabled: true, category: "理科" },
  { id: "history", name: "历史", icon: "📜", color: "amber", enabled: true, category: "文科" },
  { id: "geography", name: "地理", icon: "🌍", color: "cyan", enabled: true, category: "文科" },
  { id: "politics", name: "道法", icon: "⚖️", color: "indigo", enabled: true, category: "文科" },
  { id: "politics2", name: "政治", icon: "🏛️", color: "indigo", enabled: false, category: "文科" },
]

// 本地存储 key
const SUBJECTS_STORAGE_KEY = "aitutor_subjects"

// 获取学科配置
export function getSubjects(): Subject[] {
  if (typeof window === "undefined") return DEFAULT_SUBJECTS

  try {
    const stored = localStorage.getItem(SUBJECTS_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error("Failed to load subjects:", e)
  }

  return DEFAULT_SUBJECTS
}

// 保存学科配置
export function saveSubjects(subjects: Subject[]): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(subjects))
  } catch (e) {
    console.error("Failed to save subjects:", e)
  }
}

// 获取启用的学科
export function getEnabledSubjects(): Subject[] {
  return getSubjects().filter(s => s.enabled)
}

// 根据 ID 获取学科
export function getSubjectById(id: string): Subject | undefined {
  return getSubjects().find(s => s.id === id)
}

// 切换学科启用状态
export function toggleSubject(id: string): void {
  const subjects = getSubjects()
  const index = subjects.findIndex(s => s.id === id)
  if (index !== -1) {
    subjects[index].enabled = !subjects[index].enabled
    saveSubjects(subjects)
  }
}

// 重置为默认配置
export function resetSubjects(): void {
  saveSubjects(DEFAULT_SUBJECTS)
}

// 根据名称查找学科（支持模糊匹配和别名）
export function getSubjectByName(name: string): Subject | undefined {
  const allSubjects = getSubjects()

  // 精确匹配
  let subject = allSubjects.find(s => s.name === name)
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
    return allSubjects.find(s => s.id === mappedId)
  }

  // 模糊匹配
  return allSubjects.find(s => name.includes(s.name) || s.name.includes(name))
}

// 获取学科图标（带默认值）
export function getSubjectIcon(name: string): string {
  const subject = getSubjectByName(name)
  return subject?.icon || "📚"
}
