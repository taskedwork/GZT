const fs = require('fs');
const path = require('path');

/**
 * 读取 JSON 文件并解析
 * @param {string} filePath - 文件绝对路径
 * @returns {any} 解析后的数据
 */
function readJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    // 文件不存在或解析失败，返回 null
    return null;
  }
}

/**
 * 将数据写入 JSON 文件（格式化输出）
 * @param {string} filePath - 文件绝对路径
 * @param {any} data - 要写入的数据
 */
function writeJSON(filePath, data) {
  // 确保目录存在
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 初始化数据文件：如果文件不存在则创建
 * @param {string} filePath - 文件绝对路径
 * @param {any} defaultData - 默认数据
 */
function initFile(filePath, defaultData) {
  if (!fs.existsSync(filePath)) {
    writeJSON(filePath, defaultData);
  }
}

module.exports = {
  readJSON,
  writeJSON,
  initFile
};
