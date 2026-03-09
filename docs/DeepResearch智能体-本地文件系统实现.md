# Deep Research 智能体 - 本地文件系统实现说明

## 文档说明

本文档是对 `DeepResearch学科分析智能体设计文档.md` 的补充，专门说明**基于本地文件系统**的实现方式，替代原设计中的向量数据库方案。

---

## 1. 本地文件存储结构

### 1.1 现有数据目录

项目已有的数据存储结构：

```
data/
├── exams/                             # 试卷数据
│   ├── {subject}/                      # 学科文件夹 (geometry, algebra, etc.)
│   │   ├── {YYYYMMDD}/                 # 日期文件夹
│   │   │   ├── {examId}/
│   │   │   │   ├── data.json           # 试卷数据
│   │   │   │   └── image.{ext}         # 试卷图片
│   │   │   └── ...
│   │   └── ...
│   └── ...
│
├── reports/                            # 学科报告
│   ├── {subject}/
│   │   ├── {timestamp}/                 # 时间戳文件夹
│   │   │   ├── report.md               # 报告内容 (Markdown)
│   │   │   └── meta.json               # 报告元数据
│   │   └── ...
│   └── ...
│
├── wrong-questions/                    # 错题数据
│   ├── {questionId}.json               # 单个错题文件
│   └── ...
│
├── subjects.json                       # 学科配置
│
└── knowledge/                          # 新增：知识库
    ├── graphs/                         # 知识图谱
    │   ├── geometry.json
    │   ├── algebra.json
    │   ├── chinese.json
    │   └── english.json
    │
    ├── syllabus/                       # 教学大纲
    │   ├── math/
    │   │   ├── junior-high.md
    │   │   └── senior-high.md
    │   ├── chinese/
    │   │   └── ...
    │   └── ...
    │
    └── common-errors/                  # 常见错误库
        ├── geometry.md
        ├── algebra.md
        └── ...
```

### 1.2 新增数据目录

为支持 Deep Research 智能体，需要新增以下目录：

```
data/
└── agent/                             # Agent 数据目录
    ├── memory/                         # 记忆存储
    │   ├── sessions/                   # 会话记忆
    │   │   ├── {sessionId}.json
    │   │   └── ...
    │   ├── profiles/                   # 学生档案
    │   │   ├── {userId}.json
    │   │   └── ...
    │   └── cases/                      # 案例库
    │       ├── {caseId}.json
    │       └── index.json              # 案例索引
    │
    ├── cache/                          # 缓存目录
    │   ├── statistics/                 # 统计缓存
    │   ├── patterns/                   # 模式缓存
    │   └── embeddings/                 # 嵌入缓存 (可选)
    │
    └── logs/                           # Agent 日志
        ├── reasoning/                  # 推理日志
        ├── tool_calls/                 # 工具调用日志
        └── reflections/                # 反思日志
```

---

## 2. 本地文档读取工具

### 2.1 试卷数据读取

```typescript
// lib/agent/tools/data/queryExams.ts
import fs from 'fs/promises';
import path from 'path';

interface QueryExamsParams {
  subject?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export async function queryExams(params: QueryExamsParams) {
  const { subject, startDate, endDate, limit } = params;
  const exams: any[] = [];

  // 遍历学科目录
  const subjectsDir = path.join(process.cwd(), 'data', 'exams');

  if (subject) {
    // 只读取指定学科
    const subjectPath = path.join(subjectsDir, subject);
    await readSubjectExams(subjectPath, exams, { startDate, endDate, limit });
  } else {
    // 读取所有学科
    const subjectFolders = await fs.readdir(subjectsDir);
    for (const folder of subjectFolders) {
      const subjectPath = path.join(subjectsDir, folder);
      await readSubjectExams(subjectPath, exams, { startDate, endDate, limit });
    }
  }

  // 按日期排序
  exams.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return limit ? exams.slice(0, limit) : exams;
}

async function readSubjectExams(
  subjectPath: string,
  exams: any[],
  options: { startDate?: string; endDate?: string; limit?: number }
) {
  const { startDate, endDate, limit } = options;

  try {
    // 读取所有日期文件夹
    const dateFolders = await fs.readdir(subjectPath);

    for (const dateFolder of dateFolders) {
      // 检查日期范围
      if (startDate && dateFolder < startDate.replace(/-/g, '')) continue;
      if (endDate && dateFolder > endDate.replace(/-/g, '')) continue;

      const datePath = path.join(subjectPath, dateFolder);
      const examFolders = await fs.readdir(datePath);

      for (const examFolder of examFolders) {
        // 检查数量限制
        if (limit && exams.length >= limit) break;

        const dataPath = path.join(datePath, examFolder, 'data.json');
        try {
          const content = await fs.readFile(dataPath, 'utf-8');
          const examData = JSON.parse(content);
          exams.push(examData);
        } catch (error) {
          console.error(`Error reading exam ${examFolder}:`, error);
        }
      }

      if (limit && exams.length >= limit) break;
    }
  } catch (error) {
    console.error(`Error reading subject ${subjectPath}:`, error);
  }
}
```

