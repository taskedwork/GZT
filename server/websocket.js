const { WebSocketServer } = require('ws');
const { verifyToken } = require('./utils/helpers');
const path = require('path');
const { readJSON, writeJSON } = require('./utils/store');

const PROJECTS_FILE = path.join(__dirname, 'data', 'projects.json');

// 存储所有活跃的 WebSocket 连接
// Map<connId, { ws, userName, userId, projectId, isAlive }>
const connections = new Map();

// 节点锁状态：Map<projectId, Map<nodeId, { userId, userName }>>
const nodeLocks = new Map();

// 连接计数器
let connCounter = 0;

// 防抖保存定时器
let saveTimer = null;

/**
 * 初始化 WebSocket 服务器
 */
function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  console.log('WebSocket 服务器已启动，路径: /ws');

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, '未提供认证令牌');
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      ws.close(4002, '令牌无效或已过期');
      return;
    }

    const userId = decoded.id;
    const userName = decoded.username;
    const connId = `${userId}_${++connCounter}`;

    // 存储连接信息（支持同一用户多设备）
    const connInfo = { ws, userName, userId, connId, projectId: 'default', isAlive: true };
    connections.set(connId, connInfo);

    console.log(`用户 ${userName} 已连接 WebSocket (connId: ${connId}, 当前连接数: ${connections.size})`);

    // 发送连接成功消息
    ws.send(JSON.stringify({
      type: 'connected',
      userId,
      userName,
      connId,
      timestamp: Date.now()
    }));

    // 发送当前在线用户列表
    const onlineUsers = getOnlineUsers();
    ws.send(JSON.stringify({
      type: 'online_users',
      users: onlineUsers,
      timestamp: Date.now()
    }));

    // 广播用户上线
    broadcast(null, {
      type: 'user-online',
      userId,
      userName,
      connId,
      timestamp: Date.now()
    }, connId);

    // 心跳检测
    ws.on('pong', () => {
      const conn = connections.get(connId);
      if (conn) conn.isAlive = true;
    });

    // 接收消息
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(connId, msg);
      } catch (err) {
        console.error('WebSocket 消息解析失败:', err);
      }
    });

    // 连接关闭
    ws.on('close', () => {
      const conn = connections.get(connId);
      if (conn) {
        console.log(`用户 ${conn.userName} 已断开 WebSocket (connId: ${connId})`);

        // 释放该用户持有的所有节点锁
        releaseAllLocks(userId, conn.projectId);

        // 广播用户下线
        broadcast(conn.projectId, {
          type: 'user-offline',
          userId,
          userName: conn.userName,
          connId,
          timestamp: Date.now()
        }, connId);

        connections.delete(connId);

        // 检查该用户是否还有其他连接
        const hasOtherConn = [...connections.values()].some(c => c.userId === userId);
        if (!hasOtherConn) {
          // 该用户所有设备都断开了，广播完全下线
          broadcast(null, {
            type: 'user-offline',
            userId,
            userName: conn.userName,
            timestamp: Date.now()
          }, null);
        }
      }
    });
  });

  // 定期心跳检测
  const heartbeatInterval = setInterval(() => {
    connections.forEach((conn, connId) => {
      if (!conn.isAlive) {
        console.log(`用户 ${conn.userName} 心跳超时，断开连接 (connId: ${connId})`);
        conn.ws.terminate();
        connections.delete(connId);
        return;
      }
      conn.isAlive = false;
      conn.ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}

/**
 * 获取在线用户列表（去重）
 */
function getOnlineUsers() {
  const userMap = new Map();
  connections.forEach(conn => {
    if (!userMap.has(conn.userId)) {
      userMap.set(conn.userId, { id: conn.userId, name: conn.userName, deviceCount: 0 });
    }
    userMap.get(conn.userId).deviceCount++;
  });
  return [...userMap.values()];
}

/**
 * 处理客户端消息
 */
function handleMessage(connId, msg) {
  const conn = connections.get(connId);
  if (!conn) return;

  const { type, projectId, data } = msg;
  const { userId, userName } = conn;

  if (projectId) {
    conn.projectId = projectId;
  }

  switch (type) {
    case 'sync':
      // 持久化到服务器 + 广播给其他用户
      handleSync(connId, userId, userName, projectId || conn.projectId, data);
      break;

    case 'lock':
      handleLock(connId, userId, userName, projectId || conn.projectId, data);
      break;

    case 'unlock':
      handleUnlock(connId, userId, projectId || conn.projectId, data);
      break;

    case 'cursor':
      broadcast(projectId || conn.projectId, {
        type: 'cursor',
        userId,
        userName,
        data,
        timestamp: Date.now()
      }, connId);
      break;

    default:
      break;
  }
}

/**
 * 处理同步数据 - 持久化 + 广播
 */
function handleSync(connId, userId, userName, projectId, data) {
  if (!projectId || !data) return;

  // 广播给同项目的其他用户
  broadcast(projectId, {
    type: 'sync',
    userId,
    userName,
    data,
    timestamp: Date.now()
  }, connId);

  // 防抖持久化到 projects.json
  scheduleSave(projectId, data);
}

/**
 * 防抖保存 - 避免频繁写入文件
 */
function scheduleSave(projectId, data) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const projects = readJSON(PROJECTS_FILE) || {};
      const project = projects[projectId];
      if (!project) return;

      // 增量合并节点
      if (data.mmNodes) {
        // 用 Map 做增量合并：新数据覆盖旧数据，保留旧数据中未被覆盖的节点
        const nodeMap = new Map((project.mmNodes || []).map(n => [n.id, n]));
        (data.mmNodes || []).forEach(n => nodeMap.set(n.id, n));
        project.mmNodes = [...nodeMap.values()];
      }

      if (data.mmEdges) {
        project.mmEdges = data.mmEdges;
      }

      if (data.nodeStyles) {
        project.nodeStyles = { ...project.nodeStyles, ...data.nodeStyles };
      }

      if (data.nodeLabels) {
        project.nodeLabels = { ...project.nodeLabels, ...data.nodeLabels };
      }

      project.updatedAt = new Date().toISOString();
      writeJSON(PROJECTS_FILE, projects);
    } catch (err) {
      console.error('持久化同步数据失败:', err);
    }
  }, 500);
}

