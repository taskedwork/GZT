/**
 * 纯前端认证模块（无后端模式）
 *
 * 使用 bcryptjs 在浏览器端进行密码哈希/验证
 * 用户数据存储在 IndexedDB（通过 db.js）
 * 会话通过 localStorage 持久化（与后端模式兼容：sdd_token / sdd_user）
 *
 * 与后端 helpers.js 保持逻辑一致：bcrypt genSalt(10) + hash
 * 默认密码：123456
 */

import bcrypt from 'bcryptjs'
import {
  getAllUsers,
  getUserByUsername,
  getUserById,
  saveUser,
  saveAllUsers,
  deleteUser,
} from './db'

const DEFAULT_PASSWORD = '123456'
const SESSION_KEY = 'sdd_token'       // 兼容后端模式的 token 存储 key
const USER_KEY = 'sdd_user'           // 兼容后端模式的用户信息存储 key

// ===== 密码哈希（bcrypt 优先，SHA-256 fallback）=====

/** SHA-256 哈希（Web Crypto API fallback），返回 "sha256:salt$hash" 格式 */
async function sha256Hash(password, saltB64) {
  const salt = saltB64
    ? Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16))
  const enc = new TextEncoder()
  const data = new Uint8Array([...salt, ...enc.encode(password)])
  const buf = await crypto.subtle.digest('SHA-256', data)
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  const saltB64Final = saltB64 || btoa(String.fromCharCode(...salt))
  return `sha256:${saltB64Final}$${hashB64}`
}

/** SHA-256 验证 */
async function sha256Compare(password, stored) {
  if (!stored.startsWith('sha256:')) return false
  const [_, rest] = stored.split('sha256:')
  const [saltB64, hashB64] = rest.split('$')
  const result = await sha256Hash(password, saltB64)
  return result === stored
}

/** 哈希密码（bcrypt 优先，失败时用 SHA-256）*/
async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(10)
    return await bcrypt.hash(password, salt)
  } catch (err) {
    console.warn('bcrypt 不可用，使用 SHA-256 fallback:', err)
    return await sha256Hash(password)
  }
}

/** 验证密码（自动识别 bcrypt/SHA-256 格式）*/
async function verifyPassword(password, stored) {
  if (!stored) return false
  try {
    if (stored.startsWith('sha256:')) {
      return await sha256Compare(password, stored)
    }
    return await bcrypt.compare(password, stored)
  } catch (err) {
    console.warn('bcrypt 验证失败，尝试 SHA-256:', err)
    return await sha256Compare(password, stored)
  }
}

