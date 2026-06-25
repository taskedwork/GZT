/**
 * 全局状态管理 - 项目流程管理 v2（全新）
 * 
 * 核心数据模型：思维导图节点 + 边
 * 所有视图（总览/时间线/看板）都基于思维导图数据渲染
 * 
 * v2.1: 集成后端 API + WebSocket 实时同步
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect, useRef, useState } from 'react'
import { authAPI, projectAPI, setToken, clearToken, getStoredUser, setStoredUser, clearStoredUser } from './api'
import syncClient from './sync'
import { pushToGist, pullFromGist, getSyncInfo } from './gistSync'
import {
  initDefaultUsers,
  login as feLogin,
  register as feRegister,
  getUsers as feGetUsers,
  setSession as feSetSession,
  clearSession as feClearSession,
  getStoredUser as feGetStoredUser,
  getCurrentUser as feGetCurrentUser,
  replaceAllUsers as feReplaceAllUsers,
  updateUser as feUpdateUser,
  removeUser as feRemoveUser,
  changePassword as feChangePassword,
} from './frontendAuth'
import { checkBackendAvailable, getProject as dbGetProject, saveProject as dbSaveProject, getAllUsers as dbGetAllUsers } from './db'

// ============================================================
//  角色定义（系统固定）
// ============================================================
const roles = [
  { id: 'manager', name: '管理员', level: 0 },
  { id: 'partner', name: '伙伴', level: 1 },
  { id: 'outsider', name: '外包单位', level: 2 },
]

// ============================================================
//  初始状态
// ============================================================
const SETTINGS_KEY = 'sdd_settings'
const MM_DATA_KEY = 'sdd_mm_data'  // 思维导图数据本地缓存

// 从 localStorage 恢复设置
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      // 固定连接模式，忽略 standalone 设置
      s.standalone = false
      return s
    }
  } catch {}
  return null
}

// 从 localStorage 恢复思维导图数据（本地缓存）
function loadMmData() {
  try {
    const raw = localStorage.getItem(MM_DATA_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

const savedSettings = loadSettings()
const savedMmData = loadMmData()

const initialState = {
  // ---- 登录系统 ----
  isLoggedIn: false,
  currentUser: null,

  // ---- 主题 ----
  darkMode: true,

  // ---- 视图状态 ----
  activeView: 'dashboard',
  currentRole: null,

  // ---- 思维导图数据（核心，独立模式从本地缓存恢复）----
  mmNodes: savedMmData?.mmNodes || [],       // 节点列表 [{id, label, type, ...}]
  mmEdges: savedMmData?.mmEdges || [],       // 边列表 [{from, to}]

  // ---- 思维导图 UI 状态 ----
  selectedNodes: new Set(),
  editingNode: null,
  editText: '',
  collapsedNodes: new Set(),
  nodeStyles: savedMmData?.nodeStyles || {},    // { nodeId: { fillColor, textColor, fontSize } }
  nodeLabels: savedMmData?.nodeLabels || {},    // 自定义标签覆盖
  customPositions: savedMmData?.customPositions || {}, // 拖拽后的位置
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
  nodeFontStyles: savedMmData?.nodeFontStyles || {},  // { nodeId: { bold, italic, underline } }

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
  pendingSync: null,      // 待处理的远端更新 { diff, remoteData, localData, timestamp }
  syncNotifVisible: false, // 对比弹窗是否显示（点击提示后才显示）
  gistSyncStatus: 'idle', // idle | pushing | pulling | error
  gistLastSync: null,     // 上次 Gist 同步时间

  // ---- 团队小伙伴（从后端加载）----
  users: [],              // 后端用户列表
  teamMembers: [],        // 从后端用户列表派生

  // ---- 设置（从 localStorage 恢复，合并默认值）----
  settings: {
    privacyMode: false,       // 隐私保护：个人待办不导出
    pomDuration: 25,          // 番茄钟时长（分钟）
    exportPrefix: '深东项目备份', // 导出文件名前缀
    exportFolder: '',         // 导出文件夹路径
    gistSync: false,          // Gist自动同步开关
    gistToken: '',            // Gist Token
    wsSync: true,             // WebSocket 实时数据同步开关
    standalone: false,        // 固定连接模式
    ...(savedSettings || {}),
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

    // ===== 用户数据（从后端加载）=====
    case 'LOAD_USERS': {
      const users = action.payload
      // 从后端用户列表派生 teamMembers
      const teamMembers = users.map(u => ({
        id: u.id,
        name: u.name,
        role: u.systemRole,
        roleLabel: u.roleLabel || u.systemRole,
        group: u.group || (u.systemRole === 'outsider' ? '外包单位' : '伙伴'),
        username: u.username,
        avatar: u.avatar,
      }))
      return { ...state, users, teamMembers }
    }

    // ===== 团队小伙伴管理（本地即时更新，后端已同步）=====
    case 'ADD_TEAM_MEMBER': {
      const newMember = action.payload
      return { ...state, teamMembers: [...state.teamMembers, newMember], users: [...state.users, newMember] }
    }
    case 'UPDATE_TEAM_MEMBER': {
      const { id, ...updates } = action.payload
      return {
        ...state,
        teamMembers: state.teamMembers.map(m => m.id === id ? { ...m, ...updates } : m),
        users: state.users.map(u => u.id === id ? { ...u, ...updates } : u),
      }
    }
    case 'DELETE_TEAM_MEMBER': {
      return {
        ...state,
        teamMembers: state.teamMembers.filter(m => m.id !== action.payload),
        users: state.users.filter(u => u.id !== action.payload),
      }
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
    case 'SET_PENDING_SYNC':
      return { ...state, pendingSync: action.payload }
    case 'CLEAR_PENDING_SYNC':
      return { ...state, pendingSync: null, syncNotifVisible: false }
    case 'SHOW_SYNC_NOTIF':
      return { ...state, syncNotifVisible: true }
    case 'HIDE_SYNC_NOTIF':
      return { ...state, syncNotifVisible: false }
    case 'SET_GIST_SYNC_STATUS':
      return { ...state, gistSyncStatus: action.payload }
    case 'SET_GIST_LAST_SYNC':
      return { ...state, gistLastSync: action.payload }

    // ===== 主题 =====
    case 'TOGGLE_DARK_MODE':
      return { ...state, darkMode: !state.darkMode }

    // ===== 设置 =====
    case 'UPDATE_SETTINGS': {
      const newSettings = { ...state.settings, ...action.payload }
      // 持久化到 localStorage
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings)) } catch {}
      return { ...state, settings: newSettings }
    }

    // ===== 清空本地数据（切换同步方式时使用）=====
    case 'CLEAR_LOCAL_DATA':
      return {
        ...state,
        mmNodes: [],
        mmEdges: [],
        nodeStyles: {},
        nodeLabels: {},
        customPositions: {},
        nodeFontStyles: {},
        history: [],
        historyIndex: -1,
        pendingSync: null,
      }

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
    case 'SET_NODE_FONT_STYLES':
      return { ...state, nodeFontStyles: action.payload }

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
//  同步差异计算
// ============================================================
function computeSyncDiff(state, remoteData) {
  const result = { hasChanges: false, added: [], removed: [], modified: [], edgeChanges: [], styleChanges: [] }

  const remoteNodes = remoteData.mmNodes || []
  const localMap = new Map(state.mmNodes.map(n => [n.id, n]))
  const remoteMap = new Map(remoteNodes.map(n => [n.id, n]))

  // 新增的节点（远端有，本地没有）
  remoteNodes.forEach(n => {
    if (!localMap.has(n.id)) {
      result.added.push({ id: n.id, label: n.label || n.name || n.id, type: n.type })
    }
  })

  // 删除的节点（本地有，远端没有）
  state.mmNodes.forEach(n => {
    if (!remoteMap.has(n.id)) {
      result.removed.push({ id: n.id, label: n.label || n.name || n.id, type: n.type })
    }
  })

  // 修改的节点（两边都有，但内容不同）
  remoteNodes.forEach(rn => {
    const ln = localMap.get(rn.id)
    if (ln && JSON.stringify(ln) !== JSON.stringify(rn)) {
      const changes = []
      const allKeys = new Set([...Object.keys(ln), ...Object.keys(rn)])
      allKeys.forEach(k => {
        if (JSON.stringify(ln[k]) !== JSON.stringify(rn[k])) {
          changes.push({ key: k, local: ln[k], remote: rn[k] })
        }
      })
      result.modified.push({ id: rn.id, label: rn.label || rn.name || rn.id, type: rn.type, changes })
    }
  })

  // 边变化
  if (remoteData.mmEdges) {
    const localEdgeStr = JSON.stringify(state.mmEdges)
    const remoteEdgeStr = JSON.stringify(remoteData.mmEdges)
    if (localEdgeStr !== remoteEdgeStr) {
      result.edgeChanges.push({
        localCount: state.mmEdges.length,
        remoteCount: remoteData.mmEdges.length,
      })
    }
  }

  // 样式/位置/字体变化
  const styleKeys = ['nodeStyles', 'nodeLabels', 'nodeFontStyles', 'customPositions']
  styleKeys.forEach(key => {
    const localStr = JSON.stringify(state[key] || {})
    const remoteStr = JSON.stringify(remoteData[key] || {})
    if (localStr !== remoteStr) {
      result.styleChanges.push({ key, hasDiff: true })
    }
  })

  result.hasChanges = result.added.length > 0 || result.removed.length > 0 || result.modified.length > 0 || result.edgeChanges.length > 0 || result.styleChanges.length > 0
  return result
}

// ============================================================
//  Context
// ============================================================
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const syncLockRef = useRef(false)  // 防止同步循环
  const saveTimerRef = useRef(null)  // 防抖保存定时器
  const stateRef = useRef(state)     // 持有最新 state，供回调使用
  stateRef.current = state

  // ===== 模式检测：后端可用 → backend 模式；不可用 → frontend 模式 =====
  // 'detecting' | 'backend' | 'frontend'
  const [appMode, setAppMode] = useState('detecting')
  const frontendModeRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    checkBackendAvailable().then(async (available) => {
      if (cancelled) return
      if (available) {
        // 后端模式：先尝试加载用户列表，失败则回退到前端模式
        try {
          const res = await authAPI.getUsers()
          if (!cancelled && res.users && res.users.length > 0) {
            frontendModeRef.current = false
            dispatch({ type: 'LOAD_USERS', payload: res.users })
            setAppMode('backend')
            return
          }
          throw new Error('用户列表为空')
        } catch (err) {
          console.warn('后端模式不可用，回退到前端模式:', err.message)
        }
      }
      // 前端模式（后端不可用或加载失败）
      frontendModeRef.current = true
      try {
        await initDefaultUsers()
        const res = await feGetUsers()
        if (!cancelled) {
          dispatch({ type: 'LOAD_USERS', payload: res.users })
          setAppMode('frontend')
        }
      } catch (err) {
        console.error('前端模式初始化失败:', err)
        if (!cancelled) setAppMode('frontend')
      }
    })
    return () => { cancelled = true }
  }, [])

  // ===== 加载用户列表（自动适配模式）=====
  const loadUsers = useCallback(async () => {
    try {
      if (frontendModeRef.current) {
        const res = await feGetUsers()
        dispatch({ type: 'LOAD_USERS', payload: res.users })
      } else {
        const res = await authAPI.getUsers()
        if (res.users) dispatch({ type: 'LOAD_USERS', payload: res.users })
      }
    } catch (err) {
      console.error('加载用户列表失败:', err)
    }
  }, [])

  // ===== 登录 =====
  const login = useCallback(async (username, password) => {
    try {
      if (frontendModeRef.current) {
        // 纯前端模式：IndexedDB 验证
        const res = await feLogin(username, password)
        if (!res.success) return { success: false, error: res.error }
        feSetSession(res.token, res.user)
        dispatch({ type: 'LOGIN', payload: res.user })
        loadUsers()
        await loadProjectData()
        return { success: true, user: res.user }
      }
      // 后端模式
      const res = await authAPI.login(username, password)
      setToken(res.token)
      setStoredUser(res.user)
      dispatch({ type: 'LOGIN', payload: res.user })
      if (stateRef.current.settings?.wsSync !== false) {
        syncClient.connect(res.token, 'default')
      }
      loadUsers()
      await loadProjectData()
      return { success: true, user: res.user }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [loadUsers])

  // ===== 注册 =====
  const register = useCallback(async (username, password, name) => {
    try {
      if (frontendModeRef.current) {
        const res = await feRegister(username, password, name)
        if (!res.success) return { success: false, error: res.error }
        feSetSession(res.token, res.user)
        dispatch({ type: 'LOGIN', payload: res.user })
        loadUsers()
        return { success: true, user: res.user }
      }
      const res = await authAPI.register(username, password, name)
      setToken(res.token)
      setStoredUser(res.user)
      dispatch({ type: 'LOGIN', payload: res.user })
      syncClient.connect(res.token, 'default')
      loadUsers()
      return { success: true, user: res.user }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [loadUsers])

  // ===== 登出 =====
  const logout = useCallback(() => {
    if (!frontendModeRef.current) {
      syncClient.disconnect()
      clearToken()
      clearStoredUser()
    } else {
      feClearSession()
    }
    dispatch({ type: 'LOGOUT' })
  }, [])

  // ===== 加载项目数据（后端模式从 API，前端模式从 IndexedDB）=====
  const loadProjectData = useCallback(async () => {
    try {
      if (frontendModeRef.current) {
        // 纯前端模式：从 IndexedDB 加载
        const project = await dbGetProject('default')
        if (project && project.mmNodes) {
          dispatch({ type: 'SET_MM_DATA', payload: { nodes: project.mmNodes || [], edges: project.mmEdges || [] } })
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
          if (project.nodeFontStyles) {
            dispatch({ type: 'SET_NODE_FONT_STYLES', payload: project.nodeFontStyles })
          }
          if (project.customPositions) {
            dispatch({ type: 'SET_CUSTOM_POSITIONS', payload: project.customPositions })
          }
        }
        return
      }
      // 后端模式
      const res = await projectAPI.get('default')
      const project = res.project || res
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

  // ===== 保存数据（后端模式 → API，前端模式 → IndexedDB，防抖）=====
  const saveToServer = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const cur = stateRef.current
      try {
        if (frontendModeRef.current) {
          await dbSaveProject({
            id: 'default',
            mmNodes: cur.mmNodes,
            mmEdges: cur.mmEdges,
            nodeStyles: cur.nodeStyles,
            nodeLabels: cur.nodeLabels,
            nodeFontStyles: cur.nodeFontStyles,
            customPositions: cur.customPositions,
            updatedAt: new Date().toISOString(),
          })
        } else {
          await projectAPI.patch('default', {
            mmNodes: cur.mmNodes,
            mmEdges: cur.mmEdges,
            nodeStyles: cur.nodeStyles,
            nodeLabels: cur.nodeLabels,
          })
        }
        dispatch({ type: 'SET_LAST_SYNC', payload: new Date().toISOString() })
      } catch (err) {
        console.error('保存失败:', err)
      }
    }, 1000)
  }, [])

  // ===== WebSocket 同步回调 =====
  useEffect(() => {
    syncClient.onSync = (data) => {
      if (syncLockRef.current) return
      syncLockRef.current = true
      try {
        const currentState = stateRef.current
        // 计算远端与本地数据的差异
        const diff = computeSyncDiff(currentState, data)
        if (diff.hasChanges) {
          // 有差异，存储待处理更新，由用户选择处理方式
          dispatch({
            type: 'SET_PENDING_SYNC',
            payload: {
              diff,
              remoteData: data,
              localNodes: currentState.mmNodes,
              localEdges: currentState.mmEdges,
              timestamp: new Date().toISOString(),
            }
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
    syncClient.onConnecting = () => {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'connecting' })
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
      syncClient.onConnecting = null
    }
  }, [])

  // ===== 自动登录（模式确定后执行）=====
  useEffect(() => {
    if (appMode === 'detecting') return

    // 纯前端模式：从 localStorage 恢复会话，从 IndexedDB 加载数据
    if (appMode === 'frontend') {
      const storedUser = feGetStoredUser()
      if (!storedUser) return
      feGetCurrentUser().then((freshUser) => {
        if (freshUser) {
          dispatch({ type: 'LOGIN', payload: freshUser })
          feSetSession(localStorage.getItem('sdd_token') || '', freshUser)
          loadUsers()
          loadProjectData()
        } else {
          feClearSession()
        }
      })
      return
    }

    // 后端模式
    const storedUser = getStoredUser()
    if (!storedUser) return

    const ensureBackendRunning = async () => {
      try {
        const statusRes = await fetch('/api/manage/backend-status')
        const status = await statusRes.json()
        if (status.running) return true

        await fetch('/api/manage/start-backend')
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 1000))
          try {
            const check = await fetch('/api/manage/backend-status')
            const s = await check.json()
            if (s.running) return true
          } catch {}
        }
        return false
      } catch {
        return false
      }
    }

    ensureBackendRunning().then((ok) => {
      if (!ok) {
        dispatch({ type: 'LOGIN', payload: storedUser })
        return
      }
      const token = localStorage.getItem('sdd_token')
      if (!token) {
        dispatch({ type: 'LOGIN', payload: storedUser })
        return
      }
      authAPI.me().then((res) => {
        dispatch({ type: 'LOGIN', payload: res.user })
        if (state.settings?.wsSync !== false) {
          syncClient.connect(token, 'default')
        }
        loadUsers()
        loadProjectData()
      }).catch(() => {
        clearToken()
        clearStoredUser()
      })
    })
  }, [appMode])

  // ===== 数据变更时自动保存 + 广播 =====
  useEffect(() => {
    if (!state.isLoggedIn) return
    if (syncLockRef.current) return

    // 纯前端模式：仅保存到 IndexedDB，跳过 WebSocket 广播
    if (frontendModeRef.current) {
      saveToServer()
      return
    }

    // 后端模式：保存 + WebSocket 广播
    if (!state.settings?.wsSync) return
    saveToServer()
    syncClient.broadcastSync({
      mmNodes: state.mmNodes,
      mmEdges: state.mmEdges,
      nodeStyles: state.nodeStyles,
      nodeLabels: state.nodeLabels,
    })
  }, [state.mmNodes, state.mmEdges, state.nodeStyles, state.nodeLabels, state.isLoggedIn, state.settings?.wsSync])

  // ===== 数据变更时自动缓存到本地 localStorage =====
  useEffect(() => {
    if (!state.isLoggedIn) return
    try {
      localStorage.setItem(MM_DATA_KEY, JSON.stringify({
        mmNodes: state.mmNodes,
        mmEdges: state.mmEdges,
        nodeStyles: state.nodeStyles,
        nodeLabels: state.nodeLabels,
        customPositions: state.customPositions,
        nodeFontStyles: state.nodeFontStyles,
        cacheTime: new Date().toISOString(),
      }))
    } catch (err) {
      console.error('本地缓存失败:', err)
    }
  }, [state.mmNodes, state.mmEdges, state.nodeStyles, state.nodeLabels, state.customPositions, state.nodeFontStyles, state.isLoggedIn])

  // ===== 定期从服务器拉取最新数据（每60秒，仅后端模式）=====
  useEffect(() => {
    if (!state.isLoggedIn) return
    if (frontendModeRef.current) return
    if (!state.settings?.wsSync) return
    const timer = setInterval(() => {
      if (!syncLockRef.current) {
        loadProjectData()
      }
    }, 60000)
    return () => clearInterval(timer)
  }, [state.isLoggedIn, state.settings?.wsSync])

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

  // ===== 同步冲突处理 =====
  const resolveSync = useCallback((mode) => {
    const ps = stateRef.current.pendingSync
    if (!ps) return
    const currentState = stateRef.current
    syncLockRef.current = true
    try {
      if (mode === 'remote') {
        // 接受远端：用远端数据替换本地
        const remote = ps.remoteData
        if (remote.mmNodes) {
          const edges = remote.mmEdges || currentState.mmEdges
          dispatch({ type: 'SET_MM_DATA', payload: { nodes: remote.mmNodes, edges } })
        } else if (remote.mmEdges) {
          dispatch({ type: 'SET_MM_DATA', payload: { nodes: currentState.mmNodes, edges: remote.mmEdges } })
        }
        if (remote.nodeStyles) {
          Object.entries(remote.nodeStyles).forEach(([nodeId, style]) => {
            Object.entries(style).forEach(([key, value]) => {
              dispatch({ type: 'UPDATE_NODE_STYLE', payload: { nodeId, styleKey: key, value } })
            })
          })
        }
        if (remote.nodeLabels) {
          Object.entries(remote.nodeLabels).forEach(([nodeId, label]) => {
            dispatch({ type: 'UPDATE_NODE_LABEL', payload: { nodeId, label } })
          })
        }
        if (remote.nodeFontStyles) {
          dispatch({ type: 'SET_NODE_FONT_STYLES', payload: remote.nodeFontStyles })
        }
        if (remote.customPositions) {
          dispatch({ type: 'SET_CUSTOM_POSITIONS', payload: remote.customPositions })
        }
      } else if (mode === 'merge') {
        // 合并：远端新增/修改的合并到本地，本地独有的保留
        const remote = ps.remoteData
        if (remote.mmNodes) {
          const localMap = new Map(currentState.mmNodes.map(n => [n.id, n]))
          remote.mmNodes.forEach(n => localMap.set(n.id, n))
          const edges = remote.mmEdges || currentState.mmEdges
          dispatch({ type: 'SET_MM_DATA', payload: { nodes: [...localMap.values()], edges } })
        } else if (remote.mmEdges) {
          dispatch({ type: 'SET_MM_DATA', payload: { nodes: currentState.mmNodes, edges: remote.mmEdges } })
        }
        if (remote.nodeStyles) {
          Object.entries(remote.nodeStyles).forEach(([nodeId, style]) => {
            Object.entries(style).forEach(([key, value]) => {
              dispatch({ type: 'UPDATE_NODE_STYLE', payload: { nodeId, styleKey: key, value } })
            })
          })
        }
        if (remote.nodeLabels) {
          Object.entries(remote.nodeLabels).forEach(([nodeId, label]) => {
            dispatch({ type: 'UPDATE_NODE_LABEL', payload: { nodeId, label } })
          })
        }
        if (remote.nodeFontStyles) {
          dispatch({ type: 'SET_NODE_FONT_STYLES', payload: { ...currentState.nodeFontStyles, ...remote.nodeFontStyles } })
        }
        if (remote.customPositions) {
          dispatch({ type: 'SET_CUSTOM_POSITIONS', payload: { ...currentState.customPositions, ...remote.customPositions } })
        }
      }
      // mode === 'local' => 什么都不做，保留本地数据

      // Gist 来源：更新 settings、用户列表和同步时间
      if (ps.source === 'gist' && mode !== 'local') {
        const remote = ps.remoteData
        if (remote.settings) {
          const safeRemoteSettings = { ...remote.settings }
          delete safeRemoteSettings.gistToken
          dispatch({ type: 'UPDATE_SETTINGS', payload: safeRemoteSettings })
        }
        // 纯前端模式：同步用户列表到 IndexedDB
        if (frontendModeRef.current && remote.users) {
          feReplaceAllUsers(remote.users).then(() => loadUsers())
        }
        const now = new Date().toISOString()
        localStorage.setItem('sdd_gist_last_sync', now)
        dispatch({ type: 'SET_GIST_LAST_SYNC', payload: now })
      }

      dispatch({ type: 'CLEAR_PENDING_SYNC' })
    } finally {
      setTimeout(() => { syncLockRef.current = false }, 500)
    }
  }, [])

  // ===== Gist 同步 =====
  const gistPush = useCallback(async () => {
    const currentState = stateRef.current
    const token = currentState.settings?.gistToken
    if (!token) return { success: false, error: '未配置 Token' }

    dispatch({ type: 'SET_GIST_SYNC_STATUS', payload: 'pushing' })
    try {
      // 推送时过滤掉敏感字段 gistToken，防止 GitHub 扫描到并吊销
      const safeSettings = { ...currentState.settings }
      delete safeSettings.gistToken

      // 纯前端模式：附带用户列表（含密码哈希，用于跨设备同步账号）
      const payload = {
        mmNodes: currentState.mmNodes,
        mmEdges: currentState.mmEdges,
        nodeStyles: currentState.nodeStyles,
        nodeLabels: currentState.nodeLabels,
        nodeFontStyles: currentState.nodeFontStyles,
        customPositions: currentState.customPositions,
        settings: safeSettings,
        pushedBy: currentState.currentUser?.name || 'unknown',
      }
      if (frontendModeRef.current) {
        payload.users = await dbGetAllUsers()
      }

      const result = await pushToGist(token, payload)
      if (result.success) {
        const now = new Date().toISOString()
        localStorage.setItem('sdd_gist_last_sync', now)
        dispatch({ type: 'SET_GIST_LAST_SYNC', payload: now })
        dispatch({ type: 'SET_GIST_SYNC_STATUS', payload: 'idle' })
      } else {
        dispatch({ type: 'SET_GIST_SYNC_STATUS', payload: 'error' })
      }
      return result
    } catch (err) {
      dispatch({ type: 'SET_GIST_SYNC_STATUS', payload: 'error' })
      return { success: false, error: err.message }
    }
  }, [])

  const gistPull = useCallback(async () => {
    const currentState = stateRef.current
    const token = currentState.settings?.gistToken
    if (!token) return { success: false, error: '未配置 Token' }

    dispatch({ type: 'SET_GIST_SYNC_STATUS', payload: 'pulling' })
    try {
      const result = await pullFromGist(token)
      if (result.success && result.data) {
        const data = result.data

        // 计算本地与远端数据差异
        const diff = computeSyncDiff(currentState, data)

        if (diff.hasChanges) {
          // 有差异：存入 pendingSync，触发对比弹窗，不直接覆盖
          dispatch({
            type: 'SET_PENDING_SYNC',
            payload: {
              diff,
              remoteData: data,
              localNodes: currentState.mmNodes,
              localEdges: currentState.mmEdges,
              timestamp: new Date().toISOString(),
              source: 'gist',
            }
          })
          dispatch({ type: 'SET_GIST_SYNC_STATUS', payload: 'idle' })
          return { success: true, hasChanges: true, diff }
        }

        // 无差异：仅更新 settings 和同步时间
        // 拉取到的 settings 不应覆盖本地 gistToken
        if (data.settings) {
          const safeRemoteSettings = { ...data.settings }
          delete safeRemoteSettings.gistToken
          dispatch({ type: 'UPDATE_SETTINGS', payload: safeRemoteSettings })
        }
        const now = new Date().toISOString()
        localStorage.setItem('sdd_gist_last_sync', now)
        dispatch({ type: 'SET_GIST_LAST_SYNC', payload: now })
        dispatch({ type: 'SET_GIST_SYNC_STATUS', payload: 'idle' })
        return { success: true, hasChanges: false }
      } else {
        dispatch({ type: 'SET_GIST_SYNC_STATUS', payload: 'error' })
      }
      return result
    } catch (err) {
      dispatch({ type: 'SET_GIST_SYNC_STATUS', payload: 'error' })
      return { success: false, error: err.message }
    }
  }, [])

  // Gist 自动同步：数据变更时防抖推送
  const gistAutoTimerRef = useRef(null)
  useEffect(() => {
    if (!state.isLoggedIn) return
    if (!state.settings?.gistSync || !state.settings?.gistToken) return
    if (state.gistSyncStatus === 'pushing' || state.gistSyncStatus === 'pulling') return

    if (gistAutoTimerRef.current) clearTimeout(gistAutoTimerRef.current)
    gistAutoTimerRef.current = setTimeout(() => {
      gistPush()
    }, 30000) // 数据变更后 30 秒自动推送，避免频繁请求 GitHub API

    return () => {
      if (gistAutoTimerRef.current) clearTimeout(gistAutoTimerRef.current)
    }
  }, [state.mmNodes, state.mmEdges, state.nodeStyles, state.nodeLabels, state.nodeFontStyles, state.customPositions, state.isLoggedIn, state.settings?.gistSync, state.settings?.gistToken])

  // 启动时从 Gist 拉取
  useEffect(() => {
    if (!state.isLoggedIn) return
    if (!state.settings?.gistSync || !state.settings?.gistToken) return
    // 延迟拉取，等本地数据加载完
    const timer = setTimeout(() => {
      gistPull()
    }, 3000)
    return () => clearTimeout(timer)
  }, [state.isLoggedIn, state.settings?.gistSync, state.settings?.gistToken])

  // 定时自动拉取（每 5 分钟检查云端更新，独立模式下）
  useEffect(() => {
    if (!state.isLoggedIn) return
    if (!state.settings?.gistSync || !state.settings?.gistToken) return
    const interval = setInterval(() => {
      // 有未处理的对比弹窗时跳过，避免覆盖
      if (stateRef.current.pendingSync) return
      gistPull()
    }, 5 * 60 * 1000) // 5 分钟
    return () => clearInterval(interval)
  }, [state.isLoggedIn, state.settings?.gistSync, state.settings?.gistToken, gistPull])

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

  // ===== 团队成员管理（前端模式持久化到 IndexedDB）=====
  const addTeamMember = useCallback(async (m) => {
    if (frontendModeRef.current) {
      // 纯前端模式：通过 frontendAuth 创建用户（bcrypt 哈希密码）
      const username = m.username || ('tm_' + Date.now())
      const res = await feRegister(username, '123456', m.name, m.role)
      if (res.success) {
        dispatch({ type: 'ADD_TEAM_MEMBER', payload: { ...m, id: res.user.id, username } })
      }
    } else {
      dispatch({ type: 'ADD_TEAM_MEMBER', payload: m })
    }
  }, [])

  const updateTeamMember = useCallback(async (id, updates) => {
    if (frontendModeRef.current) {
      await feUpdateUser(id, { name: updates.name, systemRole: updates.role })
    }
    dispatch({ type: 'UPDATE_TEAM_MEMBER', payload: { id, ...updates } })
  }, [])

  const deleteTeamMember = useCallback(async (id) => {
    if (frontendModeRef.current) {
      const cur = stateRef.current
      await feRemoveUser(id, cur.currentUser?.id)
    }
    dispatch({ type: 'DELETE_TEAM_MEMBER', payload: id })
  }, [])

  // ===== 修改密码（前端模式用 IndexedDB，后端模式用 API）=====
  const changePassword = useCallback(async (oldPassword, newPassword) => {
    if (frontendModeRef.current) {
      const cur = stateRef.current
      return feChangePassword(cur.currentUser?.id, oldPassword, newPassword)
    }
    return authAPI.changePassword(oldPassword, newPassword)
  }, [])

  const value = {
    state, dispatch,
    // 系统
    appMode, users: state.users, login, register, logout, roles, teamMembers: state.teamMembers, loadUsers,
    addTeamMember, updateTeamMember, deleteTeamMember, changePassword,
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
    syncClient, saveToServer, loadProjectData, resolveSync,
    showSyncNotif: () => dispatch({ type: 'SHOW_SYNC_NOTIF' }),
    hideSyncNotif: () => dispatch({ type: 'HIDE_SYNC_NOTIF' }),
    // Gist 同步
    gistPush, gistPull,
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
