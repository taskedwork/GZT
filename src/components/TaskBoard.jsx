/**
 * 待办看板 v6 - 四象限视图 + 拖拽
 * Q0: 重要且紧急  Q1: 重要不紧急
 * Q2: 紧急不重要  Q3: 不重要不紧急
 * 支持拖拽任务卡片在象限间移动
 */

import React, { useMemo, useState, useRef, useCallback } from 'react'
import { useApp } from '../data/store'

const QUADRANTS = [
  { id: 0, label: '重要且紧急', icon: '🔴', color: '#e74c3c', bg: 'rgba(231,76,60,.08)', desc: '立即执行' },
  { id: 1, label: '重要不紧急', icon: '🟡', color: '#f39c12', bg: 'rgba(243,156,18,.08)', desc: '计划安排' },
  { id: 2, label: '紧急不重要', icon: '🔵', color: '#3498db', bg: 'rgba(52,152,219,.08)', desc: '委托他人' },
  { id: 3, label: '不重要不紧急', icon: '🟢', color: '#27ae60', bg: 'rgba(39,174,96,.08)', desc: '考虑删除' },
]

const STATUS_MAP = {
  todo: { label: '待办', color: 'var(--muted)', bg: 'var(--border)' },
  doing: { label: '进行中', color: 'var(--warning)', bg: 'rgba(217,119,6,.12)' },
  done: { label: '已完成', color: 'var(--success)', bg: 'rgba(22,163,74,.12)' },
}

