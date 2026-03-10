/**
 * 英语学科知识图谱
 *
 * 包含语法、词汇、阅读、写作等核心知识点及其关联关系
 */

import type { EnglishKnowledgeGraph, EnglishKnowledgeGraphNode, EnglishKnowledgeGraphEdge } from '@/lib/agent/types'

// ============================================
// 知识节点
// ============================================

const grammarNodes: EnglishKnowledgeGraphNode[] = [
  // 时态
  { id: 'tense_present_simple', name: '一般现在时', category: 'grammar', level: 'basic', description: '表示经常性动作、客观真理', dependencies: [] },
  { id: 'tense_present_continuous', name: '现在进行时', category: 'grammar', level: 'basic', description: '表示正在进行的动作', dependencies: ['tense_present_simple'] },
  { id: 'tense_present_perfect', name: '现在完成时', category: 'grammar', level: 'intermediate', description: '表示过去发生的动作对现在的影响', dependencies: ['tense_present_simple'] },
  { id: 'tense_present_perfect_continuous', name: '现在完成进行时', category: 'grammar', level: 'intermediate', description: '表示从过去开始持续到现在的动作', dependencies: ['tense_present_perfect'] },
  { id: 'tense_past_simple', name: '一般过去时', category: 'grammar', level: 'basic', description: '表示过去发生的动作', dependencies: ['tense_present_simple'] },
  { id: 'tense_past_continuous', name: '过去进行时', category: 'grammar', level: 'intermediate', description: '表示过去某个时刻正在进行的动作', dependencies: ['tense_past_simple', 'tense_present_continuous'] },
  { id: 'tense_past_perfect', name: '过去完成时', category: 'grammar', level: 'intermediate', description: '表示过去某个时间之前完成的动作', dependencies: ['tense_past_simple'] },
  { id: 'tense_future_simple', name: '一般将来时', category: 'grammar', level: 'basic', description: '表示将来发生的动作', dependencies: ['tense_present_simple'] },
  { id: 'tense_future_continuous', name: '将来进行时', category: 'grammar', level: 'intermediate', description: '表示将来某个时刻正在进行的动作', dependencies: ['tense_future_simple'] },
  { id: 'tense_future_perfect', name: '将来完成时', category: 'grammar', level: 'advanced', description: '表示将来某个时间之前完成的动作', dependencies: ['tense_future_simple'] },

  // 从句
  { id: 'clause_attribute', name: '定语从句', category: 'grammar', level: 'intermediate', description: '修饰名词或代词的从句', dependencies: ['sentence_structure_basic'] },
  { id: 'clause_adverbial', name: '状语从句', category: 'grammar', level: 'intermediate', description: '作状语的从句', dependencies: ['sentence_structure_basic'] },
  { id: 'clause_noun', name: '名词性从句', category: 'grammar', level: 'intermediate', description: '起名词作用的从句', dependencies: ['sentence_structure_basic'] },
  { id: 'clause_non_restrictive', name: '非限制性定语从句', category: 'grammar', level: 'advanced', description: '补充说明而非必需的定语从句', dependencies: ['clause_attribute'] },

  // 非谓语动词
  { id: 'non_finite_infinitive', name: '不定式', category: 'grammar', level: 'intermediate', description: 'to do 形式的非谓语动词', dependencies: ['verb_basic'] },
  { id: 'non_finite_gerund', name: '动名词', category: 'grammar', level: 'intermediate', description: 'ving 形式作名词用', dependencies: ['verb_basic'] },
  { id: 'non_finite_participle_present', name: '现在分词', category: 'grammar', level: 'intermediate', description: 'ving 形式作形容词/副词用', dependencies: ['verb_basic'] },
  { id: 'non_finite_participle_past', name: '过去分词', category: 'grammar', level: 'intermediate', description: 'ved 形式表示完成/被动', dependencies: ['verb_basic', 'tense_past_perfect'] },

  // 虚拟语气
  { id: 'mood_subjunctive_condition', name: '条件状语从句虚拟语气', category: 'grammar', level: 'advanced', description: '表示非真实条件的虚拟语气', dependencies: ['tense_past_perfect', 'tense_future_simple'] },
  { id: 'mood_subjunctive_wish', name: 'wish 虚拟语气', category: 'grammar', level: 'advanced', description: '表示愿望的虚拟语气', dependencies: ['tense_past_perfect'] },
  { id: 'mood_subjunctive_suggestion', name: '建议类虚拟语气', category: 'grammar', level: 'intermediate', description: 'suggest/demand 等后的虚拟语气', dependencies: ['clause_noun'] },

  // 被动语态
  { id: 'voice_passive_basic', name: '被动语态基本用法', category: 'grammar', level: 'basic', description: 'be done 结构', dependencies: ['tense_past_simple'] },
  { id: 'voice_passive_complex', name: '被动语态复杂用法', category: 'grammar', level: 'intermediate', description: '各种时态的被动语态', dependencies: ['voice_passive_basic'] },

  // 主谓一致
  { id: 'agreement_basic', name: '主谓一致基本规则', category: 'grammar', level: 'basic', description: '单复数一致', dependencies: [] },
  { id: 'agreement_complex', name: '主谓一致特殊情况', category: 'grammar', level: 'intermediate', description: '集合名词、不定代词等', dependencies: ['agreement_basic'] },

  // 冠词
  { id: 'article_definite', name: '定冠词 the', category: 'grammar', level: 'basic', description: 'the 的用法', dependencies: [] },
  { id: 'article_indefinite', name: '不定冠词 a/an', category: 'grammar', level: 'basic', description: 'a/an 的用法', dependencies: [] },
  { id: 'article_zero', name: '零冠词', category: 'grammar', level: 'intermediate', description: '不用冠词的情况', dependencies: ['article_definite', 'article_indefinite'] },

  // 介词
  { id: 'preposition_time', name: '时间介词', category: 'grammar', level: 'basic', description: 'at/on/in/in 等时间介词', dependencies: [] },
  { id: 'preposition_place', name: '地点介词', category: 'grammar', level: 'basic', description: 'at/on/in 等地点介词', dependencies: ['preposition_time'] },
  { id: 'preposition_complex', name: '复杂介词', category: 'grammar', level: 'intermediate', description: 'beyond/through/throughout 等', dependencies: ['preposition_time', 'preposition_place'] },
]

