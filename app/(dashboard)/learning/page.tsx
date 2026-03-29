"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, BookOpen, Loader2, Archive, Trash2, Edit, Plus, X } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import { Checkbox } from "@/components/ui/checkbox"
import { WordLibraryUploadDialog } from "@/components/WordLibraryUploadDialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Subject {
  id: string
  name: string
  icon: string
  color: string
  enabled: boolean
  category: string
  folderName: string
}

interface ExerciseQuestion {
  id: string
  type: string
  content: string
  options?: string[]
  correctAnswer: string
  explanation?: string
  difficulty: number
  knowledgePoint: string
}

interface ExerciseMaterial {
  id: string
  knowledgePoint: string
  severity: number
  learningContent: string
  questions: ExerciseQuestion[]
  sources: string[]
  createdAt: string
}

interface SavedWeakPoint {
  point: string
  severity: number
  reason: string
  priority: number
  count: number
  sourceReports: string[]
  addedAt: string
  archived?: boolean
  archivedAt?: string
}

interface KnowledgeLibrary {
  id: string
  subject: string
  name: string
  description: string
  wordCount: number
  sourceFile: string
  createdAt: string
  updatedAt: string
}

interface WordData {
  id: string
  word: string
  pinyin: string
  meanings: string[]
}

interface WordError {
  wordId: string
  word: string
  errorCount: number
  lastErrorAt: string
  libraryId?: string
  subject?: string
}

