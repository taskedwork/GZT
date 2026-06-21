/**
 * 主布局组件 v4 - 工作台主导模式
 * 
 * 布局结构：
 * ┌──────────┬────────────────────────┐
 * │ 侧边栏   │                        │
 * │ 导航     │    当前视图（全屏）      │
 * │          │                        │
 * │ ★ 工作台 │   工作台 / 总览         │
 * │ ─ 项目   │   时间线 / 看板         │
 * │   总览   │                        │
 * │   时间线 │                        │
 * │   看板   │                        │
 * └──────────┴────────────────────────┘
 */

import React, { useState } from 'react'
import { useApp } from '../data/store'

// ===== 导航定义 =====
// 工作台为主入口，项目流程管理为子分组
const mainNav = { id: 'dashboard', label: '工作台', icon: '⌂', desc: '仪表盘与快捷入口' }

const projectNavItems = [
  { id: 'overview', label: '项目总览', icon: '◉', desc: '整体进度与统计' },
  { id: 'timeline', label: '流程时间线', icon: '▤', desc: '节点树形列表' },
  { id: 'kanban', label: '待办看板', icon: '▦', desc: '四象限优先级' },
  { id: 'mindmap', label: '思维导图', icon: '◎', desc: '可视化节点编辑' },
]

const manageNavItems = [
  { id: 'team', label: '小伙伴管理', icon: '👥', desc: '成员与权限管理' },
  { id: 'settings', label: '系统设置', icon: '⚙', desc: '隐私、密码、导出配置' },
]

const allNavItems = [mainNav, ...projectNavItems]

