/**
 * 数学学科知识图谱
 *
 * 包含代数、几何、函数、统计等核心知识点及其关联关系
 */

// ============================================
// 知识节点
// ============================================

const algebraNodes = [
  // 实数与运算
  { id: 'number_real', name: '实数', category: 'algebra', level: 'basic', description: '有理数和无理数', dependencies: [] },
  { id: 'number_operation', name: '实数运算', category: 'algebra', level: 'basic', description: '加减乘除乘方开方', dependencies: ['number_real'] },
  { id: 'number_absolute', name: '绝对值', category: 'algebra', level: 'basic', description: '数的绝对值概念', dependencies: ['number_real'] },

  // 整式与分式
  { id: 'algebra_integer', name: '整式', category: 'algebra', level: 'basic', description: '单项式和多项式', dependencies: ['number_operation'] },
  { id: 'algebra_power', name: '幂的运算', category: 'algebra', level: 'basic', description: '同底数幂、幂的乘方、积的乘方', dependencies: ['number_operation'] },
  { id: 'algebra_multiply', name: '整式乘法', category: 'algebra', level: 'basic', description: '单项式乘以单项式、多项式', dependencies: ['algebra_integer', 'algebra_power'] },
  { id: 'algebra_formula', name: '乘法公式', category: 'algebra', level: 'intermediate', description: '平方差、完全平方公式', dependencies: ['algebra_multiply'] },
  { id: 'algebra_factorization', name: '因式分解', category: 'algebra', level: 'intermediate', description: '提公因式法、公式法、分组分解法', dependencies: ['algebra_formula'] },
  { id: 'algebra_fraction', name: '分式', category: 'algebra', level: 'intermediate', description: '分式的基本性质和运算', dependencies: ['algebra_factorization'] },

  // 方程与不等式
  { id: 'equation_linear_one', name: '一元一次方程', category: 'algebra', level: 'basic', description: '含有一个未知数的一次方程', dependencies: ['number_operation'] },
  { id: 'equation_linear_system', name: '二元一次方程组', category: 'algebra', level: 'basic', description: '代入法和加减消元法', dependencies: ['equation_linear_one'] },
  { id: 'equation_linear_three', name: '三元一次方程组', category: 'algebra', level: 'intermediate', description: '三元一次方程组的解法', dependencies: ['equation_linear_system'] },
  { id: 'equation_inequality', name: '一元一次不等式', category: 'algebra', level: 'basic', description: '不等式的性质和解法', dependencies: ['equation_linear_one'] },
  { id: 'equation_inequality_system', name: '一元一次不等式组', category: 'algebra', level: 'intermediate', description: '不等式组的解法', dependencies: ['equation_inequality'] },
  { id: 'equation_quadratic', name: '一元二次方程', category: 'algebra', level: 'intermediate', description: '配方法、公式法、因式分解法', dependencies: ['equation_linear_one', 'algebra_factorization'] },
  { id: 'equation_quadratic_root', name: '一元二次方程根的判别式', category: 'algebra', level: 'advanced', description: '判别式与根的关系', dependencies: ['equation_quadratic'] },
  { id: 'equation_quadratic_application', name: '一元二次方程的应用', category: 'algebra', level: 'advanced', description: '实际问题与一元二次方程', dependencies: ['equation_quadratic'] },

  // 分式方程
  { id: 'equation_fraction', name: '分式方程', category: 'algebra', level: 'advanced', description: '分式方程的解法', dependencies: ['algebra_fraction', 'equation_quadratic'] },
]

