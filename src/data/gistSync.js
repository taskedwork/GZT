/**
 * GitHub Gist 自动同步模块
 *
 * 功能：
 *   - pushToGist: 将本地数据加密后推送到 Gist（创建或更新）
 *   - pullFromGist: 从 Gist 拉取并解密数据
 *   - 自动同步：数据变更时定时推送，启动时拉取
 *   - AES-GCM 加密：以 GitHub Token 派生密钥，业务数据加密存储，异地终端用同一 Token 解密
 *
 * Gist 文件结构：
 *   - sdd-project-data.json  加密后的数据文件
 */

const GIST_FILENAME = 'sdd-project-data.json'
const GIST_DESC = 'SDD工作台 - 项目数据自动同步'

// Gist ID 存储 key
const GIST_ID_KEY = 'sdd_gist_id'

// ===== 加密/解密（Web Crypto API，AES-GCM 256）=====

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/** ArrayBuffer → Base64 字符串 */
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Base64 字符串 → ArrayBuffer */
function base64ToBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/** 从 GitHub Token + salt 派生 AES-GCM 密钥（PBKDF2, 10万次迭代） */
async function deriveKey(token, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(token),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** 加密明文字符串，返回 { encrypted, v, salt, iv, data } */
async function encryptData(plaintext, token) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(token, salt)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(plaintext)
  )
  return {
    encrypted: true,
    v: 1,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    data: bufferToBase64(ciphertext),
  }
}

/** 解密 { salt, iv, data } 对象，返回明文字符串 */
async function decryptData(encObj, token) {
  const salt = new Uint8Array(base64ToBuffer(encObj.salt))
  const iv = new Uint8Array(base64ToBuffer(encObj.iv))
  const ciphertext = base64ToBuffer(encObj.data)
  const key = await deriveKey(token, salt)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  return textDecoder.decode(plaintext)
}

// ===== Gist API =====

/**
 * 获取 Gist API 请求头
 */
