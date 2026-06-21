/**
 * 项目总览 v5 - 支持创建项目 & 添加任务 & 数据存储/导出导入
 * 项目 = 根节点，任务 = 子节点
 */
import React, { useState, useRef, Fragment } from 'react'
import { useApp } from '../data/store'

export default function ProjectOverview() {
  const { state, dispatch, addNode, updateNode, deleteNodes, pushHistory, treeData, saveToServer, teamMembers, setView } = useApp()
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDeadline, setNewProjectDeadline] = useState('')
  const [newProjectPriority, setNewProjectPriority] = useState('')
  const [addingTaskFor, setAddingTaskFor] = useState(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskPom, setNewTaskPom] = useState(false)
  const [newTaskCollab, setNewTaskCollab] = useState(false)
  const [newTaskCollabMembers, setNewTaskCollabMembers] = useState([])
  const [newTaskDeadline, setNewTaskDeadline] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('')
  const [taskDeadlineWarn, setTaskDeadlineWarn] = useState('')
  const [editingNode, setEditingNode] = useState(null)
  const [editText, setEditText] = useState('')
  const [editingCollab, setEditingCollab] = useState(null)
  const [editingTask, setEditingTask] = useState(null) // 完整编辑的待办对象
  const [editTaskName, setEditTaskName] = useState('')
  const [editTaskDeadline, setEditTaskDeadline] = useState('')
  const [editTaskPriority, setEditTaskPriority] = useState('')
  const [editTaskPom, setEditTaskPom] = useState(false)
  const [editTaskCollab, setEditTaskCollab] = useState(false)
  const [editTaskCollabMembers, setEditTaskCollabMembers] = useState([])
  const [editTaskDesc, setEditTaskDesc] = useState('')
  const [collapsedProjects, setCollapsedProjects] = useState(new Set())
  const [importMsg, setImportMsg] = useState('')
  const [importPreview, setImportPreview] = useState(null) // { nodes, edges, nodeStyles, nodeLabels, stats }
  const fileInputRef = useRef(null)

  const projects = treeData || []

  // ===== 导出数据为JSON文件 =====
  const handleExport = () => {
    let nodes = state.mmNodes
    let edges = state.mmEdges
    // 隐私保护：过滤掉个人待办（标记了 isPrivate 的节点）
    if ((state.settings || {}).privacyMode) {
      const privateIds = new Set(nodes.filter(n => n.isPrivate).map(n => n.id))
      nodes = nodes.filter(n => !privateIds.has(n.id))
      edges = edges.filter(e => !privateIds.has(e.from) && !privateIds.has(e.to))
    }
    const data = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      mmNodes: nodes,
      mmEdges: edges,
      nodeStyles: state.nodeStyles,
      nodeLabels: state.nodeLabels,
    }
    const prefix = (state.settings || {}).exportPrefix || 'SDD_项目数据'
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${prefix}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ===== 转换旧版备份数据（nm/sb/done格式）为 mmNodes/mmEdges =====
  const convertLegacyData = (legacyProjects) => {
    const mmNodes = []
    const mmEdges = []
    const quadToPriority = { 0: 'Q0', 1: 'Q1', 2: 'Q2', 3: 'Q3' }
    legacyProjects.forEach(proj => {
      const projId = proj.id || 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
      mmNodes.push({
        id: projId,
        label: proj.nm || '未命名项目',
        type: 'project',
        priority: proj.pr || '',
        deadline: proj.de || '',
        description: proj.desc || '',
        done: !!proj.done,
        completedAt: proj.done && proj.at ? proj.at : null,
      })
      const subs = proj.sb || proj.sub || []
      subs.forEach(task => {
        const taskId = task.id || 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
        let status = 'todo'
        if (task.done) {
          status = 'done'
        } else if (task.status === 'completed' || task.status === 'approved') {
          status = 'done'
        } else if (task.status === 'submitted') {
          status = 'doing'
        } else if (task.status === 'assigned' || task.assignees?.length > 0) {
          status = 'doing'
        }
        const quad = task.quad != null ? task.quad : null
        mmNodes.push({
          id: taskId,
          label: task.nm || '未命名待办',
          type: 'task',
          status,
          assignees: task.assignees || [],
          collabMembers: task.assignees || [],
          collab: !!(task.assignees && task.assignees.length > 0),
          deadline: task.et || '',
          description: task.desc || '',
          priority: quad != null ? quadToPriority[quad] : (task.pr || ''),
          quad,
          pom: !!task.pom,
          pomCount: task.pc || 0,
          sortOrder: task.sortOrder ?? 999,
          completedAt: task.done && task.at ? task.at : null,
        })
        mmEdges.push({ from: projId, to: taskId })
      })
    })
    return { mmNodes, mmEdges }
  }

  // ===== 导入JSON文件 =====
  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result)
        let mmNodes, mmEdges, nodeStyles, nodeLabels

        if (data.mmNodes && data.mmEdges) {
          mmNodes = data.mmNodes
          mmEdges = data.mmEdges
          nodeStyles = data.nodeStyles
          nodeLabels = data.nodeLabels
        } else if (Array.isArray(data) && data.length > 0 && (data[0].nm || data[0].sb)) {
          const converted = convertLegacyData(data)
          mmNodes = converted.mmNodes
          mmEdges = converted.mmEdges
        } else {
          setImportMsg('文件格式不正确，无法识别')
          setTimeout(() => setImportMsg(''), 3000)
          return
        }

        // 计算对比统计
        const curProjects = state.mmNodes.filter(n => n.type === 'project')
        const curTasks = state.mmNodes.filter(n => n.type === 'task')
        const newProjects = mmNodes.filter(n => n.type === 'project')
        const newTasks = mmNodes.filter(n => n.type === 'task')

        // 找出新增、已存在、冲突
        const curIds = new Set(state.mmNodes.map(n => n.id))
        const addProjects = newProjects.filter(n => !curIds.has(n.id))
        const existProjects = newProjects.filter(n => curIds.has(n.id))
        const addTasks = newTasks.filter(n => !curIds.has(n.id))
        const existTasks = newTasks.filter(n => curIds.has(n.id))

        // 冲突：ID相同但内容不同
        const curNodeMap = {}
        state.mmNodes.forEach(n => { curNodeMap[n.id] = n })
        const conflictNodes = mmNodes.filter(n => curIds.has(n.id) && JSON.stringify(n) !== JSON.stringify(curNodeMap[n.id]))

        setImportPreview({
          nodes: mmNodes,
          edges: mmEdges,
          nodeStyles,
          nodeLabels,
          stats: {
            fileName: file.name,
            curProjects: curProjects.length,
            curTasks: curTasks.length,
            newProjects: newProjects.length,
            newTasks: newTasks.length,
            addProjects: addProjects.length,
            existProjects: existProjects.length,
            addTasks: addTasks.length,
            existTasks: existTasks.length,
            conflicts: conflictNodes.length,
          }
        })
      } catch (err) {
        setImportMsg('导入失败：文件解析错误')
        setTimeout(() => setImportMsg(''), 3000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // 执行导入：覆盖
  const doImportOverwrite = () => {
    if (!importPreview) return
    pushHistory()
    dispatch({ type: 'SET_MM_DATA', payload: { nodes: importPreview.nodes, edges: importPreview.edges } })
    if (importPreview.nodeStyles) {
      Object.entries(importPreview.nodeStyles).forEach(([nodeId, style]) => {
        Object.entries(style).forEach(([key, value]) => {
          dispatch({ type: 'UPDATE_NODE_STYLE', payload: { nodeId, styleKey: key, value } })
        })
      })
    }
    if (importPreview.nodeLabels) {
      Object.entries(importPreview.nodeLabels).forEach(([nodeId, label]) => {
        dispatch({ type: 'UPDATE_NODE_LABEL', payload: { nodeId, label } })
      })
    }
    saveToServer()
    const s = importPreview.stats
    setImportMsg(`覆盖导入成功！${s.newProjects} 个项目，${s.newTasks} 个待办`)
    setImportPreview(null)
    setTimeout(() => setImportMsg(''), 4000)
  }

  // 执行导入：增量合并
  const doImportMerge = () => {
    if (!importPreview) return
    pushHistory()
    // 合并节点：已有的跳过，新增的追加
    const curIds = new Set(state.mmNodes.map(n => n.id))
    const addNodes = importPreview.nodes.filter(n => !curIds.has(n.id))
    const addEdges = importPreview.edges.filter(e => !state.mmEdges.some(ce => ce.from === e.from && ce.to === e.to))
    const mergedNodes = [...state.mmNodes, ...addNodes]
    const mergedEdges = [...state.mmEdges, ...addEdges]
    dispatch({ type: 'SET_MM_DATA', payload: { nodes: mergedNodes, edges: mergedEdges } })
    if (importPreview.nodeStyles) {
      Object.entries(importPreview.nodeStyles).forEach(([nodeId, style]) => {
        if (!curIds.has(nodeId)) {
          Object.entries(style).forEach(([key, value]) => {
            dispatch({ type: 'UPDATE_NODE_STYLE', payload: { nodeId, styleKey: key, value } })
          })
        }
      })
    }
    if (importPreview.nodeLabels) {
      Object.entries(importPreview.nodeLabels).forEach(([nodeId, label]) => {
        if (!curIds.has(nodeId)) {
          dispatch({ type: 'UPDATE_NODE_LABEL', payload: { nodeId, label } })
        }
      })
    }
    saveToServer()
    const s = importPreview.stats
    setImportMsg(`增量导入成功！新增 ${s.addProjects} 个项目，${s.addTasks} 个待办`)
    setImportPreview(null)
    setTimeout(() => setImportMsg(''), 4000)
  }

  // ===== 本地存储 =====
  const handleSaveLocal = () => {
    const data = {
      version: '1.0',
      saveTime: new Date().toISOString(),
      mmNodes: state.mmNodes,
      mmEdges: state.mmEdges,
      nodeStyles: state.nodeStyles,
      nodeLabels: state.nodeLabels,
    }
    localStorage.setItem('sdd_project_backup', JSON.stringify(data))
    setImportMsg('已保存到本地！')
    setTimeout(() => setImportMsg(''), 2000)
  }

  const handleLoadLocal = () => {
    const raw = localStorage.getItem('sdd_project_backup')
    if (!raw) {
      setImportMsg('本地无备份数据')
      setTimeout(() => setImportMsg(''), 2000)
      return
    }
    try {
      const data = JSON.parse(raw)
      pushHistory()
      dispatch({ type: 'SET_MM_DATA', payload: { nodes: data.mmNodes || [], edges: data.mmEdges || [] } })
      if (data.nodeStyles) {
        Object.entries(data.nodeStyles).forEach(([nodeId, style]) => {
          Object.entries(style).forEach(([key, value]) => {
            dispatch({ type: 'UPDATE_NODE_STYLE', payload: { nodeId, styleKey: key, value } })
          })
        })
      }
      if (data.nodeLabels) {
        Object.entries(data.nodeLabels).forEach(([nodeId, label]) => {
          dispatch({ type: 'UPDATE_NODE_LABEL', payload: { nodeId, label } })
        })
      }
      saveToServer()
      setImportMsg('本地数据已恢复！')
      setTimeout(() => setImportMsg(''), 3000)
    } catch {
      setImportMsg('本地数据损坏，恢复失败')
      setTimeout(() => setImportMsg(''), 2000)
    }
  }

  // 创建项目
  const handleCreateProject = () => {
    if (!newProjectName.trim()) return
    const id = 'proj_' + Date.now()
    addNode({
      id,
      label: newProjectName.trim(),
      type: 'project',
      deadline: newProjectDeadline || null,
      priority: newProjectPriority || null,
    }, null)
    setNewProjectName('')
    setNewProjectDeadline('')
    setNewProjectPriority('')
    setShowNewProject(false)
  }

  // 添加待办
  const handleAddTask = (projectId) => {
    if (!newTaskName.trim()) return
    const id = 'task_' + Date.now()
    addNode({
      id,
      label: newTaskName.trim(),
      type: 'task',
      status: 'todo',
      pom: newTaskPom,
      collab: newTaskCollab,
      collabMembers: newTaskCollab ? newTaskCollabMembers : [],
      deadline: newTaskDeadline || null,
      priority: newTaskPriority || null,
    }, projectId)

    // 如果项目没有截止日期，以待办最晚截止日期更新项目截止日期
    const projNode = state.mmNodes.find(n => n.id === projectId)
    if (projNode && !projNode.deadline && newTaskDeadline) {
      const allTaskDeadlines = state.mmNodes
        .filter(n => n.type === 'task' && state.mmEdges.some(e => e.from === projectId && e.to === n.id) && n.deadline)
        .map(n => n.deadline)
      allTaskDeadlines.push(newTaskDeadline)
      const latest = allTaskDeadlines.sort().pop()
      pushHistory()
      updateNode(projectId, { deadline: latest })
    }

    setNewTaskName('')
    setNewTaskPom(false)
    setNewTaskCollab(false)
    setNewTaskCollabMembers([])
    setNewTaskDeadline('')
    setNewTaskPriority('')
    setTaskDeadlineWarn('')
    setAddingTaskFor(null)
  }

  // 检查待办截止日期是否超过项目截止日期
  const checkTaskDeadline = (date, projectId) => {
    setNewTaskDeadline(date)
    setTaskDeadlineWarn('')
    if (!date) return
    const projNode = state.mmNodes.find(n => n.id === projectId)
    if (projNode?.deadline && date > projNode.deadline) {
      setTaskDeadlineWarn(`待办截止日期 (${date}) 超过了项目截止日期 (${projNode.deadline})，请确认！`)
    }
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

  // 重命名
  const startRename = (nodeId, label) => {
    setEditingNode(nodeId)
    setEditText(label)
  }
  const finishRename = (nodeId) => {
    if (editText.trim()) {
      pushHistory()
      updateNode(nodeId, { label: editText.trim() })
    }
    setEditingNode(null)
    setEditText('')
  }

  // 打开编辑待办弹窗
  const openEditTask = (task) => {
    setEditingTask(task)
    setEditTaskName(task.label || task.name || '')
    setEditTaskDeadline(task.deadline || '')
    setEditTaskPriority(task.priority || '')
    setEditTaskPom(!!task.pom)
    // 合并 assignees 和 collabMembers，去重
    const allMembers = [...new Set([...(task.assignees || []), ...(task.collabMembers || [])])]
    setEditTaskCollab(allMembers.length > 0 || !!task.collab)
    setEditTaskCollabMembers(allMembers)
    setEditTaskDesc(task.description || '')
  }

  // 保存编辑待办
  const saveEditTask = () => {
    if (!editingTask || !editTaskName.trim()) return
    pushHistory()
    const members = editTaskCollab ? editTaskCollabMembers : []
    updateNode(editingTask.id, {
      label: editTaskName.trim(),
      deadline: editTaskDeadline || null,
      priority: editTaskPriority || null,
      pom: editTaskPom,
      collab: editTaskCollab,
      collabMembers: members,
      assignees: members, // 同步 assignees，保持一致
      description: editTaskDesc.trim() || null,
    })
    setEditingTask(null)
  }

  // 关闭编辑待办弹窗
  const closeEditTask = () => {
    setEditingTask(null)
  }

  // 删除（deleteNodes 已内置 pushHistory）
  const handleDelete = (nodeId) => {
    deleteNodes([nodeId])
  }

  const statusMap = {
    todo: { label: '待办', color: 'var(--muted)', bg: 'var(--border)' },
    doing: { label: '进行中', color: 'var(--warning)', bg: 'rgba(217,119,6,.12)' },
    done: { label: '已完成', color: 'var(--success)', bg: 'rgba(22,163,74,.12)' },
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 第一栏：标题 + 统计卡片（sticky固定） */}
      <div className="stats-bar-sticky" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>项目总览</h2>
          <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 4 }}>
            管理项目与待办，点击状态标签可切换
          </p>
        </div>
        {projects.length > 0 && (
          <div className="stats-bar" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 0, gap: 10 }}>
            <StatCard label="项目/待办" value={`${projects.length}/${state.mmNodes.filter(n => n.type === 'task').length}`} icon="◉" color="#6c5ce7" />
            <StatCard label={state.currentUser?.systemRole === 'manager' ? '全部待办' : '我的待办'} value={state.mmNodes.filter(n => {
              if (n.type !== 'task') return false
              if (state.currentUser?.systemRole === 'manager') return true
              const members = [...new Set([...(n.assignees || []), ...(n.collabMembers || [])])]
              return state.currentUser ? members.includes(state.currentUser.name) : false
            }).length} icon="👤" color="#e84393" onClick={() => setView('kanban')} />
            <StatCard label="进行中" value={state.mmNodes.filter(n => n.type === 'task' && n.status === 'doing').length} icon="◐" color="#d97706" />
            <StatCard label="已完成" value={state.mmNodes.filter(n => n.type === 'task' && n.status === 'done').length} icon="✓" color="#00b894" />
          </div>
        )}
      </div>

      {/* 第二栏：数据工具栏 + 新建项目按钮 */}
      <div className="data-toolbar data-toolbar-lg">
        <button className="btn btn-primary" style={{ fontWeight: 600 }} onClick={() => setShowNewProject(true)}>
          + 新建项目
        </button>
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
        <button className="btn btn-secondary" onClick={handleExport} title="导出为JSON文件">
          ↓ 导出
        </button>
        <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} title="从JSON文件导入">
          ↑ 导入
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
        <button className="btn btn-secondary" onClick={handleSaveLocal} title="保存到浏览器本地">
          保存本地
        </button>
        <button className="btn btn-secondary" onClick={handleLoadLocal} title="从浏览器本地恢复">
          恢复本地
        </button>
        {importMsg && (
          <span className="import-msg" style={{
            fontSize: '.82rem',
            color: importMsg.includes('成功') || importMsg.includes('已保存') || importMsg.includes('已恢复') ? 'var(--success)' : 'var(--danger)',
          }}>
            {importMsg}
          </span>
        )}
      </div>

      {/* 空状态 */}
      {projects.length === 0 && !showNewProject && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 48, opacity: .3, marginBottom: 16 }}>◉</div>
          <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>暂无项目</h3>
          <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: 20 }}>
            点击下方"创建项目"开始
          </p>
        </div>
      )}

      {/* 项目列表 */}
      {projects.length > 0 && (
        <>
          {/* 项目卡片 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {projects.map(project => {
              const tasks = project.children || []
              const doneCount = tasks.filter(t => t.status === 'done').length
              const taskPercent = tasks.length > 0 ? Math.round(doneCount / tasks.length * 100) : 0
              // 四象限统计
              const quadCounts = [0, 0, 0, 0]
              const projPriority = project.priority
              tasks.forEach(t => {
                let q = t.quad != null ? t.quad : null
                // 从任务自身的 priority 映射
                if (q == null && t.priority) {
                  q = t.priority === 'Q0' ? 0 : t.priority === 'Q1' ? 1 : t.priority === 'Q2' ? 2 : t.priority === 'Q3' ? 3 : null
                }
                // 从项目优先级继承
                if (q == null && projPriority) {
                  q = projPriority === 'Q0' ? 0 : projPriority === 'Q1' ? 1 : projPriority === 'Q2' ? 2 : 3
                }
                const idx = q != null ? Math.min(Math.max(q, 0), 3) : 1
                quadCounts[idx]++
              })
              const isCollapsed = collapsedProjects.has(project.id)
              const toggleCollapse = () => {
                const next = new Set(collapsedProjects)
                if (next.has(project.id)) next.delete(project.id)
                else next.add(project.id)
                setCollapsedProjects(next)
              }

              return (
                <div key={project.id} className="project-card">
                  {/* 项目头部 */}
                  <div className="project-card-header" onClick={toggleCollapse} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <span className="project-collapse-icon" style={{ fontSize: '.6rem', transition: 'transform .15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', color: 'var(--muted)' }}>▼</span>
                      <div className="project-icon" style={project.done ? { opacity: .4 } : {}}>◉</div>
                      {editingNode === project.id ? (
                        <input
                          className="input"
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onBlur={() => finishRename(project.id)}
                          onKeyDown={e => e.key === 'Enter' && finishRename(project.id)}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                          style={{ flex: 1, fontSize: '.85rem' }}
                        />
                      ) : (
                        <span
                          className="project-name"
                          style={project.done ? { textDecoration: 'line-through', opacity: .5 } : {}}
                          onDoubleClick={() => startRename(project.id, project.label || project.name)}
                        >
                          {project.label || project.name || '未命名项目'}
                        </span>
                      )}
                      <span className="task-count">{tasks.length} 个待办</span>
                      {tasks.length > 0 && (
                        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          {[
                            { icon: '🔴', count: quadCounts[0] },
                            { icon: '🟡', count: quadCounts[1] },
                            { icon: '🔵', count: quadCounts[2] },
                            { icon: '🟢', count: quadCounts[3] },
                          ].filter(q => q.count > 0).map((q, i) => (
                            <span key={i} style={{ fontSize: '.6rem', color: 'var(--muted)', background: 'var(--border)', padding: '1px 5px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                              {q.icon}{q.count}
                            </span>
                          ))}
                        </span>
                      )}
                      {project.deadline && (
                        <span className="project-deadline" title="截止日期">📅 {project.deadline}</span>
                      )}

                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        className="btn-icon-sm"
                        title={project.done ? '标记为进行中' : '标记为完成'}
                        onClick={(e) => { e.stopPropagation(); pushHistory(); updateNode(project.id, { done: !project.done, completedAt: !project.done ? new Date().toLocaleString('zh-CN') : null }) }}
                        style={{ color: project.done ? 'var(--success)' : 'var(--muted)' }}
                      >
                        {project.done ? '✓' : '○'}
                      </button>
                      <button
                        className="btn-icon-sm"
                        title="重命名"
                        onClick={(e) => { e.stopPropagation(); startRename(project.id, project.label || project.name) }}
                      >
                        ✎
                      </button>
                      <button
                        className="btn-icon-sm btn-icon-danger"
                        title="删除项目"
                        onClick={(e) => { e.stopPropagation(); handleDelete(project.id) }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* 可折叠内容 */}
                  {!isCollapsed && (<>
                  {/* 进度条 */}
                  {tasks.length > 0 && (
                    <div className="project-progress">
                      <div className="project-progress-bar" style={{ width: taskPercent + '%' }} />
                      <span className="project-progress-text">{taskPercent}%</span>
                    </div>
                  )}

                  {/* 任务列表 */}
                  {tasks.length > 0 && (
                    <div className="task-list">
                      {tasks.map(task => {
                        const st = statusMap[task.status] || statusMap.todo
                        return (
                          <Fragment key={task.id}>
                          <div className="task-item">
                            <button
                              className="task-status-btn"
                              style={{ color: st.color, background: st.bg }}
                              onClick={() => cycleStatus(task.id, task.status)}
                              title="点击切换状态"
                            >
                              {task.status === 'done' ? '✓' : task.status === 'doing' ? '◐' : '○'}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {editingNode === task.id ? (
                                  <input
                                    className="input task-rename-input"
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    onBlur={() => finishRename(task.id)}
                                    onKeyDown={e => e.key === 'Enter' && finishRename(task.id)}
                                    autoFocus
                                  />
                                ) : (
                                  <span
                                    className={'task-name' + (task.status === 'done' ? ' task-done' : '')}
                                    onDoubleClick={() => startRename(task.id, task.label || task.name)}
                                  >
                                    {task.label || task.name || '未命名待办'}
                                  </span>
                                )}
                                <span className="task-status-tag" style={{ color: st.color, background: st.bg }}>
                                  {st.label}
                                </span>
                                {task.pom && <span className="task-badge" title="番茄钟">🍅{task.pomCount ? `×${task.pomCount}` : ''}</span>}
                                <span
                                  className={'task-badge task-badge-collab' + (task.collab ? ' active' : '')}
                                  title={task.collab ? '点击修改协作' : '点击指定协作'}
                                  onClick={(e) => { e.stopPropagation(); setEditingCollab(editingCollab === task.id ? null : task.id) }}
                                >🤝</span>
                                {task.deadline && <span className="task-badge" title="截止日期" style={{ fontSize: '.6rem', opacity: .7 }}>📅{task.deadline}</span>}
                                {task.priority && <span className="project-priority-tag" data-quad={task.priority} style={{ fontSize: '.58rem' }}>
                                  {task.priority === 'Q0' ? '🔥' : task.priority === 'Q1' ? '📋' : task.priority === 'Q2' ? '⚡' : '🍃'}
                                </span>}
                              </div>
                              {editingCollab === task.id && (
                                <div className="task-collab-edit" onClick={e => e.stopPropagation()}>
                                  {teamMembers.map(m => (
                                    <label key={m.id} className="collab-member-check">
                                      <input
                                        type="checkbox"
                                        checked={!!(task.collabMembers || []).includes(m.name)}
                                        onChange={e => {
                                          const cur = task.collabMembers || []
                                          const next = e.target.checked
                                            ? [...cur, m.name]
                                            : cur.filter(n => n !== m.name)
                                          pushHistory()
                                          updateNode(task.id, { collab: next.length > 0, collabMembers: next })
                                        }}
                                      />
                                      <span>{m.name}</span>
                                    </label>
                                  ))}
                                  <button className="btn btn-secondary" style={{ fontSize: '.7rem', padding: '2px 8px' }} onClick={() => setEditingCollab(null)}>完成</button>
                                </div>
                              )}
                              {task.collab && task.collabMembers?.length > 0 && editingCollab !== task.id && (
                                <div className="task-collab-members">
                                  {[...new Set([...(task.collabMembers || []), ...(task.assignees || [])])].map((name, i) => (
                                    <span key={i} className="task-assignee-tag">{name}</span>
                                  ))}
                                </div>
                              )}
                              {!task.collab && task.assignees?.length > 0 && (
                                <div className="task-assignees">
                                  {task.assignees.map((a, i) => (
                                    <span key={i} className="task-assignee-tag">{a}</span>
                                  ))}
                                </div>
                              )}
                              {task.description && (
                                <div className="task-desc" title={task.description}>
                                  {task.description.length > 60 ? task.description.slice(0, 60) + '...' : task.description}
                                </div>
                              )}
                              {task.completedAt && (
                                <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginTop: 2 }}>
                                  ✓ 完成: {task.completedAt}
                                </div>
                              )}
                            </div>
                            <button className="btn-icon-sm" onClick={() => openEditTask(task)} title="编辑" style={{ fontSize: '.65rem' }}>编辑</button>
                            <button className="btn-icon-sm btn-icon-danger" onClick={() => handleDelete(task.id)} title="删除">✕</button>
                          </div>
                          {/* 内联编辑区 */}
                          {editingTask && editingTask.id === task.id && (
                            <div className="task-inline-edit" onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <input className="input" placeholder="待办名称" value={editTaskName} onChange={e => setEditTaskName(e.target.value)} style={{ flex: 1, minWidth: 120, fontSize: '.75rem' }} />
                                <input type="date" className="input" value={editTaskDeadline} onChange={e => setEditTaskDeadline(e.target.value)} style={{ fontSize: '.75rem' }} />
                                <select className="input" value={editTaskPriority} onChange={e => setEditTaskPriority(e.target.value)} style={{ fontSize: '.75rem' }}>
                                  <option value="">优先级</option>
                                  <option value="Q0">🔥紧急重要</option>
                                  <option value="Q1">📋重要不紧急</option>
                                  <option value="Q2">⚡紧急不重要</option>
                                  <option value="Q3">🍃不紧急不重要</option>
                                </select>
                              </div>
                              <textarea className="input" placeholder="描述（可选）" value={editTaskDesc} onChange={e => setEditTaskDesc(e.target.value)} rows={2} style={{ fontSize: '.75rem', resize: 'vertical', marginTop: 6 }} />
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                                <label className="task-add-check"><input type="checkbox" checked={editTaskPom} onChange={e => setEditTaskPom(e.target.checked)} /><span>🍅番茄钟</span></label>
                                <label className="task-add-check"><input type="checkbox" checked={editTaskCollab} onChange={e => { setEditTaskCollab(e.target.checked); if (!e.target.checked) setEditTaskCollabMembers([]) }} /><span>🤝协作</span></label>
                                {editTaskCollab && teamMembers.map(m => (
                                  <label key={m.id} className="collab-member-check" style={{ fontSize: '.7rem' }}>
                                    <input type="checkbox" checked={editTaskCollabMembers.includes(m.name)} onChange={e => {
                                      if (e.target.checked) setEditTaskCollabMembers([...editTaskCollabMembers, m.name])
                                      else setEditTaskCollabMembers(editTaskCollabMembers.filter(n => n !== m.name))
                                    }} />
                                    <span>{m.name}</span>
                                  </label>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button className="btn btn-primary" style={{ fontSize: '.7rem', padding: '3px 12px' }} onClick={saveEditTask} disabled={!editTaskName.trim()}>保存</button>
                                <button className="btn btn-secondary" style={{ fontSize: '.7rem', padding: '3px 12px' }} onClick={closeEditTask}>取消</button>
                              </div>
                            </div>
                          )}
                          </Fragment>
                        )
                      })}
                    </div>
                  )}

                  {/* 添加待办按钮 */}
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      className="btn-add-task"
                      onClick={() => setAddingTaskFor(project.id)}
                    >
                      + 添加待办
                    </button>
                  </div>
                  </>)/* 可折叠内容结束 */}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* 导入对比弹窗 */}
      {importPreview && (
        <div className="import-overlay" onClick={() => setImportPreview(null)}>
          <div className="import-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>数据导入对比</h3>
            <div className="import-compare">
              <div className="import-compare-col">
                <div className="import-compare-title">当前数据</div>
                <div className="import-compare-row"><span>项目</span><span className="import-num">{importPreview.stats.curProjects}</span></div>
                <div className="import-compare-row"><span>待办</span><span className="import-num">{importPreview.stats.curTasks}</span></div>
              </div>
              <div className="import-compare-arrow">→</div>
              <div className="import-compare-col">
                <div className="import-compare-title">导入数据</div>
                <div className="import-compare-row"><span>项目</span><span className="import-num">{importPreview.stats.newProjects}</span></div>
                <div className="import-compare-row"><span>待办</span><span className="import-num">{importPreview.stats.newTasks}</span></div>
              </div>
            </div>
            <div className="import-detail">
              <div className="import-detail-title">对比详情</div>
              <div className="import-detail-row">
                <span>新增项目</span>
                <span className="import-badge import-badge-add">{importPreview.stats.addProjects}</span>
              </div>
              <div className="import-detail-row">
                <span>已存在项目</span>
                <span className="import-badge import-badge-exist">{importPreview.stats.existProjects}</span>
              </div>
              <div className="import-detail-row">
                <span>新增待办</span>
                <span className="import-badge import-badge-add">{importPreview.stats.addTasks}</span>
              </div>
              <div className="import-detail-row">
                <span>已存在待办</span>
                <span className="import-badge import-badge-exist">{importPreview.stats.existTasks}</span>
              </div>
              {importPreview.stats.conflicts > 0 && (
                <div className="import-detail-row import-detail-warn">
                  <span>内容冲突</span>
                  <span className="import-badge import-badge-conflict">{importPreview.stats.conflicts}</span>
                </div>
              )}
            </div>
            <div className="import-actions">
              <button className="btn btn-primary" onClick={doImportOverwrite}>
                覆盖导入
                <span className="import-action-desc">用导入数据替换当前全部数据</span>
              </button>
              <button className="btn btn-secondary" onClick={doImportMerge}>
                增量合并
                <span className="import-action-desc">仅追加新项目/待办，保留现有数据</span>
              </button>
              <button className="btn btn-secondary" style={{ opacity: .6 }} onClick={() => setImportPreview(null)}>取消</button>
            </div>
            <div className="import-file-name">文件：{importPreview.stats.fileName}</div>
          </div>
        </div>
      )}

      {/* 新建项目弹窗 */}
      {showNewProject && (
        <div className="import-overlay" onClick={() => setShowNewProject(false)}>
          <div className="import-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>新建项目</h3>
            <div className="newproj-field">
              <label>项目名称 <span style={{ color: '#e17055' }}>*</span></label>
              <input
                className="input"
                placeholder="输入项目名称"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                autoFocus
              />
            </div>
            <div className="newproj-field">
              <label>截止日期</label>
              <input
                type="date"
                className="input"
                value={newProjectDeadline}
                onChange={e => setNewProjectDeadline(e.target.value)}
              />
            </div>
            <div className="newproj-field">
              <label>优先级（关联四象限）</label>
              <select
                className="input"
                value={newProjectPriority}
                onChange={e => setNewProjectPriority(e.target.value)}
              >
                <option value="">-- 不设置 --</option>
                <option value="Q0">🔥 重要且紧急</option>
                <option value="Q1">📋 重要不紧急</option>
                <option value="Q2">⚡ 紧急不重要</option>
                <option value="Q3">🍃 不重要不紧急</option>
              </select>
            </div>
            <div className="import-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={handleCreateProject} disabled={!newProjectName.trim()}>创建项目</button>
              <button className="btn btn-secondary" onClick={() => { setShowNewProject(false); setNewProjectName(''); setNewProjectDeadline(''); setNewProjectPriority('') }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 添加待办弹窗 */}
      {addingTaskFor && (
        <div className="import-overlay" onClick={() => { setAddingTaskFor(null); setNewTaskName(''); setNewTaskPom(false); setNewTaskCollab(false); setNewTaskCollabMembers([]); setNewTaskDeadline(''); setNewTaskPriority(''); setTaskDeadlineWarn('') }}>
          <div className="import-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>添加待办</h3>
            {(() => {
              const projNode = state.mmNodes.find(n => n.id === addingTaskFor)
              return projNode?.deadline && (
                <div className="newproj-field" style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)', background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6 }}>
                    📅 项目截止日期：<strong>{projNode.deadline}</strong>
                  </div>
                </div>
              )
            })()}
            <div className="newproj-field">
              <label>待办名称 <span style={{ color: '#e17055' }}>*</span></label>
              <input
                className="input"
                placeholder="输入待办名称"
                value={newTaskName}
                onChange={e => setNewTaskName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTask(addingTaskFor)}
                autoFocus
              />
            </div>
            <div className="newproj-field">
              <label>截止日期</label>
              <input
                type="date"
                className="input"
                value={newTaskDeadline}
                onChange={e => checkTaskDeadline(e.target.value, addingTaskFor)}
              />
              {taskDeadlineWarn && (
                <div className="task-deadline-warn">{taskDeadlineWarn}</div>
              )}
            </div>
            <div className="newproj-field">
              <label>优先级</label>
              <select
                className="input"
                value={newTaskPriority}
                onChange={e => setNewTaskPriority(e.target.value)}
              >
                <option value="">-- 不设置 --</option>
                <option value="Q0">🔥 重要且紧急</option>
                <option value="Q1">📋 重要不紧急</option>
                <option value="Q2">⚡ 紧急不重要</option>
                <option value="Q3">🍃 不重要不紧急</option>
              </select>
            </div>
            <div className="newproj-field">
              <div style={{ display: 'flex', gap: 16 }}>
                <label className="task-add-check" title="番茄钟">
                  <input type="checkbox" checked={newTaskPom} onChange={e => setNewTaskPom(e.target.checked)} />
                  <span>🍅 番茄钟</span>
                </label>
                <label className="task-add-check" title="协作">
                  <input type="checkbox" checked={newTaskCollab} onChange={e => { setNewTaskCollab(e.target.checked); if (!e.target.checked) setNewTaskCollabMembers([]) }} />
                  <span>🤝 协作</span>
                </label>
              </div>
            </div>
            {newTaskCollab && (
              <div className="newproj-field">
                <label>协作小伙伴</label>
                <div className="task-add-collab-members" style={{ marginTop: 0 }}>
                  {teamMembers.map(m => (
                    <label key={m.id} className="collab-member-check">
                      <input
                        type="checkbox"
                        checked={newTaskCollabMembers.includes(m.name)}
                        onChange={e => {
                          if (e.target.checked) setNewTaskCollabMembers([...newTaskCollabMembers, m.name])
                          else setNewTaskCollabMembers(newTaskCollabMembers.filter(n => n !== m.name))
                        }}
                      />
                      <span>{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="import-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => handleAddTask(addingTaskFor)} disabled={!newTaskName.trim()}>添加待办</button>
              <button className="btn btn-secondary" onClick={() => { setAddingTaskFor(null); setNewTaskName(''); setNewTaskPom(false); setNewTaskCollab(false); setNewTaskCollabMembers([]); setNewTaskDeadline(''); setNewTaskPriority(''); setTaskDeadlineWarn('') }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color, onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={onClick ? { cursor: 'pointer', transition: 'transform .12s' } : {}}>
      <div className="num" style={{ color }}>{value}</div>
      <div className="label">{label}</div>
    </div>
  )
}
