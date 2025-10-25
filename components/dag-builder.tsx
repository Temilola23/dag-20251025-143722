"use client"

import type React from "react"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, GitBranch, AlertCircle, CheckCircle2, Network, Download, Upload } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface Node {
  id: string
  label: string
  x: number
  y: number
}

interface Edge {
  from: string
  to: string
}

interface DAGState {
  nodes: Node[]
  edges: Edge[]
}

export function DAGBuilder() {
  const [state, setState] = useState<DAGState>({
    nodes: [],
    edges: [],
  })
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [newNodeLabel, setNewNodeLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Check if adding an edge would create a cycle
  const wouldCreateCycle = useCallback(
    (from: string, to: string): boolean => {
      if (from === to) return true

      const adjacencyList = new Map<string, string[]>()
      state.nodes.forEach((node) => adjacencyList.set(node.id, []))
      state.edges.forEach((edge) => {
        adjacencyList.get(edge.from)?.push(edge.to)
      })
      adjacencyList.get(from)?.push(to)

      const visited = new Set<string>()
      const recStack = new Set<string>()

      const hasCycle = (nodeId: string): boolean => {
        visited.add(nodeId)
        recStack.add(nodeId)

        const neighbors = adjacencyList.get(nodeId) || []
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (hasCycle(neighbor)) return true
          } else if (recStack.has(neighbor)) {
            return true
          }
        }

        recStack.delete(nodeId)
        return false
      }

      return hasCycle(from)
    },
    [state.edges, state.nodes],
  )

  const addNode = useCallback(() => {
    if (!newNodeLabel.trim()) {
      setError("Node label cannot be empty")
      setTimeout(() => setError(null), 3000)
      return
    }

    const newNode: Node = {
      id: `node-${Date.now()}`,
      label: newNodeLabel.trim(),
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
    }

    setState((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }))

    setNewNodeLabel("")
    setSuccess("Node added successfully")
    setTimeout(() => setSuccess(null), 2000)
  }, [newNodeLabel])

  const deleteNode = useCallback((nodeId: string) => {
    setState((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    }))
    setSelectedNode(null)
    setConnectingFrom(null)
  }, [])

  const addEdge = useCallback(
    (from: string, to: string) => {
      if (state.edges.some((e) => e.from === from && e.to === to)) {
        setError("Edge already exists")
        setTimeout(() => setError(null), 3000)
        return
      }

      if (wouldCreateCycle(from, to)) {
        setError("Cannot add edge: would create a cycle")
        setTimeout(() => setError(null), 3000)
        return
      }

      setState((prev) => ({
        ...prev,
        edges: [...prev.edges, { from, to }],
      }))

      setSuccess("Edge added successfully")
      setTimeout(() => setSuccess(null), 2000)
    },
    [state.edges, wouldCreateCycle],
  )

  const deleteEdge = useCallback((from: string, to: string) => {
    setState((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => !(e.from === from && e.to === to)),
    }))
  }, [])

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (connectingFrom) {
        if (connectingFrom !== nodeId) {
          addEdge(connectingFrom, nodeId)
        }
        setConnectingFrom(null)
      } else {
        setSelectedNode(nodeId)
      }
    },
    [connectingFrom, addEdge],
  )

  const startConnection = useCallback((nodeId: string) => {
    setConnectingFrom(nodeId)
    setSelectedNode(null)
  }, [])

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (e.button !== 0) return
      e.stopPropagation()
      setIsDragging(true)
      setSelectedNode(nodeId)

      const node = state.nodes.find((n) => n.id === nodeId)
      if (node) {
        setDragOffset({
          x: e.clientX - node.x,
          y: e.clientY - node.y,
        })
      }
    },
    [state.nodes],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !selectedNode || !canvasRef.current) return

      const rect = canvasRef.current.getBoundingClientRect()
      const x = Math.max(30, Math.min(e.clientX - rect.left - dragOffset.x, rect.width - 30))
      const y = Math.max(30, Math.min(e.clientY - rect.top - dragOffset.y, rect.height - 30))

      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) => (node.id === selectedNode ? { ...node, x, y } : node)),
      }))
    },
    [isDragging, selectedNode, dragOffset],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const exportGraph = useCallback(() => {
    const dataStr = JSON.stringify(state, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = "dag-graph.json"
    link.click()
    URL.revokeObjectURL(url)
  }, [state])

  const importGraph = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string)
        setState(imported)
        setSuccess("Graph imported successfully")
        setTimeout(() => setSuccess(null), 2000)
      } catch {
        setError("Invalid file format")
        setTimeout(() => setError(null), 3000)
      }
    }
    reader.readAsText(file)
  }, [])

  const clearGraph = useCallback(() => {
    setState({ nodes: [], edges: [] })
    setSelectedNode(null)
    setConnectingFrom(null)
  }, [])

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Network className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">DAG Builder</h1>
              <p className="text-sm text-muted-foreground">Directed Acyclic Graph Visualization</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <GitBranch className="h-3 w-3" />
              {state.nodes.length} nodes
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Network className="h-3 w-3" />
              {state.edges.length} edges
            </Badge>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r border-border bg-card p-6">
          <div className="space-y-6">
            {/* Add Node */}
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Add Node</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Node label"
                  value={newNodeLabel}
                  onChange={(e) => setNewNodeLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNode()}
                  className="flex-1"
                />
                <Button onClick={addNode} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            {/* Instructions */}
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Instructions</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Click a node to select it</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Drag nodes to reposition them</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Click "Connect" then click target node</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Cycles are automatically prevented</span>
                </li>
              </ul>
            </Card>

            {/* Selected Node Actions */}
            {selectedNode && (
              <Card className="p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Node Actions</h3>
                <div className="space-y-2">
                  <Button
                    onClick={() => startConnection(selectedNode)}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <GitBranch className="mr-2 h-4 w-4" />
                    Connect to another node
                  </Button>
                  <Button
                    onClick={() => deleteNode(selectedNode)}
                    className="w-full justify-start"
                    variant="destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete node
                  </Button>
                </div>
              </Card>
            )}

            {/* Graph Actions */}
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Graph Actions</h3>
              <div className="space-y-2">
                <Button
                  onClick={exportGraph}
                  className="w-full justify-start bg-transparent"
                  variant="outline"
                  disabled={state.nodes.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Graph
                </Button>
                <label>
                  <Button className="w-full justify-start bg-transparent" variant="outline" asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Graph
                    </span>
                  </Button>
                  <input type="file" accept=".json" onChange={importGraph} className="hidden" />
                </label>
                <Button
                  onClick={clearGraph}
                  className="w-full justify-start bg-transparent"
                  variant="outline"
                  disabled={state.nodes.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Graph
                </Button>
              </div>
            </Card>
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 overflow-hidden bg-background p-6">
          <div className="h-full space-y-4">
            {/* Alerts */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-accent bg-accent/10 text-accent-foreground">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {connectingFrom && (
              <Alert className="border-primary bg-primary/10 text-primary-foreground">
                <GitBranch className="h-4 w-4" />
                <AlertDescription>Click on a target node to create connection</AlertDescription>
              </Alert>
            )}

            {/* Canvas Area */}
            <Card
              ref={canvasRef}
              className="relative h-[calc(100%-4rem)] overflow-hidden bg-card"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <svg className="absolute inset-0 h-full w-full">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" className="fill-primary" />
                  </marker>
                </defs>

                {/* Draw edges */}
                {state.edges.map((edge, idx) => {
                  const fromNode = state.nodes.find((n) => n.id === edge.from)
                  const toNode = state.nodes.find((n) => n.id === edge.to)
                  if (!fromNode || !toNode) return null

                  return (
                    <g key={idx}>
                      <line
                        x1={fromNode.x}
                        y1={fromNode.y}
                        x2={toNode.x}
                        y2={toNode.y}
                        className="stroke-primary"
                        strokeWidth="2"
                        markerEnd="url(#arrowhead)"
                      />
                      <line
                        x1={fromNode.x}
                        y1={fromNode.y}
                        x2={toNode.x}
                        y2={toNode.y}
                        className="cursor-pointer stroke-transparent hover:stroke-destructive/50"
                        strokeWidth="12"
                        onClick={() => deleteEdge(edge.from, edge.to)}
                      />
                    </g>
                  )
                })}
              </svg>

              {/* Draw nodes */}
              {state.nodes.map((node) => (
                <div
                  key={node.id}
                  className={cn(
                    "absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center rounded-full border-2 bg-card text-xs font-medium shadow-lg transition-all",
                    selectedNode === node.id
                      ? "border-primary ring-4 ring-primary/20"
                      : connectingFrom === node.id
                        ? "border-accent ring-4 ring-accent/20"
                        : "border-border hover:border-primary",
                  )}
                  style={{ left: node.x, top: node.y }}
                  onClick={() => handleNodeClick(node.id)}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                >
                  <span className="text-center text-foreground">{node.label}</span>
                </div>
              ))}

              {state.nodes.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <Network className="mx-auto h-16 w-16 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-semibold text-foreground">No nodes yet</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Add your first node to start building your DAG</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