function getHeaders(token) {
  return {
    'Authorization': `token ${token.trim()}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }
}

/**
 * 获取已保存的 Gist ID
 */
export function getGistId() {
  return localStorage.getItem(GIST_ID_KEY) || ''
}

/**
 * 保存 Gist ID
 */
function saveGistId(id) {
  if (id) localStorage.setItem(GIST_ID_KEY, id)
  else localStorage.removeItem(GIST_ID_KEY)
}

/**
 * 验证 Token 是否有效
 */
export async function validateToken(token) {
  if (!token || !token.trim()) return { valid: false, error: '请输入 Token' }

  const trimmed = token.trim()

  // 检查是否为 fine-grained token（不支持 Gist API）
  if (trimmed.startsWith('github_pat_')) {
    return { valid: false, error: 'Fine-grained Token 不支持 Gist API，请使用 Classic Token（以 ghp_ 开头）' }
  }

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: getHeaders(trimmed),
    })
    if (res.status === 401) {
      return { valid: false, error: 'Token 无效或已过期，请重新生成' }
    }
    if (res.status === 403) {
      return { valid: false, error: 'Token 权限不足或已超出速率限制' }
    }
    if (!res.ok) return { valid: false, error: `验证失败: HTTP ${res.status}` }

    const data = await res.json()

    // 检查 gist 权限
    const scopes = res.headers.get('X-OAuth-Scopes') || ''
    if (!scopes.split(',').some(s => s.trim() === 'gist')) {
      return { valid: false, error: `Token 缺少 gist 权限（当前权限: ${scopes || '无'}），请重新生成并勾选 gist` }
    }

    return { valid: true, username: data.login }
  } catch (err) {
    return { valid: false, error: '网络错误: ' + err.message }
  }
}

/**
 * 推送数据到 Gist（加密后上传）
 * @param {string} token - GitHub Personal Access Token（同时作为加密密钥来源）
 * @param {object} data - 要同步的数据 { mmNodes, mmEdges, nodeStyles, nodeLabels, settings }
 * @returns {Promise<{success: boolean, gistId?: string, error?: string}>}
 */
export async function pushToGist(token, data) {
  if (!token) return { success: false, error: '未配置 Token' }

  const gistId = getGistId()

  // 序列化 → 加密
  const rawContent = JSON.stringify({
    version: '1.0',
    syncTime: new Date().toISOString(),
    ...data,
  }, null, 2)

  let content
  try {
    const encObj = await encryptData(rawContent, token.trim())
    content = JSON.stringify(encObj, null, 2)
  } catch (err) {
    return { success: false, error: '加密失败: ' + err.message }
  }

  const body = {
    description: GIST_DESC,
    public: false,
    files: {
      [GIST_FILENAME]: {
        content,
      },
    },
  }

  try {
    const url = gistId
      ? `https://api.github.com/gists/${gistId}`
      : 'https://api.github.com/gists'

    const method = gistId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: getHeaders(token),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      // 如果 Gist 不存在（被删除），重新创建
      if (gistId && res.status === 404) {
        saveGistId('')
        return pushToGist(token, data)
      }
      return { success: false, error: errData.message || `HTTP ${res.status}` }
    }

    const result = await res.json()
    const newGistId = result.id
    if (newGistId !== gistId) {
      saveGistId(newGistId)
    }

    return { success: true, gistId: newGistId }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 从 Gist 拉取数据（解密后返回）
 * @param {string} token - GitHub Personal Access Token（同时作为解密密钥来源）
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function pullFromGist(token) {
  if (!token) return { success: false, error: '未配置 Token' }

  const gistId = getGistId()
  if (!gistId) {
    // 没有 Gist ID，尝试列出用户的 Gist 找到匹配的
    return findAndPullGist(token)
  }

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: getHeaders(token),
    })

    if (!res.ok) {
      if (res.status === 404) {
        saveGistId('')
        return findAndPullGist(token)
      }
      const errData = await res.json().catch(() => ({}))
      return { success: false, error: errData.message || `HTTP ${res.status}` }
    }

    const gist = await res.json()
    return parseGistData(gist, token)
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 列出用户 Gist，找到 SDD 同步的 Gist 并拉取
 */
async function findAndPullGist(token) {
  try {
    const res = await fetch('https://api.github.com/gists?per_page=100', {
      headers: getHeaders(token),
    })

    if (!res.ok) {
      return { success: false, error: `获取 Gist 列表失败: HTTP ${res.status}` }
    }

    const gists = await res.json()
    // 找到描述匹配的 Gist
    const match = gists.find(g => g.description === GIST_DESC && g.files?.[GIST_FILENAME])

    if (!match) {
      return { success: false, error: '未找到同步数据，请先推送' }
    }

    saveGistId(match.id)
    return parseGistData(match, token)
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 解析 Gist 数据（自动识别加密/明文，兼容旧版）
 */
async function parseGistData(gist, token) {
  const file = gist.files?.[GIST_FILENAME]
  if (!file || !file.content) {
    return { success: false, error: 'Gist 中无有效数据' }
  }

  try {
    const parsed = JSON.parse(file.content)

    // 加密数据：用 Token 解密
    if (parsed.encrypted && parsed.data) {
      if (!token) {
        return { success: false, error: '数据已加密，需要 Token 才能解密' }
      }
      const plaintext = await decryptData(parsed, token.trim())
      const data = JSON.parse(plaintext)
      return { success: true, data }
    }

    // 明文数据（旧版兼容）
    return { success: true, data: parsed }
  } catch (err) {
    return { success: false, error: '数据解析失败: ' + err.message }
  }
}

/**
 * 获取同步状态信息
 */
export function getSyncInfo() {
  const gistId = getGistId()
  const lastSync = localStorage.getItem('sdd_gist_last_sync')
  return {
    gistId,
    lastSync,
    configured: !!gistId,
  }
}