/** 生成简易会话 token（仅前端使用，非 JWT） */
function generateSessionToken() {
  const arr = new Uint8Array(24)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** 生成 UUID v4 */
function generateId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  arr[6] = (arr[6] & 0x0f) | 0x40
  arr[8] = (arr[8] & 0x3f) | 0x80
  const h = Array.from(arr).map(b => b.toString(16).padStart(2, '0'))
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`
}

/** 角色对应的头像 */
function avatarForRole(role) {
  if (role === 'manager') return '👑'
  if (role === 'outsider') return '👁'
  return '🤝'
}

/** 角色对应的中文标签 */
function roleLabelForRole(role) {
  if (role === 'manager') return '管理员'
  if (role === 'partner') return '伙伴'
  if (role === 'outsider') return '外包单位'
  if (role === 'member') return '成员'
  return role
}

// 预置成员名单（只含公开信息，密码运行时哈希为默认密码 123456）
const PRESET_MEMBERS = [
  { username: 'admin', name: '深东', systemRole: 'manager' },
  { username: 'dgge', name: '东哥哥', systemRole: 'partner' },
  { username: 'laocai', name: '老蔡', systemRole: 'partner' },
  { username: 'xbege', name: '小北哥', systemRole: 'partner' },
  { username: 'sunbo', name: '孙博文', systemRole: 'partner' },
  { username: 'wangjie', name: '财务王姐', systemRole: 'partner' },
  { username: 'dengguang', name: '灯光', systemRole: 'outsider' },
  { username: 'shigongtu', name: '施工图', systemRole: 'outsider' },
  { username: 'qita', name: '其他', systemRole: 'outsider' },
  { username: 'xiaopengyou', name: '小朋友', systemRole: 'partner' },
]

/**
 * 首次使用时初始化默认用户
 * 创建预置成员名单，密码统一为默认密码 123456（运行时哈希，不存储明文）
 * 如果已有用户但缺少预置成员，自动补充
 */
export async function initDefaultUsers() {
  const users = await getAllUsers()
  const existingUsernames = new Set(users.map(u => u.username))
  const missing = PRESET_MEMBERS.filter(m => !existingUsernames.has(m.username))

  if (users.length > 0 && missing.length === 0) return false

  const hashed = await hashPassword(DEFAULT_PASSWORD)
  const now = new Date().toISOString()

  const newUsers = missing.map(m => ({
    id: generateId(),
    username: m.username,
    password: hashed,
    name: m.name,
    systemRole: m.systemRole,
    avatar: avatarForRole(m.systemRole),
    createdAt: now,
  }))

  if (newUsers.length > 0) {
    await saveAllUsers([...users, ...newUsers])
  }
  return true
}

/** 剥离密码字段，返回安全用户对象 */
function sanitize(user) {
  if (!user) return null
  const { password, ...rest } = user
  return {
    ...rest,
    roleLabel: roleLabelForRole(rest.systemRole),
  }
}

/**
 * 获取所有用户（不含密码）
 * 兼容后端返回格式：{ users: [...] }
 */
export async function getUsers() {
  const users = await getAllUsers()
  return { users: users.map(sanitize) }
}

/**
 * 登录验证
 * @returns {Promise<{success: boolean, user?: object, token?: string, error?: string}>}
 */
export async function login(username, password) {
  try {
    const user = await getUserByUsername(username)
    if (!user) {
      return { success: false, error: '用户不存在' }
    }
    const ok = await verifyPassword(password, user.password)
    if (!ok) {
      return { success: false, error: '密码错误' }
    }
    const safeUser = sanitize(user)
    const token = generateSessionToken()
    return { success: true, user: safeUser, token }
  } catch (err) {
    return { success: false, error: '登录异常: ' + err.message }
  }
}

/**
 * 注册新用户
 * @returns {Promise<{success: boolean, user?: object, token?: string, error?: string}>}
 */
export async function register(username, password, name, systemRole = 'partner') {
  try {
    if (!username || !password) {
      return { success: false, error: '用户名和密码不能为空' }
    }
    const existing = await getUserByUsername(username)
    if (existing) {
      return { success: false, error: '用户名已存在' }
    }
    const hashed = await hashPassword(password)
    const now = new Date().toISOString()
    const role = ['manager', 'partner', 'outsider', 'member'].includes(systemRole) ? systemRole : 'partner'
    const newUser = {
      id: generateId(),
      username,
      password: hashed,
      name: name || username,
      systemRole: role,
      avatar: avatarForRole(role),
      createdAt: now,
    }
    await saveUser(newUser)
    const safeUser = sanitize(newUser)
    const token = generateSessionToken()
    return { success: true, user: safeUser, token }
  } catch (err) {
    return { success: false, error: '注册异常: ' + err.message }
  }
}

/**
 * 修改密码
 * @param {string} userId - 用户 ID
 * @param {string} oldPassword - 旧密码
 * @param {string} newPassword - 新密码
 */
export async function changePassword(userId, oldPassword, newPassword) {
  try {
    const user = await getUserById(userId)
    if (!user) return { success: false, error: '用户不存在' }
    const ok = await verifyPassword(oldPassword, user.password)
    if (!ok) return { success: false, error: '原密码错误' }
    user.password = await hashPassword(newPassword)
    await saveUser(user)
    return { success: true }
  } catch (err) {
    return { success: false, error: '修改密码异常: ' + err.message }
  }
}

/**
 * 更新用户信息（管理员操作）
 * @param {string} userId - 用户 ID
 * @param {object} updates - { name, systemRole }
 */
export async function updateUser(userId, updates) {
  try {
    const user = await getUserById(userId)
    if (!user) return { success: false, error: '用户不存在' }
    if (updates.name) user.name = updates.name
    if (updates.systemRole && ['manager', 'partner', 'outsider', 'member'].includes(updates.systemRole)) {
      user.systemRole = updates.systemRole
      user.avatar = avatarForRole(updates.systemRole)
    }
    await saveUser(user)
    return { success: true, user: sanitize(user) }
  } catch (err) {
    return { success: false, error: '更新用户异常: ' + err.message }
  }
}

/**
 * 删除用户
 * @param {string} userId - 用户 ID
 * @param {string} currentUserId - 当前登录用户 ID（不能删除自己）
 */
export async function removeUser(userId, currentUserId) {
  try {
    if (userId === currentUserId) {
      return { success: false, error: '不能删除当前登录用户' }
    }
    await deleteUser(userId)
    return { success: true }
  } catch (err) {
    return { success: false, error: '删除用户异常: ' + err.message }
  }
}

/**
 * 用全量用户列表替换 IndexedDB 中的用户数据
 * 用于 Gist 同步：远端用户列表覆盖本地
 */
export async function replaceAllUsers(users) {
  if (!Array.isArray(users)) return
  // 确保每个用户有完整字段
  const normalized = users.map(u => ({
    id: u.id || generateId(),
    username: u.username,
    password: u.password || '',
    name: u.name || u.username,
    systemRole: u.systemRole || 'partner',
    avatar: u.avatar || avatarForRole(u.systemRole || 'partner'),
    createdAt: u.createdAt || new Date().toISOString(),
  }))
  await saveAllUsers(normalized)
}

// ===== 会话管理（与 api.js 的 token/user 存储兼容）=====

export function setSession(token, user) {
  localStorage.setItem(SESSION_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser() {
  try {
    const u = localStorage.getItem(USER_KEY)
    return u ? JSON.parse(u) : null
  } catch {
    return null
  }
}

/**
 * 获取当前登录用户（从 IndexedDB 重新加载最新数据）
 * 用于前端模式下的 authAPI.me() 替代
 */
export async function getCurrentUser() {
  const stored = getStoredUser()
  if (!stored) return null
  const fresh = await getUserById(stored.id)
  return sanitize(fresh)
}