const geometryNodes = [
  // 线与角
  { id: 'geo_line', name: '线段、射线、直线', category: 'geometry', level: 'basic', description: '线段、射线、直线的概念和性质', dependencies: [] },
  { id: 'geo_angle', name: '角', category: 'geometry', level: 'basic', description: '角的度量、分类和性质', dependencies: ['geo_line'] },
  { id: 'geo_angle_relation', name: '角的相交与平行', category: 'geometry', level: 'basic', description: '余角、补角、对顶角', dependencies: ['geo_angle'] },
  { id: 'geo_parallel', name: '平行线', category: 'geometry', level: 'basic', description: '平行线的判定和性质', dependencies: ['geo_line'] },

  // 三角形
  { id: 'geo_triangle_basic', name: '三角形的基本概念', category: 'geometry', level: 'basic', description: '三角形的边角关系', dependencies: ['geo_line', 'geo_angle'] },
  { id: 'geo_triangle_congruent', name: '全等三角形', category: 'geometry', level: 'intermediate', description: '全等的判定和性质', dependencies: ['geo_triangle_basic'] },
  { id: 'geo_triangle_isosceles', name: '等腰三角形', category: 'geometry', level: 'intermediate', description: '等腰三角形的性质和判定', dependencies: ['geo_triangle_basic'] },
  { id: 'geo_triangle_equilateral', name: '等边三角形', category: 'geometry', level: 'intermediate', description: '等边三角形的性质', dependencies: ['geo_triangle_isosceles'] },
  { id: 'geo_triangle_right', name: '直角三角形', category: 'geometry', level: 'intermediate', description: '直角三角形的性质', dependencies: ['geo_triangle_basic'] },
  { id: 'geo_triangle_pythagoras', name: '勾股定理', category: 'geometry', level: 'intermediate', description: '勾股定理及其逆定理', dependencies: ['geo_triangle_right'] },
  { id: 'geo_triangle_similar', name: '相似三角形', category: 'geometry', level: 'advanced', description: '相似的判定和性质', dependencies: ['geo_triangle_congruent'] },

  // 四边形
  { id: 'geo_quad_basic', name: '多边形', category: 'geometry', level: 'basic', description: '多边形的内角和与外角和', dependencies: ['geo_triangle_basic'] },
  { id: 'geo_quad_parallel', name: '平行四边形', category: 'geometry', level: 'intermediate', description: '平行四边形的性质和判定', dependencies: ['geo_quad_basic', 'geo_parallel'] },
  { id: 'geo_quad_rectangle', name: '矩形', category: 'geometry', level: 'intermediate', description: '矩形的性质和判定', dependencies: ['geo_quad_parallel'] },
  { id: 'geo_quad_rhombus', name: '菱形', category: 'geometry', level: 'intermediate', description: '菱形的性质和判定', dependencies: ['geo_quad_parallel'] },
  { id: 'geo_quad_square', name: '正方形', category: 'geometry', level: 'advanced', description: '正方形的性质', dependencies: ['geo_quad_rectangle', 'geo_quad_rhombus'] },
  { id: 'geo_quad_trapezoid', name: '梯形', category: 'geometry', level: 'intermediate', description: '梯形的性质和判定', dependencies: ['geo_quad_basic'] },

  // 圆
  { id: 'geo_circle_basic', name: '圆的基本性质', category: 'geometry', level: 'intermediate', description: '圆的定义、弦、弧、圆心角', dependencies: ['geo_triangle_basic'] },
  { id: 'geo_circle_position', name: '点与圆、直线与圆', category: 'geometry', level: 'intermediate', description: '位置关系', dependencies: ['geo_circle_basic'] },
  { id: 'geo_circle_angle', name: '圆心角与圆周角', category: 'geometry', level: 'advanced', description: '圆心角与圆周角的关系', dependencies: ['geo_circle_basic'] },
  { id: 'geo_circle_tangent', name: '切线长定理', category: 'geometry', level: 'advanced', description: '切线的性质和判定', dependencies: ['geo_circle_position'] },

  // 图形变换
  { id: 'geo_transform_axis', name: '轴对称', category: 'geometry', level: 'intermediate', description: '轴对称变换', dependencies: ['geo_quad_basic'] },
  { id: 'geo_transform_rotation', name: '旋转', category: 'geometry', level: 'advanced', description: '旋转与中心对称', dependencies: ['geo_transform_axis'] },
  { id: 'geo_transform_translation', name: '平移', category: 'geometry', level: 'intermediate', description: '平移变换', dependencies: [] },
]

