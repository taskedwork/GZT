/**
 * 登录页面 - 从后端获取用户列表 + API 认证
 */

import React, { useState, useEffect } from 'react'
import { useApp } from '../data/store'

const roleLabel = { manager: '管理员', partner: '伙伴', outsider: '外包单位', member: '成员' }

export default function LoginPage() {
  const { login, state } = useApp()
  const [selectedUser, setSelectedUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [loadFailed, setLoadFailed] = useState(false)
  const [serverInput, setServerInput] = useState(localStorage.getItem('sdd_server_host') || 'localhost')
  const [showServerConfig, setShowServerConfig] = useState(false)

  // 从后端加载用户列表
  const loadUsers = () => {
    const isLocalPreview = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && import.meta.env.PROD
    const serverHost = localStorage.getItem('sdd_server_host') || 'localhost'
    const API_BASE = isLocalPreview ? '/api' : `http://${serverHost}:3001/api`
    fetch(`${API_BASE}/auth/users`)
      .then(res => res.json())
      .then(data => {
        if (data.users && data.users.length > 0) {
          setUsers(data.users)
          setLoadFailed(false)
        } else {
          setLoadFailed(true)
        }
      })
      .catch(() => setLoadFailed(true))
  }

  useEffect(() => { loadUsers() }, [])

  // 保存服务器地址并重新加载
  const handleSaveServer = () => {
    const host = serverInput.trim() || 'localhost'
    localStorage.setItem('sdd_server_host', host)
    setShowServerConfig(false)
    setLoadFailed(false)
    loadUsers()
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
