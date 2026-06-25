const express = require('express');
const router = express.Router();
const path = require('path');
const { readJSON, writeJSON } = require('../utils/store');
const { generateId, hashPassword, comparePassword, generateToken } = require('../utils/helpers');

// 数据文件路径
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

// 角色映射
const ROLE_MAP = {
  manager: { roleLabel: '管理员', group: '伙伴' },
  partner: { roleLabel: '伙伴', group: '伙伴' },
  outsider: { roleLabel: '外包单位', group: '外包单位' },
  member: { roleLabel: '成员', group: '伙伴' },
};

/**
 * GET /api/auth/users - 获取可登录用户列表（公开接口，不含密码）
 * 响应: { users: [{ id, username, name, systemRole, avatar, roleLabel, group }] }
 */
router.get('/users', (req, res) => {
  try {
    const users = readJSON(USERS_FILE) || [];
    const list = users.map(u => {
      const roleInfo = ROLE_MAP[u.systemRole] || { roleLabel: u.systemRole, group: '其他' };
      return {
        id: u.id,
        username: u.username,
        name: u.name,
        systemRole: u.systemRole,
        avatar: u.avatar || '🧑',
        role: u.systemRole,
        roleLabel: roleInfo.roleLabel,
        group: roleInfo.group,
      };
    });
    res.json({ users: list });
  } catch (err) {
    console.error('获取用户列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/auth/login - 用户登录
 * 请求体: { username, password }
 * 响应: { token, user }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const users = readJSON(USERS_FILE) || [];
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 比较密码
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成令牌
    const token = generateToken(user);

    // 返回用户信息（不含密码）
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/auth/register - 用户注册
 * 请求体: { username, password, name }
 * 响应: { token, user }
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const users = readJSON(USERS_FILE) || [];

    // 检查用户名是否已存在
    if (users.find(u => u.username === username)) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    // 哈希密码
    const hashedPassword = await hashPassword(password);

    // 创建新用户
    const newUser = {
      id: generateId(),
      username,
      password: hashedPassword,
      name: name || username,
      systemRole: 'member',
      avatar: '🧑',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeJSON(USERS_FILE, users);

    // 生成令牌
    const token = generateToken(newUser);

    // 返回用户信息（不含密码）
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * GET /api/auth/me - 获取当前用户信息
 * 需要认证
 * 响应: { user }
 */
router.get('/me', async (req, res) => {
  try {
    // 从 Authorization 头获取令牌
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const { verifyToken } = require('../utils/helpers');
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: '令牌无效或已过期' });
    }

    const users = readJSON(USERS_FILE) || [];
    const user = users.find(u => u.id === decoded.id);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/auth/change-password - 修改密码
 * 需要认证
 * 请求体: { oldPassword, newPassword }
 */
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const { verifyToken } = require('../utils/helpers');
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: '令牌无效或已过期' });
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '旧密码和新密码不能为空' });
    }

    const users = readJSON(USERS_FILE) || [];
    const userIndex = users.findIndex(u => u.id === decoded.id);

    if (userIndex === -1) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证旧密码
    const isMatch = await comparePassword(oldPassword, users[userIndex].password);
    if (!isMatch) {
      return res.status(401).json({ error: '旧密码错误' });
    }

    // 哈希新密码并更新
    users[userIndex].password = await hashPassword(newPassword);
    writeJSON(USERS_FILE, users);

    res.json({ message: '密码修改成功' });
  } catch (err) {
    console.error('修改密码失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
