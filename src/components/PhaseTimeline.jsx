/**
 * 流程时间线 v3 - 全屏模式
 * 基于思维导图数据的树形时间线
 */

import React, { useState, useMemo } from 'react'
import { useApp } from '../data/store'

export default function PhaseTimeline() {
  const { state, addNode, pushHistory, setHighlightedNode, treeData } = useApp()

  const [expandedIds, setExpandedIds] = useState(new Set())

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // 构建带层级的扁平列表
  const flatList = useMemo(() => {
    const result = []
    const walk = (nodes, level) => {
      nodes.forEach(node => {
        result.push({ ...node, level })
        if (expandedIds.has(node.id) && node.children?.length > 0) {
          walk(node.children, level + 1)
        }
      })
    }
    walk(treeData || [], 0)
    return result
  }, [treeData, expandedIds])

  // 自动展开第一层
  React.useEffect(() => {
    if (flatList.length > 0 && expandedIds.size === 0) {
      const rootIds = (treeData || []).map(n => n.id)
      setExpandedIds(new Set(rootIds))
    }
  }, [])

  const isEmpty = state.mmNodes.length === 0

  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>流程时间线</h2>
          <p style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 4 }}>
            思维导图节点的树形展示 · 共 {flatList.length} 项
          </p>
        </div>
        {!isEmpty && (
          <button className="btn btn-xs btn-secondary"
            onClick={() => setExpandedIds(expandedIds.size > 0 ? new Set() : new Set((treeData || []).map(n => n.id)))}
          >
            {expandedIds.size > 0 ? '全部折叠' : '全部展开'}
          </button>
        )}
      </div>

      {/* 空状态 */}
      {isEmpty ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--card)', borderRadius: 16,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 48, opacity: .3, marginBottom: 16 }}>▤</div>
          <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>暂无节点</h3>
          <p style={{ fontSize: '.82rem', color: 'var(--muted)' }}>请在思维导图中创建节点</p>
        </div>
      ) : (
        /* 时间线列表 */
        <div className="timeline-full">
          {flatList.map((item, idx) => {
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedIds.has(item.id)
            const isHighlighted = state.highlightedNodeId === item.id

            return (
              <div key={item.id}
                className={`timeline-row ${isHighlighted ? 'highlighted' : ''}`}
                style={{ paddingLeft: 20 + item.level * 28 }}
                onClick={() => setHighlightedNode(item.id)}
              >
                {/* 连接线 */}
                <div className="timeline-connector">
                  {idx > 0 && <div className="connector-line" />}
                </div>

                {/* 展开/折叠 */}
                <button
                  className={`tl-toggle ${hasChildren ? 'visible' : ''}`}
                  onClick={(e) => { e.stopPropagation(); hasChildren && toggleExpand(item.id) }}
                >
                  {hasChildren ? (isExpanded ? '−' : '+') : ''}
                </button>

                {/* 节点圆点 */}
                <div className={`tl-dot level-${item.level % 6}`} />

                {/* 节点内容 */}
                <div className="tl-content">
                  <div className="tl-name">
                    {state.nodeLabels[item.id] || item.label || item.name || '未命名'}
                    {state.nodeLabels[item.id] && (
                      <span className="tag-renamed">已重命名</span>
                    )}
                  </div>
                  <div className="tl-meta">
                    <span className="level-badge">L{item.level}</span>
                    <span className="tl-id">{item.id.slice(0, 10)}...</span>
                    {hasChildren && !isExpanded && (
                      <span className="child-count">+{item.children.length} 子节点</span>
                    )}
                  </div>
                </div>

                {/* 有样式标记 */}
                {state.nodeStyles[item.id] && (
                  <div className="styled-badge">✓ 已设样式</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