export default function TaskBoard() {
  const { state, updateNode, pushHistory, teamMembers } = useApp()
  const [filterStatus, setFilterStatus] = useState('doing')
  const [dragTaskId, setDragTaskId] = useState(null)
  const [dragOverQuad, setDragOverQuad] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [editModal, setEditModal] = useState(null) // 完整编辑的待办对象
  const [editName, setEditName] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editPom, setEditPom] = useState(false)
  const [editCollab, setEditCollab] = useState(false)
  const [editCollabMembers, setEditCollabMembers] = useState([])
  const [editDesc, setEditDesc] = useState('')
  const dragCounterRef = useRef({}) // 每个象限的计数器，防止子元素触发leave

  // 获取当前用户的任务节点（管理员看全部）
  const tasks = useMemo(() => {
    const nodes = state.mmNodes || []
    const isManager = state.currentUser?.systemRole === 'manager'
    return nodes.filter(n => {
      if (n.type !== 'task') return false
      if (isManager) return true
      // 非管理员：只显示协作人包含自己的待办
      const members = [...new Set([...(n.assignees || []), ...(n.collabMembers || [])])]
      return state.currentUser ? members.includes(state.currentUser.name) : false
    })
  }, [state.mmNodes, state.currentUser])

  // 按象限分组，再按项目分组
  const quadrants = useMemo(() => {
    const filtered = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus)
    const groups = [[], [], [], []]
    // 构建项目优先级映射
    const projPriority = {}
    state.mmNodes.filter(n => n.type === 'project').forEach(p => {
      if (p.priority) projPriority[p.id] = p.priority
    })
    filtered.forEach(task => {
      let q = task.quad != null ? task.quad : null
      // 如果任务没有 quad，从任务自身的 priority 映射
      if (q == null && task.priority) {
        q = task.priority === 'Q0' ? 0 : task.priority === 'Q1' ? 1 : task.priority === 'Q2' ? 2 : task.priority === 'Q3' ? 3 : null
      }
      // 如果任务没有象限，从所属项目的优先级继承
      if (q == null) {
        const parentEdge = state.mmEdges.find(e => e.to === task.id)
        if (parentEdge && projPriority[parentEdge.from]) {
          const p = projPriority[parentEdge.from]
          q = p === 'Q0' ? 0 : p === 'Q1' ? 1 : p === 'Q2' ? 2 : 3
        }
      }
      const idx = q != null ? Math.min(Math.max(q, 0), 3) : 1
      // 找到所属项目
      const parentEdge = state.mmEdges.find(e => e.to === task.id)
      const projId = parentEdge ? parentEdge.from : null
      groups[idx].push({ ...task, _projId: projId })
    })
    // 每个象限内按项目分组
    return groups.map(items => {
      const projMap = new Map()
      items.forEach(task => {
        const pid = task._projId || '__no_project__'
        if (!projMap.has(pid)) projMap.set(pid, [])
        projMap.get(pid).push(task)
      })
      // 转为数组，附带项目信息
      const result = []
      projMap.forEach((tasks, pid) => {
        const projNode = pid !== '__no_project__' ? state.mmNodes.find(n => n.id === pid) : null
        result.push({ projId: pid, projNode, tasks })
      })
      // 有项目的排前面
      result.sort((a, b) => {
        if (a.projId === '__no_project__') return 1
        if (b.projId === '__no_project__') return -1
        return 0
      })
      return result
    })
  }, [tasks, filterStatus, state.mmEdges, state.mmNodes])

  // 切换任务象限
  const moveQuadrant = (taskId, newQuad) => {
    const priorityMap = { 0: 'Q0', 1: 'Q1', 2: 'Q2', 3: 'Q3' }
    pushHistory()
    updateNode(taskId, { quad: newQuad, priority: priorityMap[newQuad] })
  }

  // 切换任务状态
  const cycleStatus = (nodeId, currentStatus) => {
    const order = ['todo', 'doing', 'done']
    const idx = order.indexOf(currentStatus)
    const next = order[(idx + 1) % order.length]
    pushHistory()
    const updates = { status: next }
    if (next === 'done') updates.completedAt = new Date().toLocaleString('zh-CN')
    else updates.completedAt = null
    updateNode(nodeId, updates)
  }

  // 开始编辑待办名称
  const startEdit = (task) => {
    setEditingTaskId(task.id)
    setEditingLabel(task.label || task.name || '')
  }

  // 保存编辑
  const saveEdit = () => {
    if (editingTaskId && editingLabel.trim()) {
      pushHistory()
      updateNode(editingTaskId, { label: editingLabel.trim() })
    }
    setEditingTaskId(null)
    setEditingLabel('')
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingTaskId(null)
    setEditingLabel('')
  }

  // 打开完整编辑弹窗
  const openEditModal = (task) => {
    setEditModal(task)
    setEditName(task.label || task.name || '')
    setEditDeadline(task.deadline || '')
    setEditPriority(task.priority || '')
    setEditPom(!!task.pom)
    // 合并 assignees 和 collabMembers，去重
    const allMembers = [...new Set([...(task.assignees || []), ...(task.collabMembers || [])])]
    setEditCollab(allMembers.length > 0 || !!task.collab)
    setEditCollabMembers(allMembers)
    setEditDesc(task.description || '')
  }

  // 保存完整编辑
  const saveEditModal = () => {
    if (!editModal || !editName.trim()) return
    pushHistory()
    const members = editCollab ? editCollabMembers : []
    updateNode(editModal.id, {
      label: editName.trim(),
      deadline: editDeadline || null,
      priority: editPriority || null,
      pom: editPom,
      collab: editCollab,
      collabMembers: members,
      assignees: members, // 同步 assignees，保持一致
      description: editDesc.trim() || null,
    })
    setEditModal(null)
  }

  const closeEditModal = () => {
    setEditModal(null)
  }

  // ===== 拖拽处理 =====
  const handleDragStart = useCallback((e, taskId) => {
    setDragTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
    // 半透明拖拽效果
    e.currentTarget.style.opacity = '0.4'
  }, [])

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.style.opacity = '1'
    setDragTaskId(null)
    setDragOverQuad(null)
    dragCounterRef.current = {}
  }, [])

  const handleDragEnter = useCallback((e, quadId) => {
    e.preventDefault()
    if (!dragCounterRef.current[quadId]) dragCounterRef.current[quadId] = 0
    dragCounterRef.current[quadId]++
    setDragOverQuad(quadId)
  }, [])

  const handleDragLeave = useCallback((e, quadId) => {
    dragCounterRef.current[quadId]--
    if (dragCounterRef.current[quadId] <= 0) {
      dragCounterRef.current[quadId] = 0
      if (dragOverQuad === quadId) setDragOverQuad(null)
    }
  }, [dragOverQuad])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e, quadId) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain') || dragTaskId
    if (taskId) {
      moveQuadrant(taskId, quadId)
    }
    setDragTaskId(null)
    setDragOverQuad(null)
    dragCounterRef.current = {}
  }, [dragTaskId, moveQuadrant])

  // 统计
  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter(t => t.status === 'done').length
    const doing = tasks.filter(t => t.status === 'doing').length
    const todo = tasks.filter(t => t.status === 'todo').length
    return { total, done, doing, todo, active: total - done }
  }, [tasks])

  return (
    <div className="taskboard-root">
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>待办看板</h2>
          <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 4 }}>
            四象限优先级 · 拖拽待办卡片切换象限 · 共 {stats.active} 个待办
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {['all', 'todo', 'doing', 'done'].map(s => (
            <button
              key={s}
              className={`btn ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '.7rem', padding: '3px 10px' }}
              onClick={() => setFilterStatus(s)}
            >
              {s === 'all' ? '全部' : s === 'todo' ? `待办 ${stats.todo}` : s === 'doing' ? `进行中 ${stats.doing}` : `已完成 ${stats.done}`}
            </button>
          ))}
        </div>
      </div>

      {/* 四象限 */}
      {tasks.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '24px 16px',
          background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 48, opacity: .3, marginBottom: 16 }}>▦</div>
          <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>暂无待办</h3>
          <p style={{ fontSize: '.82rem', color: 'var(--muted)' }}>请在项目总览中创建项目和待办</p>
        </div>
      ) : (
        <div className="quadrant-grid">
          {QUADRANTS.map((q) => {
            const projGroups = quadrants[q.id]
            const totalTasks = projGroups.reduce((s, g) => s + g.tasks.length, 0)
            const isOver = dragOverQuad === q.id
            return (
              <div
                key={q.id}
                className={`quadrant-cell${isOver ? ' quadrant-drag-over' : ''}`}
                style={{ borderColor: isOver ? q.color : q.color + '40' }}
                onDragEnter={(e) => handleDragEnter(e, q.id)}
                onDragLeave={(e) => handleDragLeave(e, q.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, q.id)}
              >
                {/* 象限头部 */}
                <div className="quadrant-header" style={{ background: q.bg }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{q.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '.82rem', color: q.color }}>{q.label}</span>
                  </div>
                </div>

                {/* 任务卡片列表 - 按项目分组 */}
                <div className="quadrant-cards">
                  {totalTasks === 0 ? (
                    <div className="quadrant-empty">{isOver ? '松开即可放入' : '暂无待办'}</div>
                  ) : (
                    projGroups.map(group => (
                      <div key={group.projId} className="quadrant-proj-group">
                        {/* 项目名标题 */}
                        {group.projNode && (
                          <div className="quadrant-proj-name">
                            <span style={{ fontSize: '.68rem', fontWeight: 600, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {'· '}{group.projNode.label || group.projNode.name || '未命名项目'}
                            </span>
                          </div>
                        )}
                        {/* 项目下的待办卡片 */}
                        {group.tasks.map(task => {
                          const st = STATUS_MAP[task.status] || STATUS_MAP.todo
                          const isDragging = dragTaskId === task.id
                          return (
                            <div
                              key={task.id}
                              className={`quadrant-card${isDragging ? ' quadrant-card-dragging' : ''}${group.projNode ? ' quadrant-card-indent' : ''}`}
                              style={{ '--bar-color': q.color }}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              onDragEnd={handleDragEnd}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                                <button
                                  className="task-status-btn"
                                  style={{ color: st.color, background: st.bg, width: 20, height: 20, fontSize: '.6rem', flexShrink: 0 }}
                                  onClick={() => cycleStatus(task.id, task.status)}
                                  title="点击切换状态"
                                >
                                  {task.status === 'done' ? '✓' : task.status === 'doing' ? '◐' : '○'}
                                </button>
                                {editingTaskId === task.id ? (
                                  <input
                                    className="task-edit-input"
                                    value={editingLabel}
                                    onChange={e => setEditingLabel(e.target.value)}
                                    onBlur={saveEdit}
                                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                                    autoFocus
                                    onClick={e => e.stopPropagation()}
                                  />
                                ) : (
                                  <span
                                    className={'task-name' + (task.status === 'done' ? ' task-done' : '')}
                                    style={{ fontSize: '.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    onDoubleClick={() => startEdit(task)}
                                    title="双击编辑"
                                  >
                                    {task.label || task.name || '未命名待办'}
                                  </span>
                                )}
                                {[...new Set([...(task.assignees || []), ...(task.collabMembers || [])])].map((a, i) => (
                                  <span key={i} className="task-assignee-tag" style={{ flexShrink: 1 }}>{a}</span>
                                ))}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
                                  <span className="task-status-tag" style={{ color: st.color, background: st.bg }}>
                                    {st.label}
                                  </span>
                                  {task.pom && <span className="task-badge" title="番茄钟">🍅{task.pomCount ? `×${task.pomCount}` : ''}</span>}
                                  {task.collab && <span className="task-badge" title="协作">🤝</span>}
                                  {editingTaskId !== task.id && (
                                    <button
                                      className="btn-icon-sm"
                                      title="编辑"
                                      onClick={(e) => { e.stopPropagation(); openEditModal(task) }}
                                      style={{ fontSize: '.6rem', opacity: .6, padding: '0 4px' }}
                                    >
                                      编辑
                                    </button>
                                  )}
                                </div>
                              </div>
                              {/* 内联编辑区 */}
                              {editModal && editModal.id === task.id && (
                                <div className="task-inline-edit" onClick={e => e.stopPropagation()}>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <input className="input" placeholder="待办名称" value={editName} onChange={e => setEditName(e.target.value)} style={{ flex: 1, minWidth: 80, fontSize: '.72rem' }} />
                                    <input type="date" className="input" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} style={{ fontSize: '.72rem' }} />
                                    <select className="input" value={editPriority} onChange={e => setEditPriority(e.target.value)} style={{ fontSize: '.72rem' }}>
                                      <option value="">优先级</option>
                                      <option value="Q0">🔥紧急重要</option>
                                      <option value="Q1">📋重要不紧急</option>
                                      <option value="Q2">⚡紧急不重要</option>
                                      <option value="Q3">🍃不紧急不重要</option>
                                    </select>
                                  </div>
                                  <textarea className="input" placeholder="描述（可选）" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} style={{ fontSize: '.72rem', resize: 'vertical', marginTop: 4 }} />
                                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                                    <label className="task-add-check"><input type="checkbox" checked={editPom} onChange={e => setEditPom(e.target.checked)} /><span>🍅</span></label>
                                    <label className="task-add-check"><input type="checkbox" checked={editCollab} onChange={e => { setEditCollab(e.target.checked); if (!e.target.checked) setEditCollabMembers([]) }} /><span>🤝</span></label>
                                    {editCollab && teamMembers.map(m => (
                                      <label key={m.id} className="collab-member-check" style={{ fontSize: '.65rem' }}>
                                        <input type="checkbox" checked={editCollabMembers.includes(m.name)} onChange={e => {
                                          if (e.target.checked) setEditCollabMembers([...editCollabMembers, m.name])
                                          else setEditCollabMembers(editCollabMembers.filter(n => n !== m.name))
                                        }} />
                                        <span>{m.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                    <button className="btn btn-primary" style={{ fontSize: '.65rem', padding: '2px 10px' }} onClick={saveEditModal} disabled={!editName.trim()}>保存</button>
                                    <button className="btn btn-secondary" style={{ fontSize: '.65rem', padding: '2px 10px' }} onClick={closeEditModal}>取消</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