export default function Layout({ children }) {
  const { state, setView, setRole, roles, toggleDarkMode, logout } = useApp()
  const [focusMode, setFocusMode] = useState(false)
  const [projectExpanded, setProjectExpanded] = useState(true)
  const [manageExpanded, setManageExpanded] = useState(false)

  // 同步状态指示
  const syncColor = state.syncStatus === 'connected' ? '#55efc4' : state.syncStatus === 'connecting' ? '#fdcb6e' : '#e17055'
  const syncText = state.syncStatus === 'connected' ? '已同步' : state.syncStatus === 'connecting' ? '连接中...' : '离线'

  const currentNav = allNavItems.find(i => i.id === state.activeView) || mainNav

  return (
    <div className={`app-layout ${focusMode ? 'focus-mode' : ''}`}>
      {/* ===== 侧边栏 ===== */}
      <aside className="sidebar">
        {/* 头部 */}
        <div className="sidebar-header">
          <h1>工作台</h1>
          <p className="subtitle">SDD Workspace v2.0</p>
        </div>

        {/* ===== 主导航 ===== */}
        <nav className="nav-section">
          {/* 工作台（主入口） */}
          <a
            className={`nav-item nav-item-main ${state.activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
            title={mainNav.desc}
          >
            <span className="icon">{mainNav.icon}</span>
            <span>{mainNav.label}</span>
            {state.activeView === 'dashboard' && (
              <span style={{ marginLeft: 'auto', fontSize: '.55rem', opacity: 0.5 }}>●</span>
            )}
          </a>
        </nav>

        {/* ===== 项目流程管理（子分组，可折叠）===== */}
        <nav className="nav-section">
          <div
            className="nav-label nav-label-collapsible"
            onClick={() => setProjectExpanded(!projectExpanded)}
          >
            <span>项目流程管理</span>
            <span className={`expand-icon ${projectExpanded ? 'open' : ''}`}>▸</span>
          </div>
          {projectExpanded && projectNavItems.map(item => (
            <a
              key={item.id}
              className={`nav-item ${state.activeView === item.id ? 'active' : ''}`}
              onClick={() => setView(item.id)}
              title={item.desc}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
              {state.activeView === item.id && (
                <span style={{ marginLeft: 'auto', fontSize: '.55rem', opacity: 0.5 }}>●</span>
              )}
            </a>
          ))}
        </nav>

        {/* 分隔线 */}
        <div style={{ margin: '12px 16px', height: 1, background: 'var(--border)' }} />

        {/* 快捷操作 */}
        <nav className="nav-section" style={{ marginBottom: 0 }}>
          <div className="nav-label">工具</div>
          <a
            className={`nav-item ${focusMode ? 'active-subtle' : ''}`}
            onClick={() => setFocusMode(!focusMode)}
          >
            <span className="icon">{focusMode ? '⊞' : '⊟'}</span>
            <span>专注模式</span>
          </a>
        </nav>

        {/* ===== 管理（子分组，可折叠）===== */}
        <nav className="nav-section">
          <div
            className="nav-label nav-label-collapsible"
            onClick={() => setManageExpanded(!manageExpanded)}
          >
            <span>管理</span>
            <span className={`expand-icon ${manageExpanded ? 'open' : ''}`}>▸</span>
          </div>
          {manageExpanded && manageNavItems.filter(item => {
            // 非管理员隐藏小伙伴管理
            if (item.id === 'team' && state.currentUser?.systemRole !== 'manager') return false
            return true
          }).map(item => (
            <a
              key={item.id}
              className={`nav-item ${state.activeView === item.id ? 'active' : ''}`}
              onClick={() => setView(item.id)}
              title={item.desc}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
              {state.activeView === item.id && (
                <span style={{ marginLeft: 'auto', fontSize: '.55rem', opacity: 0.5 }}>●</span>
              )}
            </a>
          ))}
        </nav>

        {/* ===== 侧边栏底部 ===== */}
        <div className="sidebar-footer">
          {/* 用户信息 */}
          {state.currentUser && (
            <div className="user-info-sidebar" style={{ marginBottom: 10 }}>
              <div className="user-avatar-small">{state.currentUser.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="user-name-small">{state.currentUser.name}</div>
                <div className={`role-badge ${state.currentUser.systemRole}`}>
                  {state.currentUser.label?.split('(')[1]?.replace(')', '') || ''}
                </div>
              </div>
            </div>
          )}

          {/* 角色选择器 */}
          <div className="role-selector">
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>当前角色</label>
            <select value={state.currentRole || state.currentUser?.systemRole || 'manager'} onChange={e => setRole(e.target.value)}>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* 主题切换 */}
          <label className="toggle-switch" style={{ marginTop: 10, justifyContent: 'center' }}>
            <input type="checkbox" checked={state.darkMode} onChange={toggleDarkMode} />
            <span className="toggle-track" />
            <span style={{ fontSize: '.68rem' }}>{state.darkMode ? '暗色' : '亮色'}</span>
          </label>

          {/* 同步状态 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, fontSize: '.65rem', color: 'var(--muted)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: syncColor, display: 'inline-block' }} />
            <span>{syncText}</span>
            {state.onlineUsers.length > 0 && <span style={{ color: 'var(--accent)' }}>({state.onlineUsers.length}人在线)</span>}
          </div>

          {/* 退出登录 */}
          <button
            className="btn btn-xs btn-danger"
            onClick={logout}
            style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
          >退出登录</button>
        </div>
      </aside>

      {/* ===== 主内容区（全屏单视图）===== */}
      <main className="main-content">
        {/* 头部栏 */}
        <header className="app-header">
          <div className="header-left">
            <h1>工作台</h1>
            <div className="date">{new Date().toLocaleDateString('zh-CN', {
              year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
            })}</div>
          </div>
          <div className="header-right">
            {/* 当前面板指示 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', background: 'var(--bg)',
              border: '1px solid var(--border)', borderRadius: 20,
              fontSize: '.7rem', color: 'var(--muted)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent)'
              }} />
              {currentNav.label}
            </div>

            {/* 专注模式 */}
            <label className="toggle-switch" style={{ fontSize: '.68rem' }}>
              <input type="checkbox" checked={focusMode} onChange={e => setFocusMode(e.target.checked)} />
              <span className="toggle-track" />
              <span>专注</span>
            </label>

            {/* 用户信息 */}
            {state.currentUser && (
              <div className="user-info">
                <div className="user-avatar">{state.currentUser.name[0]}</div>
                <span className="uname">{state.currentUser.name}</span>
                <span className={`role-badge ${state.currentUser.systemRole}`}>
                  {state.currentUser.label?.split('(')[1]?.replace(')', '') || ''}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* ===== 内容区域：children 渲染当前视图 ===== */}
        <div className={focusMode ? 'focus-content' : ''} style={{
          height: 'calc(100vh - 56px)',
          overflow: 'auto',
        }}>
          {children}
        </div>
      </main>
    </div>
  )
}
