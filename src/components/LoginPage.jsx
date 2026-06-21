/**
 * 登录页面 - 固定用户选择 + 后端 API 认证
 * 多用户 + 数据持久化 + 实时同步
 */

import React, { useState } from 'react'
import { useApp } from '../data/store'

// 固定用户列表
const fixedUsers = [
  { id: 'admin', username: 'admin', label: '深东 (管理员)', avatar: '👑', password: '123456' },
  { id: 'member1', username: 'member1', label: '东哥哥 (伙伴)', avatar: '🤝', password: '123456' },
  { id: 'member2', username: 'member2', label: '老蔡 (伙伴)', avatar: '🤝', password: '123456' },
  { id: 'member3', username: 'member3', label: '小北哥 (伙伴)', avatar: '🤝', password: '123456' },
  { id: 'member4', username: 'member4', label: '孙博文 (伙伴)', avatar: '🤝', password: '123456' },
  { id: 'member5', username: 'member5', label: '财务王姐 (伙伴)', avatar: '🤝', password: '123456' },
  { id: 'outsource1', username: 'outsource1', label: '灯光 (外包单位)', avatar: '👁', password: '123456' },
  { id: 'outsource2', username: 'outsource2', label: '施工图 (外包单位)', avatar: '👁', password: '123456' },
  { id: 'outsource3', username: 'outsource3', label: '其他 (外包单位)', avatar: '👁', password: '123456' },
]

export default function LoginPage() {
  const { login } = useApp()
  const [selectedUser, setSelectedUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!selectedUser) { setError('请选择身份'); return }
    const user = fixedUsers.find(u => u.id === selectedUser)
    if (!user) { setError('用户不存在'); return }
    setLoading(true)
    setError('')
    try {
      const result = await login(user.username, password || user.password)
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
            {fixedUsers.map(u => (
              <option key={u.id} value={u.id}>{u.avatar} {u.label}</option>
            ))}
          </select>
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
