/**
 * 统一路径配置
 *
 * pkg 打包后：
 * - __dirname 指向虚拟文件系统（只读），用于读取打包的静态资源
 * - process.cwd() 指向可执行文件所在目录（可写），用于存储数据
 *
 * 开发模式：
 * - __dirname 指向 server/ 目录
 * - 数据存储在 server/data/
 */

const path = require('path');
const fs = require('fs');

// 判断是否在 pkg 打包环境中运行
const isPackaged = !!process.pkg;

// 数据目录：可执行文件旁边的 data 文件夹（可写）
const DATA_DIR = isPackaged
  ? path.join(path.dirname(process.execPath), 'data')
  : path.join(__dirname, 'data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 静态资源目录（admin 页面等，打包进 exe 只读）
const PUBLIC_DIR = path.join(__dirname, 'public');

// 前端构建产物目录（仅开发模式使用，生产模式前端在 GitHub Pages）
const DIST_DIR = isPackaged
  ? null  // 打包后不服务前端，前端在 GitHub Pages
  : path.join(__dirname, '..', 'dist');

module.exports = {
  isPackaged,
  DATA_DIR,
  PUBLIC_DIR,
  DIST_DIR,
  USERS_FILE: path.join(DATA_DIR, 'users.json'),
  PROJECTS_FILE: path.join(DATA_DIR, 'projects.json'),
};
