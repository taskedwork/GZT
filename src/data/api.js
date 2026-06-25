/**
 * API 客户端 - 与后端服务通信
 * 本地 preview：/api（通过 vite proxy 转发）
 * GitHub Pages / 本地 dev：http://<serverHost>:3001/api（直连本地或局域网后端）
 * 服务器地址可通过 URL 参数 ?server=192.168.1.100 配置，或 localStorage 持久化
 */

// 从 URL 参数读取服务器地址并持久化（支持平板连接电脑后端）
const urlServer = new URLSearchParams(window.location.search).get('server')
if (urlServer) {
  localStorage.setItem('sdd_server_host', urlServer)
}

const isLocalPreview = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && import.meta.env.PROD
const serverHost = localStorage.getItem('sdd_server_host') || 'localhost'
const API_BASE = isLocalPreview ? '/api' : `http://${serverHost}:3001/api`

// 获取存储的 token
function getToken() {
  return localStorage.getItem('sdd_token') || ''
}

// 通用请求方法
async function request(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || `请求失败 (${res.status})`)
    }
    return data
  } catch (err) {
    if (err.message === 'Failed to fetch') {
      throw new Error('无法连接服务器，请检查后端是否启动')
    }
    throw err
  }
}

// ===== 认证 API =====
export const authAPI = {
  // 获取用户列表（公开接口）
  getUsers: () => request('/auth/users'),

  // 登录
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),

  // 注册
  register: (username, password, name) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, name }),
  }),

  // 获取当前用户
  me: () => request('/auth/me'),

  // 修改密码
  changePassword: (oldPassword, newPassword) => request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  }),
}

// ===== 项目 API =====
export const projectAPI = {
  // 获取项目列表
  list: () => request('/projects'),

  // 获取项目详情
  get: (id) => request(`/projects/${id}`),

  // 保存项目（全量替换）
  save: (id, data) => request(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // 部分更新
  patch: (id, data) => request(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  // 创建项目
  create: (data) => request('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 删除项目
  remove: (id) => request(`/projects/${id}`, {
    method: 'DELETE',
  }),
}

// Token 管理
export function setToken(token) {
  localStorage.setItem('sdd_token', token)
}

export function clearToken() {
  localStorage.removeItem('sdd_token')
}

export function getStoredUser() {
  try {
    const u = localStorage.getItem('sdd_user')
    return u ? JSON.parse(u) : null
  } catch { return null }
}

export function setStoredUser(user) {
  localStorage.setItem('sdd_user', JSON.stringify(user))
}

export function clearStoredUser() {
  localStorage.removeItem('sdd_user')
}
