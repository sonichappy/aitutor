# 试卷识别分析系统设计方案

## 一、系统概述

本方案设计一个能够兼容不同学科、各种试卷的智能识别分析系统，支持对试卷照片进行OCR识别、题目提取、答案标记和智能分析。

## 二、试卷类型分析

### 2.1 学科分类

| 学科类别 | 特点 | 常见题型 | 特殊元素 |
|---------|------|---------|---------|
| **理科**（数学/物理/化学） | 公式多、符号多、图形 | 选择题、填空题、计算题、证明题 | 数学公式、化学方程式、几何图形 |
| **文科**（语文/历史/政治） | 文字量大、段落多 | 选择题、填空题、简答题、论述题 | 长段落、古文、引用 |
| **英语** | 英文、阅读理解长 | 选择题、完形填空、阅读理解、作文 | 英文文章、单词拼写 |

### 2.2 题型分类

| 题型 | 识别难点 | 处理策略 |
|-----|---------|---------|
| 选择题 | 选项位置、勾选标记 | OCR定位 + 交互确认 |
| 填空题 | 空位识别、手写答案 | 文本分析 + 手动补充 |
| 阅读理解 | 长文本、分段 | 分段OCR + 结构化重组 |
| 完形填空 | 挖空位置、选项对应 | 位置映射 + 选项关联 |
| 作文题 | 题目提取、格线识别 | 区域检测 + 文字提取 |
| 计算题/证明题 | 过程识别、公式转换 | 公式识别 + LaTeX转换 |
| 复合题 | 层级结构、小题关联 | 结构解析 + 递归处理 |

## 三、系统架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        试卷上传分析系统                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │ 前端上传组件  │───▶│  OCR识别服务  │───▶│  结构化输出     │    │
│  │             │    │              │    │                 │    │
│  │ • 多图上传   │    │ • 多模态大模型│    │ • JSON格式      │    │
│  │ • 图片预处理 │    │ • 学科识别   │    │ • 题目结构化    │    │
│  │ • 进度显示   │    │ • 分块处理   │    │ • 答案提取     │    │
│  └─────────────┘    └──────────────┘    └─────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      答案标记模块                            ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ ││
│  │  │ OCR自动检测  │  │ 手动标记    │  │ 混合模式             │ ││
│  │  │ 选择题勾选  │  │ 点击选项    │  │ 系统识别+用户修正   │ ││
│  │  │ 填空题填写  │  │ 输入答案    │  │                      │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      AI分析引擎                              ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐││
│  │  │ 通用分析器   │  │ 学科专用器   │  │  题型专用器        │││
│  │  │ • 基础结构   │  │ • 理科分析   │  │ • 阅读理解分析    │││
│  │  │ • 答案对比   │  │ • 文科分析   │  │ • 作文评估        │││
│  │  │ • 准确率     │  │ • 英语分析   │  │ • 计算过程分析    │││
│  │  └──────────────┘  └──────────────┘  └────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 技术架构

#### 3.2.1 前端组件

- **多图上传组件**: 支持批量上传试卷照片
- **图片预处理组件**: 图片压缩、旋转、裁剪
- **进度显示组件**: 显示OCR识别进度
- **答案标记组件**: 交互式答案输入界面
- **结果预览组件**: 识别结果展示和编辑

#### 3.2.2 后端API

| API端点 | 功能 | 请求/响应 |
|---------|------|----------|
| `POST /api/exams/upload` | 上传试卷图片 | `{ images: string[], subject?: string }` |
| `POST /api/exams/recognize` | 执行OCR识别 | `{ examId: string, options: {...} }` |
| `POST /api/exams/answers` | 提交学生答案 | `{ examId: string, answers: {...} }` |
| `POST /api/exams/analyze` | 分析试卷 | `{ examId: string, type: 'basic'\|'deep' }` |
| `GET /api/exams/[id]` | 获取试卷详情 | 返回完整试卷数据 |