export default function LearningPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [userAnswer, setUserAnswer] = useState("")

  // 薄弱知识点相关
  const [savedWeakPoints, setSavedWeakPoints] = useState<SavedWeakPoint[]>([])
  const [selectedWeakPoints, setSelectedWeakPoints] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [generateContentType, setGenerateContentType] = useState<'both' | 'content' | 'questions'>('both')

  // 学习资料相关
  const [materials, setMaterials] = useState<ExerciseMaterial[]>([])
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<ExerciseMaterial | null>(null)
  const [editingMaterial, setEditingMaterial] = useState<ExerciseMaterial | null>(null)
  const [editingQuestions, setEditingQuestions] = useState<ExerciseQuestion[]>([])

  // 知识库相关
  const [knowledgeLibraries, setKnowledgeLibraries] = useState<KnowledgeLibrary[]>([])
  const [selectedLibrary, setSelectedLibrary] = useState<KnowledgeLibrary | null>(null)
  const [libraryWords, setLibraryWords] = useState<WordData[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [wordErrors, setWordErrors] = useState<WordError[]>([])
  const [showUploadDialog, setShowUploadDialog] = useState(false)

  // 编辑薄弱知识点标题
  const [editingWeakPoint, setEditingWeakPoint] = useState<string | null>(null)
  const [editWeakPointTitle, setEditWeakPointTitle] = useState('')

  // 页面布局选项卡
  const [mainActiveTab, setMainActiveTab] = useState<'weak-points' | 'learning-resources'>('learning-resources')

  // 分组展开状态
  const [expandedLibraryGroups, setExpandedLibraryGroups] = useState<Set<string>>(new Set())

  // 分组名称编辑状态
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null)
  const [customGroupNames, setCustomGroupNames] = useState<{ [key: string]: string }>({})
  const [editedGroupName, setEditedGroupName] = useState('')

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const response = await fetch('/api/subjects')
        if (response.ok) {
          const data = await response.json()
          const enabledSubjects = data.subjects?.filter((s: Subject) => s.enabled) || []
          setSubjects(enabledSubjects)
          if (enabledSubjects.length > 0) {
            setSelectedSubject(enabledSubjects[0].name)
          }
        }
      } catch (error) {
        console.error("[Learning Page] Failed to load subjects:", error)
      } finally {
        setLoading(false)
      }
    }
    loadSubjects()
  }, [])

  // 切换学科时重置状态
  useEffect(() => {
    if (selectedSubject) {
      loadSavedWeakPoints()
      loadMaterials()
      loadKnowledgeLibraries()
      setSelectedWeakPoints(new Set())
      setExpandedLibraryGroups(new Set())
      setExpandedMaterial(null)
      setSelectedMaterial(null)
      setSelectedLibrary(null)
      setLibraryWords([])
      setCurrentQuestion(0)
      setShowAnswer(false)
      setUserAnswer("")

      // 加载自定义分组名称
      loadCustomGroupNames()

      // 语文学科默认显示学习资源，其他学科默认显示薄弱知识点
      if (selectedSubject === "语文") {
        setMainActiveTab('learning-resources')
      } else {
        setMainActiveTab('weak-points')
      }
    }
  }, [selectedSubject])

  // 加载自定义分组名称
  const loadCustomGroupNames = () => {
    try {
      const storageKey = `weak-points-group-names-${selectedSubject}`
      const savedNames = localStorage.getItem(storageKey)
      if (savedNames) {
        setCustomGroupNames(JSON.parse(savedNames))
      }
    } catch (error) {
      console.error('Failed to load custom group names:', error)
    }
  }

  // 保存自定义分组名称
  const saveCustomGroupName = (libraryId: string, name: string) => {
    try {
      const storageKey = `weak-points-group-names-${selectedSubject}`
      const updatedNames = { ...customGroupNames, [libraryId]: name }
      setCustomGroupNames(updatedNames)
      localStorage.setItem(storageKey, JSON.stringify(updatedNames))
    } catch (error) {
      console.error('Failed to save custom group name:', error)
    }
  }

  // 开始编辑分组名称
  const handleStartEditGroupName = (libraryId: string, currentName: string) => {
    setEditingGroupName(libraryId)
    setEditedGroupName(customGroupNames[libraryId] || currentName)
  }

  // 保存分组名称
  const handleSaveGroupName = (libraryId: string) => {
    if (editedGroupName.trim()) {
      saveCustomGroupName(libraryId, editedGroupName.trim())
      setEditingGroupName(null)
      setEditedGroupName('')
    }
  }

  // 取消编辑分组名称
  const handleCancelEditGroupName = () => {
    setEditingGroupName(null)
    setEditedGroupName('')
  }

  // 重置自定义分组名称
  const handleResetGroupName = (libraryId: string) => {
    if (confirm('确定要重置为原始名称吗？')) {
      const updatedNames = { ...customGroupNames }
      delete updatedNames[libraryId]
      setCustomGroupNames(updatedNames)

      const storageKey = `weak-points-group-names-${selectedSubject}`
      localStorage.setItem(storageKey, JSON.stringify(updatedNames))
    }
  }

  // 从sourceReports中提取libraryId
  const extractLibraryId = (wp: SavedWeakPoint): string | null => {
    if (!wp.sourceReports || wp.sourceReports.length === 0) return null
    const sourceReport = wp.sourceReports[0]
    // 格式: word-word-{libraryId}-{uniqueId}-{timestamp}
    const parts = sourceReport.split('-')
    if (parts.length >= 4 && parts[0] === 'word' && parts[1] === 'word') {
      return parts[2] // 这是libraryId
    }
    return null
  }

  // 按字词库分组薄弱知识点
  const groupWeakPointsByLibrary = (weakPoints: SavedWeakPoint[]) => {
    const groups: { [libraryId: string]: SavedWeakPoint[] } = {}

    weakPoints.forEach(wp => {
      const libraryId = extractLibraryId(wp)
      const key = libraryId || 'ungrouped'
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(wp)
    })

    return groups
  }

  // 切换分组展开/折叠
  const toggleLibraryGroup = (libraryId: string) => {
    setExpandedLibraryGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(libraryId)) {
        newSet.delete(libraryId)
      } else {
        newSet.add(libraryId)
      }
      return newSet
    })
  }

  // 按分组批量归档
  const archiveLibraryGroup = async (libraryId: string) => {
    const groups = groupWeakPointsByLibrary(currentWeakPoints)
    const pointsInGroup = groups[libraryId] || []

    if (pointsInGroup.length === 0) return

    if (!confirm(`确定要归档"${pointsInGroup.length}个字词"的薄弱知识点吗？`)) {
      return
    }

    for (const wp of pointsInGroup) {
      await archiveWeakPoint(wp.point)
    }
  }

  // 加载保存的薄弱知识点列表
  const loadSavedWeakPoints = async () => {
    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/weak-points`)
      if (response.ok) {
        const data = await response.json()
        const points = data.weakPoints || []
        setSavedWeakPoints(points.sort((a: SavedWeakPoint, b: SavedWeakPoint) => a.priority - b.priority))
      }
    } catch (error) {
      console.error("Failed to load saved weak points:", error)
    }
  }

  // 加载学习材料
  const loadMaterials = async () => {
    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/materials`)
      if (response.ok) {
        const data = await response.json()
        setMaterials(data.materials || [])

        // 加载所有字词库的错误记录
        const allLibraryIds = new Set<string>()
        data.materials?.forEach((material: ExerciseMaterial) => {
          if (material.sources) {
            material.sources.forEach(source => {
              const parts = source.split('-')
              if (parts.length >= 3 && parts[0] === 'word' && parts[1] === 'word') {
                allLibraryIds.add(parts[2]) // libraryId
              }
            })
          }
        })

        // 加载所有相关库的错误记录
        const allErrors: WordError[] = []
        for (const libraryId of allLibraryIds) {
          try {
            const errorResponse = await fetch(`/api/knowledge-base/${libraryId}/errors`)
            if (errorResponse.ok) {
              const errorData = await errorResponse.json()
              allErrors.push(...(errorData.data?.errors || []))
            }
          } catch (error) {
            console.error(`Failed to load errors for library ${libraryId}:`, error)
          }
        }
        setWordErrors(allErrors)
      }
    } catch (error) {
      console.error("Failed to load materials:", error)
    }
  }

  // 加载知识库列表（仅语文学科）
  const loadKnowledgeLibraries = async () => {
    if (selectedSubject !== "语文") {
      setKnowledgeLibraries([])
      setWordErrors([])
      return
    }

    try {
      const subjectFolder = subjects.find(s => s.name === selectedSubject)?.folderName || "chinese"
      const response = await fetch(`/api/knowledge-base/libraries?subject=${subjectFolder}`)
      if (response.ok) {
        const data = await response.json()
        const libraries = data.data?.libraries || []
        setKnowledgeLibraries(libraries)

        // 加载所有字词库的错误记录
        const allErrors: WordError[] = []
        for (const library of libraries) {
          try {
            const errorResponse = await fetch(`/api/knowledge-base/${library.id}/errors`)
            if (errorResponse.ok) {
              const errorData = await errorResponse.json()
              allErrors.push(...(errorData.data?.errors || []))
            }
          } catch (error) {
            console.error(`Failed to load errors for library ${library.id}:`, error)
          }
        }
        setWordErrors(allErrors)
      }
    } catch (error) {
      console.error("Failed to load knowledge libraries:", error)
    }
  }

  // 加载知识库字词
  const loadLibraryWords = async (libraryId: string) => {
    setLoadingLibrary(true)
    // 先清空之前的字词和错误记录
    setLibraryWords([])
    setWordErrors([])
    try {
      const response = await fetch(`/api/knowledge-base/${libraryId}`)
      if (response.ok) {
        const data = await response.json()
        setLibraryWords(data.data?.words || [])
        await loadWordErrors(libraryId)
      }
    } catch (error) {
      console.error("Failed to load library words:", error)
    } finally {
      setLoadingLibrary(false)
    }
  }

  // 加载字词错误记录
  const loadWordErrors = async (libraryId: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/${libraryId}/errors`)
      if (response.ok) {
        const data = await response.json()
        setWordErrors(data.data?.errors || [])
      }
    } catch (error) {
      console.error("Failed to load word errors:", error)
    }
  }

  // 标记字词错误
  const markWordError = async (word: WordData) => {
    try {
      const response = await fetch('/api/knowledge-base/word-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId: selectedLibrary?.id,
          wordId: word.id,
          word: word.word,
          subject: selectedSubject
        })
      })

      if (response.ok) {
        // 更新本地错误记录
        setWordErrors(prev => {
          const existing = prev.find(e => e.wordId === word.id)
          if (existing) {
            return prev.map(e =>
              e.wordId === word.id
                ? { ...e, errorCount: e.errorCount + 1, lastErrorAt: new Date().toISOString() }
                : e
            )
          } else {
            return [...prev, {
              wordId: word.id,
              word: word.word,
              errorCount: 1,
              lastErrorAt: new Date().toISOString()
            }]
          }
        })

        // 直接添加为薄弱知识点（不弹确认）
        await addWeakPointFromWord(word)
      }
    } catch (error) {
      console.error("Failed to mark word error:", error)
    }
  }

  // 从字词添加薄弱知识点
  const addWeakPointFromWord = async (word: WordData) => {
    try {
      const pointName = `字词掌握：${word.word}`
      console.log('[addWeakPointFromWord] Starting for word:', word.word, 'pointName:', pointName)
      console.log('[addWeakPointFromWord] Current weak points:', savedWeakPoints)

      const existingPoint = savedWeakPoints.find(wp => wp.point === pointName)
      console.log('[addWeakPointFromWord] Existing point:', existingPoint)

      if (existingPoint) {
        // 已存在，更新优先级和严重程度
        console.log('[addWeakPointFromWord] Updating existing point...')
        const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/weak-points`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            point: existingPoint.point,
            updates: {
              severity: Math.min(existingPoint.severity + 1, 5),
              priority: Math.max(existingPoint.priority - 1, 1),
              count: existingPoint.count + 1
            }
          })
        })

        console.log('[addWeakPointFromWord] PATCH response status:', response.status)

        if (response.ok) {
          console.log('[addWeakPointFromWord] Successfully updated, reloading...')
          await loadSavedWeakPoints()
        } else {
          const errorData = await response.json()
          console.error('[addWeakPointFromWord] Failed to update weak point:', errorData)
        }
      } else {
        // 不存在，创建新的
        console.log('[addWeakPointFromWord] Creating new weak point...')
        const requestBody = {
          weakPoints: [{
            point: pointName,
            severity: 3,
            reason: `字词"${word.word}"（${word.pinyin}）在练习中多次出错，含义：${word.meanings.join('、')}`,
            priority: 2,
            sourceReportId: `word-${word.id}-${Date.now()}`
          }]
        }
        console.log('[addWeakPointFromWord] POST request body:', requestBody)

        const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/weak-points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })

        console.log('[addWeakPointFromWord] POST response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('[addWeakPointFromWord] POST response data:', data)
          console.log('[addWeakPointFromWord] Successfully added, reloading...')
          await loadSavedWeakPoints()
        } else {
          const errorData = await response.json()
          console.error('[addWeakPointFromWord] Failed to add weak point:', errorData)
          alert(`添加失败：${errorData.error || '未知错误'}`)
        }
      }
    } catch (error) {
      console.error('[addWeakPointFromWord] Exception:', error)
    }
  }

  // 归档薄弱知识点
  const archiveWeakPoint = async (point: string) => {
    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/weak-points`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          point: point,
          updates: {
            archived: true,
            archivedAt: new Date().toISOString()
          }
        })
      })

      if (response.ok) {
        await loadSavedWeakPoints()
      } else {
        const errorData = await response.json()
        console.error('Failed to archive weak point:', errorData)
        alert(`归档失败：${errorData.error || '未知错误'}`)
      }
    } catch (error) {
      console.error("Failed to archive weak point:", error)
      alert("归档失败")
    }
  }

  // 生成学习内容
  const handleGenerateContent = async () => {
    if (selectedWeakPoints.size === 0) {
      alert("请先选择至少一个薄弱知识点")
      return
    }

    setGenerating(true)

    try {
      const selectedPointsList = savedWeakPoints.filter(wp => selectedWeakPoints.has(wp.point))
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/generate-materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weakPoints: selectedPointsList.map(wp => ({
            point: wp.point,
            severity: wp.severity,
            reason: wp.reason,
            priority: wp.priority
          })),
          generateContent: generateContentType === 'both' || generateContentType === 'content',
          generateQuestions: generateContentType === 'both' || generateContentType === 'questions'
        })
      })

      if (response.ok) {
        const data = await response.json()
        await loadMaterials()
        alert(`学习内容已生成！包含 ${data.materialCount} 个知识点的学习资料`)
      } else {
        const error = await response.json()
        alert(error.error || "生成学习内容失败")
      }
    } catch (error: any) {
      console.error("Failed to generate content:", error)
      alert("生成学习内容失败：" + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSelectMaterial = (material: ExerciseMaterial) => {
    setSelectedMaterial(material)
    setCurrentQuestion(0)
    setShowAnswer(false)
    setUserAnswer("")
    setExpandedMaterial(material.id)
  }

  const handleDeleteMaterial = async (material: ExerciseMaterial) => {
    if (!confirm(`确定要删除"${material.knowledgePoint}"的学习资料吗？\n\n删除后该资料对应的薄弱知识点将被归档。`)) {
      return
    }

    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/materials/${encodeURIComponent(material.id || '')}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message || '删除成功')

        // 刷新学习材料和薄弱知识点
        await loadMaterials()
        await loadSavedWeakPoints()

        // 如果删除的是当前选中的材料，清除选中状态
        if (selectedMaterial?.id === material.id) {
          setSelectedMaterial(null)
          setExpandedMaterial(null)
        }
      } else {
        const error = await response.json()
        alert(`删除失败：${error.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('Failed to delete material:', error)
      alert('删除失败')
    }
  }

  const handleStartEdit = (material: ExerciseMaterial) => {
    setEditingMaterial(material)
    setEditingQuestions(material.questions ? [...material.questions] : [])
  }

  const handleCancelEdit = () => {
    setEditingMaterial(null)
    setEditingQuestions([])
  }

  const handleSaveEdit = async () => {
    if (!editingMaterial) return

    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/materials/${encodeURIComponent(editingMaterial.id || '')}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: editingQuestions
        })
      })

      if (response.ok) {
        alert('保存成功')
        await loadMaterials()
        if (selectedMaterial?.id === editingMaterial.id) {
          setSelectedMaterial({
            ...selectedMaterial,
            questions: editingQuestions
          })
        }
        handleCancelEdit()
      } else {
        const error = await response.json()
        alert(`保存失败：${error.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('Failed to save edit:', error)
      alert('保存失败')
    }
  }

  const handleQuestionChange = (index: number, field: keyof ExerciseQuestion, value: any) => {
    const newQuestions = [...editingQuestions]
    newQuestions[index] = { ...newQuestions[index], [field]: value }
    setEditingQuestions(newQuestions)
  }

  const handleAddQuestion = () => {
    const newQuestion: ExerciseQuestion = {
      id: `q-${Date.now()}`,
      type: 'choice',
      content: '',
      options: ['', '', '', ''],
      correctAnswer: '',
      explanation: '',
      difficulty: 3,
      knowledgePoint: editingMaterial?.knowledgePoint || ''
    }
    setEditingQuestions([...editingQuestions, newQuestion])
  }

  const handleDeleteQuestion = (index: number) => {
    if (!confirm('确定要删除这道题吗？')) return
    const newQuestions = editingQuestions.filter((_, i) => i !== index)
    setEditingQuestions(newQuestions)
  }

  // 编辑薄弱知识点标题
  const handleStartEditWeakPointTitle = (point: string) => {
    setEditingWeakPoint(point)
    setEditWeakPointTitle(point)
  }

  const handleSaveWeakPointTitle = async (originalPoint: string) => {
    if (!editWeakPointTitle.trim()) {
      alert('标题不能为空')
      return
    }

    if (originalPoint === editWeakPointTitle) {
      setEditingWeakPoint(null)
      return
    }

    try {
      const response = await fetch(`/api/learning/${encodeURIComponent(selectedSubject)}/weak-points`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          point: originalPoint,
          updates: { point: editWeakPointTitle.trim() }
        })
      })

      if (response.ok) {
        await loadSavedWeakPoints()
        // 更新选中状态
        const newSelected = new Set(selectedWeakPoints)
        newSelected.delete(originalPoint)
        newSelected.add(editWeakPointTitle.trim())
        setSelectedWeakPoints(newSelected)
        setEditingWeakPoint(null)
      } else {
        const error = await response.json()
        alert(`保存失败：${error.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('Failed to update weak point title:', error)
      alert('保存失败')
    }
  }

  const handleCancelEditWeakPointTitle = () => {
    setEditingWeakPoint(null)
    setEditWeakPointTitle('')
  }

  const handleAnswerSelect = (index: number) => {
    setUserAnswer(index.toString())
  }

  const handleSubmit = () => {
    setShowAnswer(true)
  }

  const handleNext = () => {
    if (currentQuestion < (selectedMaterial?.questions?.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setShowAnswer(false)
      setUserAnswer("")
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
      setShowAnswer(false)
      setUserAnswer("")
    }
  }

  const toggleWeakPointSelection = (point: string) => {
    const newSelected = new Set(selectedWeakPoints)
    if (newSelected.has(point)) {
      newSelected.delete(point)
    } else {
      newSelected.add(point)
    }
    setSelectedWeakPoints(newSelected)
  }

  const getSeverityColor = (severity: number) => {
    if (severity >= 4) return "text-red-600 bg-red-50"
    if (severity >= 3) return "text-orange-600 bg-orange-50"
    return "text-yellow-600 bg-yellow-50"
  }

  const getSeverityLabel = (severity: number) => {
    if (severity >= 4) return "严重薄弱"
    if (severity >= 3) return "较薄弱"
    return "需加强"
  }

  // 上传字词列表
  const handleUploadWordList = async (name: string, description: string, markdown: string) => {
    try {
      const subjectFolder = subjects.find(s => s.name === selectedSubject)?.folderName || "chinese"
      const response = await fetch('/api/knowledge-base/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subjectFolder,
          name,
          description,
          markdown
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`成功上传 ${data.data.wordCount} 个字词`)
        setShowUploadDialog(false)
        await loadKnowledgeLibraries()
      } else {
        const error = await response.json()
        alert(error.error || '上传失败')
      }
    } catch (error) {
      console.error('Failed to upload word list:', error)
      alert('上传失败')
    }
  }

  const currentWeakPoints = savedWeakPoints.filter(wp => !wp.archived)
  const archivedWeakPoints = savedWeakPoints.filter(wp => wp.archived)
  const currentQ = selectedMaterial?.questions?.[currentQuestion]

  // 计算学习资料对应的错误字词数量
  const getMaterialErrorCount = (material: ExerciseMaterial): number => {
    if (!material.sources || material.sources.length === 0) return 0

    // 从sources中提取libraryId
    const libraryIds = new Set<string>()
    material.sources.forEach(source => {
      const parts = source.split('-')
      if (parts.length >= 3 && parts[0] === 'word' && parts[1] === 'word') {
        libraryIds.add(parts[2]) // libraryId
      }
    })

    // 统计所有相关libraryId的错误字词数量
    let totalErrors = 0
    libraryIds.forEach(libraryId => {
      const libraryErrors = wordErrors.filter(e => e.libraryId === libraryId)
      totalErrors += libraryErrors.length
    })

    return totalErrors
  }

  // 根据错误率获取卡片颜色
  const getMaterialErrorColor = (material: ExerciseMaterial): string => {
    const errorCount = getMaterialErrorCount(material)

    if (errorCount === 0) {
      // 没有错误 - 白色
      return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }

    const totalWords = material.sources?.length || 1
    const errorRate = errorCount / totalWords

    if (errorRate >= 0.5) {
      // 错误率 >= 50% - 深红色
      return 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600'
    } else if (errorRate >= 0.3) {
      // 错误率 >= 30% - 中等红色
      return 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
    } else if (errorRate >= 0.2) {
      // 错误率 >= 20% - 橙色
      return 'bg-orange-100 dark:bg-orange-900/30 border-orange-400 dark:border-orange-600'
    } else if (errorRate >= 0.1) {
      // 错误率 >= 10% - 浅黄色
      return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600'
    } else {
      // 错误率 < 10% - 绿色（正确率90%以上）
      return 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600'
    }
  }

  // 计算字词库的错误字词数量
  const getLibraryErrorCount = (libraryId: string): number => {
    return wordErrors.filter(e => e.libraryId === libraryId).length
  }

  // 根据字词库的错误率获取颜色
  const getLibraryErrorColor = (libraryId: string): string => {
    const errorCount = getLibraryErrorCount(libraryId)
    const library = knowledgeLibraries.find(lib => lib.id === libraryId)
    const totalWords = library?.wordCount || 1

    if (errorCount === 0) {
      // 没有错误 - 白色
      return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
    }

    const errorRate = errorCount / totalWords

    if (errorRate >= 0.5) {
      // 错误率 >= 50% - 深红色
      return 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600'
    } else if (errorRate >= 0.3) {
      // 错误率 >= 30% - 中等红色
      return 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
    } else if (errorRate >= 0.2) {
      // 错误率 >= 20% - 橙色
      return 'bg-orange-100 dark:bg-orange-900/30 border-orange-400 dark:border-orange-600'
    } else if (errorRate >= 0.1) {
      // 错误率 >= 10% - 浅黄色
      return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600'
    } else {
      // 错误率 < 10% - 绿色（正确率90%以上）
      return 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="text-center">
          <CardContent className="pt-6">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-500">加载中...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (subjects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="text-gray-500 mb-4">尚未启用任何学科，请先在设置中启用学科</p>
            <Button onClick={() => (window.location.href = "/settings")}>前往设置</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 标题和学科选择 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">个性化学习</h1>

        {/* 学科选择 */}
        <div className="flex gap-2 flex-wrap">
          {subjects.map((subject) => (
            <Button
              key={subject.id}
              variant={selectedSubject === subject.name ? "default" : "outline"}
              onClick={() => setSelectedSubject(subject.name)}
            >
              {subject.icon} {subject.name}
            </Button>
          ))}
        </div>
      </div>

      {/* 主内容选项卡 */}
      <div className="flex gap-2 border-b">
        {selectedSubject === "语文" ? (
          <>
            <Button
              variant={mainActiveTab === 'learning-resources' ? "default" : "ghost"}
              onClick={() => setMainActiveTab('learning-resources')}
              className="rounded-b-none"
            >
              📚 学习资源
            </Button>
            <Button
              variant={mainActiveTab === 'weak-points' ? "default" : "ghost"}
              onClick={() => setMainActiveTab('weak-points')}
              className="rounded-b-none"
            >
              🎯 薄弱知识点 {currentWeakPoints.length > 0 && `(${currentWeakPoints.length})`}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant={mainActiveTab === 'weak-points' ? "default" : "ghost"}
              onClick={() => setMainActiveTab('weak-points')}
              className="rounded-b-none"
            >
              🎯 薄弱知识点 {currentWeakPoints.length > 0 && `(${currentWeakPoints.length})`}
            </Button>
            <Button
              variant={mainActiveTab === 'learning-resources' ? "default" : "ghost"}
              onClick={() => setMainActiveTab('learning-resources')}
              className="rounded-b-none"
            >
              📚 学习资源
            </Button>
          </>
        )}
      </div>

      {/* 薄弱知识点选项卡内容 */}
      {mainActiveTab === 'weak-points' && (
        <div className="space-y-6">
          {/* 当前薄弱知识点 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">当前薄弱知识点</CardTitle>
                  <CardDescription>
                    {currentWeakPoints.length} 个待改进项
                  </CardDescription>
                </div>
                {currentWeakPoints.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allPoints = new Set(currentWeakPoints.map(p => p.point))
                      setSelectedWeakPoints(
                        selectedWeakPoints.size === currentWeakPoints.length ? new Set() : allPoints
                      )
                    }}
                  >
                    {selectedWeakPoints.size === currentWeakPoints.length ? "取消全选" : "全选"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {currentWeakPoints.length === 0 ? (
                <div className="py-8 text-center text-gray-500 border-2 border-dashed rounded-lg">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>暂无薄弱知识点</p>
                  <p className="text-sm mt-1">通过字词练习或从学科报告提取薄弱点</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const groups = groupWeakPointsByLibrary(currentWeakPoints)
                    const libraryIds = Object.keys(groups)

                    return (
                      <div className="space-y-4">
                        {libraryIds.map(libraryId => {
                          const pointsInGroup = groups[libraryId]
                          const isExpanded = expandedLibraryGroups.has(libraryId)

                          // 查找字词库信息
                          const library = knowledgeLibraries.find(lib => lib.id === libraryId)
                          const originalName = library?.name || (libraryId === 'ungrouped' ? '其他来源' : libraryId)
                          const libraryName = customGroupNames[libraryId] || originalName

                          return (
                            <Card key={libraryId} className="border-2">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <div
                                    className="flex items-center gap-2 cursor-pointer flex-1"
                                    onClick={() => {
                                      if (editingGroupName !== libraryId) {
                                        toggleLibraryGroup(libraryId)
                                      }
                                    }}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                    {editingGroupName === libraryId ? (
                                      <div className="flex items-center gap-2 flex-1">
                                        <Input
                                          value={editedGroupName}
                                          onChange={(e) => setEditedGroupName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.stopPropagation()
                                              handleSaveGroupName(libraryId)
                                            } else if (e.key === 'Escape') {
                                              e.stopPropagation()
                                              handleCancelEditGroupName()
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="h-7 text-sm"
                                          autoFocus
                                        />
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-green-600"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleSaveGroupName(libraryId)
                                          }}
                                        >
                                          ✓
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-red-600"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleCancelEditGroupName()
                                          }}
                                        >
                                          ✕
                                        </Button>
                                      </div>
                                    ) : (
                                      <>
                                        <CardTitle className="text-base">
                                          {libraryName}
                                        </CardTitle>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-5 px-1 text-gray-400 hover:text-gray-600"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleStartEditGroupName(libraryId, originalName)
                                          }}
                                          title="编辑分组名称"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                        {customGroupNames[libraryId] && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-5 px-1 text-orange-400 hover:text-orange-600"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleResetGroupName(libraryId)
                                            }}
                                            title="恢复原始名称"
                                          >
                                            ↺
                                          </Button>
                                        )}
                                      </>
                                    )}
                                    <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                      {pointsInGroup.length} 个字词
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      archiveLibraryGroup(libraryId)
                                    }}
                                    className="text-gray-500 hover:text-gray-700"
                                  >
                                    <Archive className="w-4 h-4 mr-1" />
                                    批量归档
                                  </Button>
                                </div>
                              </CardHeader>
                              {isExpanded && (
                                <CardContent className="pt-0">
                                  <div className="space-y-2">
                                    {pointsInGroup.map((wp) => (
                                      <div
                                        key={wp.point}
                                        className={`p-3 rounded-lg border transition-all ${
                                          selectedWeakPoints.has(wp.point)
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div
                                            className="flex items-start gap-3 flex-1 cursor-pointer"
                                            onClick={() => toggleWeakPointSelection(wp.point)}
                                          >
                                            <Checkbox
                                              checked={selectedWeakPoints.has(wp.point)}
                                              onCheckedChange={() => toggleWeakPointSelection(wp.point)}
                                            />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                {editingWeakPoint === wp.point ? (
                                                  <div className="flex items-center gap-2 flex-1">
                                                    <Input
                                                      value={editWeakPointTitle}
                                                      onChange={(e) => setEditWeakPointTitle(e.target.value)}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                          e.stopPropagation()
                                                          handleSaveWeakPointTitle(wp.point)
                                                        } else if (e.key === 'Escape') {
                                                          e.stopPropagation()
                                                          handleCancelEditWeakPointTitle()
                                                        }
                                                      }}
                                                      onClick={(e) => e.stopPropagation()}
                                                      className="h-7 text-sm"
                                                      autoFocus
                                                    />
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-7 px-2 text-green-600"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleSaveWeakPointTitle(wp.point)
                                                      }}
                                                    >
                                                      ✓
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-7 px-2 text-red-600"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleCancelEditWeakPointTitle()
                                                      }}
                                                    >
                                                      ✕
                                                    </Button>
                                                  </div>
                                                ) : (
                                                  <>
                                                    <span className="font-medium text-sm">{wp.point}</span>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-5 px-1 text-gray-400 hover:text-gray-600"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleStartEditWeakPointTitle(wp.point)
                                                      }}
                                                    >
                                                      <Edit className="w-3 h-3" />
                                                    </Button>
                                                  </>
                                                )}
                                                <span className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(wp.severity)}`}>
                                                  {getSeverityLabel(wp.severity)}
                                                </span>
                                                <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                  出现 {wp.count} 次
                                                </span>
                                              </div>
                                              {wp.reason && (
                                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                                  {wp.reason}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => archiveWeakPoint(wp.point)}
                                            className="text-gray-500 hover:text-gray-700"
                                          >
                                            <Archive className="w-4 h-4 mr-1" />
                                            归档
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                          )
                        })}
                      </div>
                    )
                  })()}

                  {/* 生成内容按钮 */}
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">生成内容类型</label>
                      <div className="flex gap-2">
                        <Button
                          variant={generateContentType === 'both' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setGenerateContentType('both')}
                        >
                          讲解+习题
                        </Button>
                        <Button
                          variant={generateContentType === 'content' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setGenerateContentType('content')}
                        >
                          仅讲解
                        </Button>
                        <Button
                          variant={generateContentType === 'questions' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setGenerateContentType('questions')}
                        >
                          仅习题
                        </Button>
                      </div>
                    </div>
                    <Button
                      onClick={handleGenerateContent}
                      disabled={selectedWeakPoints.size === 0 || generating}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : `生成学习内容 (${selectedWeakPoints.size} 个)`}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 归档薄弱知识点 */}
          {archivedWeakPoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-gray-600">归档薄弱知识点</CardTitle>
                <CardDescription>
                  {archivedWeakPoints.length} 个已归档项
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {archivedWeakPoints.map((wp) => (
                    <div
                      key={wp.point}
                      className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-600 dark:text-gray-400">{wp.point}</span>
                        <span className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(wp.severity)}`}>
                          {getSeverityLabel(wp.severity)}
                        </span>
                      </div>
                      {wp.archivedAt && (
                        <p className="text-xs text-gray-500">
                          归档于 {new Date(wp.archivedAt).toLocaleDateString('zh-CN')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 学习资源选项卡内容 */}
      {mainActiveTab === 'learning-resources' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">学习资源</CardTitle>
                <CardDescription>
                  {selectedSubject === "语文"
                    ? `${knowledgeLibraries.length} 个字词库 · ${materials.length} 个学习资料`
                    : `${materials.length} 个知识点已生成`
                  }
                </CardDescription>
              </div>

              {/* 语文学科显示上传按钮 */}
              {selectedSubject === "语文" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUploadDialog(true)}
                >
                  + 上传字词库
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* 非语文学科：显示学习资料 */}
            {selectedSubject !== "语文" ? (
              materials.length === 0 ? (
                <div className="py-8 text-center text-gray-500 border-2 border-dashed rounded-lg">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>暂无学习资料</p>
                  <p className="text-sm mt-1">在"薄弱知识点"标签页中选择薄弱点生成学习内容</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {materials.map((material, index) => {
                    const errorCount = getMaterialErrorCount(material)
                    const errorColor = expandedMaterial === (material.id || index)
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : getMaterialErrorColor(material)

                    return (
                    <div
                      key={material.id || index}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${errorColor}`}
                      onClick={() => handleSelectMaterial(material)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-medium">{material.knowledgePoint}</span>
                            <span className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(material.severity)}`}>
                              {getSeverityLabel(material.severity)}
                            </span>
                            {errorCount > 0 && (
                              <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                错误 {errorCount} 个
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {material.questions?.length || 0} 道练习题
                            {material.learningContent && " · 有讲解"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 h-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStartEdit(material)
                            }}
                          >
                            编辑题目
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 h-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteMaterial(material)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {expandedMaterial === (material.id || index) ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* 展开的学习内容 */}
                      {expandedMaterial === (material.id || index) && material.learningContent && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{material.learningContent}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              )
            ) : (
              /* 语文学科：字词库内容 */
              <>
                {!selectedLibrary ? (
                  // 字词库列表
                  <div className="space-y-3">
                    {knowledgeLibraries.length === 0 ? (
                      <div className="py-8 text-center text-gray-500 border-2 border-dashed rounded-lg">
                        <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>暂无字词库</p>
                        <p className="text-sm mt-1">点击上方按钮上传字词库</p>
                      </div>
                    ) : (
                      knowledgeLibraries.map((library) => {
                        const errorCount = getLibraryErrorCount(library.id)
                        const libraryColor = getLibraryErrorColor(library.id)

                        return (
                        <div
                          key={library.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${libraryColor}`}
                          onClick={() => {
                            setSelectedLibrary(library)
                            loadLibraryWords(library.id)
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium text-sm">{library.name}</h3>
                                {errorCount > 0 && (
                                  <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                    错误 {errorCount} 个
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{library.description}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span>📝 {library.wordCount} 个字词</span>
                                <span>📅 {new Date(library.createdAt).toLocaleDateString('zh-CN')}</span>
                              </div>
                            </div>
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                        )
                      })
                    )}
                  </div>
                ) : (
                  // 字词详情
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedLibrary(null)
                          setLibraryWords([])
                          setWordErrors([])
                        }}
                      >
                        ← 返回列表
                      </Button>
                      <span className="text-sm text-gray-500">
                        {selectedLibrary.name} · {libraryWords.length} 个字词
                      </span>
                    </div>

                    {loadingLibrary ? (
                      <div className="py-8 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                        <p className="text-gray-500">加载中...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {libraryWords.map((word, index) => {
                          const wordError = wordErrors.find(e => e.wordId === word.id)
                          const wordNumber = index + 1
                          return (
                            <div
                              key={word.id}
                              className={`p-3 rounded-lg border transition-all ${
                                wordError
                                  ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                              } hover:shadow-md`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="text-center flex-1">
                                  {/* 编号 */}
                                  <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs font-bold mb-2">
                                    {wordNumber}
                                  </div>
                                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                                    {word.word}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {word.pinyin}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-1"
                                  onClick={() => markWordError(word)}
                                >
                                  ❌ 错误+1
                                </Button>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                {word.meanings.map((meaning, idx) => (
                                  <div key={idx} className="flex items-start gap-1">
                                    <span className="text-gray-400">•</span>
                                    <span>{meaning}</span>
                                  </div>
                                ))}
                              </div>
                              {wordError && (
                                <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
                                  错误 {wordError.errorCount} 次 · 最后: {new Date(wordError.lastErrorAt).toLocaleDateString('zh-CN')}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 练习题区域 */}
      {selectedMaterial && selectedMaterial.questions && selectedMaterial.questions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>练习题目</CardTitle>
                <CardDescription>
                  {selectedMaterial.knowledgePoint} · 第 {currentQuestion + 1} / {selectedMaterial.questions?.length || 0} 题
                </CardDescription>
              </div>
              {currentQ && (
                <span className="text-sm text-gray-500">
                  难度: {"⭐".repeat(Math.min(currentQ.difficulty || 1, 5))}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentQ ? (
              <>
                {/* 题目内容 */}
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-lg">{currentQ.content}</p>
                </div>

                {/* 选项 */}
                {currentQ.options && (
                  <div className="space-y-3">
                    {currentQ.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => !showAnswer && handleAnswerSelect(index)}
                        disabled={showAnswer}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          showAnswer
                            ? currentQ.correctAnswer === String.fromCharCode(65 + index)
                              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                              : userAnswer === index.toString()
                                ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                                : "border-gray-200 dark:border-gray-700"
                            : userAnswer === index.toString()
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <span className="font-medium mr-2">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        {option}
                        {showAnswer && currentQ.correctAnswer === String.fromCharCode(65 + index) && (
                          <CheckCircle2 className="w-5 h-5 text-green-600 inline ml-2" />
                        )}
                        {showAnswer && userAnswer === index.toString() && currentQ.correctAnswer !== String.fromCharCode(65 + index) && (
                          <AlertCircle className="w-5 h-5 text-red-600 inline ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* 答案解析 */}
                {showAnswer && currentQ.explanation && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-medium mb-2">📝 答案解析</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {currentQ.explanation}
                    </p>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestion === 0}
                  >
                    上一题
                  </Button>
                  <div className="flex gap-2">
                    {!showAnswer ? (
                      <Button
                        onClick={handleSubmit}
                        disabled={!userAnswer}
                      >
                        提交答案
                      </Button>
                    ) : (
                      <Button
                        onClick={handleNext}
                        disabled={currentQuestion === (selectedMaterial?.questions?.length || 0) - 1}
                      >
                        下一题
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-gray-500">
                已做完所有练习题
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 上传对话框 */}
      <WordLibraryUploadDialog
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onUpload={handleUploadWordList}
      />

      {/* 题目编辑对话框 */}
      <Dialog open={!!editingMaterial} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMaterial?.id?.startsWith('temp-') ? '创建题目' : '编辑题目'}
            </DialogTitle>
            <DialogDescription>
              {editingMaterial?.knowledgePoint} · {editingQuestions.length} 道题
            </DialogDescription>
          </DialogHeader>

          {/* 显示关联的字词列表 */}
          {editingMaterial?.sources && editingMaterial.sources.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium mb-2">关联的字词：</p>
              <div className="flex flex-wrap gap-2">
                {editingMaterial.sources.map((source, idx) => {
                  // 从sourceReport中提取字词名称
                  const match = source.match(/word-word-[^-]+-[^-]+-(\d+)/)
                  return match ? (
                    <span key={idx} className="px-2 py-1 text-xs bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-800">
                      字词 #{idx + 1}
                    </span>
                  ) : null
                })}
              </div>
            </div>
          )}

          <div className="space-y-6 py-4">
            {editingQuestions.map((question, qIndex) => (
              <Card key={question.id || qIndex} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">题目 {qIndex + 1}</CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteQuestion(qIndex)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 题目内容 */}
                  <div>
                    <Label className="text-sm font-medium">题目内容</Label>
                    <Textarea
                      value={question.content}
                      onChange={(e) => handleQuestionChange(qIndex, 'content', e.target.value)}
                      className="mt-1"
                      rows={3}
                      placeholder="请输入题目内容"
                    />
                  </div>

                  {/* 题目类型 */}
                  <div>
                    <Label className="text-sm font-medium">题目类型</Label>
                    <select
                      value={question.type}
                      onChange={(e) => handleQuestionChange(qIndex, 'type', e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="choice">选择题</option>
                      <option value="fillblank">填空题</option>
                      <option value="essay">简答题</option>
                    </select>
                  </div>

                  {/* 难度 */}
                  <div>
                    <Label className="text-sm font-medium">难度 (1-5)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      value={question.difficulty}
                      onChange={(e) => handleQuestionChange(qIndex, 'difficulty', parseInt(e.target.value))}
                      className="mt-1"
                    />
                  </div>

                  {/* 选项（仅选择题） */}
                  {question.type === 'choice' && (
                    <div>
                      <Label className="text-sm font-medium">选项</Label>
                      <div className="mt-2 space-y-2">
                        {question.options?.map((option, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-2">
                            <span className="text-sm font-medium w-6">
                              {String.fromCharCode(65 + oIndex)}.
                            </span>
                            <Input
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...(question.options || [])]
                                newOptions[oIndex] = e.target.value
                                handleQuestionChange(qIndex, 'options', newOptions)
                              }}
                              placeholder={`选项 ${String.fromCharCode(65 + oIndex)}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 正确答案 */}
                  <div>
                    <Label className="text-sm font-medium">
                      正确答案 {question.type === 'choice' ? '(请输入选项字母，如 A、B、C、D)' : ''}
                    </Label>
                    <Input
                      value={question.correctAnswer}
                      onChange={(e) => handleQuestionChange(qIndex, 'correctAnswer', e.target.value)}
                      className="mt-1"
                      placeholder={question.type === 'choice' ? '如：A' : '请输入正确答案'}
                    />
                  </div>

                  {/* 答案解析 */}
                  <div>
                    <Label className="text-sm font-medium">答案解析</Label>
                    <Textarea
                      value={question.explanation || ''}
                      onChange={(e) => handleQuestionChange(qIndex, 'explanation', e.target.value)}
                      className="mt-1"
                      rows={3}
                      placeholder="请输入答案解析（可选）"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* 添加新题目按钮 */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleAddQuestion}
            >
              <Plus className="w-4 h-4 mr-2" />
              添加新题目
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              取消
            </Button>
            <Button onClick={handleSaveEdit}>
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