const vocabularyNodes: EnglishKnowledgeGraphNode[] = [
  { id: 'vocab_root_affix', name: '词根词缀法', category: 'vocabulary', level: 'intermediate', description: '通过词根词缀记忆单词', dependencies: [] },
  { id: 'vocab_word_formation', name: '构词法', category: 'vocabulary', level: 'intermediate', description: '派生、合成、转化', dependencies: ['vocab_root_affix'] },
  { id: 'vocab_collocation', name: '词语搭配', category: 'vocabulary', level: 'intermediate', description: '固定搭配和习惯用语', dependencies: [] },
  { id: 'vocab_synonym_antonym', name: '同义词反义词', category: 'vocabulary', level: 'basic', description: '同义和反义关系', dependencies: [] },
  { id: 'vocab_context', name: '语境猜词', category: 'vocabulary', level: 'intermediate', description: '通过上下文推测词义', dependencies: [] },
  { id: 'vocab_academic', name: '学术词汇', category: 'vocabulary', level: 'advanced', description: '学术英语常用词汇', dependencies: [] },
]

const readingNodes: EnglishKnowledgeGraphNode[] = [
  { id: 'reading_skimming', name: '略读', category: 'reading', level: 'basic', description: '快速获取文章主旨', dependencies: [] },
  { id: 'reading_scanning', name: '扫读', category: 'reading', level: 'basic', description: '快速定位特定信息', dependencies: [] },
  { id: 'reading_detail', name: '细读', category: 'reading', level: 'intermediate', description: '深入理解文章细节', dependencies: ['reading_skimming', 'reading_scanning'] },
  { id: 'reading_inference', name: '推理判断', category: 'reading', level: 'intermediate', description: '根据上下文推理隐含信息', dependencies: ['reading_detail'] },
  { id: 'reading_structure', name: '文章结构分析', category: 'reading', level: 'intermediate', description: '分析文章的组织结构', dependencies: ['reading_detail'] },
  { id: 'reading_tone', name: '语气态度判断', category: 'reading', level: 'advanced', description: '判断作者语气和态度', dependencies: ['reading_inference'] },
]

