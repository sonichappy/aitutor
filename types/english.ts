/**
 * 英语单词类型定义
 */

export interface EnglishWord {
  id: string
  userId: string
  word: string
  phonetic?: string
  partOfSpeech?: string
  meanings: string // JSON string: [{"part": "n.", "meaning": "苹果"}]
  definitions?: string // JSON string
  exampleSentences?: string // JSON string
  category?: string
  tags: string[]
  source?: string
  masteryLevel: number
  reviewCount: number
  correctCount: number
  nextReviewAt?: string
  lastReviewedAt?: string
  easeFactor: number
  interval: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface WordMeaning {
  part: string // 词性
  meaning: string // 中文释义
}

export interface WordExample {
  sentence: string // 英文例句
  translation: string // 中文翻译
}

export interface GrammarPoint {
  id: string
  userId: string
  title: string
  category: string
  level: string
  explanation: string
  formulas?: string
  examples?: string // JSON string
  commonErrors?: string
  notes?: string
  relatedWords: string[]
  masteryLevel: number
  practiceCount: number
  status: string
}

export interface GrammarExample {
  sentence: string
  translation: string
  highlight?: string // 要高亮的部分
}

// 单词分类
export const WORD_CATEGORIES = [
  { value: "课本", label: "课本单词" },
  { value: "中考", label: "中考词汇" },
  { value: "高考", label: "高考词汇" },
  { value: "四六级", label: "四六级" },
  { value: "托福", label: "托福" },
  { value: "雅思", label: "雅思" },
  { value: "日常", label: "日常用语" },
]

// 语法分类
export const GRAMMAR_CATEGORIES = [
  { value: "时态", label: "时态", subcategories: ["一般现在时", "一般过去时", "一般将来时", "现在进行时", "过去进行时", "现在完成时", "过去完成时"] },
  { value: "语态", label: "语态", subcategories: ["被动语态"] },
  { value: "从句", label: "从句", subcategories: ["定语从句", "状语从句", "名词性从句", "宾语从句", "主语从句", "表语从句", "同位语从句"] },
  { value: "非谓语", label: "非谓语动词", subcategories: ["不定式", "动名词", "分词"] },
  { value: "虚拟语气", label: "虚拟语气" },
  { value: "情态动词", label: "情态动词" },
  { value: "介词", label: "介词" },
  { value: "冠词", label: "冠词" },
  { value: "连词", label: "连词" },
  { value: "句子结构", label: "句子结构", subcategories: ["简单句", "并列句", "复合句", "复杂句"] },
]

// 语法难度
export const GRAMMAR_LEVELS = [
  { value: "初级", label: "初级" },
  { value: "中级", label: "中级" },
  { value: "高级", label: "高级" },
]

// 词性
export const PARTS_OF_SPEECH = [
  { value: "n.", label: "名词" },
  { value: "v.", label: "动词" },
  { value: "adj.", label: "形容词" },
  { value: "adv.", label: "副词" },
  { value: "pron.", label: "代词" },
  { value: "prep.", label: "介词" },
  { value: "conj.", label: "连词" },
  { value: "art.", label: "冠词" },
  { value: "int.", label: "感叹词" },
]
