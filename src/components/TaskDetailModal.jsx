/**
 * 节点详情弹窗 v2 - 基于思维导图数据
 * 
 * 显示选中节点的详细信息、样式编辑、子节点管理
 */

import React, { useState } from 'react'
import { useApp } from '../data/store'

export default function TaskDetailModal() {
  const {
    state, closeTaskDetail,
    updateNode, updateNodeStyle, resetNodeStyle, updateNodeLabel,
    deleteNodes, addEdge, setSelectedNodes,
  } = useApp()

  const nodes = state.mmNodes
  const edges = state.mmEdges

  const task = state.selectedTask
  if (!state.selectedTask || !task) return null

  // 找到对应的思维导图节点
  const node = nodes.find(n => n.id === task.id) || task
  const style = state.nodeStyles[task.id] || {}
  const customLabel = state.nodeLabels[task.id]

  // 子节点（从 edges 中找）
  const children = edges.filter(e => e.from === task.id).map(e => {
    const child = nodes.find(n => n.id === e.to)
    return child
  }).filter(Boolean)

  // 父节点
  const parentEdge = edges.find(e => e.to === task.id)
  const parentNode = parentEdge ? nodes.find(n => n.id === parentEdge.from) : null

  // 样式编辑状态
  const [editLabel, setEditLabel] = useState(customLabel || node.label || node.name || '')
  const [activeTab, setActiveTab] = useState('info')

  // 层级计算
  let level = 0
  let pid = parentEdge?.from
  while (pid) {
    level++
    pid = edges.find(e => e.to === pid)?.from
  }

  // 保存标签修改
  function handleSaveLabel() {
    if (editLabel.trim()) {
      updateNode(task.id, { label: editLabel.trim() })
      updateNodeLabel(task.id, editLabel.trim())
    }
  }

  return (
    <div className="modal-overlay" onClick={closeTaskDetail}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {/* 头部 */}
        <div className="modal-header">
          <h3>节点详情</h3>
          <button className="modal-close" onClick={closeTaskDetail}>✕</button>
        </div>

        {/* Tab 切换 */}
        <div style={{
          display: 'flex', gap: 2, padding: '0 16px', borderBottom: '1px solid var(--border)',
        }}>
          {[
            { id: 'info', label: '基本信息' },
            { id: 'style', label: '样式设置' },
            { id: 'children', label: `子节点 (${children.length})` },
          ].map(tab => (
            <button key={tab.id}
              style={{
                flex: 1, padding: '8px 12px',
                background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--muted)',
                border: 'none', borderRadius: '6px 6px 0 0',
                fontSize: '.7rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
              }}
              onClick={() => setActiveTab(tab.id)}
            >{tab.label}</button>
          ))}
        </div>

        <div className="modal-body" style={{ paddingTop: 14 }}>
          {/* ===== 基本信息 Tab ===== */}
          {activeTab === 'info' && (
            <>
              {/* 名称编辑 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '.64rem', color: 'var(--muted)', fontWeight: 600 }}>节点名称</label>
                <input
                  className="fld input"
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  onBlur={handleSaveLabel}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveLabel() }}
                  style={{ width: '100%', marginTop: 4 }}
                />
                {customLabel && customLabel !== (node.label || node.name) && (
                  <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginTop: 3, fontStyle: 'italic' }}>
                    原名：{node.label || node.name || '-'}
                  </div>
                )}
              </div>

              {/* 信息网格 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <InfoBlock label="节点 ID" value={task.id} />
                <InfoBlock label="层级" value={`第 ${level} 层`} />
                <InfoBlock label="类型" value={node.type || '普通'} />
                <InfoBlock label="子节点数" value={`${children.length}`} />
                {parentNode && <InfoBlock label="父节点" value={parentNode.label || parentNode.name || parentNode.id} />}
                {!parentNode && <InfoBlock label="父节点" value="(根节点)" />}
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-xs btn-danger"
                  onClick={() => { deleteNodes([task.id]); closeTaskDetail(); setSelectedNodes(new Set()) }}
                >删除此节点</button>
              </div>
            </>
          )}

          {/* ===== 样式设置 Tab ===== */}
          {activeTab === 'style' && (
            <>
              {/* 背景色 */}
              <StyleEditor label="背景色" current={style.fillColor} colors={[
                '#1a1a2e','#16213e','#1b2838','#1a2634','#1f1f38','#24243e','#2d132c','#1e3a3a','#17252a','#1b1b2f',
                '#2c2c54','#474787','#40407a','#6c5ce7','#0984e3','#00b894','#fdcb6e','#e17055','#d63031','#e84393',
              ]}
                onChange={(v) => updateNodeStyle(task.id, 'fillColor', v)} />

              {/* 文字色 */}
              <StyleEditor label="文字颜色" current={style.textColor} colors={[
                '#ffffff','#e0e0e0','#dfe6e9','#b2bec3','#74b9ff','#81ecec','#55efc4','#ffeaa7','#fab1a0','#ff7675',
                '#fd79a8','#a29bfe','#6c5ce7','#00cec9','#e17055','#d63031','#2d3436','#636e72','#b2bec3','#dfe6e9',
              ]}
                onChange={(v) => updateNodeStyle(task.id, 'textColor', v)} />

              {/* 字号 */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '.64rem', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>字号</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[9,10,11,12,13,14,16,18,20,24].map(s => (
                    <button key={s}
                      className={`fs-btn ${style.fontSize === s ? 'active' : ''}`}
                      onClick={() => updateNodeStyle(task.id, 'fontSize', s)}
                      style={{ fontSize: s }}>{s}</button>
                  ))}
                </div>
              </div>

              {/* 预览 + 重置 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
              }}>
                <div style={{
                  flex: 1, textAlign: 'center', padding: 10, borderRadius: 6,
                  background: style.fillColor || '#1a1a2e',
                  color: style.textColor || '#e0e0e0',
                  fontSize: `${style.fontSize || 13}px`,
                  fontWeight: 600,
                }}>
                  预览效果
                </div>
                <button className="btn btn-xs btn-secondary" onClick={() => resetNodeStyle(task.id)}>
                  恢复默认
                </button>
              </div>
            </>
          )}

          {/* ===== 子节点 Tab ===== */}
          {activeTab === 'children' && (
            <>
              {children.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)', fontSize: '.75rem' }}>
                  此节点暂无子节点
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {children.map((child, i) => {
                    const cStyle = state.nodeStyles[child.id] || {}
                    return (
                      <div key={child.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 6,
                        background: cStyle.fillColor ? `${cStyle.fillColor}20` : 'var(--bg)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background .12s',
                      }}
                        onClick={() => { /* 可以打开子节点详情 */ }}
                      >
                        <span style={{
                          width: 20, height: 20, borderRadius: 4,
                          background: cStyle.fillColor || 'var(--card)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '.58rem', color: cStyle.textColor || 'var(--muted)',
                          flexShrink: 0,
                        }}>{i + 1}</span>
                        <span style={{
                          flex: 1, fontSize: '.72rem', fontWeight: 500,
                          color: cStyle.textColor || 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {state.nodeLabels[child.id] || child.label || child.name || child.id}
                        </span>
                        <span style={{ fontSize: '.56rem', color: 'var(--muted)' }}>{child.id.slice(0, 8)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={closeTaskDetail}>关闭</button>
        </div>
      </div>
    </div>
  )
}

function InfoBlock({ label, value }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</label>
      <div style={{ fontSize: 13, marginTop: 2, fontWeight: 500, wordBreak: 'break-all' }}>{value}</div>
    </div>
  )
}

function StyleEditor({ label, current, colors, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: '.64rem', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
        {colors.map((c, i) => (
          <button key={`${label}-${i}-${c}`}
            style={{
              aspectRatio: 1, borderRadius: 4, border: current === c ? '2px solid #fff' : '1.5px solid transparent',
              background: c, cursor: 'pointer', transition: 'transform .1s',
              boxShadow: current === c ? '0 0 0 1px var(--accent)' : 'none',
            }}
            onMouseEnter={e => e.target.style.transform = 'scale(1.15)'}
            onMouseLeave={e => e.target.style.transform = ''}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  )
}
