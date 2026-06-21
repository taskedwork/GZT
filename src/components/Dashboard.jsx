/**
 * 工作台 - 登录后的中央仪表盘
 *
 * 展示内容：
 *   - 欢迎横幅 + 日期
 *   - 快捷统计卡片
 *   - 我的任务（当前用户相关节点）
 *   - 快捷入口（跳转各视图）
 *   - 最近活动 / 项目动态
 */
import React, { useMemo } from 'react'
import { useApp } from '../data/store'

// ===== 快捷入口定义 =====
const quickEntries = [
  { id: 'overview', icon: '◉', label: '项目总览', desc: '整体进度与统计', color: '#6c5ce7' },
  { id: 'timeline', icon: '▤', label: '流程时间线', desc: '节点树形列表', color: '#0984e3' },
  { id: 'kanban', icon: '▦', label: '任务看板', desc: '待处理/已完成', color: '#00b894' },
  { id: 'mindmap', icon: '◎', label: '思维导图', desc: '可视化节点编辑', color: '#e17055' },
]

export default function Dashboard() {
  const { state, progress, projectInfo, setView, teamMembers } = useApp()
  const isEmpty = state.mmNodes.length === 0

  // 计算今日日期
  const today = useMemo(() => {
    return new Date().toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    })
  }, [])

  // 问候语
  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 6) return '夜深了'
    if (h < 12) return '早上好'
    if (h < 14) return '中午好'
    if (h < 18) return '下午好'
    return '晚上好'
  }, [])

  // 节点类型统计
  const typeStats = useMemo(() => {
    const stats = {}
    state.mmNodes.forEach(n => {
      const t = n.type || 'default'
      stats[t] = (stats[t] || 0) + 1
    })
    return stats
  }, [state.mmNodes])

  // 根节点
  const rootNodes = useMemo(() => {
    return state.mmNodes.filter(n => !state.mmEdges.some(e => e.to === n.id))
  }, [state.mmNodes, state.mmEdges])

  // 叶子节点
  const leafNodes = useMemo(() => {
    return state.mmNodes.filter(n => !state.mmEdges.some(e => e.from === n.id))
  }, [state.mmNodes, state.mmEdges])

  // 最近添加的节点（取最后5个）
  const recentNodes = useMemo(() => {
    return state.mmNodes.slice(-5).reverse()
  }, [state.mmNodes])

  return (
    <div style={{ padding: 24 }}>
      {/* ===== 欢迎横幅 ===== */}
      <div className="dashboard-banner">
        <div className="banner-content">
          <div className="banner-greeting">
            {greeting}，{state.currentUser?.name || '用户'}
          </div>
          <div className="banner-date">{today}</div>
        </div>
        <div className="banner-actions">
          {isEmpty && (
            <button className="btn btn-primary" onClick={() => setView('overview')}>
              开始创建项目
            </button>
          )}
        </div>
      </div>

      {/* ===== 快捷统计 ===== */}
      <div className="dashboard-stats">
        <DashStatCard
          icon="◉"
          label="项目总数"
          value={state.mmNodes.length}
          color="#6c5ce7"
          sub={`根节点 ${rootNodes.length}`}
        />
        <DashStatCard
          icon="⤳"
          label="连线数"
          value={state.mmEdges.length}
          color="#0984e3"
          sub={`叶子节点 ${leafNodes.length}`}
        />
        <DashStatCard
          icon="✦"
          label="完成率"
          value={progress.percent + '%'}
          color="#00b894"
          sub={`${progress.done} / ${progress.total}`}
        />
        <DashStatCard
          icon="⊖"
          label="已折叠"
          value={state.collapsedNodes.size}
          color="#e17055"
          sub={`节点类型 ${Object.keys(typeStats).length}`}
        />
      </div>

      {/* ===== 双栏布局 ===== */}
      <div className="dashboard-grid">
        {/* 左侧：快捷入口 + 最近节点 */}
        <div className="dashboard-left">
          {/* 快捷入口 */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h4>快捷入口</h4>
            </div>
            <div className="quick-entry-grid">
              {quickEntries.map(entry => (
                <div
                  key={entry.id}
                  className="quick-entry-item"
                  onClick={() => setView(entry.id)}
                >
                  <div className="quick-entry-icon" style={{ background: entry.color + '18', color: entry.color }}>
                    {entry.icon}
                  </div>
                  <div className="quick-entry-text">
                    <div className="quick-entry-label">{entry.label}</div>
                    <div className="quick-entry-desc">{entry.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 最近节点 */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h4>最近节点</h4>
              {state.mmNodes.length > 0 && (
                <button className="btn btn-xs" onClick={() => setView('overview')}>
                  查看全部
                </button>
              )}
            </div>
            {recentNodes.length > 0 ? (
              <div className="recent-node-list">
                {recentNodes.map(node => (
                  <div key={node.id} className="recent-node-item">
                    <div className="recent-node-dot" style={{
                      background: typeStats[node.type || 'default'] ? 'var(--accent)' : 'var(--border)'
                    }} />
                    <div className="recent-node-info">
                      <div className="recent-node-name">{node.label || '未命名'}</div>
                      <div className="recent-node-meta">
                        <span className="mini-tag">{node.type || 'default'}</span>
                        <span style={{ fontSize: '.58rem', color: 'var(--muted)' }}>{node.id}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">
                <div style={{ fontSize: 28, opacity: .3, marginBottom: 8 }}>◎</div>
                <p>暂无节点，前往项目总览创建</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：项目信息 + 团队小伙伴 + 节点类型分布 */}
        <div className="dashboard-right">
          {/* 项目信息 */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h4>项目信息</h4>
            </div>
            <div className="info-rows">
              <InfoRow label="项目名称" value={projectInfo.name} />
              <InfoRow label="版本" value={projectInfo.version} />
              <InfoRow label="项目总数" value={String(progress.total)} />
              <InfoRow label="完成率" value={progress.percent + '%'} highlight />
              <InfoRow label="当前角色" value={state.currentUser?.label || '-'} />
            </div>
          </div>

          {/* 团队小伙伴 */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h4>团队小伙伴</h4>
            </div>
            <div className="team-list">
              {(teamMembers || []).map(m => (
                <div key={m.id} className="team-member-item">
                  <div className="team-member-avatar">{m.name[0]}</div>
                  <div className="team-member-info">
                    <div className="team-member-name">{m.name}</div>
                    <div className="team-member-role">{m.roleLabel}</div>
                  </div>
                  <span className={'role-tag ' + m.role}>{m.roleLabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 节点类型分布 */}
          {Object.keys(typeStats).length > 0 && (
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <h4>节点类型分布</h4>
              </div>
              <div className="type-dist-list">
                {Object.entries(typeStats).map(([type, count]) => (
                  <div key={type} className="type-dist-item">
                    <div className="type-dist-label">
                      <span>{type}</span>
                      <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>{count} 个</span>
                    </div>
                    <div className="type-dist-bar">
                      <div className="type-dist-fill" style={{
                        width: Math.max(4, (count / state.mmNodes.length) * 100) + '%'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ===== 子组件 =====

function DashStatCard({ icon, label, value, color, sub }) {
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-icon" style={{ background: color + '18', color }}>{icon}</div>
      <div className="dash-stat-body">
        <div className="dash-stat-value" style={{ color }}>{value}</div>
        <div className="dash-stat-label">{label}</div>
        {sub && <div className="dash-stat-sub">{sub}</div>}
      </div>
    </div>
  )
}

function InfoRow({ label, value, highlight }) {
  return (
    <div className="info-row-item">
      <span className="info-row-label">{label}</span>
      <span className="info-row-value" style={{
        color: highlight ? 'var(--accent)' : 'var(--text)',
        fontWeight: highlight ? 700 : 500,
      }}>{value}</span>
    </div>
  )
}