## 四、提示词策略

### 4.1 三层提示词架构

采用 **"通用基础 + 学科增强 + 题型专用"** 的三层提示词策略：

#### Level 1: 通用基础提示词（所有学科共享）

```typescript
const BASE_OCR_PROMPT = `你是一位专业的试卷识别专家。请分析上传的试卷图片，识别并提取所有题目信息。

识别要求：
1. 按题目顺序识别，保持题目编号
2. 识别题型：选择题、填空题、简答题、计算题、证明题、阅读理解、作文等
3. 提取题目内容（包括题干、选项、图片描述等）
4. 如果有学生作答，提取学生答案（包括选择题的勾选标记、填空题的手写内容等）

返回JSON格式：
{
  "subject": "学科名称",
  "paperType": "试卷类型",
  "questions": [
    {
      "number": "题号",
      "type": "题型",
      "content": "题目内容",
      "options": ["选项A", "选项B", ...],  // 选择题才有
      "subQuestions": [...],  // 复合题的小题
      "hasStudentAnswer": true/false,
      "studentAnswer": "学生答案"
    }
  ]
}`
```

#### Level 2: 学科增强提示词

**数学学科**:
```typescript
const MATH_ENHANCEMENT = `
数学学科特殊要求：
- 数学公式用 LaTeX 格式表示，如 \\frac{a}{b}、\\sqrt{x}、x^2
- 几何题描述图形的位置和标注
- 证明题识别"证明"、"求证"等关键词
- 计算题识别"解："、"计算："等开头
`
```

**语文学科**:
```typescript
const CHINESE_ENHANCEMENT = `
语文学科特殊要求：
- 古诗词用引号包裹，保留原格式
- 阅读理解区分文章内容和题目
- 作文题识别题目要求和字数限制
- 默写题识别填空位置
`
```

**英语学科**:
```typescript
const ENGLISH_ENHANCEMENT = `
英语学科特殊要求：
- 保持英文原样，不翻译
- 完形填空识别挖空位置，用 [ ] 表示
- 阅读理解提取完整英文文章
- 作文题识别提示语和字数要求
`
```

#### Level 3: 题型专用提示词

**阅读理解**:
```typescript
const READING_COMPREHENSION_PROMPT = `
阅读理解题型处理：
1. 先提取完整阅读文章（包括标题、段落）
2. 文章内容用 article 字段存储
3. 题目按顺序提取，每个题目标注对应的文章段落
4. 保留文章中的格式（缩进、换行等）

特殊格式：
{
  "type": "reading_comprehension",
  "article": "完整文章内容",
  "articleTitle": "文章标题",
  "questions": [
    {
      "number": "1",
      "content": "题目内容",
      "relatedParagraph": "第X段",
      ...
    }
  ]
}`
```

**完形填空**:
```typescript
const CLOZE_TEST_PROMPT = `
完形填空题型处理：
1. 识别文章中的挖空位置（通常用 [ ] 或 _____ 表示）
2. 提取完整的文章框架
3. 挖空位置按顺序编号
4. 识别是否有选项列表（A、B、C、D...）

特殊格式：
{
  "type": "cloze_test",
  "articleWithBlanks": "带挖空的文章",
  "blankCount": 20,
  "hasOptions": true,
  "blanks": [
    {"number": 1, "position": "...", "options": ["A", "B", "C", "D"]}
  ]
}`
```

### 4.2 提示词选择策略

```typescript
class PromptBuilder {
  buildPrompt(subject: string, detectedTypes: string[]) {
    let prompt = BASE_OCR_PROMPT

    // 添加学科增强
    prompt += this.getSubjectEnhancement(subject)

    // 添加题型专用提示
    const specialTypes = this.getSpecialTypes(detectedTypes)
    specialTypes.forEach(type => {
      prompt += this.getTypePrompt(type)
    })

    return prompt
  }
}
```