const writingNodes: EnglishKnowledgeGraphNode[] = [
  { id: 'writing_sentence_basic', name: '基本句型', category: 'writing', level: 'basic', description: '五大基本句型', dependencies: [] },
  { id: 'writing_sentence_variety', name: '句式多样性', category: 'writing', level: 'intermediate', description: '使用不同句式', dependencies: ['writing_sentence_basic'] },
  { id: 'writing_paragraph', name: '段落写作', category: 'writing', level: 'basic', description: '主题句、支持句、结论句', dependencies: [] },
  { id: 'writing_cohesion', name: '衔接与连贯', category: 'writing', level: 'intermediate', description: '使用过渡词和连接手段', dependencies: ['writing_paragraph'] },
  { id: 'writing_essay_structure', name: '文章结构', category: 'writing', level: 'intermediate', description: '开头、正文、结尾', dependencies: ['writing_paragraph'] },
  { id: 'writing_argument', name: '议论文写作', category: 'writing', level: 'advanced', description: '论点、论据、论证', dependencies: ['writing_essay_structure'] },
  { id: 'writing_narrative', name: '记叙文写作', category: 'writing', level: 'intermediate', description: '时间顺序、情节发展', dependencies: ['writing_essay_structure'] },
]

// 辅助节点
const auxiliaryNodes: EnglishKnowledgeGraphNode[] = [
  { id: 'sentence_structure_basic', name: '基本句子结构', category: 'grammar', level: 'basic', description: '主谓宾等基本结构', dependencies: [] },
  { id: 'verb_basic', name: '动词基础', category: 'grammar', level: 'basic', description: '及物/不及物动词', dependencies: [] },
  { id: 'noun_basic', name: '名词基础', category: 'grammar', level: 'basic', description: '可数/不可数名词', dependencies: [] },
]

// ============================================
// 知识边（关系）
// ============================================

const grammarEdges: EnglishKnowledgeGraphEdge[] = [
  { from: 'tense_present_simple', to: 'tense_present_continuous', type: 'extends', weight: 0.8 },
  { from: 'tense_present_simple', to: 'tense_present_perfect', type: 'extends', weight: 0.8 },
  { from: 'tense_present_perfect', to: 'tense_present_perfect_continuous', type: 'extends', weight: 0.9 },
  { from: 'tense_present_simple', to: 'tense_past_simple', type: 'extends', weight: 0.7 },
  { from: 'tense_past_simple', to: 'tense_past_continuous', type: 'extends', weight: 0.8 },
  { from: 'tense_present_continuous', to: 'tense_past_continuous', type: 'applies', weight: 0.7 },
  { from: 'tense_past_simple', to: 'tense_past_perfect', type: 'extends', weight: 0.8 },
  { from: 'tense_present_simple', to: 'tense_future_simple', type: 'extends', weight: 0.7 },
  { from: 'tense_future_simple', to: 'tense_future_continuous', type: 'extends', weight: 0.8 },
  { from: 'tense_future_simple', to: 'tense_future_perfect', type: 'extends', weight: 0.8 },
  { from: 'sentence_structure_basic', to: 'clause_attribute', type: 'prerequisite', weight: 1.0 },
  { from: 'sentence_structure_basic', to: 'clause_adverbial', type: 'prerequisite', weight: 1.0 },
  { from: 'sentence_structure_basic', to: 'clause_noun', type: 'prerequisite', weight: 1.0 },
  { from: 'clause_attribute', to: 'clause_non_restrictive', type: 'extends', weight: 0.9 },
  { from: 'verb_basic', to: 'non_finite_infinitive', type: 'prerequisite', weight: 0.8 },
  { from: 'verb_basic', to: 'non_finite_gerund', type: 'prerequisite', weight: 0.8 },
  { from: 'verb_basic', to: 'non_finite_participle_present', type: 'prerequisite', weight: 0.8 },
  { from: 'verb_basic', to: 'non_finite_participle_past', type: 'prerequisite', weight: 0.8 },
  { from: 'tense_past_perfect', to: 'mood_subjunctive_condition', type: 'applies', weight: 0.7 },
  { from: 'tense_future_simple', to: 'mood_subjunctive_condition', type: 'applies', weight: 0.7 },
  { from: 'tense_past_perfect', to: 'mood_subjunctive_wish', type: 'applies', weight: 0.8 },
  { from: 'clause_noun', to: 'mood_subjunctive_suggestion', type: 'applies', weight: 0.7 },
]

