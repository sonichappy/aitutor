import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AnalysisPage() {
  // 模拟数据 - 实际应从数据库获取
  const analysisData = {
    overallMastery: 68,
    totalQuestions: 128,
    correctRate: 82,
    studyHours: 24,
  }

  const subjectAnalysis = [
    {
      subject: "数学",
      mastery: 75,
      questions: 45,
      weakPoints: ["二次函数", "三角函数", "立体几何"],
      strongPoints: ["代数运算", "函数基础", "方程求解"],
    },
    {
      subject: "物理",
      mastery: 60,
      questions: 32,
      weakPoints: ["力学综合", "电场分析", "动量守恒"],
      strongPoints: ["运动学", "力的分析", "能量守恒"],
    },
    {
      subject: "化学",
      mastery: 70,
      questions: 28,
      weakPoints: ["氧化还原反应", "化学平衡", "电化学"],
      strongPoints: ["原子结构", "元素周期律", "化学键"],
    },
  ]

  const recommendations = [
    {
      priority: "高",
      title: "重点加强：二次函数",
      description: "你在二次函数题目上的正确率只有55%，建议先复习基础概念",
      action: "开始练习",
    },
    {
      priority: "中",
      title: "巩固提升：力学综合",
      description: "力学综合题涉及多个知识点，建议分模块练习",
      action: "查看解析",
    },
    {
      priority: "低",
      title: "保持练习：代数运算",
      description: "这部分掌握较好，建议定期练习保持手感",
      action: "开始练习",
    },
  ]

  const priorityColor = {
    高: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    中: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    低: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  }

  return (
    <div className="space-y-8">
      {/* 标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          学习诊断报告
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          基于你的学习数据生成的个性化分析
        </p>
      </div>

      {/* 总体概览 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总体掌握度</CardDescription>
            <CardTitle className="text-3xl">{analysisData.overallMastery}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>累计练习</CardDescription>
            <CardTitle className="text-3xl">{analysisData.totalQuestions}题</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>整体正确率</CardDescription>
            <CardTitle className="text-3xl">{analysisData.correctRate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>学习时长</CardDescription>
            <CardTitle className="text-3xl">{analysisData.studyHours}小时</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 各科目详细分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {subjectAnalysis.map((subject) => (
          <Card key={subject.subject}>
            <CardHeader>
              <CardTitle>{subject.subject}</CardTitle>
              <CardDescription>掌握度: {subject.mastery}%</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 进度条 */}
              <div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all"
                    style={{ width: `${subject.mastery}%` }}
                  />
                </div>
              </div>

              {/* 薄弱点 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  需要加强
                </h4>
                <div className="flex flex-wrap gap-1">
                  {subject.weakPoints.map((point) => (
                    <span
                      key={point}
                      className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs"
                    >
                      {point}
                    </span>
                  ))}
                </div>
              </div>

              {/* 优势点 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  掌握较好
                </h4>
                <div className="flex flex-wrap gap-1">
                  {subject.strongPoints.map((point) => (
                    <span
                      key={point}
                      className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs"
                    >
                      {point}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 学习建议 */}
      <Card>
        <CardHeader>
          <CardTitle>个性化学习建议</CardTitle>
          <CardDescription>基于你的学习情况生成的推荐</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <span
                  className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${priorityColor[rec.priority as keyof typeof priorityColor]}`}
                >
                  {rec.priority}优先级
                </span>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {rec.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {rec.description}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  {rec.action}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 导出报告 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">需要更详细的报告？</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                导出完整的学习诊断报告，包含所有数据分析
              </p>
            </div>
            <Button>导出报告</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