### 2.2 报告数据读取

```typescript
// lib/agent/tools/data/queryReports.ts
import fs from 'fs/promises';
import path from 'path';

interface QueryReportsParams {
  subject: string;
  count?: number;
}

export async function queryReports(params: QueryReportsParams) {
  const { subject, count = 3 } = params;
  const reports: any[] = [];

  const subjectDir = path.join(process.cwd(), 'data', 'reports', subject);

  try {
    // 读取所有时间戳文件夹
    const timestampFolders = await fs.readdir(subjectDir);

    // 按时间倒序排序
    timestampFolders.sort().reverse();

    for (const folder of timestampFolders.slice(0, count)) {
      const reportPath = path.join(subjectDir, folder);
      const metaPath = path.join(reportPath, 'meta.json');
      const contentPath = path.join(reportPath, 'report.md');

      try {
        const [metaContent, content] = await Promise.all([
          fs.readFile(metaPath, 'utf-8'),
          fs.readFile(contentPath, 'utf-8')
        ]);

        const report = {
          ...JSON.parse(metaContent),
          content
        };

        reports.push(report);
      } catch (error) {
        console.error(`Error reading report ${folder}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error reading reports for ${subject}:`, error);
  }

  return reports;
}
```

### 2.3 知识图谱读取

```typescript
// lib/agent/tools/knowledge/searchKnowledgeGraph.ts
import fs from 'fs/promises';
import path from 'path';

interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: Relationship[];
  metadata: {
    subject: string;
    version: string;
    lastUpdated: string;
  };
}

interface KnowledgeNode {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
}

interface Relationship {
  from: string;
  to: string;
  type: string;
  properties?: Record<string, any>;
}

export async function searchKnowledgeGraph(params: {
  subject: string;
  keywords: string[];
  depth?: number;
}) {
  const { subject, keywords, depth = 2 } = params;

  // 读取知识图谱文件
  const graphPath = path.join(process.cwd(), 'data', 'knowledge', 'graphs', `${subject}.json`);

  try {
    const content = await fs.readFile(graphPath, 'utf-8');
    const graph: KnowledgeGraph = JSON.parse(content);

    // 搜索匹配的节点
    const matchedNodes = graph.nodes.filter(node =>
      keywords.some(keyword =>
        node.name.includes(keyword) ||
        node.id.includes(keyword) ||
        JSON.stringify(node.properties).includes(keyword)
      )
    );

    // 根据深度扩展相关节点
    const relatedNodeIds = new Set<string>(matchedNodes.map(n => n.id));

    for (let i = 0; i < depth; i++) {
      const currentIds = Array.from(relatedNodeIds);

      for (const edge of graph.edges) {
        if (currentIds.includes(edge.from) || currentIds.includes(edge.to)) {
          relatedNodeIds.add(edge.from);
          relatedNodeIds.add(edge.to);
        }
      }
    }

    // 构建子图
    const subgraphNodes = graph.nodes.filter(n => relatedNodeIds.has(n.id));
    const subgraphEdges = graph.edges.filter(e =>
      relatedNodeIds.has(e.from) && relatedNodeIds.has(e.to)
    );

    return {
      nodes: subgraphNodes,
      edges: subgraphEdges,
      matchedNodes,
      summary: {
        totalNodes: graph.nodes.length,
        matchedCount: matchedNodes.length,
        expandedCount: subgraphNodes.length
      }
    };
  } catch (error) {
    console.error(`Error loading knowledge graph for ${subject}:`, error);
    return {
      nodes: [],
      edges: [],
      matchedNodes: [],
      error: 'Knowledge graph not found'
    };
  }
}
```

### 2.4 教学大纲读取

