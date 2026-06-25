/**
 * IndexedDB 存储层
 * 纯前端 PWA 模式的数据存储，替代后端 JSON 文件
 *
 * 对象存储：
 * - users: 用户列表（含密码哈希）
 * - projects: 项目数据（思维导图节点/边等）
 * - settings: 配置项
 */

const DB_NAME = 'sdd-pwa-db'
const DB_VERSION = 1

let dbPromise = null

/** 打开/初始化数据库 */
function getDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    }
  })
  return dbPromise
}

/** 通用：执行事务 */
async function tx(storeName, mode, fn) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const result = fn(store)
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error)
  })
}

// ===== 用户存储 =====
export async function getAllUsers() {
  return tx('users', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  })
}

export async function getUserById(id) {
  return tx('users', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(id)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  })
}

export async function getUserByUsername(username) {
  const users = await getAllUsers()
  return users.find(u => u.username === username) || null
}

export async function saveUser(user) {
  return tx('users', 'readwrite', (store) => {
    store.put(user)
  })
}

export async function saveAllUsers(users) {
  return tx('users', 'readwrite', (store) => {
    store.clear()
    users.forEach(u => store.put(u))
  })
}

export async function deleteUser(id) {
  return tx('users', 'readwrite', (store) => {
    store.delete(id)
  })
}

// ===== 项目存储 =====
export async function getProject(id = 'default') {
  return tx('projects', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(id)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  })
}

export async function saveProject(project) {
  return tx('projects', 'readwrite', (store) => {
    store.put(project)
  })
}

// ===== 设置存储 =====
export async function getSetting(key) {
  return tx('settings', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result?.value || null)
      req.onerror = () => reject(req.error)
    })
  })
}

export async function setSetting(key, value) {
  return tx('settings', 'readwrite', (store) => {
    store.put({ key, value })
  })
}

// ===== 检测后端是否可用 =====
let _backendAvailable = null

export async function checkBackendAvailable() {
  if (_backendAvailable !== null) return _backendAvailable
  try {
    const isLocalPreview = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && import.meta.env.PROD
    const serverHost = localStorage.getItem('sdd_server_host') || 'localhost'
    const base = isLocalPreview ? '' : `http://${serverHost}:3001`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${base}/api/health`, { signal: controller.signal })
    clearTimeout(timeout)
    _backendAvailable = res.ok
  } catch {
    _backendAvailable = false
  }
  // 30 秒后重新检测
  setTimeout(() => { _backendAvailable = null }, 30000)
  return _backendAvailable
}

/** 强制重新检测后端 */
export function resetBackendCheck() {
  _backendAvailable = null
}
