/**
 * 系统设置面板
 * 包含：隐私保护、修改密码、番茄钟时长、导出配置、数据维护、Gist同步
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../data/store'
import { validateToken, getSyncInfo } from '../data/gistSync'

export default function Settings() {
  const { state, updateSettings, dispatch, saveToServer, logout, gistPush, gistPull, syncClient } = useApp()
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
  const [gistValidating, setGistValidating] = useState(false)
  const [gistUser, setGistUser] = useState('')
  const [gistMsg, setGistMsg] = useState('')

  // WebSocket同步
  const [wsSync, setWsSync] = useState(s.wsSync !== false)

  // 局域网设备检测
  const [lanDevices, setLanDevices] = useState([])
  const [lanScanning, setLanScanning] = useState(false)

  // 消息提示
  const [msg, setMsg] = useState('')

  // 数据诊断结果
  const [diagnosis, setDiagnosis] = useState(null)

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  // ===== 本地数据缓存 key（与 store.jsx 的 MM_DATA_KEY 一致）=====
  const LOCAL_BACKUP_KEY = 'sdd_mm_data'

  // 删除本地备份
  const handleDeleteLocal = () => {
    const raw = localStorage.getItem(LOCAL_BACKUP_KEY)
    if (!raw) { showMsg('无本地备份可删除'); return }
    localStorage.removeItem(LOCAL_BACKUP_KEY)
    showMsg('本地备份已删除')
  }

  // 拉取（Gist）
  const handlePull = async () => {
    if (!gistConfigured) { showMsg('请先配置并验证 Gist Token'); return }
    const result = await gistPull()
    if (result.success) {
      if (result.hasChanges) {
        showMsg(`发现 ${result.diff.added.length + result.diff.removed.length + result.diff.modified.length} 处变更，请查看对比弹窗`)
      } else {
        showMsg('已是最新数据')
      }
    } else {
      showMsg('拉取失败：' + (result.error || '未知错误'))
    }
  }

  // 推送（Gist）
  const handlePush = async () => {
    if (!gistConfigured) { showMsg('请先配置并验证 Gist Token'); return }
    const result = await gistPush()
    if (result.success) showMsg('推送成功')
    else showMsg('推送失败：' + (result.error || '未知错误'))
  }

  // ===== 同步方式切换（可同时开启）=====
  const handleWsSyncToggle = (checked) => {
    setWsSync(checked)
    updateSettings({ wsSync: checked })
    if (checked) {
      const token = localStorage.getItem('sdd_token')
      if (token) {
        syncClient.connect(token, 'default')
      }
      showMsg('WebSocket 实时同步已开启')
    } else {
      syncClient.disconnect()
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' })
      showMsg('WebSocket 实时同步已关闭')
    }
  }

  // ===== 检测局域网设备 =====
  const detectLanDevices = useCallback(async () => {
    setLanScanning(true)
    try {
      const token = localStorage.getItem('sdd_token')
      const res = await fetch('/api/sync/lan-devices', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setLanDevices(data.devices || [])
      }
    } catch (err) {
      console.error('局域网检测失败:', err)
    } finally {
      setLanScanning(false)
    }
  }, [])

  // 进入设置页面时检测一次，之后每 10 秒刷新
  useEffect(() => {
    detectLanDevices()
    const timer = setInterval(detectLanDevices, 10000)
    return () => clearInterval(timer)
  }, [detectLanDevices])

  const handleGistSyncToggle = (checked) => {
    setGistSync(checked)
    updateSettings({ gistSync: checked })
    if (checked) {
      showMsg('Gist 自动同步已开启')
    } else {
      showMsg('Gist 自动同步已关闭')
    }
  }

  // ===== 修改密码 =====
  const handleChangePassword = async () => {
    if (state.currentUser?.systemRole !== 'manager') { showMsg('仅管理员可修改密码'); return }
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
    const nodeIds = new Set(nodes.map(n => n.id))
    const edgeToSet = new Set(edges.map(e => e.to))

    // 分类收集问题
    const orphanTasks = []        // 孤儿待办（无父节点）
    const missingParents = []     // 边引用了不存在的父节点
    const missingChildren = []    // 边引用了不存在的子节点
    const duplicateNodes = []     // 重复节点 ID
    const invalidNodes = []       // 节点数据异常

    // 检查孤儿待办
    nodes.forEach(n => {
      if (n.type === 'task' && !edgeToSet.has(n.id)) {
        orphanTasks.push({ id: n.id, label: n.label || '(无标签)' })
      }
    })

    // 检查边的完整性
    edges.forEach(e => {
      if (!nodeIds.has(e.from)) missingParents.push({ from: e.from, to: e.to })
      if (!nodeIds.has(e.to)) missingChildren.push({ from: e.from, to: e.to })
    })

    // 检查重复节点 ID
    const idCount = {}
    nodes.forEach(n => { idCount[n.id] = (idCount[n.id] || 0) + 1 })
    Object.entries(idCount).forEach(([id, count]) => {
      if (count > 1) {
        const node = nodes.find(n => n.id === id)
        duplicateNodes.push({ id, count, label: node?.label || '(无标签)' })
      }
    })

    // 检查节点数据异常
    nodes.forEach(n => {
      if (!n.id) invalidNodes.push({ label: n.label || '(无标签)', reason: '缺少 ID' })
      else if (!n.type) invalidNodes.push({ id: n.id, label: n.label || '(无标签)', reason: '缺少类型' })
    })

    const categories = [
      { type: 'orphan', title: '孤儿待办（无父节点的任务节点）', items: orphanTasks, color: 'var(--warning)' },
      { type: 'missing_parent', title: '边引用了不存在的父节点', items: missingParents, color: 'var(--danger)' },
      { type: 'missing_child', title: '边引用了不存在的子节点', items: missingChildren, color: 'var(--danger)' },
      { type: 'duplicate', title: '重复的节点 ID', items: duplicateNodes, color: 'var(--warning)' },
      { type: 'invalid', title: '节点数据异常', items: invalidNodes, color: 'var(--warning)' },
    ].filter(c => c.items.length > 0)

    const totalIssues = categories.reduce((sum, c) => sum + c.items.length, 0)

    setDiagnosis({
      summary: {
        nodes: nodes.length,
        edges: edges.length,
        issues: totalIssues,
        types: nodes.reduce((acc, n) => { acc[n.type] = (acc[n.type] || 0) + 1; return acc }, {}),
      },
      categories,
      checkedAt: new Date().toISOString(),
    })

    if (totalIssues === 0) showMsg(`数据正常：${nodes.length} 个节点，${edges.length} 条边`)
    else showMsg(`发现 ${totalIssues} 个问题，详见下方列表`)
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
  // 持久化 Token 到 localStorage（不依赖验证结果，避免关闭系统后丢失）
  const persistGistToken = (token) => {
    if (token === (s.gistToken || '')) return
    updateSettings({ gistToken: token })
    if (token) {
      setGistConfigured(true)
    } else {
      setGistConfigured(false)
      setGistUser('')
    }
  }

  const handleSaveGistToken = async () => {
    if (!gistToken) {
      persistGistToken('')
      updateSettings({ gistSync: false })
      showMsg('Token已清除')
      return
    }
    // 先持久化，避免验证失败时 Token 丢失
    persistGistToken(gistToken)
    setGistValidating(true)
    try {
      const result = await validateToken(gistToken)
      if (result.valid) {
        setGistConfigured(true)
        setGistUser(result.username)
        showMsg(`Token验证通过，用户: ${result.username}`)
      } else {
        showMsg(`Token已保存但验证失败: ${result.error}`)
      }
    } catch (err) {
      showMsg('Token已保存，验证异常: ' + err.message)
    } finally {
      setGistValidating(false)
    }
  }

  // ===== 手动推送到 Gist =====
  const handleGistPush = async () => {
    setGistMsg('推送中...')
    const result = await gistPush()
    if (result.success) {
      setGistMsg('推送成功 ' + new Date().toLocaleTimeString('zh-CN'))
    } else {
      setGistMsg('推送失败: ' + (result.error || '未知错误'))
    }
    setTimeout(() => setGistMsg(''), 5000)
  }

  // ===== 手动从 Gist 拉取 =====
  const handleGistPull = async () => {
    setGistMsg('拉取中...')
    const result = await gistPull()
    if (result.success) {
      setGistMsg('拉取成功 ' + new Date().toLocaleTimeString('zh-CN'))
    } else {
      setGistMsg('拉取失败: ' + (result.error || '未知错误'))
    }
    setTimeout(() => setGistMsg(''), 5000)
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input" type="password" placeholder="旧密码" value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={{ flex: 1, minWidth: 80 }} />
          <input className="input" type="password" placeholder="新密码" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={{ flex: 1, minWidth: 80 }} />
          <input className="input" type="password" placeholder="确认新密码" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} style={{ flex: 1, minWidth: 80 }} />
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
          <input className="input" type="number" min="1" max="60" value={pomDuration} onChange={e => setPomDuration(e.target.value)} style={{ width: 'auto', minWidth: 80, flex: '0 0 auto' }} />
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

        {/* 数据诊断结果列表 */}
        {diagnosis && (
          <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {/* 概览栏 */}
            <div style={{ padding: '8px 10px', background: 'var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text)' }}>
                诊断结果 · {new Date(diagnosis.checkedAt).toLocaleString('zh-CN')}
              </span>
              <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '.7rem' }} onClick={() => setDiagnosis(null)}>关闭</button>
            </div>

            {/* 数据概览 */}
            <div style={{ padding: '8px 10px', fontSize: '.75rem', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              <span>节点：<b style={{ color: 'var(--text)' }}>{diagnosis.summary.nodes}</b></span>
              <span style={{ marginLeft: 12 }}>边：<b style={{ color: 'var(--text)' }}>{diagnosis.summary.edges}</b></span>
              <span style={{ marginLeft: 12 }}>问题：<b style={{ color: diagnosis.summary.issues > 0 ? 'var(--danger)' : 'var(--success)' }}>{diagnosis.summary.issues}</b></span>
              {Object.entries(diagnosis.summary.types).length > 0 && (
                <span style={{ marginLeft: 12 }}>
                  类型分布：
                  {Object.entries(diagnosis.summary.types).map(([t, c]) => (
                    <span key={t} style={{ marginLeft: 4 }}>{t}: {c}</span>
                  ))}
                </span>
              )}
            </div>

            {/* 问题列表 */}
            {diagnosis.categories.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: '.8rem', color: 'var(--success)' }}>
                ✓ 数据正常，未发现问题
              </div>
            ) : (
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {diagnosis.categories.map((cat) => (
                  <div key={cat.type} style={{ borderBottom: '1px solid var(--border)' }}>
                    <div style={{ padding: '6px 10px', background: 'var(--bg-secondary, rgba(0,0,0,0.03))', fontSize: '.75rem', fontWeight: 600, color: cat.color }}>
                      {cat.title}（{cat.items.length}）
                    </div>
                    <ul style={{ margin: 0, padding: '4px 10px 4px 28px', fontSize: '.73rem', color: 'var(--text)', lineHeight: 1.8 }}>
                      {cat.items.map((item, idx) => (
                        <li key={idx}>
                          {cat.type === 'orphan' && <span>孤儿待办：<b>{item.label}</b>（ID: {item.id}）</span>}
                          {cat.type === 'missing_parent' && <span>边 <code>{item.from}</code> → <code>{item.to}</code> 的父节点不存在</span>}
                          {cat.type === 'missing_child' && <span>边 <code>{item.from}</code> → <code>{item.to}</code> 的子节点不存在</span>}
                          {cat.type === 'duplicate' && <span>节点 <b>{item.label}</b>（ID: {item.id}）重复 {item.count} 次</span>}
                          {cat.type === 'invalid' && <span><b>{item.label}</b>{item.id ? `（ID: ${item.id}）` : ''} - {item.reason}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 分隔线 */}
      <hr className="settings-divider" />

      {/* 本地数据操作 */}
      <section className="settings-section">
        <label style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 8, display: 'block' }}>本地数据操作</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleDeleteLocal}>🗑️ 删除本地备份</button>
        </div>
        <p className="settings-hint" style={{ marginTop: 8 }}>
          数据会自动缓存到本地（<code>sdd_mm_data</code>），无需手动保存。「删除本地备份」清空本地缓存。
        </p>
      </section>

      {/* 分隔线 */}
      <hr className="settings-divider" />

      {/* Gist自动同步 */}
      <section className="settings-section">
        <div className="settings-section-header">
          <label className="toggle-switch" style={{ justifyContent: 'flex-start', gap: 10 }}>
            <input type="checkbox" checked={gistSync} onChange={e => handleGistSyncToggle(e.target.checked)} />
            <span className="toggle-track" />
            <span style={{ fontSize: '.85rem', fontWeight: 600 }}>🌐 Gist自动同步</span>
          </label>
        </div>
        <p className="settings-hint">
          通过 GitHub Gist 实现跨网络数据同步。数据变更自动推送到 Gist，启动时自动拉取。可与 WebSocket 同时启用。
        </p>
        <label style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 6, display: 'block' }}>
          GitHub Personal Access Token（Classic，需 gist 权限）
        </label>
        <input
          className="input"
          type="password"
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx（仅支持 Classic Token）"
          value={gistToken}
          onChange={e => setGistToken(e.target.value)}
          onBlur={() => persistGistToken(gistToken)}
          disabled={false}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleSaveGistToken} disabled={gistValidating}>
            {gistValidating ? '验证中...' : '验证并保存'}
          </button>
          {gistConfigured && (
            <span style={{ fontSize: '.75rem', color: 'var(--success)' }}>
              ✓ 已配置{gistUser ? ` (${gistUser})` : ''}
            </span>
          )}
        </div>

        {/* 同步状态 */}
        {(gistMsg || state.gistLastSync) && (
          <div className="gist-sync-status">
            {gistMsg && <span className="gist-sync-msg">{gistMsg}</span>}
            {state.gistLastSync && !gistMsg && (
              <span className="gist-sync-time">
                上次同步: {new Date(state.gistLastSync).toLocaleString('zh-CN')}
              </span>
            )}
          </div>
        )}

        <p className="settings-hint">
          开启后，数据变更会自动推送到 GitHub Gist，启动时自动拉取。多端可通过 Gist 同步数据。
        </p>
      </section>

      {/* 分隔线 */}
      <hr className="settings-divider" />

      {/* WebSocket 实时数据同步 */}
      <section className="settings-section">
        <div className="settings-section-header">
          <label className="toggle-switch" style={{ justifyContent: 'flex-start', gap: 10 }}>
            <input type="checkbox" checked={wsSync} onChange={e => handleWsSyncToggle(e.target.checked)} />
            <span className="toggle-track" />
            <span style={{ fontSize: '.85rem', fontWeight: 600 }}>⚡ WebSocket 实时数据同步</span>
          </label>
        </div>
        <p className="settings-hint">
          通过 WebSocket 协议实现局域网/服务器内多端实时同步。数据变更即时广播，支持在线用户感知和节点锁定。
          可与 Gist 同步同时启用。
        </p>
        <div className="ws-sync-info">
          <div className="ws-sync-info-item">
            <span className="ws-sync-info-label">连接状态</span>
            {(() => {
              if (!wsSync) {
                return (
                  <>
                    <span className="ws-sync-status-dot ws-sync-status-offline" />
                    <span className="ws-sync-info-value">未启用</span>
                  </>
                )
              }
              const statusText = state.syncStatus === 'connected' ? '已连接' : state.syncStatus === 'connecting' ? '连接中...' : '未连接'
              return (
                <>
                  <span className={`ws-sync-status-dot ws-sync-status-${state.syncStatus}`} />
                  <span className="ws-sync-info-value" style={{ color: state.syncStatus === 'connected' ? 'var(--success)' : state.syncStatus === 'connecting' ? 'var(--warning)' : 'var(--muted)' }}>
                    {statusText}
                  </span>
                </>
              )
            })()}
          </div>
          <div className="ws-sync-info-item">
            <span className="ws-sync-info-label">在线用户</span>
            <span className="ws-sync-info-value">{`${state.onlineUsers?.length || 0} 人`}</span>
          </div>
          <div className="ws-sync-info-item">
            <span className="ws-sync-info-label">局域网设备</span>
            <span className="ws-sync-info-value" style={{ color: lanDevices.length > 0 ? 'var(--success)' : 'var(--muted)' }}>
              {lanScanning ? '检测中...' : `${lanDevices.length} 台`}
            </span>
            <button
              className="btn btn-xs"
              style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '.6rem' }}
              onClick={detectLanDevices}
              disabled={lanScanning}
            >
              {lanScanning ? '扫描中' : '刷新'}
            </button>
          </div>
          {lanDevices.length > 0 && (
            <div className="lan-device-list">
              {lanDevices.map((d, i) => (
                <div className="lan-device-item" key={`${d.ip}:${d.port}`}>
                  <span className="lan-device-icon">💻</span>
                  <span className="lan-device-name">{d.hostname}</span>
                  <span className="lan-device-ip">{d.ip}:{d.port}</span>
                  <span className="lan-device-users">{d.userCount} 人在线</span>
                </div>
              ))}
            </div>
          )}
          {state.lastSyncAt && (
            <div className="ws-sync-info-item">
              <span className="ws-sync-info-label">上次同步</span>
              <span className="ws-sync-info-value">{new Date(state.lastSyncAt).toLocaleString('zh-CN')}</span>
            </div>
          )}
        </div>
      </section>

      {/* 关于 & 许可证 */}
      <hr className="settings-divider" />
      <section className="settings-section">
        <label style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6, display: 'block' }}>关于</label>
        <p style={{ fontSize: '.78rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          SDD工作台 v1.0<br />
          本软件使用了以下开源组件：React (MIT)、Express (MIT)、jsMind (BSD-3)、ws (MIT)、jsonwebtoken (MIT)、bcryptjs (MIT) 等。<br />
          完整第三方许可证声明见项目根目录 THIRD_PARTY_LICENSES.txt
        </p>
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
