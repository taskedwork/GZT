/**
 * 全局状态管理 - 项目流程管理 v2（全新）
 * 
 * 核心数据模型：思维导图节点 + 边
 * 所有视图（总览/时间线/看板）都基于思维导图数据渲染
 * 
 * v2.1: 集成后端 API + WebSocket 实时同步
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect, useRef } from 'react'
import { authAPI, projectAPI, setToken, clearToken, getStoredUser, setStoredUser, clearStoredUser } from './api'
import syncClient from './sync'

// ============================================================
//  登录用户
// ============================================================
const loginUsers = [
  { id: 'admin', name: '深东', password: '', systemRole: 'manager', label: '深东 (管理员)' },
  { id: 'member1', name: '东哥哥', password: '', systemRole: 'partner', label: '东哥哥 (伙伴)' },
  { id: 'member2', name: '老蔡', password: '', systemRole: 'partner', label: '老蔡 (伙伴)' },
  { id: 'member3', name: '小北哥', password: '', systemRole: 'partner', label: '小北哥 (伙伴)' },
  { id: 'member4', name: '孙博文', password: '', systemRole: 'partner', label: '孙博文 (伙伴)' },
  { id: 'member5', name: '财务王姐', password: '', systemRole: 'partner', label: '财务王姐 (伙伴)' },
  { id: 'outsource1', name: '灯光', password: '123', systemRole: 'outsider', label: '灯光 (外包单位)' },
  { id: 'outsource2', name: '施工图', password: '123', systemRole: 'outsider', label: '施工图 (外包单位)' },
  { id: 'outsource3', name: '其他', password: '123', systemRole: 'outsider', label: '其他 (外包单位)' },
]

// 团队小伙伴预设
const defaultTeamMembers = [
  { id: 'tm_1', name: '深东', role: 'manager', roleLabel: '管理员', group: '伙伴' },
  { id: 'tm_2', name: '东哥哥', role: 'partner', roleLabel: '伙伴', group: '伙伴' },
  { id: 'tm_3', name: '老蔡', role: 'partner', roleLabel: '伙伴', group: '伙伴' },
  { id: 'tm_4', name: '小北哥', role: 'partner', roleLabel: '伙伴', group: '伙伴' },
  { id: 'tm_5', name: '孙博文', role: 'partner', roleLabel: '伙伴', group: '伙伴' },
  { id: 'tm_6', name: '财务王姐', role: 'partner', roleLabel: '伙伴', group: '伙伴' },
  { id: 'tm_7', name: '灯光', role: 'outsider', roleLabel: '外包单位', group: '外包单位' },
  { id: 'tm_8', name: '施工图', role: 'outsider', roleLabel: '外包单位', group: '外包单位' },
  { id: 'tm_9', name: '其他', role: 'outsider', roleLabel: '外包单位', group: '外包单位' },
]

// 角色定义
const roles = [
  { id: 'manager', name: '管理员', level: 0 },
  { id: 'partner', name: '伙伴', level: 1 },
  { id: 'outsider', name: '外包单位', level: 2 },
]

// ============================================================
//  初始状态
// ============================================================
const initialState = {
  // ---- 登录系统 ----
  isLoggedIn: false,
  currentUser: null,

  // ---- 主题 ----
  darkMode: true,

  // ---- 视图状态 ----
  activeView: 'dashboard',
  currentRole: null,

  // ---- 思维导图数据（核心）----
  mmNodes: [],       // 节点列表 [{id, label, type, ...}]
  mmEdges: [],       // 边列表 [{from, to}]

  // ---- 思维导图 UI 状态 ----
  selectedNodes: new Set(),
  editingNode: null,
  editText: '',
  collapsedNodes: new Set(),
  nodeStyles: {},    // { nodeId: { fillColor, textColor, fontSize } }
  nodeLabels: {},    // 自定义标签覆盖
  customPositions: {}, // 拖拽后的位置
  layoutMode: 'radial', // radial | tree_right | tree_down | compact

  // ---- 画布 ----
  zoom: 1,
  panOffset: { x: 0, y: 0 },

  // ---- 连接模式 ----
  connectMode: null,

  // ---- 层级显示控制（Alt+数字）----
  visibleLevel: 0,  // 0=全部显示, 1-N=只显示N层

  // ---- 聚焦模式（F3/F4）----
  focusNodeId: null,   // 聚焦的节点ID，null=不聚焦

  // ---- 剪贴板（复制/剪切/粘贴）----
  clipboard: null,     // { type: 'copy'|'cut', nodes: [], edges: [] }

  // ---- 节点文字格式 ----
  nodeFontStyles: {},  // { nodeId: { bold, italic, underline } }

  // ---- 历史 ----
  history: [],
  historyIndex: -1,

  // ---- 任务详情弹窗 ----
  selectedTask: null,

  // ---- 同步状态 ----
  syncStatus: 'offline',  // offline | connecting | connected | error
  onlineUsers: [],        // 在线用户列表
  lockedNodes: {},        // { nodeId: { userId, userName } } 被其他用户锁定的节点
  lastSyncAt: null,       // 上次同步时间

  // ---- 团队小伙伴 ----
  teamMembers: defaultTeamMembers,

  // ---- 设置 ----
  settings: {
    privacyMode: false,       // 隐私保护：个人待办不导出
    pomDuration: 25,          // 番茄钟时长（分钟）
    exportPrefix: '深东项目备份', // 导出文件名前缀
    exportFolder: '',         // 导出文件夹路径
    gistSync: false,          // Gist自动同步开关
    gistToken: '',            // Gist Token
  },
}

// ============================================================
//  Reducer
// ============================================================
function appReducer(state, action) {
  switch (action.type) {
    // ===== 视图切换 =====
    case 'SET_VIEW':
      return { ...state, activeView: action.payload }
    case 'SET_ROLE':
      return { ...state, currentRole: action.payload }

    // ===== 团队小伙伴管理 =====
    case 'ADD_TEAM_MEMBER': {
      const newMember = action.payload
      return { ...state, teamMembers: [...state.teamMembers, newMember] }
    }
    case 'UPDATE_TEAM_MEMBER': {
      const { id, ...updates } = action.payload
      return { ...state, teamMembers: state.teamMembers.map(m => m.id === id ? { ...m, ...updates } : m) }
    }
    case 'DELETE_TEAM_MEMBER': {
      return { ...state, teamMembers: state.teamMembers.filter(m => m.id !== action.payload) }
    }

    // ===== 登录 =====
    case 'LOGIN': {
      return { ...state, isLoggedIn: true, currentUser: action.payload }
    }
    case 'LOGOUT':
      return { ...initialState }

    // ===== 同步状态 =====
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload }
    case 'SET_ONLINE_USERS':
      return { ...state, onlineUsers: action.payload }
    case 'SET_LOCKED_NODES':
      return { ...state, lockedNodes: action.payload }
    case 'LOCK_NODE': {
      return { ...state, lockedNodes: { ...state.lockedNodes, [action.payload.nodeId]: { userId: action.payload.userId, userName: action.payload.userName } } }
    }
    case 'UNLOCK_NODE': {
      const next = { ...state.lockedNodes }
      delete next[action.payload]
      return { ...state, lockedNodes: next }
    }
    case 'SET_LAST_SYNC':
      return { ...state, lastSyncAt: action.payload }

    // ===== 主题 =====
    case 'TOGGLE_DARK_MODE':
      return { ...state, darkMode: !state.darkMode }

    // ===== 设置 =====
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } }

    // ===== 思维导图数据操作 =====
    case 'SET_MM_DATA':
      return { ...state, mmNodes: action.payload.nodes || [], mmEdges: action.payload.edges || [] }

    case 'ADD_NODE': {
      const nodes = [...state.mmNodes, action.payload]
      const edges = action.payload.parentId ? [...state.mmEdges, { from: action.payload.parentId, to: action.payload.id }] : state.mmEdges
      return { ...state, mmNodes: nodes, mmEdges: edges }
    }

    case 'UPDATE_NODE': {
      const nodes = state.mmNodes.map(n => n.id === action.payload.id ? { ...n, ...action.payload.data } : n)
      return { ...state, mmNodes: nodes }
    }

    case 'DELETE_NODES': {
      const ids = Array.isArray(action.payload) ? action.payload : [action.payload]
      // 找所有后代
      const descendants = new Set(ids)
      let changed = true
      while (changed) {
        changed = false
        state.mmEdges.forEach(e => {
          if (descendants.has(e.from) && !descendants.has(e.to)) { descendants.add(e.to); changed = true }
        })
      }
      return {
        ...state,
        mmNodes: state.mmNodes.filter(n => !descendants.has(n.id)),
        mmEdges: state.mmEdges.filter(e => !descendants.has(e.from) && !descendants.has(e.to)),
        selectedNodes: new Set([...state.selectedNodes].filter(id => !descendants.has(id))),
      }
    }

    case 'ADD_EDGE': {
      const exists = state.mmEdges.some(e => e.from === action.payload.from && e.to === action.payload.to)
      if (exists) return state
      return { ...state, mmEdges: [...state.mmEdges, action.payload] }
    }

    case 'DELETE_EDGE': {
      return { ...state, mmEdges: state.mmEdges.filter((_, i) => i !== action.payload) }
    }

    case 'MOVE_NODE': {
      // 移动节点到新父节点：删除旧边，添加新边
      const { nodeId, newParentId } = action.payload
      const edgesWithoutOld = state.mmEdges.filter(e => e.to !== nodeId)
      const alreadyExists = edgesWithoutOld.some(e => e.from === newParentId && e.to === nodeId)
      const newEdges = alreadyExists ? edgesWithoutOld : [...edgesWithoutOld, { from: newParentId, to: nodeId }]
      return { ...state, mmEdges: newEdges }
    }

    // ===== 选择 & 编辑 =====
    case 'SET_SELECTED_NODES':
      return { ...state, selectedNodes: action.payload }
    case 'SET_EDITING_NODE':
      return { ...state, editingNode: action.payload.nodeId, editText: action.payload.text || '' }
    case 'FINISH_EDIT':
      return { ...state, editingNode: null, editText: '' }

    // ===== 折叠 =====
    case 'TOGGLE_COLLAPSE': {
      const next = new Set(state.collapsedNodes)
      if (next.has(action.payload)) next.delete(action.payload)
      else next.add(action.payload)
      return { ...state, collapsedNodes: next }
    }

    // ===== 样式 =====
    case 'UPDATE_NODE_STYLE': {
      const { nodeId, styleKey, value } = action.payload
      return {
        ...state,
        nodeStyles: {
          ...state.nodeStyles,
          [nodeId]: { ...(state.nodeStyles[nodeId] || {}), [styleKey]: value },
        },
      }
    }
    case 'RESET_NODE_STYLE': {
      const next = { ...state.nodeStyles }
      delete next[action.payload]
      return { ...state, nodeStyles: next }
    }

    // ===== 标签 =====
    case 'UPDATE_NODE_LABEL': {
      if (!action.payload.label) {
        const next = { ...state.nodeLabels }
        delete next[action.payload.nodeId]
        return { ...state, nodeLabels: next }
      }
      return { ...state, nodeLabels: { ...state.nodeLabels, [action.payload.nodeId]: action.payload.label } }
    }

    // ===== 高亮联动 =====
    case 'SET_HIGHLIGHTED_NODE':
      return { ...state, highlightedNodeId: action.payload }

    // ===== 画布 =====
    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(0.15, Math.min(3.0, action.payload)) }
    case 'SET_PAN_OFFSET':
      return { ...state, panOffset: action.payload }
    case 'SET_LAYOUT_MODE':
      return { ...state, layoutMode: action.payload }
    case 'SET_CUSTOM_POSITIONS':
      return { ...state, customPositions: action.payload }

    // ===== 连接模式 =====
    case 'SET_CONNECT_MODE':
      return { ...state, connectMode: action.payload }

    // ===== 层级显示控制 =====
    case 'SET_VISIBLE_LEVEL':
      return { ...state, visibleLevel: action.payload }

    // ===== 聚焦模式 =====
    case 'SET_FOCUS_NODE':
      return { ...state, focusNodeId: action.payload }

    // ===== 剪贴板 =====
    case 'SET_CLIPBOARD':
      return { ...state, clipboard: action.payload }

    // ===== 文字格式 =====
    case 'UPDATE_NODE_FONT_STYLE': {
      const { nodeId, fontKey, value } = action.payload
      return {
        ...state,
        nodeFontStyles: {
          ...state.nodeFontStyles,
          [nodeId]: { ...(state.nodeFontStyles[nodeId] || {}), [fontKey]: value },
        },
      }
    }
    case 'RESET_NODE_FONT_STYLE': {
      const next = { ...state.nodeFontStyles }
      delete next[action.payload]
      return { ...state, nodeFontStyles: next }
    }

    // ===== 历史 =====
    case 'PUSH_HISTORY': {
      const snapshot = JSON.stringify({ nodes: state.mmNodes, edges: state.mmEdges })
      const nextHistory = state.history.slice(0, state.historyIndex + 1)
      nextHistory.push(snapshot)
      return {
        ...state,
        history: nextHistory.slice(-50),
        historyIndex: Math.min(state.historyIndex + 1, 49),
      }
    }
    case 'UNDO': {
      if (state.historyIndex < 0) return state
      const prev = JSON.parse(state.history[state.historyIndex])
      return { ...state, mmNodes: prev.nodes, mmEdges: prev.edges, historyIndex: state.historyIndex - 1 }
    }
    case 'REDO': {
      const nextIdx = state.historyIndex + 1
      if (nextIdx >= state.history.length) return state
      const next = JSON.parse(state.history[nextIdx])
      return { ...state, mmNodes: next.nodes, mmEdges: next.edges, historyIndex: nextIdx }
    }

    // ===== 任务详情 =====
    case 'OPEN_TASK_DETAIL':
      return { ...state, selectedTask: action.payload }
    case 'CLOSE_TASK_DETAIL':
      return { ...state, selectedTask: null }

    default:
      return state
  }
}

// ============================================================
//  Context
// ============================================================
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const syncLockRef = useRef(false)  // 防止同步循环
  const saveTimerRef = useRef(null)  // 防抖保存定时器

  // ===== 登录（通过后端 API）=====
  const login = useCallback(async (username, password) => {
    try {
      const res = await authAPI.login(username, password)
      setToken(res.token)
      setStoredUser(res.user)
      dispatch({ type: 'LOGIN', payload: res.user })
      // 连接 WebSocket
      syncClient.connect(res.token, 'default')
      // 加载项目数据
      await loadProjectData()
      return { success: true, user: res.user }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [])

  // ===== 注册 =====
  const register = useCallback(async (username, password, name) => {
    try {
      const res = await authAPI.register(username, password, name)
      setToken(res.token)
      setStoredUser(res.user)
      dispatch({ type: 'LOGIN', payload: res.user })
      syncClient.connect(res.token, 'default')
      return { success: true, user: res.user }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [])

  // ===== 登出 =====
  const logout = useCallback(() => {
    syncClient.disconnect()
    clearToken()
    clearStoredUser()
    dispatch({ type: 'LOGOUT' })
  }, [])

  // ===== 从后端加载项目数据 =====
  const loadProjectData = useCallback(async () => {
    try {
      const project = await projectAPI.get('default')
      if (project && project.mmNodes) {
        dispatch({ type: 'SET_MM_DATA', payload: { nodes: project.mmNodes || [], edges: project.mmEdges || [] } })
        // 恢复样式和标签
        if (project.nodeStyles) {
          Object.entries(project.nodeStyles).forEach(([nodeId, style]) => {
            Object.entries(style).forEach(([key, value]) => {
              dispatch({ type: 'UPDATE_NODE_STYLE', payload: { nodeId, styleKey: key, value } })
            })
          })
        }
        if (project.nodeLabels) {
          Object.entries(project.nodeLabels).forEach(([nodeId, label]) => {
            dispatch({ type: 'UPDATE_NODE_LABEL', payload: { nodeId, label } })
          })
        }
      }
    } catch (err) {
      console.error('加载项目数据失败:', err)
    }
  }, [])

  // ===== 保存数据到后端（防抖）=====
  const saveToServer = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await projectAPI.patch('default', {
          mmNodes: state.mmNodes,
          mmEdges: state.mmEdges,
          nodeStyles: state.nodeStyles,
          nodeLabels: state.nodeLabels,
        })
        dispatch({ type: 'SET_LAST_SYNC', payload: new Date().toISOString() })
      } catch (err) {
        console.error('保存失败:', err)
      }
    }, 1000)
  }, [state.mmNodes, state.mmEdges, state.nodeStyles, state.nodeLabels])

  // ===== WebSocket 同步回调 =====
  useEffect(() => {
    syncClient.onSync = (data) => {
      if (syncLockRef.current) return
      syncLockRef.current = true
      try {
        // 增量合并：远端数据与本地数据合并，远端优先
        if (data.mmNodes) {
          const localMap = new Map(state.mmNodes.map(n => [n.id, n]))
          data.mmNodes.forEach(n => localMap.set(n.id, n))
          // 如果远端也发了 edges，做增量合并
          const edges = data.mmEdges || state.mmEdges
          dispatch({ type: 'SET_MM_DATA', payload: { nodes: [...localMap.values()], edges } })
        } else if (data.mmEdges) {
          dispatch({ type: 'SET_MM_DATA', payload: { nodes: state.mmNodes, edges: data.mmEdges } })
        }
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
      } finally {
        setTimeout(() => { syncLockRef.current = false }, 300)
      }
    }

    syncClient.onLock = (msg) => {
      dispatch({ type: 'LOCK_NODE', payload: { nodeId: msg.nodeId, userId: msg.userId, userName: msg.userName } })
    }
    syncClient.onUnlock = (msg) => {
      dispatch({ type: 'UNLOCK_NODE', payload: msg.nodeId })
    }
    syncClient.onOnlineUsers = (users) => {
      dispatch({ type: 'SET_ONLINE_USERS', payload: users })
    }
    syncClient.onConnected = () => {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'connected' })
    }
    syncClient.onDisconnected = () => {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' })
    }
    // 重连成功后拉取最新数据
    syncClient.onReconnected = () => {
      loadProjectData()
    }

    return () => {
      syncClient.onSync = null
      syncClient.onLock = null
      syncClient.onUnlock = null
      syncClient.onOnlineUsers = null
      syncClient.onConnected = null
      syncClient.onDisconnected = null
      syncClient.onReconnected = null
    }
  }, [])

  // ===== 自动登录（token 有效时）=====
  useEffect(() => {
    const storedUser = getStoredUser()
    const token = localStorage.getItem('sdd_token')
    if (storedUser && token) {
      // 验证 token 有效性
      authAPI.me().then((res) => {
        dispatch({ type: 'LOGIN', payload: res.user })
        syncClient.connect(token, 'default')
        loadProjectData()
      }).catch(() => {
        // token 过期，清除
        clearToken()
        clearStoredUser()
      })
    }
  }, [])

  // ===== 数据变更时自动保存 + 广播 =====
  useEffect(() => {
    if (!state.isLoggedIn) return
    if (syncLockRef.current) return

    // 保存到服务器
    saveToServer()

    // 广播给其他客户端
    syncClient.broadcastSync({
      mmNodes: state.mmNodes,
      mmEdges: state.mmEdges,
      nodeStyles: state.nodeStyles,
      nodeLabels: state.nodeLabels,
    })
  }, [state.mmNodes, state.mmEdges, state.nodeStyles, state.nodeLabels, state.isLoggedIn])

  // ===== 定期从服务器拉取最新数据（每60秒）=====
  useEffect(() => {
    if (!state.isLoggedIn) return
    const timer = setInterval(() => {
      if (!syncLockRef.current) {
        loadProjectData()
      }
    }, 60000)
    return () => clearInterval(timer)
  }, [state.isLoggedIn])

  // ===== 主题 =====
  const toggleDarkMode = useCallback(() => dispatch({ type: 'TOGGLE_DARK_MODE' }), [])

  // ===== 视图 =====
  const setView = useCallback((v) => dispatch({ type: 'SET_VIEW', payload: v }), [])
  const setRole = useCallback((r) => dispatch({ type: 'SET_ROLE', payload: r }), [])

  // ===== 思维导图操作 =====
  const addNode = useCallback((nodeData, parentId) => {
    dispatch({ type: 'PUSH_HISTORY' })
    dispatch({ type: 'ADD_NODE', payload: { ...nodeData, parentId } })
  }, [])

  const updateNode = useCallback((nodeId, data) => {
    dispatch({ type: 'UPDATE_NODE', payload: { id: nodeId, data } })
  }, [])

  const deleteNodes = useCallback((nodeIds) => {
    dispatch({ type: 'PUSH_HISTORY' })
    dispatch({ type: 'DELETE_NODES', payload: nodeIds })
  }, [])

  const addEdge = useCallback((from, to) => {
    dispatch({ type: 'PUSH_HISTORY' })
    dispatch({ type: 'ADD_EDGE', payload: { from, to } })
  }, [])

  const deleteEdge = useCallback((index) => {
    dispatch({ type: 'DELETE_EDGE', payload: index })
  }, [])

  const moveNode = useCallback((nodeId, newParentId) => {
    dispatch({ type: 'PUSH_HISTORY' })
    dispatch({ type: 'MOVE_NODE', payload: { nodeId, newParentId } })
  }, [])

  // ===== 选择 =====
  const setSelectedNodes = useCallback((nodes) => dispatch({ type: 'SET_SELECTED_NODES', payload: nodes }), [])
  const setEditingNode = useCallback((nodeId, text) =>
    dispatch({ type: 'SET_EDITING_NODE', payload: { nodeId, text } }), [])
  const finishEdit = useCallback(() => dispatch({ type: 'FINISH_EDIT' }), [])

  // ===== 折叠 =====
  const toggleCollapse = useCallback((nodeId) => dispatch({ type: 'TOGGLE_COLLAPSE', payload: nodeId }), [])

  // ===== 样式 =====
  const updateNodeStyle = useCallback((nodeId, key, value) =>
    dispatch({ type: 'UPDATE_NODE_STYLE', payload: { nodeId, styleKey: key, value } }), [])
  const resetNodeStyle = useCallback((nodeId) => dispatch({ type: 'RESET_NODE_STYLE', payload: nodeId }), [])

  // ===== 标签 =====
  const updateNodeLabel = useCallback((nodeId, label) =>
    dispatch({ type: 'UPDATE_NODE_LABEL', payload: { nodeId, label } }), [])

  // ===== 高亮 =====
  const setHighlightedNode = useCallback((nodeId) =>
    dispatch({ type: 'SET_HIGHLIGHTED_NODE', payload: nodeId }), [])

  // ===== 画布 =====
  const setZoom = useCallback((z) => dispatch({ type: 'SET_ZOOM', payload: z }), [])
  const setPanOffset = useCallback((offset) => dispatch({ type: 'SET_PAN_OFFSET', payload: offset }), [])
  const setLayoutMode = useCallback((mode) => dispatch({ type: 'SET_LAYOUT_MODE', payload: mode }), [])
  const setCustomPositions = useCallback((pos) => dispatch({ type: 'SET_CUSTOM_POSITIONS', payload: pos }), [])

  // ===== 连接 =====
  const setConnectMode = useCallback((mode) => dispatch({ type: 'SET_CONNECT_MODE', payload: mode }), [])

  // ===== 层级显示 =====
  const setVisibleLevel = useCallback((level) => dispatch({ type: 'SET_VISIBLE_LEVEL', payload: level }), [])

  // ===== 聚焦模式 =====
  const setFocusNode = useCallback((nodeId) => dispatch({ type: 'SET_FOCUS_NODE', payload: nodeId }), [])

  // ===== 剪贴板 =====
  const setClipboard = useCallback((data) => dispatch({ type: 'SET_CLIPBOARD', payload: data }), [])

  // ===== 文字格式 =====
  const updateNodeFontStyle = useCallback((nodeId, fontKey, value) =>
    dispatch({ type: 'UPDATE_NODE_FONT_STYLE', payload: { nodeId, fontKey, value } }), [])
  const resetNodeFontStyle = useCallback((nodeId) => dispatch({ type: 'RESET_NODE_FONT_STYLE', payload: nodeId }), [])

  // ===== 历史 =====
  const pushHistory = useCallback(() => dispatch({ type: 'PUSH_HISTORY' }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  // ===== 任务详情 =====
  const openTaskDetail = useCallback((task) => dispatch({ type: 'OPEN_TASK_DETAIL', payload: task }), [])
  const closeTaskDetail = useCallback(() => dispatch({ type: 'CLOSE_TASK_DETAIL' }), [])

  // ===== 计算属性（从思维导图数据派生）=====
  const projectInfo = useMemo(() => ({
    id: 'PROJECT-001',
    name: '项目流程管理',
    description: '基于思维导图的项目管理工具',
    version: 'v2.0',
  }), [])

  const progress = useMemo(() => {
    const total = state.mmNodes.length
    // 有样式的节点视为"已完成"
    const done = Object.keys(state.nodeStyles).length
    return { total, done, percent: total > 0 ? Math.round(done / total * 100) : 0 }
  }, [state.mmNodes.length, state.nodeStyles])

  const currentRoleData = useMemo(() => {
    if (!state.currentUser) return roles[0]
    return roles.find(r => r.id === state.currentUser.systemRole) || roles[0]
  }, [state.currentUser])

  // 构建树形结构供副面板使用
  const treeData = useMemo(() => {
    const nodeMap = {}
    state.mmNodes.forEach(n => { nodeMap[n.id] = { ...n, children: [] } })
    const roots = []
    state.mmEdges.forEach(e => {
      if (nodeMap[e.from]) nodeMap[e.from].children.push(nodeMap[e.to])
    })
    // 按 sortOrder 排序子节点
    Object.values(nodeMap).forEach(n => {
      n.children.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    })
    state.mmNodes.forEach(n => {
      const hasParent = state.mmEdges.some(e => e.to === n.id)
      if (!hasParent) roots.push(nodeMap[n.id])
    })
    return roots
  }, [state.mmNodes, state.mmEdges])

  const value = {
    state, dispatch,
    // 系统
    loginUsers, login, register, logout, roles, teamMembers: state.teamMembers,
    addTeamMember: (m) => dispatch({ type: 'ADD_TEAM_MEMBER', payload: m }),
    updateTeamMember: (id, updates) => dispatch({ type: 'UPDATE_TEAM_MEMBER', payload: { id, ...updates } }),
    deleteTeamMember: (id) => dispatch({ type: 'DELETE_TEAM_MEMBER', payload: id }),
    toggleDarkMode, setView, setRole,
    // 项目信息
    projectInfo, progress, currentRoleData, treeData,
    // 思维导图操作
    addNode, updateNode, deleteNodes, addEdge, deleteEdge, moveNode,
    setSelectedNodes, setEditingNode, finishEdit,
    toggleCollapse,
    updateNodeStyle, resetNodeStyle,
    updateNodeLabel, setHighlightedNode,
    // 画布
    setZoom, setPanOffset, setLayoutMode, setCustomPositions,
    setConnectMode,
    // 层级/聚焦/剪贴板/格式
    setVisibleLevel, setFocusNode, setClipboard,
    updateNodeFontStyle, resetNodeFontStyle,
    // 历史
    pushHistory, undo, redo,
    // 弹窗
    openTaskDetail, closeTaskDetail,
    // 同步
    syncClient, saveToServer, loadProjectData,
    // 设置
    updateSettings: (payload) => dispatch({ type: 'UPDATE_SETTINGS', payload }),
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
