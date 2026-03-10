"use client"

import { useCallback, useMemo, useState } from "react"
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  NodeTypes,
} from "reactflow"
import "reactflow/dist/style.css"
import { ENGLISH_KNOWLEDGE_GRAPH } from "@/lib/knowledge/english-knowledge-graph"

// 自定义节点样式
const categoryColors = {
  grammar: { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  vocabulary: { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  reading: { bg: "#dcfce7", border: "#22c55e", text: "#166534" },
  writing: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
}

const levelColors = {
  basic: "#22c55e",
  intermediate: "#f59e0b",
  advanced: "#ef4444",
}

// 自定义节点组件
function KnowledgeNode({ data }: { data: any }) {
  const colors = categoryColors[data.category as keyof typeof categoryColors] || categoryColors.grammar

  return (
    <div
      className="px-4 py-2 rounded-lg border-2 shadow-md min-w-[160px] max-w-[200px] bg-white"
      style={{
        borderColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: levelColors[data.level as keyof typeof levelColors] }}
          title={data.level}
        />
        <span className="text-xs font-medium" style={{ color: colors.text }}>
          {data.category === "grammar" && "语法"}
          {data.category === "vocabulary" && "词汇"}
          {data.category === "reading" && "阅读"}
          {data.category === "writing" && "写作"}
        </span>
      </div>
      <div className="font-semibold text-sm text-gray-900">{data.label}</div>
      {data.description && (
        <div className="text-xs text-gray-600 mt-1 line-clamp-2">{data.description}</div>
      )}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  knowledge: KnowledgeNode,
}

interface KnowledgeGraphViewProps {
  category?: "grammar" | "vocabulary" | "reading" | "writing" | "all"
  level?: "basic" | "intermediate" | "advanced" | "all"
  initialNodeId?: string // 高亮显示的节点
}

export function KnowledgeGraphView({
  category = "all",
  level = "all",
  initialNodeId,
}: KnowledgeGraphViewProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  // 过滤节点
  const filteredNodes = useMemo(() => {
    let nodes = ENGLISH_KNOWLEDGE_GRAPH.nodes

    if (category !== "all") {
      nodes = nodes.filter((n) => n.category === category)
    }

    if (level !== "all") {
      nodes = nodes.filter((n) => n.level === level)
    }

    return nodes
  }, [category, level])

  // 转换为 React Flow 节点格式
  const initialNodes: Node[] = useMemo(() => {
    // 按类别分组计算位置
    const categoryGroups: Record<string, Node[]> = {
      grammar: [],
      vocabulary: [],
      reading: [],
      writing: [],
    }

    filteredNodes.forEach((node, index) => {
      categoryGroups[node.category].push({
        id: node.id,
        type: "knowledge",
        position: { x: 0, y: 0 },
        data: {
          label: node.name,
          description: node.description,
          category: node.category,
          level: node.level,
        },
      })
    })

    // 计算节点位置（分层布局）
    const nodes: Node[] = []
    const categoryOrder = ["grammar", "vocabulary", "reading", "writing"]
    let xOffset = 0

    categoryOrder.forEach((cat) => {
      const catNodes = categoryGroups[cat]
      if (catNodes.length === 0) return

      // 按依赖关系排序
      catNodes.sort((a, b) => {
        const aNode = ENGLISH_KNOWLEDGE_GRAPH.nodes.find((n) => n.id === a.id)
        const bNode = ENGLISH_KNOWLEDGE_GRAPH.nodes.find((n) => n.id === b.id)
        return (aNode?.dependencies.length || 0) - (bNode?.dependencies.length || 0)
      })

      // 网格布局
      const cols = Math.ceil(Math.sqrt(catNodes.length))
      catNodes.forEach((node, index) => {
        node.position = {
          x: xOffset + (index % cols) * 220,
          y: Math.floor(index / cols) * 150,
        }
        nodes.push(node)
      })

      xOffset += (cols + 1) * 220
    })

    return nodes
  }, [filteredNodes])

  // 转换为 React Flow 边格式
  const initialEdges: Edge[] = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id))
    const edges: Edge[] = []

    ENGLISH_KNOWLEDGE_GRAPH.edges.forEach((edge) => {
      // 只显示两个节点都存在的边
      if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
        const isDependency = edge.type === "prerequisite"

        edges.push({
          id: `${edge.from}-${edge.to}`,
          source: edge.from,
          target: edge.to,
          type: "smoothstep",
          animated: edge.type === "extends",
          style: {
            stroke: isDependency ? "#94a3b8" : "#6366f1",
            strokeWidth: edge.weight * 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isDependency ? "#94a3b8" : "#6366f1",
          },
          label: edge.type === "prerequisite" ? "前置" : edge.type === "extends" ? "扩展" : "",
          labelStyle: {
            fontSize: 10,
            fontWeight: 500,
          },
        })
      }
    })

    return edges
  }, [filteredNodes])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  // 获取选中节点的详细信息
  const selectedNodeInfo = useMemo(() => {
    if (!selectedNode) return null

    const nodeData = ENGLISH_KNOWLEDGE_GRAPH.nodes.find((n) => n.id === selectedNode.id)
    if (!nodeData) return null

    const prerequisites = nodeData.dependencies
      .map((depId) => ENGLISH_KNOWLEDGE_GRAPH.nodes.find((n) => n.id === depId))
      .filter((n) => n !== undefined)

    const relatedEdges = ENGLISH_KNOWLEDGE_GRAPH.edges.filter(
      (e) => e.from === selectedNode.id || e.to === selectedNode.id
    )

    const relatedNodes = relatedEdges
      .map((e) => {
        const otherId = e.from === selectedNode.id ? e.to : e.from
        return ENGLISH_KNOWLEDGE_GRAPH.nodes.find((n) => n.id === otherId)
      })
      .filter((n) => n !== undefined)

    return {
      ...nodeData,
      prerequisites,
      relatedNodes,
    }
  }, [selectedNode])

  return (
    <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const colors = categoryColors[node.data.category as keyof typeof categoryColors]
            return colors.border
          }}
        />
      </ReactFlow>

      {/* 选中节点详情面板 */}
      {selectedNodeInfo && (
        <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-xl border p-4 max-h-[560px] overflow-y-auto">
          <button
            onClick={() => setSelectedNode(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>

          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: levelColors[selectedNodeInfo.level as keyof typeof levelColors] }}
            />
            <h3 className="font-bold text-lg">{selectedNodeInfo.name}</h3>
          </div>

          <p className="text-sm text-gray-600 mb-3">{selectedNodeInfo.description}</p>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">类别</span>
              <span className="font-medium">
                {selectedNodeInfo.category === "grammar" && "语法"}
                {selectedNodeInfo.category === "vocabulary" && "词汇"}
                {selectedNodeInfo.category === "reading" && "阅读"}
                {selectedNodeInfo.category === "writing" && "写作"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">难度</span>
              <span className="font-medium">
                {selectedNodeInfo.level === "basic" && "基础"}
                {selectedNodeInfo.level === "intermediate" && "中级"}
                {selectedNodeInfo.level === "advanced" && "高级"}
              </span>
            </div>

            {selectedNodeInfo.prerequisites.length > 0 && (
              <div>
                <span className="text-gray-500 block mb-1">前置知识</span>
                <div className="flex flex-wrap gap-1">
                  {selectedNodeInfo.prerequisites.map((p) => (
                    <span
                      key={p!.id}
                      className="px-2 py-1 bg-gray-100 rounded text-xs"
                    >
                      {p!.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedNodeInfo.relatedNodes.length > 0 && (
              <div>
                <span className="text-gray-500 block mb-1">相关知识</span>
                <div className="flex flex-wrap gap-1">
                  {selectedNodeInfo.relatedNodes.map((n) => (
                    <button
                      key={n!.id}
                      onClick={() => {
                        const node = nodes.find((node) => node.id === n!.id)
                        if (node) setSelectedNode(node)
                      }}
                      className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs hover:bg-indigo-100"
                    >
                      {n!.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 图例 */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md border p-3">
        <div className="text-xs font-semibold text-gray-700 mb-2">图例</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>基础</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>中级</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>高级</span>
          </div>
          <div className="border-t pt-1 mt-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-gray-400" />
              <span>前置依赖</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-indigo-500" />
              <span>扩展关系</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
