'use client'

/**
 * 语文字词库主页面
 */

import Link from 'next/link'

export default function ChineseWordsPage() {
  const stats = [
    {
      icon: '📚',
      title: '58 个字词',
      description: '已导入七年级下册重点字词'
    },
    {
      icon: '📖',
      title: '1 个知识库',
      description: '初中语文课本 - 重点字词'
    },
    {
      icon: '✨',
      title: '多种练习',
      description: '拼音、释义、手写等多种题型'
    }
  ]

  const actions = [
    {
      title: '查看字词库',
      description: '浏览所有已导入的字词',
      icon: '👁️',
      href: '/demo/knowledge-base-view',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: '导入字词表',
      description: '从 exercises 目录导入新的字词表',
      icon: '📥',
      href: '/demo/knowledge-base-import',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: '上传字词表',
      description: '手动上传 Markdown 格式的字词表',
      icon: '📤',
      href: '/demo/knowledge-base-upload',
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      title: '手写识别演示',
      description: '体验多模态 AI 手写识别功能',
      icon: '✍️',
      href: '/demo/handwriting-multimodal',
      color: 'bg-orange-500 hover:bg-orange-600'
    }
  ]

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* 标题 */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">📚 语文字词库</h1>
        <p className="text-xl text-gray-600">
          智能字词学习系统，支持在线练习和手写识别
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-4xl mb-3">{stat.icon}</div>
            <h3 className="text-xl font-semibold mb-2">{stat.title}</h3>
            <p className="text-sm text-gray-600">{stat.description}</p>
          </div>
        ))}
      </div>

      {/* 功能卡片 */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 text-center">功能入口</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {actions.map((action, index) => (
            <Link key={index} href={action.href}>
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{action.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{action.title}</h3>
                    <p className="text-sm text-gray-600">{action.description}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 使用指南 */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">📖 使用指南</h2>
        <div className="space-y-4 text-sm text-blue-800">
          <div>
            <h3 className="font-medium mb-2">1. 查看字词库</h3>
            <p>点击"查看字词库"可以浏览所有已导入的字词，支持搜索和筛选。</p>
          </div>
          <div>
            <h3 className="font-medium mb-2">2. 导入新字词</h3>
            <p>将 Markdown 格式的字词表放到 <code className="bg-blue-100 px-2 py-1 rounded">data/exercises/chinese</code> 目录，然后点击"导入字词表"即可。</p>
          </div>
          <div>
            <h3 className="font-medium mb-2">3. 手写练习</h3>
            <p>点击"手写识别演示"可以体验多模态 AI 手写识别功能，支持智能判题和详细反馈。</p>
          </div>
        </div>
      </div>

      {/* 字词示例 */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">📝 字词示例</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { word: '元勋', pinyin: 'yuán xūn', meaning: '立大功的人' },
            { word: '锲而不舍', pinyin: 'qiè ér bù shě', meaning: '不停地雕刻，比喻有恒心，有毅力' },
            { word: '鹤立鸡群', pinyin: 'hè lì jī qún', meaning: '比喻一个人的才能或仪表在一群人里显得很突出' },
            { word: '可歌可泣', pinyin: 'kě gē kě qì', meaning: '值得歌颂赞美，使人感动流泪' }
          ].map((item, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-blue-900">{item.word}</span>
                <span className="text-sm text-gray-600">{item.pinyin}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{item.meaning}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
