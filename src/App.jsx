/**
 * 主应用组件 v3 - 传统导航模式
 * 
 * 侧边栏切换 4 个独立视图：
 *   overview  → 项目总览
 *   timeline  → 流程时间线
 *   kanban    → 任务看板
 * 
 * 所有视图共享同一套节点数据 (mmNodes + mmEdges)
 */

import React, { useEffect, useState } from 'react'
import { AppProvider, useApp } from './data/store'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import ProjectOverview from './components/ProjectOverview'
import PhaseTimeline from './components/PhaseTimeline'
import TaskBoard from './components/TaskBoard'
import MindMap from './components/MindMap'
import TaskDetailModal from './components/TaskDetailModal'
import LoginPage from './components/LoginPage'
import TeamManagement from './components/TeamManagement'
import Settings from './components/Settings'
import About from './components/About'

// ===== 主题效果 =====
function ThemeEffect() {
  const { state } = useApp()
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light')
  }, [state.darkMode])
  
  return null
}

/**
 * 视图路由：根据 activeView 渲染对应组件
 */
function Views() {
  const { state } = useApp()

  switch (state.activeView) {
    case 'dashboard':
      return <Dashboard />
    case 'overview':
      return <ProjectOverview />
    case 'timeline':
      return <PhaseTimeline />
    case 'kanban':
      return <TaskBoard />
    case 'team':
      return <TeamManagement />
    case 'settings':
      return <Settings />
    case 'about':
      return <About />
    case 'mindmap':
      return <MindMap />
    default:
      return <ProjectOverview />
  }
}

/**
 * Token 配置界面 - 登录后未配置 Gist Token 时引导用户
 * 输入 Token 确认后自动拉取云端数据
 */
function TokenSetup() {
  const { updateSettings, gistPull, resolveSync, logout, loadUsers, state } = useApp()
  const isTester = state.currentUser?.systemRole === 'tester'
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    const t = token.trim()
    if (!t) { setError('请输入 Token'); return }
    setLoading(true)
    setError('')
    // 先用传入 token 拉取验证，成功后再保存 Token
    const result = await gistPull(t)
    if (result.success) {
      updateSettings({ gistToken: t, gistSync: true })
      // 测试账号：应用远端数据后退出，重新加载用户列表供登录页使用
      if (isTester) {
        if (result.hasChanges) {
          await resolveSync('remote')
        }
        logout()
        await loadUsers()
      }
    } else {
      setError(result.error || '拉取失败，请检查 Token')
    }
    setLoading(false)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>配置同步</h1>
        <p className="sub">输入 GitHub Token 拉取云端数据</p>
        <div className="fld">
          <input
            type="text"
            value={token}
            onChange={e => { setToken(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            placeholder="粘贴 GitHub Token..."
            autoFocus
          />
        </div>
        <div className="err">{error}</div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '.85rem', opacity: loading ? 0.6 : 1 }}
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? '拉取中...' : '确认并拉取'}
        </button>
        <div style={{ marginTop: 16, fontSize: '.6rem', color: 'var(--muted)', textAlign: 'left', lineHeight: 1.6 }}>
          Token 用于从 Gist 加密同步成员与项目数据，仅存储于本设备。
          {isTester && ' 拉取成功后将退出测试账号，请选择真实身份登录。'}
        </div>
      </div>
    </div>
  )
}

function AppContent() {
  const { state } = useApp()

  // 主题效果始终生效（包括登录页）
  return (
    <>
      <ThemeEffect />
      {/* 未登录时显示登录页 */}
      {!state.isLoggedIn ? (
        <LoginPage />
      ) : state.currentUser?.systemRole === 'tester' ? (
        <TokenSetup />
      ) : !state.settings?.gistToken ? (
        <TokenSetup />
      ) : (
        <>
          <Layout>
            <Views />
          </Layout>
          <TaskDetailModal />
        </>
      )}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
