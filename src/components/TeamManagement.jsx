/**
 * 小伙伴管理 - 管理团队成员、角色权限
 */
import React, { useState } from 'react'
import { useApp } from '../data/store'

const ROLE_ICONS = {
  manager: '👑',
  partner: '🤝',
  outsider: '👁',
}

const PERMISSIONS = {
  manager: {
    label: '管理员',
    desc: '拥有所有权限，可管理成员、项目和数据',
    perms: ['创建项目', '删除项目', '添加待办', '删除待办', '导入导出', '管理成员', '思维导图', '修改设置'],
  },
  partner: {
    label: '伙伴',
    desc: '可创建项目和待办，导入导出，编辑思维导图',
    perms: ['创建项目', '添加待办', '导入导出', '思维导图'],
  },
  outsider: {
    label: '外包单位',
    desc: '仅可查看，不可编辑',
    perms: [],
  },
}

export default function TeamManagement() {
  const { teamMembers, roles, addTeamMember, updateTeamMember, deleteTeamMember, state } = useApp()
  const isStandalone = state.settings?.standalone !== false
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('partner')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [selectedRole, setSelectedRole] = useState(null)

  const currentUser = state.currentUser
  const isManager = currentUser?.role === 'manager' || currentUser?.systemRole === 'manager'

  // 按分组显示
  const groups = ['伙伴', '外包单位']
  const grouped = {}
  groups.forEach(g => { grouped[g] = [] })
  teamMembers.forEach(m => {
    const g = m.group || (m.role === 'manager' || m.role === 'partner' ? '伙伴' : '外包单位')
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(m)
  })

  const getApiBase = () => import.meta.env.PROD ? '/api' : `http://${window.location.hostname}:3001/api`
  const getToken = () => localStorage.getItem('sdd_token')

  const handleAdd = async () => {
    if (!newName.trim()) return
    const id = 'tm_' + Date.now()
    const roleObj = roles.find(r => r.id === newRole)
    const group = newRole === 'outsider' ? '外包单位' : '伙伴'
    const name = newName.trim()

    // 连接模式：同步到后端 users.json
    if (!isStandalone) {
      try {
        const username = 'tm_' + Date.now()
        const res = await fetch(`${getApiBase()}/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + getToken(),
          },
          body: JSON.stringify({ username, password: '123456', name, systemRole: newRole }),
        })
        const data = await res.json().catch(() => ({}))
        if (data.user) {
          addTeamMember({ id: data.user.id, name: data.user.name, role: newRole, roleLabel: roleObj?.name || newRole, group, username: data.user.username })
        } else {
          addTeamMember({ id, name, role: newRole, roleLabel: roleObj?.name || newRole, group })
        }
      } catch {
        addTeamMember({ id, name, role: newRole, roleLabel: roleObj?.name || newRole, group })
      }
    } else {
      addTeamMember({ id, name, role: newRole, roleLabel: roleObj?.name || newRole, group })
    }
    setNewName('')
    setNewRole('partner')
    setShowAdd(false)
  }

  const handleUpdate = async (id) => {
    if (!editName.trim()) return
    const roleObj = roles.find(r => r.id === editRole)
    const group = editRole === 'outsider' ? '外包单位' : '伙伴'
    // 连接模式：同步到后端
    if (!isStandalone) {
      try {
        await fetch(`${getApiBase()}/admin/users/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + getToken(),
          },
          body: JSON.stringify({ name: editName.trim(), systemRole: editRole }),
        })
      } catch {}
    }
    updateTeamMember(id, { name: editName.trim(), role: editRole, roleLabel: roleObj?.name || editRole, group })
    setEditingId(null)
  }

  const startEdit = (m) => {
    setEditingId(m.id)
    setEditName(m.name)
    setEditRole(m.role)
  }

  return (
    <div className="team-mgmt">
      {/* 标题栏 */}
      <div className="team-mgmt-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>小伙伴管理</h2>
          <p style={{ margin: '4px 0 0', fontSize: '.75rem', color: 'var(--muted)' }}>
            管理团队成员与权限，共 {teamMembers.length} 人
          </p>
        </div>
        {isManager && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + 添加小伙伴
          </button>
        )}
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <div className="team-mgmt-add-form">
          <input
            className="input"
            placeholder="输入姓名"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
            style={{ flex: 1 }}
          />
          <select className="input" value={newRole} onChange={e => setNewRole(e.target.value)} style={{ width: 120 }}>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleAdd}>添加</button>
          <button className="btn btn-secondary" onClick={() => { setShowAdd(false); setNewName('') }}>取消</button>
        </div>
      )}

      {/* 按分组显示成员列表 */}
      {groups.map(g => (
        <div key={g}>
          <div className="team-mgmt-group-title">
            {g === '伙伴' ? '🤝' : '👁'} {g}（{(grouped[g] || []).length}人）
          </div>
          <div className="team-mgmt-list">
            {(grouped[g] || []).map(m => {
              const permInfo = PERMISSIONS[m.role] || PERMISSIONS.partner
              const isEditing = editingId === m.id

              return (
                <div key={m.id} className="team-mgmt-card">
                  <div className="team-mgmt-card-left">
                    <span className="team-mgmt-avatar">{ROLE_ICONS[m.role] || '👤'}</span>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                        <input
                          className="input"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleUpdate(m.id)}
                          autoFocus
                          style={{ width: 120 }}
                        />
                        <select className="input" value={editRole} onChange={e => setEditRole(e.target.value)} style={{ width: 110 }}>
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        <button className="btn btn-primary" style={{ fontSize: '.72rem', padding: '3px 10px' }} onClick={() => handleUpdate(m.id)}>保存</button>
                        <button className="btn btn-secondary" style={{ fontSize: '.72rem', padding: '3px 10px' }} onClick={() => setEditingId(null)}>取消</button>
                      </div>
                    ) : (
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: '.9rem' }}>{m.name}</span>
                          <span className="role-tag" data-role={m.role}>{permInfo.label}</span>
                          {currentUser?.name === m.name && <span className="role-tag" style={{ background: 'var(--primary)', color: '#fff' }}>当前</span>}
                        </div>
                        <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 2 }}>{permInfo.desc}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {permInfo.perms.map(p => (
                            <span key={p} className="perm-tag">{p}</span>
                          ))}
                          {permInfo.perms.length === 0 && <span style={{ fontSize: '.7rem', color: 'var(--muted)' }}>仅查看</span>}
                        </div>
                      </div>
                    )}
                  </div>
                  {!isEditing && isManager && (
                    <div className="team-mgmt-card-actions">
                      <button className="btn-icon-sm" title="编辑" onClick={() => startEdit(m)}>✎</button>
                      {m.role !== 'manager' && (
                        <button className="btn-icon-sm btn-icon-danger" title="移除" onClick={async () => {
                          if (!isStandalone) {
                            try {
                              await fetch(`${getApiBase()}/admin/users/${m.id}`, {
                                method: 'DELETE',
                                headers: { Authorization: 'Bearer ' + getToken() },
                              })
                            } catch {}
                          }
                          deleteTeamMember(m.id)
                        }}>✕</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* 权限说明 */}
      <div className="team-mgmt-perms">
        <h3 style={{ fontSize: '.9rem', margin: '0 0 12px' }}>权限说明</h3>
        <div className="team-mgmt-perms-grid">
          {Object.entries(PERMISSIONS).map(([roleId, info]) => (
            <div
              key={roleId}
              className={'team-mgmt-perm-card' + (selectedRole === roleId ? ' selected' : '')}
              onClick={() => setSelectedRole(selectedRole === roleId ? null : roleId)}
            >
              <div style={{ fontSize: '1.4rem' }}>{ROLE_ICONS[roleId]}</div>
              <div style={{ fontWeight: 600, fontSize: '.85rem', marginTop: 4 }}>{info.label}</div>
              <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: 2 }}>{info.desc}</div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6, justifyContent: 'center' }}>
                {info.perms.map(p => (
                  <span key={p} className="perm-tag">{p}</span>
                ))}
                {info.perms.length === 0 && <span style={{ fontSize: '.7rem', color: 'var(--muted)' }}>仅查看</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