```typescript
// lib/agent/tools/knowledge/querySyllabus.ts
import fs from 'fs/promises';
import path from 'path';

export async function querySyllabus(params: {
  subject: string;
  grade?: string;
  topic?: string;
}) {
  const { subject, grade, topic } = params;

  // 构建文件路径
  const subjectPath = path.join(process.cwd(), 'data', 'knowledge', 'syllabus', subject);

  try {
    // 如果指定了年级，读取特定文件
    if (grade) {
      const filePath = path.join(subjectPath, `${grade}.md`);
      const content = await fs.readFile(filePath, 'utf-8');

      return {
        subject,
        grade,
        content: topic ? extractTopic(content, topic) : content
      };
    }

    // 否则读取所有年级
    const files = await fs.readdir(subjectPath);
    const syllabus: any[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(subjectPath, file);
        const content = await fs.readFile(filePath, 'utf-8');

        syllabus.push({
          grade: file.replace('.md', ''),
          content: topic ? extractTopic(content, topic) : content
        });
      }
    }

    return { subject, syllabus };
  } catch (error) {
    console.error(`Error loading syllabus for ${subject}:`, error);
    return { error: 'Syllabus not found' };
  }
}

function extractTopic(content: string, topic: string): string {
  // 简单的主题提取
  const lines = content.split('\n');
  let inTopic = false;
  const topicLines: string[] = [];

  for (const line of lines) {
    if (line.includes(topic)) {
      inTopic = true;
    }

    if (inTopic) {
      topicLines.push(line);
      if (line.startsWith('#') && !line.includes(topic) && topicLines.length > 1) {
        topicLines.pop();
        break;
      }
    }
  }

  return topicLines.join('\n') || 'Topic not found';
}
```

### 2.5 常见错误库读取

```typescript
// lib/agent/tools/knowledge/queryCommonErrors.ts
import fs from 'fs/promises';
import path from 'path';

export async function queryCommonErrors(params: {
  subject: string;
  knowledgePoint?: string;
}) {
  const { subject, knowledgePoint } = params;

  const filePath = path.join(process.cwd(), 'data', 'knowledge', 'common-errors', `${subject}.md`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');

    if (knowledgePoint) {
      // 提取特定知识点的常见错误
      const section = extractSection(content, knowledgePoint);
      return {
        subject,
        knowledgePoint,
        content: section
      };
    }

    return {
      subject,
      content
    };
  } catch (error) {
    console.error(`Error loading common errors for ${subject}:`, error);
    return { error: 'Common errors not found' };
  }
}

function extractSection(content: string, title: string): string {
  const lines = content.split('\n');
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    if (line.includes(title) && line.startsWith('#')) {
      inSection = true;
    }

    if (inSection) {
      sectionLines.push(line);
      if (line.startsWith('#') && !line.includes(title) && sectionLines.length > 1) {
        sectionLines.pop();
        break;
      }
    }
  }

  return sectionLines.join('\n') || 'Section not found';
}
```

---

## 3. 文档索引系统

为了提高查询效率，可以建立简单的文档索引。

### 3.1 索引结构

```typescript
// data/agent/indexes/exams-index.json
{
  "lastUpdated": "2026-03-10T10:00:00Z",
  "totalExams": 50,
  "bySubject": {
    "geometry": {
      "count": 15,
      "dateRange": ["2026-01-01", "2026-03-10"],
      "files": [
        { "date": "20260310", "examId": "exam-123", "path": "geometry/20260310/exam-123" },
        { "date": "20260308", "examId": "exam-124", "path": "geometry/20260308/exam-124" }
      ]
    },
    "algebra": {
      "count": 12,
      "dateRange": ["2026-01-15", "2026-03-09"],
      "files": [...]
    }
  }
}
```

### 3.2 索引构建

