/**
 * 系统设置面板
 * 包含：隐私保护、修改密码、番茄钟时长、导出配置、数据维护、Gist同步
 */
import React, { useState } from 'react'
import { useApp } from '../data/store'

export default function Settings() {
  const { state, updateSettings, dispatch, saveToServer, logout } = useApp()
  const s = state.settings || {}

  // 修改密码状态
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')

  // 番茄钟时长
  const [pomDuration, setPomDuration] = useState(s.pomDuration || 25)

  // 导出设置
  const [exportPrefix, setExportPrefix] = useState(s.exportPrefix || '深东项目备份')
  const [exportFolder, setExportFolder] = useState(s.exportFolder || '浏览器默认下载文件夹')

  // Gist同步
  const [gistToken, setGistToken] = useState(s.gistToken || '')
  const [gistSync, setGistSync] = useState(!!s.gistSync)
  const [gistConfigured, setGistConfigured] = useState(!!s.gistToken)

  // 消息提示
  const [msg, setMsg] = useState('')

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  // ===== 修改密码 =====
  const handleChangePassword = async () => {
    if (!oldPwd && newPwd) { showMsg('请输入旧密码'); return }
    if (!newPwd) { showMsg('请输入新密码'); return }
    if (newPwd !== confirmPwd) { showMsg('两次新密码不一致'); return }
    try {
      const token = localStorage.getItem('sdd_token')
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd })
      })
      const data = await res.json()
      if (res.ok) {
        showMsg('密码修改成功')
        setOldPwd(''); setNewPwd(''); setConfirmPwd('')
      } else {
        showMsg(data.error || '修改失败')
      }
    } catch { showMsg('网络错误') }
  }

  // ===== 保存番茄钟时长 =====
  const handleSavePom = () => {
    updateSettings({ pomDuration: Number(pomDuration) || 25 })
    showMsg('已保存')
  }

  // ===== 保存导出前缀 =====
  const handleSaveExportPrefix = () => {
    updateSettings({ exportPrefix })
    showMsg('已保存')
  }

  // ===== 选择导出文件夹（浏览器端模拟） =====
  const handleSelectFolder = () => {
    showMsg('请在浏览器下载设置中配置默认目录')
  }

  // ===== 配置开机启动（提示） =====
  const handleAutoStart = () => {
    showMsg('请将浏览器快捷方式加入启动文件夹')
  }

  // ===== 数据诊断 =====
  const handleDataDiagnosis = () => {
    const nodes = state.mmNodes || []
    const edges = state.mmEdges || []
    let issues = []
    // 孤儿节点
    const edgeToSet = new Set(edges.map(e => e.to))
    nodes.forEach(n => {
      if (n.type === 'task' && !edgeToSet.has(n.id)) issues.push(`孤儿待办: ${n.label}`)
    })
    // 缺少父节点
    const nodeIds = new Set(nodes.map(n => n.id))
    edges.forEach(e => {
      if (!nodeIds.has(e.from)) issues.push(`边引用了不存在的父节点: ${e.from}`)
      if (!nodeIds.has(e.to)) issues.push(`边引用了不存在的子节点: ${e.to}`)
    })
    if (issues.length === 0) showMsg(`数据正常：${nodes.length}个节点，${edges.length}条边`)
    else showMsg(`发现${issues.length}个问题：\n` + issues.slice(0, 5).join('\n'))
  }

  // ===== 导出备份 =====
  const handleBackup = () => {
    const data = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      mmNodes: state.mmNodes,
      mmEdges: state.mmEdges,
      nodeStyles: state.nodeStyles,
      nodeLabels: state.nodeLabels,
      settings: state.settings,
    }
    const prefix = s.exportPrefix || 'SDD_项目数据'
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${prefix}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
    showMsg('备份已导出')
  }

  // ===== 保存Gist Token =====
  const handleSaveGistToken = () => {
    updateSettings({ gistToken, gistSync })
    setGistConfigured(!!gistToken)
    showMsg(gistToken ? 'Token已保存' : 'Token已清除')
  }

  return (
    <div className="settings-panel">
      <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem' }}>系统设置</h2>

      {/* 隐私保护 */}
      <section className="settings-section">
        <div className="settings-section-header">
          <label className="toggle-switch" style={{ justifyContent: 'flex-start', gap: 10 }}>
            <input type="checkbox" checked={!!s.privacyMode} onChange={e => updateSettings({ privacyMode: e.target.checked })} />
            <span className="toggle-track" />
            <span style={{ fontSize: '.85rem', fontWeight: 600 }}>隐私保护</span>
          </label>
        </div>
        <p className="settings-hint">开启后，标记为「个人待办」的项目将不会随 JSON 导出</p>
      </section>

      {/* 分隔线 */}
      <hr className="settings-divider" />

      {/* 修改密码 */}
      <section className="settings-section">
        <label style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6, display: 'block' }}>修改密码（留空=无密码）</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" type="password" placeholder="旧密码" value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={{ flex: 1 }} />
          <input className="input" type="password" placeholder="新密码" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={{ flex: 1 }} />
          <input className="input" type="password" placeholder="确认新密码" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} style={{ flex: 1 }} />
        </div>
        <button className="btn btn-secondary" onClick={handleChangePassword} style={{ marginTop: 8 }}>修改密码</button>
        {pwdMsg && <div style={{ fontSize: '.72rem', color: '#e17055', marginTop: 4 }}>{pwdMsg}</div>}
      </section>

      {/* 分隔线 */}
      <hr className="settings-divider" />

      {/* 番茄钟时长 */}
      <section className="settings-section">
        <label style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6, display: 'block' }}>番茄钟时长（分钟）</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" type="number" min="1" max="60" value={pomDuration} onChange={e => setPomDuration(e.target.value)} style={{ width: 120 }} />
          <button className="btn btn-primary" onClick={handleSavePom}>保存</button>
        </div>
      </section>

      {/* 分隔线 */}
      <hr className="settings-divider" />

      {/* 导出文件名前缀 */}
      <section className="settings-section">
        <label style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6, display: 'block' }}>导出文件名前缀</label>
        <input className="input" value={exportPrefix} onChange={e => setExportPrefix(e.target.value)} onBlur={handleSaveExportPrefix} />
      </section>

      {/* 导出文件夹 */}
      <section className="settings-section">
        <label style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6, display: 'block' }}>导出文件夹</label>
        <input className="input" value={exportFolder} onChange={e => setExportFolder(e.target.value)} onBlur={() => updateSettings({ exportFolder })} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={handleSelectFolder}>📂 选择文件夹</button>
          <button className="btn btn-secondary" onClick={handleAutoStart}>🚀 配置开机启动</button>
        </div>
      </section>

      {/* 分隔线 */}
      <hr className="settings-divider" />

      {/* 数据维护 */}
      <section className="settings-section">
        <label style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 8, display: 'block' }}>数据维护</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button className="btn btn-secondary" onClick={handleDataDiagnosis}>🔍 数据诊断</button>
          <button className="btn btn-secondary" onClick={handleBackup}>💾 导出备份</button>
        </div>
        <p className="settings-hint">如果子任务错位，请先导出备份，然后在看板中手动调整</p>
      </section>

      {/* 分隔线 */}
      <hr className="settings-divider" />

      {/* Gist自动同步 */}
      <section className="settings-section">
        <div className="settings-section-header">
          <label className="toggle-switch" style={{ justifyContent: 'flex-start', gap: 10 }}>
            <input type="checkbox" checked={gistSync} onChange={e => { setGistSync(e.target.checked); updateSettings({ gistSync: e.target.checked }) }} />
            <span className="toggle-track" />
            <span style={{ fontSize: '.85rem', fontWeight: 600 }}>🌐 Gist自动同步</span>
          </label>
        </div>
        <label style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 6, display: 'block' }}>Token（需手动输入，不会上传到GitHub仓库）</label>
        <input className="input" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" value={gistToken} onChange={e => setGistToken(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleSaveGistToken}>保存Token</button>
          {gistConfigured && <span style={{ fontSize: '.75rem', color: 'var(--success)' }}>✓ 已配置</span>}
        </div>
        <p className="settings-hint">在「设置 → 同步设置」中输入 Token 后可实现多端自动同步</p>
      </section>

      {/* 关闭按钮 */}
      <div style={{ textAlign: 'right', marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'dashboard' })}>关闭</button>
      </div>

      {/* 全局消息 */}
      {msg && (
        <div className="settings-toast">{msg}</div>
      )}
    </div>
  )
}
