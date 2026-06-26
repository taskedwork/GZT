/**
 * 登录页面 - 自动适配后端/纯前端模式
 *
 * - appMode === 'detecting': 显示加载中
 * - appMode === 'frontend':  纯前端模式，用户列表来自 IndexedDB
 * - appMode === 'backend':   后端模式，用户列表来自后端 API
 */

import React, { useState, useEffect } from 'react'
import { useApp } from '../data/store'

const roleLabel = { manager: '管理员', partner: '伙伴', outsider: '外包单位', member: '成员', tester: '测试' }

export default function LoginPage() {
  const { login, state, appMode, loadUsers } = useApp()
  const [selectedUser, setSelectedUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showServerConfig, setShowServerConfig] = useState(false)
  const [serverInput, setServerInput] = useState(localStorage.getItem('sdd_server_host') || 'localhost')

  // 用户列表来自 store（由模式检测 effect 统一加载）
  const users = state.users || []
  const loadFailed = appMode === 'backend' && users.length === 0

  // 后端模式且用户列表为空时，尝试重新加载
  useEffect(() => {
    if (appMode === 'backend' && users.length === 0) {
      loadUsers()
    }
  }, [appMode])

  // 保存服务器地址并重新加载
  const handleSaveServer = () => {
    const host = serverInput.trim() || 'localhost'
    localStorage.setItem('sdd_server_host', host)
    setShowServerConfig(false)
    // 重置后端检测缓存并重新加载页面以应用新的服务器地址
    window.location.reload()
  }

  async function handleLogin() {
    if (!selectedUser) { setError('请选择身份'); return }
    const user = users.find(u => u.id === selectedUser || u.username === selectedUser)
    if (!user) { setError('用户不存在'); return }
    setLoading(true)
    setError('')
    try {
      const result = await login(user.username, password || '123456')
      if (!result.success) {
        setError(result.error || '登录失败')
      }
    } catch (err) {
      setError('登录异常：' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleLogin()
  }

  // 模式检测中：显示加载状态
  if (appMode === 'detecting') {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>工作台</h1>
          <p className="sub">正在检测运行环境...</p>
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: '.75rem' }}>
            <div style={{ display: 'inline-block', width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ marginTop: 10 }}>正在连接服务器或初始化本地模式</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>工作台</h1>
        <p className="sub">项目流程管理 · 专注 · 协作 · 高效</p>

        <div className="fld">
          <label>选择身份</label>
          <select value={selectedUser} onChange={e => { setSelectedUser(e.target.value); setError('') }}>
            <option value="">-- 请选择 --</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({roleLabel[u.systemRole] || u.systemRole})</option>
            ))}
          </select>
          {loadFailed && (
            <div style={{ fontSize: '.65rem', color: 'var(--danger)', marginTop: 4 }}>
              无法连接服务器，请检查后端是否启动
              <span
                style={{ color: 'var(--accent)', cursor: 'pointer', marginLeft: 6, textDecoration: 'underline' }}
                onClick={() => setShowServerConfig(!showServerConfig)}
              >
                配置服务器地址
              </span>
            </div>
          )}
          {appMode === 'frontend' && users.length > 0 && (
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginTop: 4 }}>
              本地模式 · 数据存储于本设备，可通过 Gist 同步
            </div>
          )}
          {showServerConfig && (
            <div style={{ marginTop: 8, padding: 10, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <label style={{ fontSize: '.6rem', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                后端服务器地址（IP 或 localhost）
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={serverInput}
                  onChange={e => setServerInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveServer()}
                  placeholder="如 192.168.1.100 或 localhost"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '.75rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', outline: 'none' }}
                />
                <button className="btn btn-primary btn-xs" onClick={handleSaveServer} style={{ padding: '6px 12px' }}>
                  保存
                </button>
              </div>
              <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                本机运行后端填 localhost；连接其他设备后端填其 IP（如 192.168.1.100）
              </div>
            </div>
          )}
        </div>

        <div className="fld">
          <label>密码（默认 123456）</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入密码..."
          />
        </div>

        <div className="err">{error}</div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '.85rem', opacity: loading ? 0.6 : 1 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? '请稍候...' : '进入系统'}
        </button>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: '.6rem', color: 'var(--muted)', textAlign: 'left' }}>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>角色说明：</div>
          <div style={{ lineHeight: 1.8 }}>
            <div>• 管理员：全部权限，可管理项目、成员、设置</div>
            <div>• 伙伴：内部团队成员，可执行/查看分配任务</div>
            <div>• 外包单位：外部协作者，仅可查看授权内容</div>
          </div>
        </div>
      </div>
    </div>
  )
}