const functionNodes = [
  // 坐标与函数基础
  { id: 'func_coord', name: '平面直角坐标系', category: 'function', level: 'basic', description: '坐标与点的位置', dependencies: [] },
  { id: 'func_basic', name: '函数', category: 'function', level: 'basic', description: '函数的概念和表示法', dependencies: ['func_coord'] },
  { id: 'func_image', name: '函数的图像', category: 'function', level: 'basic', description: '函数图像的描绘', dependencies: ['func_basic'] },
  { id: 'func_property', name: '函数的性质', category: 'function', level: 'intermediate', description: '单调性、奇偶性', dependencies: ['func_basic'] },

  // 一次函数
  { id: 'func_linear', name: '一次函数', category: 'function', level: 'basic', description: '一次函数的图像和性质', dependencies: ['func_basic', 'equation_linear_one'] },
  { id: 'func_linear_system', name: '一次函数与方程、不等式', category: 'function', level: 'intermediate', description: '函数与方程的关系', dependencies: ['func_linear', 'equation_inequality'] },

  // 反比例函数
  { id: 'func_inverse', name: '反比例函数', category: 'function', level: 'intermediate', description: '反比例函数的图像和性质', dependencies: ['func_basic'] },

  // 二次函数
  { id: 'func_quadratic', name: '二次函数', category: 'function', level: 'intermediate', description: '二次函数的图像和性质', dependencies: ['func_property', 'equation_quadratic'] },
  { id: 'func_quadratic_formula', name: '二次函数的表达式', category: 'function', level: 'intermediate', description: '一般式、顶点式、交点式', dependencies: ['func_quadratic'] },
  { id: 'func_quadratic_application', name: '二次函数的应用', category: 'function', level: 'advanced', description: '实际问题中的二次函数', dependencies: ['func_quadratic_formula'] },

  // 锐角三角函数
  { id: 'func_trig_basic', name: '锐角三角函数', category: 'function', level: 'intermediate', description: '正弦、余弦、正切', dependencies: ['geo_triangle_right', 'func_quad_basic'] },
  { id: 'func_trig_table', name: '特殊角三角函数值', category: 'function', level: 'intermediate', description: '30°、45°、60°的三角函数值', dependencies: ['func_trig_basic'] },
  { id: 'func_trig_solve', name: '解直角三角形', category: 'function', level: 'advanced', description: '利用三角函数解直角三角形', dependencies: ['func_trig_basic', 'geo_triangle_pythagoras'] },
]

const statisticsNodes = [
  // 数据的收集与整理
  { id: 'stat_data', name: '数据的收集', category: 'statistics', level: 'basic', description: '普查与抽样调查', dependencies: [] },
  { id: 'stat organise', name: '数据的整理', category: 'statistics', level: 'basic', description: '统计图表', dependencies: ['stat_data'] },

  // 数据的代表值
  { id: 'stat_central', name: '数据的集中趋势', category: 'statistics', level: 'basic', description: '平均数、中位数、众数', dependencies: ['stat_organise'] },
  { id: 'stat_spread', name: '数据的离散程度', category: 'statistics', level: 'intermediate', description: '极差、方差', dependencies: ['stat_central'] },

  // 概率初步
  { id: 'stat_prob_basic', name: '概率', category: 'statistics', level: 'basic', description: '随机事件与概率', dependencies: [] },
  { id: 'stat_prob_classical', name: '古典概率', category: 'statistics', level: 'intermediate', description: '用列举法计算概率', dependencies: ['stat_prob_basic'] },
  { id: 'stat_prob_frequency', name: '用频率估计概率', category: 'statistics', level: 'intermediate', description: '频率与概率的关系', dependencies: ['stat_prob_basic'] },
]

// 辅助节点
const auxiliaryNodes = [
  { id: 'math_logic', name: '数学逻辑', category: 'auxiliary', level: 'basic', description: '命题与推理', dependencies: [] },
  { id: 'math_method', name: '数学方法', category: 'auxiliary', level: 'basic', description: '分类讨论、数形结合', dependencies: [] },
]

