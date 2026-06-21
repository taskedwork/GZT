/**
 * WebSocket 实时同步层
 *
 * 生产模式：同源 ws(s) 连接
 * 开发模式：ws://localhost:3001
 */

const WS_URL = import.meta.env.PROD
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
  : 'ws://localhost:3001'

class SyncClient {
  constructor() {
    this.ws = null
    this.token = ''
    this.projectId = 'default'
    this.connected = false
    this.reconnectTimer = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.heartbeatTimer = null

    // 回调函数
    this.onSync = null        // (data) => {}  收到远端同步数据
    this.onLock = null        // (data) => {}  节点被锁定
    this.onUnlock = null      // (data) => {}  节点解锁
    this.onCursor = null      // (data) => {}  其他用户光标位置
    this.onUserJoin = null    // (data) => {}  用户加入
    this.onUserLeave = null   // (data) => {}  用户离开
    this.onOnlineUsers = null // (users) => {} 在线用户列表
    this.onConnected = null   // () => {}      连接成功
    this.onDisconnected = null// () => {}      断开连接
    this.onReconnected = null // () => {}      重连成功（需要拉取最新数据）
  }

  // 连接 WebSocket
  connect(token, projectId = 'default') {
    this.token = token
    this.projectId = projectId

    if (this.ws) {
      this.ws.close()
    }

    try {
      this.ws = new WebSocket(`${WS_URL}?token=${token}&projectId=${projectId}`)

      this.ws.onopen = () => {
        this.connected = true
        const wasReconnect = this.reconnectAttempts > 0
        this.reconnectAttempts = 0
        this.startHeartbeat()
        if (this.onConnected) this.onConnected()
        // 重连成功后通知拉取最新数据
        if (wasReconnect && this.onReconnected) this.onReconnected()
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          this.handleMessage(msg)
        } catch (e) {
          console.error('WebSocket 消息解析失败:', e)
        }
      }

      this.ws.onclose = () => {
        this.connected = false
        this.stopHeartbeat()
        if (this.onDisconnected) this.onDisconnected()
        this.scheduleReconnect()
      }

      this.ws.onerror = (err) => {
        console.error('WebSocket 错误:', err)
      }
    } catch (e) {
      console.error('WebSocket 连接失败:', e)
      this.scheduleReconnect()
    }
  }

  // 断开连接
  disconnect() {
    this.reconnectAttempts = this.maxReconnectAttempts // 阻止重连
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  // 处理收到的消息
  handleMessage(msg) {
    switch (msg.type) {
      case 'sync':
        if (this.onSync) this.onSync(msg.data)
        break
      case 'lock':
        if (this.onLock) this.onLock(msg)
        break
      case 'unlock':
        if (this.onUnlock) this.onUnlock(msg)
        break
      case 'cursor':
        if (this.onCursor) this.onCursor(msg)
        break
      case 'user_join':
        if (this.onUserJoin) this.onUserJoin(msg)
        break
      case 'user_leave':
        if (this.onUserLeave) this.onUserLeave(msg)
        break
      case 'online_users':
        if (this.onOnlineUsers) this.onOnlineUsers(msg.users)
        break
      case 'pong':
        // 心跳响应
        break
      default:
        break
    }
  }

  // 广播同步数据
  broadcastSync(data) {
    this.send({ type: 'sync', data })
  }

  // 请求锁定节点
  lockNode(nodeId) {
    this.send({ type: 'lock', nodeId })
  }

  // 解锁节点
  unlockNode(nodeId) {
    this.send({ type: 'unlock', nodeId })
  }

  // 发送光标位置
  sendCursor(position) {
    this.send({ type: 'cursor', position })
  }

  // 发送消息
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  // 心跳
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' })
    }, 30000)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // 自动重连
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    this.reconnectTimer = setTimeout(() => {
      console.log(`WebSocket 重连中... (第 ${this.reconnectAttempts} 次)`)
      this.connect(this.token, this.projectId)
    }, delay)
  }

  // 获取在线用户数量
  isConnected() {
    return this.connected
  }
}

// 单例
const syncClient = new SyncClient()
export default syncClient
