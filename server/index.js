const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { readJSON, writeJSON, initFile } = require('./utils/store');
const { hashPassword } = require('./utils/helpers');
const { initWebSocket } = require('./websocket');
const { initLanDiscovery, getLanDevices, getLanDeviceCount } = require('./lanDiscovery');

// 路由模块
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const adminRoutes = require('./routes/admin');

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

// 默认数据
const DEFAULT_USERS = [
  { id: 'u1', username: 'admin', password: '$2a$10$placeholder_admin_hash', name: '深东', systemRole: 'manager', avatar: '👑', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u2', username: 'member1', password: '$2a$10$placeholder_member1_hash', name: '东哥哥', systemRole: 'partner', avatar: '🤝', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u3', username: 'member2', password: '$2a$10$placeholder_member2_hash', name: '老蔡', systemRole: 'partner', avatar: '🤝', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u4', username: 'member3', password: '$2a$10$placeholder_member3_hash', name: '小北哥', systemRole: 'partner', avatar: '🤝', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u5', username: 'member4', password: '$2a$10$placeholder_member4_hash', name: '孙博文', systemRole: 'partner', avatar: '🤝', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u6', username: 'member5', password: '$2a$10$placeholder_member5_hash', name: '财务王姐', systemRole: 'partner', avatar: '🤝', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u7', username: 'outsource1', password: '$2a$10$placeholder_outsource1_hash', name: '灯光', systemRole: 'outsider', avatar: '👁', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u8', username: 'outsource2', password: '$2a$10$placeholder_outsource2_hash', name: '施工图', systemRole: 'outsider', avatar: '👁', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'u9', username: 'outsource3', password: '$2a$10$placeholder_outsource3_hash', name: '其他', systemRole: 'outsider', avatar: '👁', createdAt: '2024-01-01T00:00:00Z' },
];

const DEFAULT_PROJECTS = {
  default: {
    id: 'default',
    name: 'SDD Workspace',
    mmNodes: [],
    mmEdges: [],
    nodeStyles: {},
    nodeLabels: {},
    history: [],
    historyIndex: -1,
    updatedAt: '2024-01-01T00:00:00Z'
  }
};

/**
 * 初始化数据文件
 */
function initDataFiles() {
  initFile(USERS_FILE, DEFAULT_USERS);
  initFile(PROJECTS_FILE, DEFAULT_PROJECTS);
}

/**
 * 检查并替换占位符密码为真实哈希值
 * 默认密码均为 "123456"
 */
async function hashPlaceholderPasswords() {
  const users = readJSON(USERS_FILE);
  if (!users) return;

  let changed = false;

  for (const user of users) {
    // 检查是否是占位符密码
    if (user.password && user.password.includes('placeholder')) {
      console.log(`正在为用户 ${user.username} 生成密码哈希...`);
      user.password = await hashPassword('123456');
      changed = true;
    }
  }

  if (changed) {
    writeJSON(USERS_FILE, users);
    console.log('占位符密码已替换为真实哈希值');
  }
}

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: function(origin, callback) {
    // 允许无 origin 的请求（如服务端请求、Postman）
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // 部署后允许同源请求
    callback(null, true);
  },
  credentials: true
}));

// Private Network Access：允许 HTTPS 页面（GitHub Pages）请求 HTTP localhost 后端
// Chrome 94+ 要求 preflight 响应包含此头，否则阻止请求
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// 请求日志（生产环境可关闭）
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/admin', adminRoutes);

// 服务后台管理静态页面
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 局域网设备检测接口
app.get('/api/sync/lan-devices', (req, res) => {
  res.json({
    devices: getLanDevices(),
    count: getLanDeviceCount(),
    timestamp: new Date().toISOString(),
  });
});

// 生产模式：服务前端构建产物
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  // SPA 路由回退
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// 后台管理 SPA 路由回退
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 创建 HTTP 服务器
const server = http.createServer(app);

// 初始化 WebSocket 服务器（共享同一 HTTP 服务器）
initWebSocket(server);

// 启动服务器
async function start() {
  try {
    // 初始化数据文件
    initDataFiles();

    // 替换占位符密码
    await hashPlaceholderPasswords();

    // 启动监听
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 SDD 服务器已启动`);
      console.log(`   HTTP:  http://localhost:${PORT}`);
      console.log(`   WS:    ws://localhost:${PORT}/ws`);
      console.log(`   API:   http://localhost:${PORT}/api`);
      console.log(`   后台管理: http://localhost:${PORT}/admin`);
      console.log(`   健康检查: http://localhost:${PORT}/api/health\n`);
    });
  } catch (err) {
    console.error('服务器启动失败:', err);
    process.exit(1);
  }
}

start();