## 五、识别流程设计

### 5.1 主流程

```typescript
class ExamRecognitionService {
  async recognizeExam(images: string[], subjectHint?: string) {
    // 1. 预处理阶段
    const preprocessedImages = await this.preprocessImages(images)

    // 2. 学科检测
    const detectedSubject = await this.detectSubject(preprocessedImages, subjectHint)

    // 3. 题型预检测
    const detectedTypes = await this.detectQuestionTypes(preprocessedImages)

    // 4. 构建提示词
    const prompt = this.buildPrompt(detectedSubject, detectedTypes)

    // 5. 执行 OCR 识别
    const rawResult = await this.performOCR(preprocessedImages, prompt)

    // 6. 后处理与验证
    const validatedResult = await this.postProcess(rawResult, detectedSubject)

    // 7. 结构化输出
    return this.formatOutput(validatedResult)
  }
}
```

### 5.2 长文本处理策略

对于阅读理解等长文本题型，采用**分段处理 + 智能拼接**策略：

```typescript
class LongTextHandler {
  async processReadingComprehension(image: string) {
    // 1. 识别文章区域和题目区域
    const regions = await this.detectRegions(image)

    // 2. 提取文章（分段处理）
    const article = await this.extractArticle(regions.articleRegion)

    // 3. 提取题目（批量处理）
    const questions = await this.extractQuestions(regions.questionRegion)

    // 4. 组装结果
    return {
      type: 'reading_comprehension',
      article: article.fullText,
      questions: questions
    }
  }

  // 文章分段提取
  async extractArticle(region: ImageRegion) {
    // 将长文章区域切分成多个小块
    const chunks = this.splitRegion(region, { maxHeight: 1000 })

    // 分段 OCR
    const results = []
    for (const chunk of chunks) {
      const text = await this.ocrChunk(chunk)
      results.push(text)
    }

    // 智能拼接（处理段落边界）
    return this.joinAndClean(results)
  }
}
```

### 5.3 复合题处理策略

```typescript
class CompositeQuestionHandler {
  async processCompositeQuestion(questionData: any) {
    // 1. 识别主结构
    const mainStructure = this.identifyMainStructure(questionData)

    // 2. 递归处理小题
    const subQuestions = []
    for (const subQ of mainStructure.subQuestions) {
      if (this.isComposite(subQ)) {
        subQuestions.push(await this.processCompositeQuestion(subQ))
      } else {
        subQuestions.push(await this.processSimpleQuestion(subQ))
      }
    }

    return {
      ...mainStructure,
      subQuestions
    }
  }
}
```

## 六、答案标记方案

### 6.1 混合标记策略

| 标记方式 | 适用场景 | 实现方式 |
|---------|---------|---------|
| **OCR自动检测** | 选择题勾选 | AI识别勾选/涂写位置 |
| **交互式标记** | 所有题型 | 点击选项、输入答案 |
| **混合模式** | 提高准确性 | 系统识别 + 用户确认 |

### 6.2 答案标记流程

```typescript
class AnswerMarkingService {
  // 方案 A: OCR 自动检测选择题
  async detectMultipleChoiceAnswers(image: string, questions: Question[]) {
    const detectionPrompt = `
请检测这张试卷中学生的作答情况。对于每个选择题：
1. 检测选项位置的勾选、涂写标记（如 ✓、●、○ 等）
2. 识别填空题的手写答案

返回格式：
{
  "answers": {
    "1": "A",
    "2": "C",
    ...
  }
}`
    // ...
  }

  // 方案 B: 交互式标记界面数据
  async provideInteractiveMarking(questions: Question[]) {
    return {
      type: 'interactive',
      questions: questions.map(q => ({
        number: q.number,
        type: q.type,
        options: q.options,
        markingMode: this.getMarkingMode(q.type)
      }))
    }
  }

  getMarkingMode(questionType: string) {
    const modes = {
      'multiple_choice': 'click_options',
      'fill_blank': 'text_input',
      'essay': 'photo_or_text',
      'reading_comprehension': 'click_options_or_input'
    }
    return modes[questionType] || 'manual'
  }
}
```