// ============================================
// 知识边（关系）
// ============================================

const algebraEdges: MathEdge[] = [
  // 实数与运算
  { from: 'number_real', to: 'number_operation', type: 'prerequisite', weight: 1.0 },
  { from: 'number_real', to: 'number_absolute', type: 'prerequisite', weight: 0.8 },
  { from: 'number_operation', to: 'algebra_integer', type: 'prerequisite', weight: 0.9 },

  // 整式与分式
  { from: 'number_operation', to: 'algebra_power', type: 'prerequisite', weight: 0.9 },
  { from: 'algebra_integer', to: 'algebra_multiply', type: 'prerequisite', weight: 1.0 },
  { from: 'algebra_power', to: 'algebra_multiply', type: 'prerequisite', weight: 0.8 },
  { from: 'algebra_multiply', to: 'algebra_formula', type: 'prerequisite', weight: 1.0 },
  { from: 'algebra_formula', to: 'algebra_factorization', type: 'prerequisite', weight: 1.0 },
  { from: 'algebra_factorization', to: 'algebra_fraction', type: 'prerequisite', weight: 0.9 },

  // 方程与不等式
  { from: 'number_operation', to: 'equation_linear_one', type: 'prerequisite', weight: 0.9 },
  { from: 'equation_linear_one', to: 'equation_linear_system', type: 'extends', weight: 0.8 },
  { from: 'equation_linear_system', to: 'equation_linear_three', type: 'extends', weight: 0.7 },
  { from: 'equation_linear_one', to: 'equation_inequality', type: 'applies', weight: 0.8 },
  { from: 'equation_inequality', to: 'equation_inequality_system', type: 'extends', weight: 0.8 },
  { from: 'equation_linear_one', to: 'equation_quadratic', type: 'extends', weight: 0.7 },
  { from: 'algebra_factorization', to: 'equation_quadratic', type: 'applies', weight: 0.9 },
  { from: 'equation_quadratic', to: 'equation_quadratic_root', type: 'extends', weight: 0.8 },
  { from: 'equation_quadratic', to: 'equation_quadratic_application', type: 'applies', weight: 0.7 },
  { from: 'algebra_fraction', to: 'equation_fraction', type: 'prerequisite', weight: 0.9 },
  { from: 'equation_quadratic', to: 'equation_fraction', type: 'applies', weight: 0.7 },
]

