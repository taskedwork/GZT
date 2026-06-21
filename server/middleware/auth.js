const { verifyToken } = require('../utils/helpers');

/**
 * JWT 认证中间件
 * 从 Authorization 头提取 Bearer 令牌并验证
 * 验证成功后将用户信息挂载到 req.user
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: '令牌无效或已过期' });
  }

  // 将用户信息挂载到请求对象上
  req.user = decoded;
  next();
}

module.exports = authMiddleware;