const readingEdges: EnglishKnowledgeGraphEdge[] = [
  { from: 'reading_skimming', to: 'reading_detail', type: 'prerequisite', weight: 0.7 },
  { from: 'reading_scanning', to: 'reading_detail', type: 'prerequisite', weight: 0.7 },
  { from: 'reading_detail', to: 'reading_inference', type: 'prerequisite', weight: 0.9 },
  { from: 'reading_detail', to: 'reading_structure', type: 'prerequisite', weight: 0.8 },
  { from: 'reading_inference', to: 'reading_tone', type: 'prerequisite', weight: 0.8 },
]

const writingEdges: EnglishKnowledgeGraphEdge[] = [
  { from: 'writing_sentence_basic', to: 'writing_sentence_variety', type: 'prerequisite', weight: 0.9 },
  { from: 'writing_paragraph', to: 'writing_cohesion', type: 'prerequisite', weight: 0.8 },
  { from: 'writing_paragraph', to: 'writing_essay_structure', type: 'prerequisite', weight: 0.9 },
  { from: 'writing_essay_structure', to: 'writing_argument', type: 'prerequisite', weight: 0.9 },
  { from: 'writing_essay_structure', to: 'writing_narrative', type: 'prerequisite', weight: 0.8 },
]

// ============================================
// 完整知识图谱
// ============================================

export const ENGLISH_KNOWLEDGE_GRAPH: EnglishKnowledgeGraph = {
  nodes: [
    ...auxiliaryNodes,
    ...grammarNodes,
    ...vocabularyNodes,
    ...readingNodes,
    ...writingNodes,
  ],
  edges: [
    ...grammarEdges,
    ...readingEdges,
    ...writingEdges,
  ],
}

// ============================================
// 辅助函数
// ============================================

/**
 * 根据关键词搜索知识节点
 */
export function searchEnglishKnowledgeNodes(keywords: string[]): EnglishKnowledgeGraphNode[] {
  const results: EnglishKnowledgeGraphNode[] = []
  const keywordSet = new Set(keywords.map(k => k.toLowerCase()))

  for (const node of ENGLISH_KNOWLEDGE_GRAPH.nodes) {
    const nameLower = node.name.toLowerCase()
    const descLower = node.description.toLowerCase()
    const idLower = node.id.toLowerCase()

    for (const keyword of keywordSet) {
      if (nameLower.includes(keyword) || descLower.includes(keyword) || idLower.includes(keyword)) {
        results.push(node)
        break
      }
    }
  }

  return results
}

/**
 * 获取节点的相关节点
 */
export function getRelatedNodes(nodeId: string, depth: number = 1): EnglishKnowledgeGraphNode[] {
  const visited = new Set<string>()
  const results: EnglishKnowledgeGraphNode[] = []

  function dfs(currentId: string, currentDepth: number) {
    if (currentDepth > depth || visited.has(currentId)) return

    visited.add(currentId)
    const node = ENGLISH_KNOWLEDGE_GRAPH.nodes.find(n => n.id === currentId)
    if (node) results.push(node)

    // 找到所有相关节点
    const relatedEdges = ENGLISH_KNOWLEDGE_GRAPH.edges.filter(
      e => e.from === currentId || e.to === currentId
    )

    for (const edge of relatedEdges) {
      const nextId = edge.from === currentId ? edge.to : edge.from
      dfs(nextId, currentDepth + 1)
    }
  }

  dfs(nodeId, 0)
  return results.filter(n => n.id !== nodeId)
}

/**
 * 获取节点的前置依赖
 */
export function getPrerequisites(nodeId: string): EnglishKnowledgeGraphNode[] {
  const node = ENGLISH_KNOWLEDGE_GRAPH.nodes.find(n => n.id === nodeId)
  if (!node) return []

  return node.dependencies
    .map(depId => ENGLISH_KNOWLEDGE_GRAPH.nodes.find(n => n.id === depId))
    .filter((n): n is EnglishKnowledgeGraphNode => n !== undefined)
}

/**
 * 根据类别获取知识点
 */
export function getNodesByCategory(category: string): EnglishKnowledgeGraphNode[] {
  return ENGLISH_KNOWLEDGE_GRAPH.nodes.filter(n => n.category === category)
}

/**
 * 根据难度获取知识点
 */
export function getNodesByLevel(level: string): EnglishKnowledgeGraphNode[] {
  return ENGLISH_KNOWLEDGE_GRAPH.nodes.filter(n => n.level === level)
}