const geometryEdges: MathEdge[] = [
  // 线与角
  { from: 'geo_line', to: 'geo_angle', type: 'prerequisite', weight: 1.0 },
  { from: 'geo_angle', to: 'geo_angle_relation', type: 'prerequisite', weight: 0.9 },
  { from: 'geo_line', to: 'geo_parallel', type: 'prerequisite', weight: 0.8 },

  // 三角形
  { from: 'geo_line', to: 'geo_triangle_basic', type: 'prerequisite', weight: 0.7 },
  { from: 'geo_angle', to: 'geo_triangle_basic', type: 'prerequisite', weight: 0.7 },
  { from: 'geo_triangle_basic', to: 'geo_triangle_congruent', type: 'prerequisite', weight: 1.0 },
  { from: 'geo_triangle_basic', to: 'geo_triangle_isosceles', type: 'extends', weight: 0.8 },
  { from: 'geo_triangle_isosceles', to: 'geo_triangle_equilateral', type: 'extends', weight: 0.7 },
  { from: 'geo_triangle_basic', to: 'geo_triangle_right', type: 'extends', weight: 0.8 },
  { from: 'geo_triangle_right', to: 'geo_triangle_pythagoras', type: 'prerequisite', weight: 1.0 },
  { from: 'geo_triangle_congruent', to: 'geo_triangle_similar', type: 'extends', weight: 0.7 },

  // 四边形
  { from: 'geo_triangle_basic', to: 'geo_quad_basic', type: 'prerequisite', weight: 0.6 },
  { from: 'geo_quad_basic', to: 'geo_quad_parallel', type: 'extends', weight: 0.8 },
  { from: 'geo_parallel', to: 'geo_quad_parallel', type: 'applies', weight: 0.9 },
  { from: 'geo_quad_parallel', to: 'geo_quad_rectangle', type: 'extends', weight: 0.8 },
  { from: 'geo_quad_parallel', to: 'geo_quad_rhombus', type: 'extends', weight: 0.8 },
  { from: 'geo_quad_rectangle', to: 'geo_quad_square', type: 'prerequisite', weight: 0.9 },
  { from: 'geo_quad_rhombus', to: 'geo_quad_square', type: 'prerequisite', weight: 0.9 },
  { from: 'geo_quad_basic', to: 'geo_quad_trapezoid', type: 'extends', weight: 0.7 },

  // 圆
  { from: 'geo_triangle_basic', to: 'geo_circle_basic', type: 'prerequisite', weight: 0.6 },
  { from: 'geo_circle_basic', to: 'geo_circle_position', type: 'extends', weight: 0.8 },
  { from: 'geo_circle_basic', to: 'geo_circle_angle', type: 'extends', weight: 0.9 },
  { from: 'geo_circle_position', to: 'geo_circle_tangent', type: 'prerequisite', weight: 0.9 },

  // 图形变换
  { from: 'geo_quad_basic', to: 'geo_transform_axis', type: 'prerequisite', weight: 0.7 },
  { from: 'geo_transform_axis', to: 'geo_transform_rotation', type: 'extends', weight: 0.8 },
  { from: 'geo_transform_rotation', to: 'geo_transform_translation', type: 'applies', weight: 0.7 },
]

const functionEdges: MathEdge[] = [
  { from: 'func_coord', to: 'func_basic', type: 'prerequisite', weight: 1.0 },
  { from: 'func_basic', to: 'func_image', type: 'prerequisite', weight: 0.9 },
  { from: 'func_basic', to: 'func_property', type: 'extends', weight: 0.8 },
  { from: 'func_basic', to: 'func_linear', type: 'prerequisite', weight: 0.9 },
  { from: 'equation_linear_one', to: 'func_linear', type: 'applies', weight: 0.8 },
  { from: 'func_linear', to: 'func_linear_system', type: 'extends', weight: 0.8 },
  { from: 'equation_inequality', to: 'func_linear_system', type: 'applies', weight: 0.7 },
  { from: 'func_basic', to: 'func_inverse', type: 'extends', weight: 0.7 },
  { from: 'func_property', to: 'func_quadratic', type: 'prerequisite', weight: 0.9 },
  { from: 'equation_quadratic', to: 'func_quadratic', type: 'applies', weight: 0.9 },
  { from: 'func_quadratic', to: 'func_quadratic_formula', type: 'extends', weight: 0.9 },
  { from: 'func_quadratic_formula', to: 'func_quadratic_application', type: 'applies', weight: 0.8 },
  { from: 'geo_triangle_right', to: 'func_trig_basic', type: 'prerequisite', weight: 0.9 },
  { from: 'func_quad_basic', to: 'func_trig_basic', type: 'prerequisite', weight: 0.8 },
  { from: 'func_trig_basic', to: 'func_trig_table', type: 'extends', weight: 0.7 },
  { from: 'func_trig_basic', to: 'func_trig_solve', type: 'extends', weight: 0.9 },
  { from: 'geo_triangle_pythagoras', to: 'func_trig_solve', type: 'applies', weight: 0.9 },
]

const statisticsEdges: MathEdge[] = [
  { from: 'stat_data', to: 'stat_organise', type: 'prerequisite', weight: 1.0 },
  { from: 'stat_organise', to: 'stat_central', type: 'prerequisite', weight: 0.9 },
  { from: 'stat_central', to: 'stat_spread', type: 'extends', weight: 0.8 },
  { from: 'stat_prob_basic', to: 'stat_prob_classical', type: 'prerequisite', weight: 0.9 },
  { from: 'stat_prob_basic', to: 'stat_prob_frequency', type: 'extends', weight: 0.8 },
]

