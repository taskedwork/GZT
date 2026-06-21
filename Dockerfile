# ---- 构建阶段 ----
FROM node:20-alpine AS builder

WORKDIR /app

# 安装前端依赖
COPY package.json package-lock.json ./
RUN npm ci

# 复制前端源码并构建
COPY index.html vite.config.js ./
COPY src/ src/
RUN npm run build

# 安装后端依赖
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --production

# ---- 运行阶段 ----
FROM node:20-alpine

WORKDIR /app

# 复制后端代码
COPY server/ ./server/

# 从构建阶段复制后端依赖
COPY --from=builder /app/server/node_modules ./server/node_modules

# 从构建阶段复制前端构建产物
COPY --from=builder /app/dist ./dist

# 数据持久化卷
VOLUME /app/server/data

# 环境变量
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]