## 七、数据结构设计

### 7.1 试卷数据结构

```typescript
interface ExamPaper {
  id: string
  subject: string
  subjectFolder: string
  uploadTime: string

  // 原始数据
  images: string[]  // 图片 URL 列表

  // 识别结果
  recognition: {
    confidence: number  // 识别置信度
    processingTime: number
    issues: string[]  // 识别中的问题
  }

  // 试卷结构
  structure: {
    title?: string
    instructions?: string
    totalQuestions: number
    totalScore?: number
    timeLimit?: string
  }

  // 题目列表
  questions: ExamQuestion[]

  // 学生答案
  studentAnswers: {
    [questionNumber: string]: StudentAnswer
  }

  // 分析结果
  analysis?: {
    score: number
    accuracy: number
    wrongQuestions: WrongQuestion[]
    weakPoints: string[]
    suggestions: string[]
  }
}

interface ExamQuestion {
  number: string
  type: string
  typeConfidence: number
  content: string
  options?: string[]
  subQuestions?: ExamQuestion[]
  article?: string  // 阅读理解文章
  score?: number
  difficulty?: number

  // AI 分析相关
  knowledgePoints?: string[]
  analysis?: {
    correctAnswer?: string
    explanation?: string
    keyPoints?: string[]
  }
}

interface StudentAnswer {
  value: string
  confidence: number  // 识别置信度
  method: 'ocr_auto' | 'user_input' | 'hybrid'
  timestamp: string
  imageUrl?: string  // 手写答案图片
}
```

### 7.2 存储结构

```
data/
├── exams/
│   ├── {学科文件夹}/
│   │   ├── {日期}/{examId}/
│   │   │   ├── images/           # 原始图片
│   │   │   ├── meta.json         # 试卷元数据
│   │   │   ├── questions.json    # 识别的题目
│   │   │   ├── answers.json      # 学生答案
│   │   │   └── analysis.json     # 分析结果
│   │   └── ...
└── ...
```

## 八、API 接口设计

### 8.1 试卷上传 API

```
POST /api/exams/upload
Content-Type: multipart/form-data

请求:
{
  images: File[],
  subject?: string,  // 可选的学科提示
  examName?: string
}

响应:
{
  success: true,
  examId: string,
  uploadUrls: string[]
}
```

### 8.2 试卷识别 API

```
POST /api/exams/recognize
Content-Type: application/json

请求:
{
  examId: string,
  options: {
    detectSubject: boolean,  // 是否自动检测学科
    detectAnswers: boolean,  // 是否检测学生答案
    enableLongText: boolean  // 是否启用长文本优化
  }
}

响应:
{
  success: true,
  examId: string,
  recognition: {
    confidence: number,
    processingTime: number,
    detectedSubject: string
  },
  structure: {
    title?: string,
    totalQuestions: number
  },
  questions: ExamQuestion[],
  detectedAnswers?: StudentAnswer[]
}
```

### 8.3 答案提交 API

```
POST /api/exams/[examId]/answers
Content-Type: application/json

请求:
{
  answers: {
    "1": { value: "A", method: "user_input" },
    "2": { value: "C", method: "ocr_auto" },
    "3": { value: "因为...", method: "user_input", imageUrl: "..." }
  }
}

响应:
{
  success: true,
  message: "答案已保存"
}
```

### 8.4 试卷分析 API

```
POST /api/exams/[examId]/analyze
Content-Type: application/json

请求:
{
  analysisType: "basic" | "deep",
  options?: {
    includeWeakPoints: boolean,
    includeSuggestions: boolean
  }
}

响应:
{
  success: true,
  analysis: {
    score: number,
    accuracy: number,
    wrongQuestions: WrongQuestion[],
    weakPoints: string[],
    suggestions: string[]
  }
}
```

