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

  // 从后端加载用户列表
  useEffect(() => {
    const isLocalPreview = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && import.meta.env.PROD
    const API_BASE = isLocalPreview ? '/api' : 'http://localhost:3001/api'
    fetch(`${API_BASE}/auth/users`)
      .then(res => res.json())
      .then(data => {
        if (data.users && data.users.length > 0) {
          setUsers(data.users)
        } else {
          setLoadFailed(true)
        }
      })
      .catch(() => setLoadFailed(true))
  }, [])

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
          {loadFailed && <div style={{ fontSize: '.65rem', color: 'var(--danger)', marginTop: 4 }}>无法连接服务器，请检查后端是否启动</div>}
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
