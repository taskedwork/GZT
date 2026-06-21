const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// JWT 密钥，优先从环境变量读取
const JWT_SECRET = process.env.JWT_SECRET || 'sdd-secret-key-2024';

/**
 * 生成唯一 ID
 */
function generateId() {
  return uuidv4();
}

/**
 * 对密码进行哈希
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 哈希后的密码
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * 比较明文密码与哈希密码
 * @param {string} password - 明文密码
 * @param {string} hash - 哈希密码
 * @returns {Promise<boolean>} 是否匹配
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * 生成 JWT 令牌
 * @param {object} user - 用户对象，包含 id, username, systemRole
 * @returns {string} JWT 令牌
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, systemRole: user.systemRole },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * 验证 JWT 令牌
 * @param {string} token - JWT 令牌
 * @returns {object|null} 解码后的载荷，失败返回 null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  generateId,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  JWT_SECRET
};
