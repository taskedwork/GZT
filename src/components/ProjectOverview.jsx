﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿/**
 * 项目总览 v5 - 支持创建项目 & 添加任务 & 数据存储/导出导入
 * 项目 = 根节点，任务 = 子节点
 */
import React, { useState, useRef, Fragment, useEffect, useCallback } from 'react'
import { useApp } from '../data/store'

export default function ProjectOverview() {
  const { state, dispatch, addNode, updateNode, deleteNodes, pushHistory, treeData, saveToServer, teamMembers, setView, gistPush, gistPull } = useApp()
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
  const [collapsedProjects, setCollapsedProjects] = useState(null) // null=初始未计算
  const [importMsg, setImportMsg] = useState('')
  const [importPreview, setImportPreview] = useState(null) // { nodes, edges, nodeStyles, nodeLabels, stats }
  const [myTasksModal, setMyTasksModal] = useState(false) // 我的待办弹窗
  const [editProjectModal, setEditProjectModal] = useState(null) // 编辑项目弹窗
  const [editProjName, setEditProjName] = useState('')
  const [editProjDeadline, setEditProjDeadline] = useState('')
  const [editProjPriority, setEditProjPriority] = useState('')
  const [editProjLoop, setEditProjLoop] = useState(false)
  const fileInputRef = useRef(null)

  // ===== 番茄钟悬浮计时器 =====
  const [pomoTask, setPomoTask] = useState(null)       // 当前计时的任务
  const [pomoRemaining, setPomoRemaining] = useState(0) // 剩余秒数
  const [pomoRunning, setPomoRunning] = useState(false)  // 是否运行中
  const pomoDuration = (state.settings?.pomDuration || 25) * 60

  const startPomodoro = useCallback((task) => {
    setPomoTask(task)
    setPomoRemaining(pomoDuration)
    setPomoRunning(true)
  }, [pomoDuration])

  const pausePomodoro = useCallback(() => setPomoRunning(false), [])
  const resumePomodoro = useCallback(() => setPomoRunning(true), [])
  const stopPomodoro = useCallback(() => {
    setPomoTask(null)
    setPomoRemaining(0)
    setPomoRunning(false)
  }, [])

  // 计时器
  useEffect(() => {
    if (!pomoRunning || pomoRemaining <= 0) return
    const timer = setInterval(() => {
      setPomoRemaining(prev => {
        if (prev <= 1) {
          // 番茄钟完成
          setPomoRunning(false)
          if (pomoTask) {
            updateNode(pomoTask.id, { pomCount: (pomoTask.pomCount || 0) + 1 })
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [pomoRunning, pomoRemaining, pomoTask, updateNode])

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

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

  // ===== 本地存储（已由 store 自动缓存，无需手动操作）=====

  // ===== Gist 推送 / 拉取 =====
  const gistConfigured = !!state.settings?.gistToken
  const handlePush = async () => {
    if (!gistConfigured) { setImportMsg('请先在系统设置中配置 Gist Token'); setTimeout(() => setImportMsg(''), 3000); return }
    setImportMsg('推送中...')
    const result = await gistPush()
    if (result.success) {
      setImportMsg('推送成功 ' + new Date().toLocaleTimeString('zh-CN'))
    } else {
      setImportMsg('推送失败：' + (result.error || '未知错误'))
    }
    setTimeout(() => setImportMsg(''), 4000)
  }
  const handlePull = async () => {
    if (!gistConfigured) { setImportMsg('请先在系统设置中配置 Gist Token'); setTimeout(() => setImportMsg(''), 3000); return }
    setImportMsg('拉取中...')
    const result = await gistPull()
    if (result.success) {
      if (result.hasChanges) {
        setImportMsg(`发现 ${result.diff.added.length + result.diff.removed.length + result.diff.modified.length} 处变更，请查看对比弹窗`)
      } else {
        setImportMsg('已是最新数据 ' + new Date().toLocaleTimeString('zh-CN'))
      }
    } else {
      setImportMsg('拉取失败：' + (result.error || '未知错误'))
    }
    setTimeout(() => setImportMsg(''), 4000)
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
      createdBy: state.currentUser?.name || null,
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

  // 打开编辑项目弹窗
  const openEditProject = (project) => {
    setEditProjectModal(project)
    setEditProjName(project.label || project.name || '')
    setEditProjDeadline(project.deadline || '')
    setEditProjPriority(project.priority || '')
    setEditProjLoop(!!project.loop)
  }
  // 保存编辑项目
  const saveEditProject = () => {
    if (!editProjectModal || !editProjName.trim()) return
    pushHistory()
    updateNode(editProjectModal.id, {
      label: editProjName.trim(),
      deadline: editProjDeadline || null,
      priority: editProjPriority || null,
      loop: editProjLoop,
    })
    setEditProjectModal(null)
  }
  const closeEditProject = () => setEditProjectModal(null)

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

  // 删除（deleteNodes 已内置 pushHistory），删除前确认（仅管理员可删除）
  const handleDelete = (node) => {
    if (state.currentUser?.systemRole !== 'manager') return
    const isProject = node.type === 'project'
    const childCount = isProject
      ? state.mmEdges.filter(e => e.from === node.id).length
      : 0
    const msg = isProject && childCount > 0
      ? `确定删除项目「${node.label || node.name}」吗？\n该项目下的 ${childCount} 个待办也将一并删除，此操作不可撤销。`
      : `确定删除「${node.label || node.name}」吗？此操作不可撤销。`
    if (!window.confirm(msg)) return
    deleteNodes([node.id])
  }

  // 设为个人待办（当前用户）
  const handleSetPersonal = (task) => {
    const userName = state.currentUser?.name
    if (!userName) return
    updateNode(task.id, {
      assignees: [userName],
      collab: false,
      collabMembers: [],
    })
  }

  // 加入协作（当前用户）
  const handleJoinCollab = (task) => {
    const userName = state.currentUser?.name
    if (!userName) return
    const existing = [...new Set([...(task.assignees || []), ...(task.collabMembers || [])])]
    if (!existing.includes(userName)) existing.push(userName)
    const selfJoined = [...new Set([...(task.selfJoinedMembers || [])])]
    if (!selfJoined.includes(userName)) selfJoined.push(userName)
    updateNode(task.id, {
      assignees: existing,
      collab: true,
      collabMembers: existing,
      selfJoinedMembers: selfJoined,
      // 未标记(todo)的待办加入后自动设为进行中
      ...(task.status === 'todo' ? { status: 'doing' } : {}),
    })
  }

  // 退出协作（当前用户，仅限自己加入的）
  const handleLeaveCollab = (task) => {
    const userName = state.currentUser?.name
    if (!userName) return
    // 管理员分配的不能退出
    if (!task.selfJoinedMembers?.includes(userName)) return
    const remaining = [...new Set([...(task.assignees || []), ...(task.collabMembers || [])])].filter(n => n !== userName)
    const selfJoined = (task.selfJoinedMembers || []).filter(n => n !== userName)
    updateNode(task.id, {
      assignees: remaining,
      collab: remaining.length > 0,
      collabMembers: remaining,
      selfJoinedMembers: selfJoined,
    })
  }

  const statusMap = {
    todo: { label: '待办', color: 'var(--muted)', bg: 'var(--border)' },
    doing: { label: '进行中', color: 'var(--warning)', bg: 'rgba(217,119,6,.12)' },
    done: { label: '已完成', color: 'var(--success)', bg: 'rgba(22,163,74,.12)' },
  }

  return (
    <div className="project-overview-root">
      {/* 第一栏：标题 + 统计卡片（sticky固定） */}
      <div className="stats-bar-sticky" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>项目总览</h2>
          <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 4 }}>
            管理项目与待办，点击状态标签可切换
          </p>
        </div>
        {projects.length > 0 && (
          <div className="stats-bar" style={{ marginBottom: 0, gap: 10 }}>
            <StatCard label="项目/待办" value={`${projects.length}/${state.mmNodes.filter(n => n.type === 'task' && n.status !== 'done').length}`} icon="◉" color="#6c5ce7" />
            <StatCard label={state.currentUser?.systemRole === 'manager' ? '全部待办' : '我的待办'} value={state.mmNodes.filter(n => {
              if (n.type !== 'task' || n.status === 'done') return false
              if (state.currentUser?.systemRole === 'manager') return true
              const members = [...new Set([...(n.assignees || []), ...(n.collabMembers || [])])]
              return state.currentUser ? members.includes(state.currentUser.name) : false
            }).length} icon="👤" color="#e84393" onClick={() => setMyTasksModal(true)} />
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
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
        <button className="btn btn-blue" onClick={handlePull} disabled={!gistConfigured} title="从 Gist 拉取数据">
          ⬇ 拉取
        </button>
        {state.currentUser?.systemRole === 'manager' && (
          <button className="btn btn-green" onClick={handlePush} disabled={!gistConfigured} title="推送到 Gist">
            ⬆ 推送
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
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
          textAlign: 'center', padding: '24px 16px',
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
              const isCollapsed = collapsedProjects === null || collapsedProjects.has(project.id)
              const toggleCollapse = () => {
                const next = collapsedProjects === null ? new Set(projects.map(p => p.id)) : new Set(collapsedProjects)
                if (next.has(project.id)) next.delete(project.id)
                else next.add(project.id)
                setCollapsedProjects(next)
              }

              return (
                <div key={project.id} className="project-card">
                  {/* 项目头部 + 进度条 */}
                  <div className="project-card-header" onClick={toggleCollapse} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                      <span className="project-collapse-icon" style={{ fontSize: '.6rem', transition: 'transform .15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', color: 'var(--muted)' }}>▼</span>
                      <div className="project-icon" style={project.done ? { opacity: .4 } : {}}>{project.done ? '✓' : '◉'}</div>
                      <span
                        className="project-name"
                        style={project.done ? { textDecoration: 'line-through', opacity: .5 } : {}}
                      >
                        {project.label || project.name || '未命名项目'}
                      </span>
                      <span className="task-count">{tasks.filter(t => t.status !== 'done').length} 个待办</span>
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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
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
                        title="编辑"
                        onClick={(e) => { e.stopPropagation(); openEditProject(project) }}
                      >
                        ✎
                      </button>
                      {state.currentUser?.systemRole === 'manager' && (
                      <button
                        className="btn-icon-sm btn-icon-danger"
                        title="删除项目"
                        onClick={(e) => { e.stopPropagation(); handleDelete(project) }}
                      >
                        ✕
                      </button>
                      )}
                    </div>
                    {/* 进度条 - 在标题栏底部 */}
                    {tasks.length > 0 && (
                      <div className="project-progress" onClick={e => e.stopPropagation()}>
                        <div className="project-progress-bar" style={{ width: taskPercent + '%' }} />
                        <span className="project-progress-text">{taskPercent}%</span>
                      </div>
                    )}
                  </div>

                  {/* 可折叠内容 */}
                  {!isCollapsed && (<>

                  {/* 任务列表 */}
                  <div className="task-list">
                    {tasks.map(task => {
                      const st = statusMap[task.status] || statusMap.todo
                      const isManager = state.currentUser?.systemRole === 'manager'
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
                            <div className="task-info" style={{ flex: 1, minWidth: 0 }}>
                              {/* 第一行：标题 + 协作人/按钮（空间不够时换行） */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 60, flex: '0 1 auto', flexWrap: 'wrap' }}>
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
                                      className={'task-title-text' + (task.status === 'done' ? ' task-done' : '')}
                                      onDoubleClick={() => startRename(task.id, task.label || task.name)}
                                    >
                                      {task.label || task.name || '未命名待办'}
                                    </span>
                                  )}
                                  {/* 协作人标签 - 紧跟标题后 */}
                                  {task.collab && task.collabMembers?.length > 0 && editingCollab !== task.id && (
                                    [...new Set([...(task.collabMembers || []), ...(task.assignees || [])])].map((name, i) => (
                                      <span key={i} className="task-assignee-tag">{name}</span>
                                    ))
                                  )}
                                  {!task.collab && task.assignees?.length > 0 && (
                                    task.assignees.map((a, i) => (
                                      <span key={i} className="task-assignee-tag">{a}</span>
                                    ))
                                  )}
                                </div>
                                {/* 右边区域：状态标签 + 按钮（空间不够时换到第二行） */}
                                <div className="task-actions" style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                  {task.status !== 'todo' && (
                                    <span className="task-status-tag" style={{ color: st.color, background: st.bg }}>
                                      {st.label}
                                    </span>
                                  )}
                                  {task.pom && (
                                    <span
                                      className={'task-badge' + (task.status === 'done' ? ' badge-disabled' : '')}
                                      title={task.status === 'done' ? '已完成' : '点击启动番茄钟'}
                                      style={{ cursor: task.status === 'done' ? 'not-allowed' : 'pointer' }}
                                      onClick={(e) => { e.stopPropagation(); if (task.status !== 'done') startPomodoro(task) }}
                                    >🍅{task.pomCount ? `×${task.pomCount}` : ''}</span>
                                  )}
                                  {/* 加入/退出协作 */}
                                  {(() => {
                                    const isDone = task.status === 'done'
                                    const allMembers = [...new Set([...(task.assignees || []), ...(task.collabMembers || [])])]
                                    const userName = state.currentUser?.name
                                    const isInCollab = userName && allMembers.includes(userName)
                                    const canLeave = userName && (task.selfJoinedMembers || []).includes(userName)
                                    if (isInCollab && canLeave)
                                      return <button className="btn-icon-sm btn-icon-leave" disabled={isDone} onClick={(e) => { e.stopPropagation(); handleLeaveCollab(task) }} title="退出协作" style={{ fontSize: '.62rem' }}>退出</button>
                                    if (isInCollab)
                                      return null  // 管理员分配的，不能退出
                                    return <button className="btn-icon-sm btn-icon-join" disabled={isDone} onClick={(e) => { e.stopPropagation(); handleJoinCollab(task) }} title="加入协作" style={{ fontSize: '.62rem' }}>加入</button>
                                  })()}
                                  {isManager && (
                                    <span
                                      className={'task-badge task-badge-collab' + (task.collab ? ' active' : '') + (task.status === 'done' ? ' badge-disabled' : '')}
                                      title={task.status === 'done' ? '已完成' : (task.collab ? '点击修改协作' : '点击指定协作')}
                                      style={{ cursor: task.status === 'done' ? 'not-allowed' : 'pointer' }}
                                      onClick={(e) => { e.stopPropagation(); if (task.status !== 'done') setEditingCollab(editingCollab === task.id ? null : task.id) }}
                                    >协作</span>
                                  )}
                                  {task.priority && <span className={'project-priority-tag' + (task.status === 'done' ? ' badge-disabled' : '')} data-quad={task.priority} style={{ fontSize: '.58rem', cursor: task.status === 'done' ? 'not-allowed' : 'pointer' }} title={task.priority === 'Q0' ? '重要且紧急' : task.priority === 'Q1' ? '紧急不重要' : task.priority === 'Q2' ? '不重要不紧急' : '重要不紧急'}>
                                    {task.priority === 'Q0' ? '🔥' : task.priority === 'Q1' ? '📋' : task.priority === 'Q2' ? '⚡' : '🍃'}
                                  </span>}
                                  {(isManager || task.createdBy === state.currentUser?.name) && <button className="btn-icon-sm" disabled={task.status === 'done'} onClick={() => openEditTask(task)} title="编辑" style={{ fontSize: '.65rem' }}>编辑</button>}
                                  {isManager && <button className="btn-icon-sm btn-icon-danger" onClick={() => handleDelete(task)} title="删除" style={{ fontSize: '.62rem' }}>删除</button>}
                                </div>
                              </div>
                              {/* 第二行：元数据（协作编辑、描述、截止日期） */}
                              <div className="task-meta">
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
                              {task.description && (
                                <span title={task.description}>
                                  {task.description.length > 60 ? task.description.slice(0, 60) + '...' : task.description}
                                </span>
                              )}
                              {task.deadline && <span>📅{task.deadline}</span>}
                              {task.completedAt && <span>✓ 完成: {task.completedAt}</span>}
                              </div>
                            </div>
                          </div>
                          {/* 内联编辑区 */}
                          {editingTask && editingTask.id === task.id && (
                            <div className="task-inline-edit" onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input className="input" placeholder="待办名称" value={editTaskName} onChange={e => setEditTaskName(e.target.value)} style={{ flex: 1, minWidth: 80, fontSize: '.75rem' }} />
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                                <input type="date" className="input" value={editTaskDeadline} onChange={e => setEditTaskDeadline(e.target.value)} style={{ flex: 1, fontSize: '.75rem' }} />
                                <select className="input" value={editTaskPriority} onChange={e => setEditTaskPriority(e.target.value)} style={{ flex: 1, fontSize: '.75rem' }}>
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
                    {/* 添加待办按钮 */}
                    <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)' }}>
                      <button
                        className="btn-add-task"
                        onClick={() => setAddingTaskFor(project.id)}
                      >
                        + 添加待办
                      </button>
                    </div>
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

      {/* 编辑项目弹窗 */}
      {editProjectModal && (
        <div className="import-overlay" onClick={closeEditProject}>
          <div className="import-dialog" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>编辑项目</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '.82rem', color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 50 }}>项目名称</span>
                <input className="input" placeholder="请输入项目名称" value={editProjName} onChange={e => setEditProjName(e.target.value)} style={{ flex: 1, fontSize: '.85rem' }} autoFocus />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <span style={{ fontSize: '.82rem', color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 50 }}>截止时间</span>
                  <input type="date" className="input" value={editProjDeadline} onChange={e => setEditProjDeadline(e.target.value)} style={{ flex: 1, fontSize: '.85rem' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <span style={{ fontSize: '.82rem', color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 36 }}>优先级</span>
                  <select className="input" value={editProjPriority} onChange={e => setEditProjPriority(e.target.value)} style={{ flex: 1, fontSize: '.85rem' }}>
                    <option value="">请选择</option>
                    <option value="Q0">🔴 紧急重要</option>
                    <option value="Q1">🟡 重要不紧急</option>
                    <option value="Q2">🔵 紧急不重要</option>
                    <option value="Q3">🟢 不紧急不重要</option>
                  </select>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={editProjLoop} onChange={e => setEditProjLoop(e.target.checked)} />
                <span>🔄 循环任务</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={closeEditProject}>取消</button>
              <button className="btn btn-primary" onClick={saveEditProject} disabled={!editProjName.trim()}>保存</button>
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

      {/* 我的待办弹窗 */}
      {myTasksModal && (() => {
        const isManager = state.currentUser?.systemRole === 'manager'
        const myTasks = state.mmNodes.filter(n => {
          if (n.type !== 'task') return false
          if (isManager) return true
          const members = [...new Set([...(n.assignees || []), ...(n.collabMembers || [])])]
          return state.currentUser ? members.includes(state.currentUser.name) : false
        }).map(task => {
          const projNode = state.mmNodes.find(n => state.mmEdges.some(e => e.from === n.id && e.to === task.id))
          return { ...task, projectName: projNode?.label || projNode?.name || '' }
        })
        const todoCount = myTasks.filter(t => t.status === 'todo').length
        const doingCount = myTasks.filter(t => t.status === 'doing').length
        const doneCount = myTasks.filter(t => t.status === 'done').length
        const doingTasks = myTasks.filter(t => t.status === 'doing' || t.status === 'todo')
        const doneTasks = myTasks.filter(t => t.status === 'done')
        const renderTaskItem = (task) => {
          const st = statusMap[task.status] || statusMap.todo
          return (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderBottom: '1px solid var(--border)',
              fontSize: '.78rem', flexWrap: 'wrap',
            }}>
              <span style={{ color: st.color, fontSize: '.7rem' }}>
                {task.status === 'done' ? '✓' : task.status === 'doing' ? '◐' : '○'}
              </span>
              <span style={{ flex: 1, textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? .5 : 1 }}>
                {task.label || task.name || '未命名'}
              </span>
              {task.projectName && (
                <span style={{ fontSize: '.62rem', color: 'var(--muted)', background: 'var(--border)', padding: '1px 6px', borderRadius: 6 }}>
                  {task.projectName}
                </span>
              )}
              <span style={{ fontSize: '.62rem', color: st.color, background: st.bg, padding: '1px 6px', borderRadius: 6 }}>
                {st.label}
              </span>
              {task.deadline && (
                <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>📅{task.deadline}</span>
              )}
              {task.priority && (
                <span style={{ fontSize: '.6rem' }}>
                  {task.priority === 'Q0' ? '🔥' : task.priority === 'Q1' ? '📋' : task.priority === 'Q2' ? '⚡' : '🍃'}
                </span>
              )}
            </div>
          )
        }
        return (
          <div className="import-overlay" onClick={() => setMyTasksModal(false)}>
            <div className="import-dialog my-tasks-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, minHeight: 'auto', maxHeight: '80vh' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>
                  {isManager ? '全部待办详情' : '我的待办详情'}
                  <span style={{ fontSize: '.72rem', color: 'var(--muted)', marginLeft: 8 }}>
                    共 {doingTasks.length} 项 · 待办 {todoCount} · 进行中 {doingCount} · 已完成 {doneCount}
                  </span>
                </h3>
                <button className="btn btn-primary" style={{ fontSize: '.72rem', padding: '4px 12px' }} onClick={() => { setMyTasksModal(false); setView('kanban') }}>
                  专注模式
                </button>
              </div>
              {myTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: '.85rem' }}>
                  暂无待办
                </div>
              ) : (
                <div style={{ maxHeight: 460, overflow: 'auto' }}>
                  {/* 进行中 */}
                  {doingTasks.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--warning)', padding: '6px 10px', background: 'rgba(217,119,6,.08)', borderRadius: 6, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>◐</span> 进行中 <span style={{ fontWeight: 400, fontSize: '.7rem', color: 'var(--muted)' }}>{doingTasks.length} 项</span>
                      </div>
                      {doingTasks.map(renderTaskItem)}
                    </div>
                  )}
                  {/* 已完成 */}
                  {doneTasks.length > 0 && (
                    <div>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--success)', padding: '6px 10px', background: 'rgba(22,163,74,.08)', borderRadius: 6, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>✓</span> 已完成 <span style={{ fontWeight: 400, fontSize: '.7rem', color: 'var(--muted)' }}>{doneTasks.length} 项</span>
                      </div>
                      {doneTasks.map(renderTaskItem)}
                    </div>
                  )}
                </div>
              )}
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <button className="btn btn-secondary" onClick={() => setMyTasksModal(false)}>关闭</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 悬浮番茄钟 */}
      {pomoTask && (
        <div className="pomo-float">
          <div className="pomo-float-header">
            <span className="pomo-float-icon">🍅</span>
            <span className="pomo-float-title">番茄钟</span>
            <button className="pomo-float-close" onClick={stopPomodoro} title="关闭">✕</button>
          </div>
          <div className="pomo-float-task" title={pomoTask.label || pomoTask.name}>
            {pomoTask.label || pomoTask.name || '未命名待办'}
          </div>
          <div className={'pomo-float-time' + (pomoRunning ? ' running' : '')}>
            {formatTime(pomoRemaining)}
          </div>
          <div className="pomo-float-progress">
            <div className="pomo-float-progress-bar" style={{ width: `${(1 - pomoRemaining / pomoDuration) * 100}%` }} />
          </div>
          <div className="pomo-float-actions">
            {pomoRunning ? (
              <button className="btn btn-secondary pomo-float-btn" onClick={pausePomodoro}>⏸ 暂停</button>
            ) : pomoRemaining > 0 && pomoRemaining < pomoDuration ? (
              <button className="btn btn-primary pomo-float-btn" onClick={resumePomodoro}>▶ 继续</button>
            ) : (
              <button className="btn btn-primary pomo-float-btn" onClick={() => { setPomoRemaining(pomoDuration); setPomoRunning(true) }}>▶ 开始</button>
            )}
            {pomoRemaining === 0 && (
              <span className="pomo-float-done">✓ 完成！番茄数 +1</span>
            )}
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