/**
 * 处理节点锁定
 */
function handleLock(connId, userId, userName, projectId, data) {
  if (!projectId || !data || !data.nodeId) return;

  if (!nodeLocks.has(projectId)) {
    nodeLocks.set(projectId, new Map());
  }

  const locks = nodeLocks.get(projectId);
  const nodeId = data.nodeId;

  // 检查节点是否已被其他用户锁定
  if (locks.has(nodeId) && locks.get(nodeId).userId !== userId) {
    const conn = connections.get(connId);
    if (conn) {
      conn.ws.send(JSON.stringify({
        type: 'lock-denied',
        userId,
        userName,
        data: { nodeId, lockedBy: locks.get(nodeId) },
        timestamp: Date.now()
      }));
    }
    return;
  }

  locks.set(nodeId, { userId, userName });

  broadcast(projectId, {
    type: 'lock',
    userId,
    userName,
    data: { nodeId },
    timestamp: Date.now()
  }, null);
}

/**
 * 处理节点解锁
 */
function handleUnlock(connId, userId, projectId, data) {
  if (!projectId || !data || !data.nodeId) return;

  const locks = nodeLocks.get(projectId);
  if (!locks) return;

  const nodeId = data.nodeId;
  const lockInfo = locks.get(nodeId);

  if (lockInfo && lockInfo.userId === userId) {
    locks.delete(nodeId);

    const conn = connections.get(connId);
    broadcast(projectId, {
      type: 'unlock',
      userId,
      userName: conn ? conn.userName : '',
      data: { nodeId },
      timestamp: Date.now()
    }, null);
  }
}

/**
 * 释放用户持有的所有节点锁
 */
function releaseAllLocks(userId, projectId) {
  if (!projectId) return;

  const locks = nodeLocks.get(projectId);
  if (!locks) return;

  const releasedNodes = [];
  locks.forEach((lockInfo, nodeId) => {
    if (lockInfo.userId === userId) {
      releasedNodes.push(nodeId);
      locks.delete(nodeId);
    }
  });

  if (releasedNodes.length > 0) {
    broadcast(projectId, {
      type: 'unlock',
      userId,
      data: { nodeIds: releasedNodes },
      timestamp: Date.now()
    }, null);
  }
}

/**
 * 广播消息给同一项目的所有连接（可排除指定连接）
 */
function broadcast(projectId, message, excludeConnId) {
  const msgStr = JSON.stringify(message);

  connections.forEach((conn, connId) => {
    if (connId === excludeConnId) return;

    if (projectId && conn.projectId !== projectId) return;

    if (conn.ws.readyState === 1) {
      conn.ws.send(msgStr);
    }
  });
}

/**
 * 获取在线用户数量
 */
function getOnlineUserCount() {
  return getOnlineUsers().length;
}

module.exports = { initWebSocket, getOnlineUsers, getOnlineUserCount };