```typescript
// lib/agent/index/buildExamIndex.ts
import fs from 'fs/promises';
import path from 'path';

interface ExamIndex {
  lastUpdated: string;
  totalExams: number;
  bySubject: Record<string, {
    count: number;
    dateRange: [string, string];
    files: Array<{
      date: string;
      examId: string;
      path: string;
    }>;
  }>;
}

export async function buildExamIndex() {
  const index: ExamIndex = {
    lastUpdated: new Date().toISOString(),
    totalExams: 0,
    bySubject: {}
  };

  const examsDir = path.join(process.cwd(), 'data', 'exams');

  try {
    const subjectFolders = await fs.readdir(examsDir);

    for (const subject of subjectFolders) {
      const subjectPath = path.join(examsDir, subject);
      const subjectStats = {
        count: 0,
        dateRange: [null as string | null, null as string | null] as [string, string],
        files: []
      };

      const dateFolders = await fs.readdir(subjectPath);

      for (const dateFolder of dateFolders) {
        const datePath = path.join(subjectPath, dateFolder);
        const examFolders = await fs.readdir(datePath);

        for (const examFolder of examFolders) {
          subjectStats.count++;
          subjectStats.files.push({
            date: dateFolder,
            examId: examFolder,
            path: `${subject}/${dateFolder}/${examFolder}`
          });

          // 更新日期范围
          if (!subjectStats.dateRange[0] || dateFolder < subjectStats.dateRange[0]) {
            subjectStats.dateRange[0] = dateFolder;
          }
          if (!subjectStats.dateRange[1] || dateFolder > subjectStats.dateRange[1]) {
            subjectStats.dateRange[1] = dateFolder;
          }

          index.totalExams++;
        }
      }

      // 按日期排序
      subjectStats.files.sort((a, b) => b.date.localeCompare(a.date));

      index.bySubject[subject] = subjectStats;
    }

    // 保存索引
    const indexPath = path.join(process.cwd(), 'data', 'agent', 'indexes', 'exams-index.json');
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

    return index;
  } catch (error) {
    console.error('Error building exam index:', error);
    throw error;
  }
}
```

### 3.3 使用索引查询

```typescript
// lib/agent/index/queryWithIndex.ts
import fs from 'fs/promises';
import path from 'path';

export async function queryExamsWithIndex(params: {
  subject?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const { subject, startDate, endDate, limit } = params;

  // 读取索引
  const indexPath = path.join(process.cwd(), 'data', 'agent', 'indexes', 'exams-index.json');
  const indexContent = await fs.readFile(indexPath, 'utf-8');
  const index = JSON.parse(indexContent);

  const results: any[] = [];

  // 根据索引定位文件
  const subjects = subject ? [subject] : Object.keys(index.bySubject);

  for (const subj of subjects) {
    const subjectIndex = index.bySubject[subj];
    if (!subjectIndex) continue;

    for (const file of subjectIndex.files) {
      // 检查日期范围
      if (startDate && file.date < startDate.replace(/-/g, '')) continue;
      if (endDate && file.date > endDate.replace(/-/g, '')) continue;

      // 检查数量限制
      if (limit && results.length >= limit) break;

      // 读取试卷数据
      const dataPath = path.join(process.cwd(), 'data', 'exams', file.path, 'data.json');
      const content = await fs.readFile(dataPath, 'utf-8');
      results.push(JSON.parse(content));
    }

    if (limit && results.length >= limit) break;
  }

  return results;
}
```

---

## 4. 缓存机制

### 4.1 统计数据缓存

```typescript
// lib/agent/cache/statisticsCache.ts
import fs from 'fs/promises';
import path from 'path';

interface CachedStatistics {
  key: string;
  data: any;
  timestamp: string;
  ttl: number;  // Time to live (seconds)
}

export async function getCachedStatistics(
  subject: string,
  params: any
): Promise<any | null> {
  const cacheKey = generateCacheKey(subject, params);
  const cachePath = path.join(process.cwd(), 'data', 'agent', 'cache', 'statistics', `${cacheKey}.json`);

  try {
    const content = await fs.readFile(cachePath, 'utf-8');
    const cached: CachedStatistics = JSON.parse(content);

    // 检查是否过期
    const age = (Date.now() - new Date(cached.timestamp).getTime()) / 1000;
    if (age > cached.ttl) {
      await fs.unlink(cachePath);
      return null;
    }

    return cached.data;
  } catch {
    return null;
  }
}

export async function setCachedStatistics(
  subject: string,
  params: any,
  data: any,
  ttl: number = 3600  // 默认1小时
): Promise<void> {
  const cacheKey = generateCacheKey(subject, params);
  const cachePath = path.join(process.cwd(), 'data', 'agent', 'cache', 'statistics', `${cacheKey}.json`);

  await fs.mkdir(path.dirname(cachePath), { recursive: true });

  const cached: CachedStatistics = {
    key: cacheKey,
    data,
    timestamp: new Date().toISOString(),
    ttl
  };

  await fs.writeFile(cachePath, JSON.stringify(cached, null, 2));
}

function generateCacheKey(subject: string, params: any): string {
  const paramsStr = JSON.stringify(params);
  const hash = Buffer.from(paramsStr).toString('base64').replace(/[/+=]/g, '');
  return `${subject}-${hash.substring(0, 20)}`;
}
```

