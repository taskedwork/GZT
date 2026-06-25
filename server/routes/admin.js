const express = require('express');
const router = express.Router();
const path = require('path');
const { readJSON, writeJSON } = require('../utils/store');
const { generateId, hashPassword } = require('../utils/helpers');
const authMiddleware = require('../middleware/auth');

// 数据文件路径
const { USERS_FILE, PROJECTS_FILE } = require('../paths');

// 所有 admin 路由都需要认证
router.use(authMiddleware);

// 仅管理员可访问
function requireManager(req, res, next) {
  if (req.user.systemRole !== 'manager') {
    return res.status(403).json({ error: '仅管理员可访问' });
  }
  next();
}

router.use(requireManager);

/**
 * GET /api/admin/users - 获取所有用户
 */
router.get('/users', (req, res) => {
  try {
    const users = readJSON(USERS_FILE) || [];
    const list = users.map(u => {
      const { password, ...rest } = u;
      return rest;
    });
    res.json({ users: list });
  } catch (err) {
    console.error('获取用户列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/admin/users - 创建用户
 * 请求体: { username, password, name, systemRole }
 */
router.post('/users', async (req, res) => {
  try {
    const { username, password, name, systemRole = 'partner' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const users = readJSON(USERS_FILE) || [];

    if (users.find(u => u.username === username)) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    const hashedPassword = await hashPassword(password);
    const newUser = {
      id: generateId(),
      username,
      password: hashedPassword,
      name: name || username,
      systemRole: ['manager', 'partner', 'outsider', 'member'].includes(systemRole) ? systemRole : 'partner',
      avatar: systemRole === 'manager' ? '👑' : systemRole === 'outsider' ? '👁' : '🤝',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeJSON(USERS_FILE, users);

    const { password: _, ...withoutPassword } = newUser;
    res.status(201).json({ user: withoutPassword });
  } catch (err) {
    console.error('创建用户失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * PUT /api/admin/users/:id - 更新用户信息
 */
router.put('/users/:id', (req, res) => {
  try {
    const { name, systemRole } = req.body;
    const users = readJSON(USERS_FILE) || [];
    const index = users.findIndex(u => u.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (name) users[index].name = name;
    if (systemRole && ['manager', 'partner', 'outsider', 'member'].includes(systemRole)) {
      users[index].systemRole = systemRole;
    }

    writeJSON(USERS_FILE, users);

    const { password: _, ...withoutPassword } = users[index];
    res.json({ user: withoutPassword });
  } catch (err) {
    console.error('更新用户失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * DELETE /api/admin/users/:id - 删除用户
 */
router.delete('/users/:id', (req, res) => {
  try {
    const users = readJSON(USERS_FILE) || [];
    const index = users.findIndex(u => u.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 不能删除自己
    if (users[index].id === req.user.id) {
      return res.status(403).json({ error: '不能删除当前登录用户' });
    }

    users.splice(index, 1);
    writeJSON(USERS_FILE, users);

    res.json({ message: '用户已删除' });
  } catch (err) {
    console.error('删除用户失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * GET /api/admin/projects - 获取所有项目
 */
router.get('/projects', (req, res) => {
  try {
    const projects = readJSON(PROJECTS_FILE) || {};
    const list = Object.values(projects).map(p => ({
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      nodeCount: (p.mmNodes || []).length
    }));
    res.json({ projects: list });
  } catch (err) {
    console.error('获取项目列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/admin/projects - 创建项目
 */
router.post('/projects', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: '项目名称不能为空' });
    }

    const projects = readJSON(PROJECTS_FILE) || {};
    const id = generateId();
    const newProject = {
      id,
      name,
      mmNodes: [],
      mmEdges: [],
      nodeStyles: {},
      nodeLabels: {},
      history: [],
      historyIndex: -1,
      updatedAt: new Date().toISOString()
    };

    projects[id] = newProject;
    writeJSON(PROJECTS_FILE, projects);

    res.status(201).json({ project: { id, name, updatedAt: newProject.updatedAt, nodeCount: 0 } });
  } catch (err) {
    console.error('创建项目失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * DELETE /api/admin/projects/:id - 删除项目
 */
router.delete('/projects/:id', (req, res) => {
  try {
    const projects = readJSON(PROJECTS_FILE) || {};

    if (!projects[req.params.id]) {
      return res.status(404).json({ error: '项目不存在' });
    }

    if (req.params.id === 'default') {
      return res.status(403).json({ error: '不能删除默认项目' });
    }

    delete projects[req.params.id];
    writeJSON(PROJECTS_FILE, projects);

    res.json({ message: '项目已删除' });
  } catch (err) {
    console.error('删除项目失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
