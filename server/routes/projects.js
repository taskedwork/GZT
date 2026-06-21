const express = require('express');
const router = express.Router();
const path = require('path');
const { readJSON, writeJSON } = require('../utils/store');
const { generateId } = require('../utils/helpers');
const authMiddleware = require('../middleware/auth');

// 数据文件路径
const PROJECTS_FILE = path.join(__dirname, '..', 'data', 'projects.json');

// 所有项目路由都需要认证
router.use(authMiddleware);

/**
 * GET /api/projects - 获取用户的项目列表
 * 响应: { projects: [...] }
 */
router.get('/', (req, res) => {
  try {
    const projects = readJSON(PROJECTS_FILE) || {};
    // 返回所有项目的基本信息（不含详细节点/边数据，减少传输量）
    const projectList = Object.values(projects).map(p => ({
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      nodeCount: (p.mmNodes || []).length
    }));
    res.json({ projects: projectList });
  } catch (err) {
    console.error('获取项目列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * GET /api/projects/:id - 获取项目完整数据
 * 响应: { project }
 */
router.get('/:id', (req, res) => {
  try {
    const projects = readJSON(PROJECTS_FILE) || {};
    const project = projects[req.params.id];

    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    res.json({ project });
  } catch (err) {
    console.error('获取项目数据失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * PUT /api/projects/:id - 完整替换项目数据
 * 请求体: 完整的项目对象
 */
router.put('/:id', (req, res) => {
  try {
    const projects = readJSON(PROJECTS_FILE) || {};

    if (!projects[req.params.id]) {
      return res.status(404).json({ error: '项目不存在' });
    }

    // 完整替换，保留 id 和更新时间
    projects[req.params.id] = {
      ...req.body,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    };

    writeJSON(PROJECTS_FILE, projects);
    res.json({ project: projects[req.params.id] });
  } catch (err) {
    console.error('保存项目数据失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * PATCH /api/projects/:id - 部分更新项目数据
 * 请求体: 要更新的字段（nodes, edges, styles, labels 等）
 */
router.patch('/:id', (req, res) => {
  try {
    const projects = readJSON(PROJECTS_FILE) || {};

    if (!projects[req.params.id]) {
      return res.status(404).json({ error: '项目不存在' });
    }

    // 合并更新
    const project = projects[req.params.id];
    const allowedFields = ['mmNodes', 'mmEdges', 'nodeStyles', 'nodeLabels', 'history', 'historyIndex', 'name'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field];
      }
    }

    project.updatedAt = new Date().toISOString();
    writeJSON(PROJECTS_FILE, projects);
    res.json({ project });
  } catch (err) {
    console.error('更新项目数据失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/projects - 创建新项目
 * 请求体: { name, ...其他可选字段 }
 */
router.post('/', (req, res) => {
  try {
    const projects = readJSON(PROJECTS_FILE) || {};
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: '项目名称不能为空' });
    }

    const id = generateId();
    const newProject = {
      id,
      name,
      mmNodes: req.body.mmNodes || [],
      mmEdges: req.body.mmEdges || [],
      nodeStyles: req.body.nodeStyles || {},
      nodeLabels: req.body.nodeLabels || {},
      history: [],
      historyIndex: -1,
      updatedAt: new Date().toISOString()
    };

    projects[id] = newProject;
    writeJSON(PROJECTS_FILE, projects);

    res.status(201).json({ project: newProject });
  } catch (err) {
    console.error('创建项目失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * DELETE /api/projects/:id - 删除项目
 */
router.delete('/:id', (req, res) => {
  try {
    const projects = readJSON(PROJECTS_FILE) || {};

    if (!projects[req.params.id]) {
      return res.status(404).json({ error: '项目不存在' });
    }

    // 不允许删除默认项目
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