---

## 5. 更新后的技术栈

| 组件 | 技术选型 |
|------|---------|
| **LLM** | Qwen3.5-Plus (支持长上下文、工具调用) |
| **框架** | LangChain / LangGraph |
| **数据存储** | **本地文件系统 (JSON/MD)** |
| **索引** | 内存索引 + JSON 索引文件 |
| **缓存** | 文件系统缓存 |
| **后端** | Next.js API Routes |
| **前端** | React + TypeScript + Tailwind |
| **记忆存储** | 文件系统 (JSON) |

---

## 6. 优势与限制

### 6.1 本地文件系统优势

| 优势 | 说明 |
|------|------|
| **简单** | 无需额外的数据库依赖 |
| **快速** | 文件读取速度快，无需网络请求 |
| **透明** | 数据格式清晰，便于调试 |
| **可靠** | 无需担心数据库服务故障 |
| **及时** | 数据更新立即可用，无需重新索引 |
| **成本** | 无额外存储成本 |

### 6.2 注意事项

| 注意事项 | 解决方案 |
|---------|---------|
| **文件数量限制** | 使用索引加速查询 |
| **并发访问** | 使用文件锁或队列 |
| **数据一致性** | 定期重建索引 |
| **搜索性能** | 对大量数据使用缓存 |

---

## 7. 知识库示例

### 7.1 知识图谱示例 (geometry.json)

```json
{
  "metadata": {
    "subject": "geometry",
    "version": "1.0",
    "lastUpdated": "2026-03-10"
  },
  "nodes": [
    {
      "id": "geo:triangle",
      "name": "三角形",
      "type": "shape",
      "properties": {
        "grade": "七年级",
        "importance": "critical",
        "topics": ["全等三角形", "相似三角形", "勾股定理"]
      }
    },
    {
      "id": "geo:circle",
      "name": "圆",
      "type": "shape",
      "properties": {
        "grade": "八年级",
        "importance": "critical",
        "topics": ["圆心角", "圆周角", "切线"]
      }
    },
    {
      "id": "geo:quadrilateral",
      "name": "四边形",
      "type": "shape",
      "properties": {
        "grade": "七年级",
        "importance": "important",
        "topics": ["平行四边形", "矩形", "菱形", "正方形"]
      }
    }
  ],
  "edges": [
    {
      "from": "geo:triangle",
      "to": "geo:quadrilateral",
      "type": "prerequisite",
      "properties": {
        "reason": "三角形是理解多边形的基础"
      }
    },
    {
      "from": "geo:circle",
      "to": "geo:triangle",
      "type": "advanced",
      "properties": {
        "reason": "圆的知识需要三角形角度知识"
      }
    }
  ]
}
```

### 7.2 教学大纲示例 (math/junior-high.md)

```markdown
# 初中数学教学大纲

## 七年级

### 第一章 有理数
- 正数和负数
- 有理数的加减法
- 有理数的乘除法

### 第二章 整式的加减
- 整式
- 整式的加减
- ...

## 八年级

### 第一章 三角形
- 三角形的边角关系
- 多边形及其内角和
- 全等三角形

### 第二章 轴对称
- 轴对称图形
- 线段的垂直平分线
- ...

## 九年级

### 第一章 一元二次方程
- ...
```

### 7.3 常见错误示例 (geometry.md)

```markdown
# 几何常见错误

## 圆的性质

### 圆心角和圆周角
**常见错误**: 混淆圆心角和圆周角的关系
- 错误: 认为"同弧所对圆周角是圆心角的一半"
- 正确: "同弧所对圆心角是圆周角的两倍" 或 "同弧所对圆周角是圆心角的一半"

**原因**: 定理记忆不准确

**解决方法**:
1. 画图记忆：画出圆心角和圆周角的图形
2. 口诀记忆："大角两倍小角"
3. 练习验证：用具体角度验证关系

### 切线的性质
**常见错误**: 忽略切线垂直于半径的性质
- 错误: 计算时忘记使用垂直关系
- 正确: 切线一定垂直于过切点的半径

**原因**: 理解不深入

**解决方法**:
1. 记住图形特征：切线与半径形成直角
2. 多做相关证明题
3. 总结常见题型
```

---

**文档结束**