## 九、技术选型

| 技术组件 | 选择方案 | 说明 |
|---------|---------|------|
| **OCR引擎** | 通义千问 VL (qwen-vl-max) | 多模态大模型，支持图片理解和文本提取 |
| **学科检测** | qwen-vl-plus | 快速识别试卷类型 |
| **公式识别** | LaTeX转换 | 数学公式转换为LaTeX格式 |
| **手写识别** | qwen-vl-max | 识别手写答案 |
| **文本分析** | qwen-plus | 试卷内容分析和答案评估 |

## 十、实施计划

### Phase 1: 基础功能（第1-2周）
- [ ] 实现通用OCR识别API
- [ ] 支持选择题和填空题
- [ ] 交互式答案标记界面
- [ ] 基础的准确率分析

### Phase 2: 学科增强（第3-4周）
- [ ] 添加数学公式识别和转换
- [ ] 添加语文学科特殊处理
- [ ] 添加英语学科特殊处理
- [ ] 完善学科分类提示词

### Phase 3: 高级题型（第5-6周）
- [ ] 阅读理解完整支持（分段处理）
- [ ] 完形填空识别
- [ ] 复合题处理
- [ ] 作文题目识别

### Phase 4: 智能化升级（第7-8周）
- [ ] 自动检测学生答案（选择题）
- [ ] 手写答案识别
- [ ] 识别结果质量评估
- [ ] 置信度评分和人工复核机制

## 十一、质量保证

### 11.1 识别质量指标

```typescript
interface RecognitionQuality {
  confidence: number        // 整体置信度 (0-100)
  questionCount: {
    detected: number         // 检测到的题目数
    expected: number         // 预期的题目数
    accuracy: number         // 准确率
  }
  issues: {
    lowConfidence: string[]  // 低置信度区域
    missing: string[]        // 漏检的题目
    errors: string[]         // 识别错误
  }
  recommendations: string[]  // 人工复核建议
}
```

### 11.2 质量控制流程

1. **实时反馈**: 识别过程中显示进度和置信度
2. **低置信度提醒**: 对识别不确定的区域标记，提示用户确认
3. **人工复核**: 提供完整的编辑界面，支持修正识别结果
4. **版本管理**: 保存识别结果的修改历史

## 十二、扩展性考虑

### 12.1 新学科接入

通过配置化的方式添加新学科：

```typescript
// config/subjects.config.ts
export const SUBJECT_CONFIGS = {
  biology: {
    name: "生物",
    enhancement: BIOLOGY_ENHANCEMENT_PROMPT,
    specialQuestionTypes: ['diagram', 'experiment']
  },
  geography: {
    name: "地理",
    enhancement: GEOGRAPHY_ENHANCEMENT_PROMPT,
    specialQuestionTypes: ['map_reading', 'chart_analysis']
  }
}
```

### 12.2 新题型接入

通过题型处理器插件模式：

```typescript
interface QuestionTypeHandler {
  type: string
  canHandle(question: any): boolean
  process(question: any, image: string): Promise<ProcessedQuestion>
}

// 注册新题型
registerQuestionTypeHandler(new ReadingComprehensionHandler())
registerQuestionTypeHandler(new ClozeTestHandler())
```

## 十三、性能优化

### 13.1 图片处理优化

- 客户端压缩：上传前进行图片压缩和尺寸调整
- 分片上传：大图片分块上传，提高成功率
- 并行处理：多张图片并行识别
- 缓存机制：识别结果缓存，避免重复处理

### 13.2 识别优化

- 区域检测：先识别试卷结构，再针对性处理
- 增量识别：支持增量识别和更新
- 批处理：支持批量试卷识别

## 十四、安全考虑

- 图片内容安全扫描
- 敏感信息脱敏处理
- 学生隐私保护
- 数据加密存储和传输
