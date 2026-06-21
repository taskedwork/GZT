/**
 * 思维导图 - 基于 jsMind v0.9.1 官方 API
 *
 * 参考: https://github.com/hizzgdev/jsmind
 * API 文档: https://hizzgdev.github.io/jsmind/docs/zh/3.operation.md
 *
 * 功能：
 *   - jsMind 官方 API 渲染/布局/节点操作
 *   - WPS 风格工具栏
 *   - 右键菜单
 *   - 样式面板（set_node_color / set_node_font_style）
 *   - 快捷键支持
 *   - 与 store 双向同步
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useApp } from '../data/store'

import 'jsmind/style/jsmind.css'
import jsMind from 'jsmind'

// ===== jsMind 官方主题 =====
const JM_THEMES = [
  { id: 'primary', label: '默认蓝' },
  { id: 'success', label: '成功绿' },
  { id: 'warning', label: '警告橙' },
  { id: 'danger', label: '危险红' },
  { id: 'info', label: '信息青' },
  { id: 'greensea', label: '海洋绿' },
  { id: 'nephrite', label: '翡翠绿' },
  { id: 'belizehole', label: '伯利兹蓝' },
  { id: 'wisteria', label: '紫藤' },
  { id: 'asphalt', label: '沥青灰' },
  { id: 'orange', label: '活力橙' },
  { id: 'pumpkin', label: '南瓜橙' },
  { id: 'pomegranate', label: '石榴红' },
  { id: 'clouds', label: '云白' },
  { id: 'asbestos', label: '石棉灰' },
]

// ===== 示例数据（首次加载）=====
const DEMO_MIND = {
  meta: { name: 'SDD MindMap', author: 'SDD', version: '2.0' },
  format: 'node_tree',
  data: {
    id: 'root', topic: '中心主题',
    children: [
      {
        id: 'sub1', topic: '分支一',
        children: [
          { id: 'sub1_1', topic: '子主题 1-1' },
          { id: 'sub1_2', topic: '子主题 1-2' },
        ],
      },
      {
        id: 'sub2', topic: '分支二',
        children: [
          { id: 'sub2_1', topic: '子主题 2-1' },
        ],
      },
      { id: 'sub3', topic: '分支三' },
    ],
  },
}

export default function MindMap() {
  const {
    state, dispatch, addNode, updateNode, deleteNodes, moveNode,
    setSelectedNodes, setEditingNode, finishEdit,
    toggleCollapse, updateNodeStyle, resetNodeStyle,
    updateNodeLabel, setHighlightedNode,
    setZoom, setLayoutMode, setCustomPositions,
    pushHistory, undo, redo, openTaskDetail,
  } = useApp()

  const containerRef = useRef(null)
  const jmRef = useRef(null)
  const [jmReady, setJmReady] = useState(false)
  const [currentTheme, setCurrentTheme] = useState('primary')
  const [showStylePanel, setShowStylePanel] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const syncLock = useRef(false)
  const nodeCounter = useRef(1)

  // ===== 生成唯一节点 ID =====
  const nextNodeId = useCallback(() => {
    nodeCounter.current += 1
    return 'n_' + Date.now() + '_' + nodeCounter.current
  }, [])

  // ===== 初始化 jsMind =====
  useEffect(() => {
    if (!containerRef.current || jmRef.current) return

    const options = {
      container: 'jsmind_container',
      editable: true,
      theme: 'primary',
      view: {
        engine: 'canvas',
        hmargin: 100,
        vmargin: 50,
        line_width: 2,
        line_color: '#555',
      },
      layout: {
        hspace: 30,
        vspace: 20,
        pspace: 13,
      },
    }

    try {
      const jm = new jsMind(options)

      // 如果 store 有数据则同步，否则使用示例数据
      if (state.mmNodes.length > 0) {
        const mind = buildMindData(state)
        jm.show(mind)
      } else {
        jm.show(DEMO_MIND)
        // 将示例数据同步到 store
        syncDemoToStore(jm)
      }

      jmRef.current = jm
      setJmReady(true)
    } catch (e) {
      console.error('jsMind init error:', e)
    }

    return () => {
      jmRef.current = null
      setJmReady(false)
    }
  }, [])

  // ===== 从 store 数据构建 jsMind 数据 =====
  function buildMindData(st) {
    const nodeMap = {}
    st.mmNodes.forEach(n => {
      nodeMap[n.id] = {
        id: n.id,
        topic: st.nodeLabels[n.id] || n.label || n.name || '未命名',
        children: [],
      }
      const style = st.nodeStyles[n.id]
      if (style) {
        if (style.fillColor) nodeMap[n.id]['background-color'] = style.fillColor
        if (style.textColor) nodeMap[n.id]['foreground-color'] = style.textColor
        if (style.fontSize) nodeMap[n.id]['font-size'] = style.fontSize + 'px'
      }
    })

    const roots = []
    st.mmEdges.forEach(e => {
      if (nodeMap[e.from] && nodeMap[e.to]) {
        nodeMap[e.from].children.push(nodeMap[e.to])
      }
    })
    st.mmNodes.forEach(n => {
      const hasParent = st.mmEdges.some(e => e.to === n.id)
      if (!hasParent && nodeMap[n.id]) roots.push(nodeMap[n.id])
    })

    if (roots.length === 0) {
      return { meta: { name: 'SDD MindMap', author: 'SDD', version: '2.0' }, format: 'node_tree', data: { id: 'root', topic: '中心主题' } }
    }

    return {
      meta: { name: 'SDD MindMap', author: 'SDD', version: '2.0' },
      format: 'node_tree',
      data: roots.length === 1 ? roots[0] : { id: 'virtual_root', topic: '项目', children: roots },
    }
  }

  // ===== 将示例数据同步到 store =====
  function syncDemoToStore(jm) {
    const root = jm.get_root()
    if (!root) return
    const nodes = []
    const edges = []

    function walk(node, parentId) {
      nodes.push({ id: node.id, label: node.topic, type: 'default' })
      if (parentId) edges.push({ from: parentId, to: node.id })
      if (node.children) {
        node.children.forEach(child => walk(child, node.id))
      }
    }
    walk(root, null)
    dispatch({ type: 'SET_MM_DATA', payload: { nodes, edges } })
  }

  // ===== 从 store 同步到 jsMind =====
  useEffect(() => {
    if (!jmRef.current || syncLock.current || !jmReady) return
    const jm = jmRef.current
    if (!jm.mind) return

    syncLock.current = true
    try {
      const mind = buildMindData(state)
      jm.show(mind)
    } finally {
      setTimeout(() => { syncLock.current = false }, 100)
    }
  }, [state.mmNodes, state.mmEdges])

  // ===== 样式同步到 jsMind =====
  useEffect(() => {
    if (!jmRef.current || syncLock.current || !jmReady) return
    const jm = jmRef.current
    if (!jm.mind) return

    Object.entries(state.nodeStyles).forEach(([nodeId, style]) => {
      const node = jm.get_node(nodeId)
      if (!node) return
      if (style.fillColor || style.textColor) {
        jm.set_node_color(nodeId, style.fillColor || '', style.textColor || '')
      }
      if (style.fontSize) {
        jm.set_node_font_style(nodeId, style.fontSize + 'px', null, null)
      }
    })
  }, [state.nodeStyles])

  // ===== 标签同步到 jsMind =====
  useEffect(() => {
    if (!jmRef.current || syncLock.current || !jmReady) return
    const jm = jmRef.current
    if (!jm.mind) return

    Object.entries(state.nodeLabels).forEach(([nodeId, label]) => {
      const node = jm.get_node(nodeId)
      if (node && node.topic !== label) {
        jm.update_node(nodeId, label)
      }
    })
  }, [state.nodeLabels])

  // ===== 右键菜单 =====
  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    const jm = jmRef.current
    if (!jm) return
    const node = jm.get_selected_node()
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      nodeId: node ? node.id : null,
    })
  }, [])

  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  // ===== 节点操作（使用 jsMind 官方 API）=====
  const addChildNode = useCallback(() => {
    const jm = jmRef.current
    if (!jm) return
    const selected = jm.get_selected_node()
    const parentId = selected ? selected.id : jm.get_root().id
    const newId = nextNodeId()
    const topic = '新节点'

    // jsMind API: add_node(parent_node, node_id, topic, data, direction)
    jm.add_node(parentId, newId, topic)

    // 同步到 store
    syncLock.current = true
    try {
      addNode({ id: newId, label: topic, type: 'default' }, parentId)
    } finally {
      setTimeout(() => { syncLock.current = false }, 100)
    }

    // 选中新节点
    jm.select_node(newId)
    closeCtxMenu()
  }, [addNode, nextNodeId, closeCtxMenu])

  const addSiblingNode = useCallback(() => {
    const jm = jmRef.current
    if (!jm) return
    const selected = jm.get_selected_node()
    if (!selected || selected.isroot) return

    const newId = nextNodeId()
    const topic = '新节点'

    // jsMind API: insert_node_after(node_after, node_id, topic, data)
    jm.insert_node_after(selected.id, newId, topic)

    // 同步到 store
    const parentId = selected.parent ? selected.parent.id : null
    syncLock.current = true
    try {
      addNode({ id: newId, label: topic, type: 'default' }, parentId)
    } finally {
      setTimeout(() => { syncLock.current = false }, 100)
    }

    jm.select_node(newId)
    closeCtxMenu()
  }, [addNode, nextNodeId, closeCtxMenu])

  const deleteSelectedNode = useCallback(() => {
    const jm = jmRef.current
    if (!jm) return
    const selected = jm.get_selected_node()
    if (!selected || selected.isroot) return

    const nodeId = selected.id

    // jsMind API: remove_node(node|node_id)
    jm.remove_node(nodeId)

    // 同步到 store
    syncLock.current = true
    try {
      deleteNodes([nodeId])
    } finally {
      setTimeout(() => { syncLock.current = false }, 100)
    }

    setSelectedNodeId(null)
    closeCtxMenu()
  }, [deleteNodes, closeCtxMenu])

  const startEditNode = useCallback(() => {
    const jm = jmRef.current
    if (!jm) return
    const selected = jm.get_selected_node()
    if (!selected) return

    // jsMind API: begin_edit(node)
    jm.begin_edit(selected.id)
    setEditingId(selected.id)
    setEditValue(selected.topic)
    closeCtxMenu()
  }, [closeCtxMenu])

  const saveEdit = useCallback(() => {
    if (!editingId || !editValue.trim()) return
    const jm = jmRef.current
    if (jm) {
      // jsMind API: update_node(node_id, topic)
      jm.update_node(editingId, editValue.trim())
    }
    updateNodeLabel(editingId, editValue.trim())
    updateNode(editingId, { label: editValue.trim() })
    setEditingId(null)
    setEditValue('')
  }, [editingId, editValue, updateNodeLabel, updateNode])

  // ===== 主题切换 =====
  const changeTheme = useCallback((theme) => {
    const jm = jmRef.current
    if (!jm) return
    // jsMind API: set_theme(theme)
    jm.set_theme(theme)
    setCurrentTheme(theme)
  }, [])

  // ===== 缩放 =====
  const handleZoomIn = useCallback(() => {
    const jm = jmRef.current
    if (!jm || !jm.view) return
    // jsMind 0.9+ API: view.zoom_in() / view.set_zoom(zoom)
    jm.view.zoom_in()
    // 读取当前缩放值
    const currentZoom = jm.view.zoom_current || 1
    setZoomLevel(currentZoom)
    setZoom(currentZoom)
  }, [setZoom])

  const handleZoomOut = useCallback(() => {
    const jm = jmRef.current
    if (!jm || !jm.view) return
    jm.view.zoom_out()
    const currentZoom = jm.view.zoom_current || 1
    setZoomLevel(currentZoom)
    setZoom(currentZoom)
  }, [setZoom])

  const handleZoomReset = useCallback(() => {
    const jm = jmRef.current
    if (!jm || !jm.view) return
    // jsMind 0.9+ API: view.set_zoom(zoom)
    if (jm.view.set_zoom) {
      jm.view.set_zoom(1)
    }
    setZoomLevel(1)
    setZoom(1)
  }, [setZoom])

  // ===== 展开/折叠 =====
  const expandAll = useCallback(() => {
    const jm = jmRef.current
    if (jm) jm.expand_all()
  }, [])

  const collapseAll = useCallback(() => {
    const jm = jmRef.current
    if (jm) jm.collapse_all()
  }, [])

  const toggleSelectedNode = useCallback(() => {
    const jm = jmRef.current
    if (!jm) return
    const selected = jm.get_selected_node()
    if (selected) jm.toggle_node(selected.id)
  }, [])

  // ===== 选中节点事件 =====
  useEffect(() => {
    if (!jmReady) return
    const jm = jmRef.current
    if (!jm) return

    jm.add_event_listener((type, data) => {
      if (type === jsMind.event_type.select) {
        if (data) {
          setSelectedNodeId(data.id)
          setSelectedNodes(new Set([data.id]))
          setHighlightedNode(data.id)
        }
      }
    })
  }, [jmReady])

  // ===== 鼠标滚轮缩放 =====
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handler = (e) => {
      if (e.ctrlKey) {
        e.preventDefault()
        if (e.deltaY < 0) handleZoomIn()
        else handleZoomOut()
      }
    }
    container.addEventListener('wheel', handler, { passive: false })
    return () => container.removeEventListener('wheel', handler)
  }, [handleZoomIn, handleZoomOut])

  // ===== 快捷键 =====
  useEffect(() => {
    const handler = (e) => {
      if (editingId) return

      if (e.key === 'Tab') {
        e.preventDefault()
        addChildNode()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        addSiblingNode()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelectedNode()
      } else if (e.key === 'F2') {
        e.preventDefault()
        startEditNode()
      } else if (e.ctrlKey && e.key === 'z') {
        e.preventDefault()
        undo()
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [addChildNode, addSiblingNode, deleteSelectedNode, startEditNode, undo, redo, editingId])

  // 点击空白关闭右键菜单
  useEffect(() => {
    const handler = () => closeCtxMenu()
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [closeCtxMenu])

  // ===== 当前选中节点样式 =====
  const selectedStyle = selectedNodeId ? (state.nodeStyles[selectedNodeId] || {}) : {}

  return (
    <div className="wps-mindmap" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ===== 工具栏 ===== */}
      <div className="wps-toolbar">
        <div className="wps-tb-left">
          <span className="wps-logo">思维导图</span>
          <span className="wps-info">jsMind</span>
          <div className="wps-tb-sep" />
          <select className="wps-theme-select" value={currentTheme} onChange={e => changeTheme(e.target.value)}>
            {JM_THEMES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        <div className="wps-tb-center">
          <button className="wps-btn" onClick={handleZoomOut} title="缩小">−</button>
          <span className="wps-zoom-text">{Math.round(zoomLevel * 100)}%</span>
          <button className="wps-btn" onClick={handleZoomIn} title="放大">+</button>
          <button className="wps-btn" onClick={handleZoomReset} title="重置缩放">1:1</button>
          <div className="wps-tb-sep" />
          <button className="wps-btn" onClick={expandAll} title="展开全部">展开</button>
          <button className="wps-btn" onClick={collapseAll} title="折叠全部">折叠</button>
        </div>

        <div className="wps-tb-right">
          <button className="wps-btn" onClick={addChildNode} title="添加子节点 (Tab)">
            + 子节点
          </button>
          <button className="wps-btn" onClick={addSiblingNode} title="添加兄弟节点 (Enter)">
            + 兄弟
          </button>
          <button className="wps-btn danger" onClick={deleteSelectedNode} title="删除 (Del)">
            删除
          </button>
          <div className="wps-tb-sep" />
          <button className="wps-btn" onClick={undo} title="撤销 (Ctrl+Z)">
            撤销
          </button>
          <button className="wps-btn" onClick={redo} title="重做 (Ctrl+Y)">
            重做
          </button>
          <div className="wps-tb-sep" />
          <button
            className={`wps-btn ${showStylePanel ? 'active' : ''}`}
            onClick={() => setShowStylePanel(!showStylePanel)}
          >
            样式
          </button>
        </div>
      </div>

      {/* ===== jsMind 容器 ===== */}
      <div className="wps-jsmind-container" style={{ flex: 1, position: 'relative' }}>
        <div
          id="jsmind_container"
          ref={containerRef}
          style={{ width: '100%', height: '100%' }}
          onContextMenu={handleContextMenu}
        />

        {/* ===== 编辑输入框（F2 / 双击触发）===== */}
        {editingId && (
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
          }}>
            <div style={{
              background: 'var(--card)', border: '2px solid var(--accent)',
              borderRadius: 8, padding: 12, minWidth: 240,
              boxShadow: 'var(--shadow-lg)',
            }}>
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEdit()
                  if (e.key === 'Escape') { setEditingId(null); setEditValue('') }
                }}
                onBlur={saveEdit}
                style={{
                  width: '100%', padding: '8px 12px',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text)', fontSize: '.85rem',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        )}

        {/* ===== 样式面板 ===== */}
        {showStylePanel && selectedNodeId && (
          <StylePanel
            nodeId={selectedNodeId}
            style={selectedStyle}
            jm={jmRef.current}
            updateNodeStyle={updateNodeStyle}
            resetNodeStyle={resetNodeStyle}
            onClose={() => setShowStylePanel(false)}
          />
        )}
      </div>

      {/* ===== 右键菜单 ===== */}
      {ctxMenu && (
        <div className="wps-ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={e => e.stopPropagation()}>
          <div className="wps-ctx-item" onClick={addChildNode}>
            <span className="wps-ctx-icon">+</span>
            <span className="wps-ctx-label">添加子节点</span>
            <span className="wps-ctx-hotkey">Tab</span>
          </div>
          {ctxMenu.nodeId && (
            <div className="wps-ctx-item" onClick={addSiblingNode}>
              <span className="wps-ctx-icon">↔</span>
              <span className="wps-ctx-label">添加兄弟节点</span>
              <span className="wps-ctx-hotkey">Enter</span>
            </div>
          )}
          {ctxMenu.nodeId && (
            <div className="wps-ctx-item" onClick={startEditNode}>
              <span className="wps-ctx-icon">✎</span>
              <span className="wps-ctx-label">重命名</span>
              <span className="wps-ctx-hotkey">F2</span>
            </div>
          )}
          {ctxMenu.nodeId && (
            <div className="wps-ctx-item" onClick={toggleSelectedNode}>
              <span className="wps-ctx-icon">⊞</span>
              <span className="wps-ctx-label">展开/折叠</span>
            </div>
          )}
          {ctxMenu.nodeId && !jmRef.current?.get_node(ctxMenu.nodeId)?.isroot && (
            <>
              <div className="wps-ctx-sep" />
              <div className="wps-ctx-item danger" onClick={deleteSelectedNode}>
                <span className="wps-ctx-icon">✕</span>
                <span className="wps-ctx-label">删除节点</span>
                <span className="wps-ctx-hotkey">Del</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== 底部快捷键提示 ===== */}
      <div className="wps-bottom-hint">
        <span><kbd>Tab</kbd> 子节点</span>
        <span><kbd>Enter</kbd> 兄弟</span>
        <span><kbd>F2</kbd> 重命名</span>
        <span><kbd>Del</kbd> 删除</span>
        <span><kbd>Ctrl+滚轮</kbd> 缩放</span>
        <span><kbd>Ctrl+Z/Y</kbd> 撤销/重做</span>
      </div>
    </div>
  )
}

// ===== 样式面板（使用 jsMind 官方 API）=====
const FILL_COLORS = [
  '#1a1a2e','#16213e','#1b2838','#1f1f38','#24243e','#2d132c','#1e3a3a','#1b1b2f',
  '#2c2c54','#474787','#6c5ce7','#0984e3','#00b894','#fdcb6e','#e17055','#d63031','#e84393','#74b9ff','#55efc4','#ffeaa7',
]

const TEXT_COLORS = [
  '#ffffff','#e0e0e0','#dfe6e9','#b2bec3','#74b9ff','#81ecec','#55efc4','#ffeaa7',
  '#fab1a0','#ff7675','#fd79a8','#a29bfe','#6c5ce7','#00cec9','#e17055','#d63031',
]

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24]

function StylePanel({ nodeId, style, jm, updateNodeStyle, resetNodeStyle, onClose }) {
  const handleFillColor = (color) => {
    updateNodeStyle(nodeId, 'fillColor', color)
    // jsMind API: set_node_color(node_id, bg_color, fg_color)
    if (jm) jm.set_node_color(nodeId, color, style.textColor || '')
  }

  const handleTextColor = (color) => {
    updateNodeStyle(nodeId, 'textColor', color)
    if (jm) jm.set_node_color(nodeId, style.fillColor || '', color)
  }

  const handleFontSize = (size) => {
    updateNodeStyle(nodeId, 'fontSize', size)
    // jsMind API: set_node_font_style(node_id, size, weight, style)
    if (jm) jm.set_node_font_style(nodeId, size + 'px', null, null)
  }

  const handleReset = () => {
    resetNodeStyle(nodeId)
    // 重置 jsMind 节点样式
    if (jm) {
      jm.set_node_color(nodeId, '', '')
      jm.set_node_font_style(nodeId, '', null, null)
    }
  }

  return (
    <div className="wps-style-panel">
      <div className="wps-sp-head">
        <strong>节点样式</strong>
        <button onClick={onClose}>✕</button>
      </div>

      {/* 背景色 */}
      <div className="wps-sp-section">
        <label>背景色</label>
        <div className="wps-colors">
          {FILL_COLORS.map(c => (
            <button
              key={c}
              className={`wps-swatch ${style.fillColor === c ? 'act' : ''}`}
              style={{ background: c }}
              onClick={() => handleFillColor(c)}
            />
          ))}
        </div>
      </div>

      {/* 文字色 */}
      <div className="wps-sp-section">
        <label>文字颜色</label>
        <div className="wps-colors">
          {TEXT_COLORS.map(c => (
            <button
              key={c}
              className={`wps-swatch ${style.textColor === c ? 'act' : ''}`}
              style={{ background: c }}
              onClick={() => handleTextColor(c)}
            />
          ))}
        </div>
      </div>

      {/* 字号 */}
      <div className="wps-sp-section">
        <label>字号</label>
        <div className="wps-fontsizes">
          {FONT_SIZES.map(s => (
            <button
              key={s}
              className={`wps-fs ${style.fontSize === s ? 'act' : ''}`}
              onClick={() => handleFontSize(s)}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* 预览 + 重置 */}
      <div className="wps-sp-foot">
        <button className="wps-reset-btn" onClick={handleReset}>
          恢复默认
        </button>
        <div
          className="wps-preview"
          style={{
            background: style.fillColor || '#1a1a2e',
            color: style.textColor || '#e0e0e0',
            fontSize: (style.fontSize || 13) + 'px',
          }}
        >
          预览
        </div>
      </div>
    </div>
  )
}
