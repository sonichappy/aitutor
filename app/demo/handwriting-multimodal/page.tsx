'use client'

/**
 * 多模态手写识别演示页面
 * 展示使用通义千问 VL 等多模态大模型进行智能识别
 */

import { useState } from 'react'
import { MultimodalHandwritingInput } from '@/components/MultimodalHandwritingInput'
import { MultimodalJudgeResult } from '@/lib/handwriting/multimodal-recognizer'

export default function MultimodalHandwritingDemoPage() {
  const [mode, setMode] = useState<'intro' | 'demo'>('intro')

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* 标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🤖 多模态 AI 手写识别</h1>
        <p className="text-gray-600">
          使用通义千问 VL 等多模态大模型，提供智能识别和个性化反馈
        </p>
      </div>

      {/* 对比卡片 */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">🔍 传统 OCR</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ 识别速度快</li>
            <li>✓ 成本低</li>
            <li>✗ 只能识别文字</li>
            <li>✗ 无法提供反馈</li>
          </ul>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
          <h3 className="font-semibold text-purple-900 mb-2">✨ 多模态 AI</h3>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>✓ 智能识别文字</li>
            <li>✓ 提供详细反馈</li>
            <li>✓ 书写建议</li>
            <li>✓ 理解上下文</li>
          </ul>
        </div>
      </div>

      {/* 模式切换 */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setMode('intro')}
          className={`px-4 py-2 rounded ${
            mode === 'intro'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          功能介绍
        </button>
        <button
          onClick={() => setMode('demo')}
          className={`px-4 py-2 rounded ${
            mode === 'demo'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          在线演示
        </button>
      </div>

      {/* 功能介绍 */}
      {mode === 'intro' && (
        <div className="space-y-6">
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">核心优势</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-purple-900 mb-2">🎓 教育价值</h3>
                <p className="text-sm text-gray-600">
                  不仅能识别文字，还能分析书写质量，提供具体的改进建议，
                  就像真正的老师在旁边指导一样。
                </p>
              </div>
              <div>
                <h3 className="font-medium text-purple-900 mb-2">💬 智能反馈</h3>
                <p className="text-sm text-gray-600">
                  针对学生的书写给出鼓励性的反馈，指出优点和需要改进的地方，
                  激发学习兴趣。
                </p>
              </div>
              <div>
                <h3 className="font-medium text-purple-900 mb-2">🔗 无缝集成</h3>
                <p className="text-sm text-gray-600">
                  直接使用您已有的通义千问 API，无需额外申请 OCR 服务，
                  统一的 AI 调用接口。
                </p>
              </div>
              <div>
                <h3 className="font-medium text-purple-900 mb-2">🧠 智能理解</h3>
                <p className="text-sm text-gray-600">
                  能理解模糊字迹，结合上下文判断，即使书写不够工整
                  也能准确识别。
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">适用场景</h2>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-purple-500">✓</span>
                <span><strong>语文字词考核</strong>：识别手写词语，判断正误，提供书写建议</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500">✓</span>
                <span><strong>英语单词拼写</strong>：识别手写单词，检查拼写，纠正书写规范</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500">✓</span>
                <span><strong>数学公式识别</strong>：识别手写公式，检查步骤，给出解题提示</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500">✓</span>
                <span><strong>作文批改</strong>：识别手写作文，提供批改建议和评分</span>
              </li>
            </ul>
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">技术方案</h2>
            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <h3 className="font-medium text-gray-900 mb-1">支持的多模态模型</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>通义千问 VL</strong>（推荐）- 国内访问快，价格低</li>
                  <li><strong>GPT-4V</strong> - 准确率最高</li>
                  <li><strong>Claude 3.5 Sonnet</strong> - 理解能力强</li>
                  <li><strong>Gemini Pro Vision</strong> - 价格便宜</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">成本估算</h3>
                <p>约 ¥0.5 - ¥2 / 1000 次识别，与专用 OCR 相当，但提供更多价值</p>
              </div>
            </div>
          </section>

          <div className="text-center">
            <button
              onClick={() => setMode('demo')}
              className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium"
            >
              立即体验 →
            </button>
          </div>
        </div>
      )}

      {/* 在线演示 */}
      {mode === 'demo' && (
        <div className="space-y-6">
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">📝 在线演示</h2>
            <p className="text-gray-600 mb-4">
              在下方画板中手写词语<strong>"侍弄"</strong>，系统会自动识别并给出详细反馈。
            </p>

            <MultimodalHandwritingInput
              width={500}
              height={250}
              correctAnswer="侍弄"
              placeholder="请手写：侍弄"
              onJudged={(result) => {
                console.log('判题结果:', result)
              }}
            />
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">💡 测试建议</h2>
            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">正确答案测试</h3>
                <p>手写"侍弄"，观察系统如何识别和反馈</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2">错误答案测试</h3>
                <p>手写其他词语或故意写错，观察系统的反馈是否鼓励性</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2">书写质量测试</h3>
                <p>尝试工整书写和潦草书写，对比系统的识别准确率</p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">📊 实际效果示例</h2>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded border border-green-200">
                <p className="font-medium text-green-900 mb-2">✅ 书写正确</p>
                <p className="text-sm text-gray-700">
                  <strong>反馈：</strong>识别正确！学生的书写很工整，"侍"字的"彳"旁写得很好，
                  笔画顺序正确。建议"弄"字下部的笔画可以更饱满一些，整体结构会更美观。
                </p>
              </div>
              <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
                <p className="font-medium text-yellow-900 mb-2">⚠️ 识别错误</p>
                <p className="text-sm text-gray-700">
                  <strong>反馈：</strong>识别结果为"诗弄"，与期望答案"侍弄"不同。
                  "侍"字是双人旁，"诗"字是言字旁，请注意区分。继续加油，多练习会写得更好！
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