// ============================================
// 类型定义
// ============================================

export interface MathKnowledgeGraphNode {
  id: string
  name: string
  category: 'algebra' | 'geometry' | 'function' | 'statistics' | 'auxiliary'
  level: 'basic' | 'intermediate' | 'advanced'
  description: string
  dependencies: string[]
}

export interface MathKnowledgeGraphEdge {
  from: string
  to: string
  type: 'prerequisite' | 'related' | 'extends' | 'applies'
  weight: number
}

export interface MathKnowledgeGraph {
  nodes: MathKnowledgeGraphNode[]
  edges: MathKnowledgeGraphEdge[]
}

export type MathEdge = MathKnowledgeGraphEdge

// ============================================
// 完整知识图谱
// ============================================

export const MATH_KNOWLEDGE_GRAPH: MathKnowledgeGraph = {
  nodes: [
    ...auxiliaryNodes,
    ...algebraNodes,
    ...geometryNodes,
    ...functionNodes,
    ...statisticsNodes,
  ],
  edges: [
    ...algebraEdges,
    ...geometryEdges,
    ...functionEdges,
    ...statisticsEdges,
  ],
}

// ============================================
// 辅助函数
// ============================================

/**
 * 根据关键词搜索知识节点
 */
export function searchMathKnowledgeNodes(keywords: string[]): MathKnowledgeGraphNode[] {
  const results: MathKnowledgeGraphNode[] = []
  const keywordSet = new Set(keywords.map((k) => k.toLowerCase()))

  for (const node of MATH_KNOWLEDGE_GRAPH.nodes) {
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
export function getMathRelatedNodes(nodeId: string, depth: number = 1): MathKnowledgeGraphNode[] {
  const visited = new Set<string>()
  const results: MathKnowledgeGraphNode[] = []

  function dfs(currentId: string, currentDepth: number) {
    if (currentDepth > depth || visited.has(currentId)) return

    visited.add(currentId)
    const node = MATH_KNOWLEDGE_GRAPH.nodes.find((n) => n.id === currentId)
    if (node) results.push(node)

    const relatedEdges = MATH_KNOWLEDGE_GRAPH.edges.filter((e) => e.from === currentId || e.to === currentId)

    for (const edge of relatedEdges) {
      const nextId = edge.from === currentId ? edge.to : edge.from
      dfs(nextId, currentDepth + 1)
    }
  }

  dfs(nodeId, 0)
  return results.filter((n) => n.id !== nodeId)
}

/**
 * 获取节点的前置依赖
 */
export function getMathPrerequisites(nodeId: string): MathKnowledgeGraphNode[] {
  const node = MATH_KNOWLEDGE_GRAPH.nodes.find((n) => n.id === nodeId)
  if (!node) return []

  return node.dependencies
    .map((depId) => MATH_KNOWLEDGE_GRAPH.nodes.find((n) => n.id === depId))
    .filter((n): n is MathKnowledgeGraphNode => n !== undefined)
}

/**
 * 根据类别获取知识点
 */
export function getMathNodesByCategory(category: string): MathKnowledgeGraphNode[] {
  return MATH_KNOWLEDGE_GRAPH.nodes.filter((n) => n.category === category)
}

/**
 * 根据难度获取知识点
 */
export function getMathNodesByLevel(level: string): MathKnowledgeGraphNode[] {
  return MATH_KNOWLEDGE_GRAPH.nodes.filter((n) => n.level === level)
}

/**
 * 获取类别的中文名称
 */
export function getMathCategoryName(category: string): string {
  const names: Record<string, string> = {
    algebra: '代数',
    geometry: '几何',
    function: '函数',
    statistics: '统计与概率',
    auxiliary: '辅助',
  }
  return names[category] || category
}

/**
 * 获取难度的中文名称
 */
export function getMathLevelName(level: string): string {
  const names: Record<string, string> = {
    basic: '基础',
    intermediate: '中级',
    advanced: '高级',
  }
  return names[level] || level
}
