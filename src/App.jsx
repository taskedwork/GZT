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

import React, { useEffect } from 'react'
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

function AppContent() {
  const { state } = useApp()

  // 主题效果始终生效（包括登录页）
  return (
    <>
      <ThemeEffect />
      {/* 未登录时显示登录页 */}
      {!state.isLoggedIn ? (
        <LoginPage />
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
