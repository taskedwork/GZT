/**
 * 同步更新通知组件
 *
 * 当远端数据有更新时（Gist 拉取 / WebSocket 同步），先在工作台/侧边栏显示提示，
 * 用户点击提示后（syncNotifVisible=true）才弹出数据对比详情，
 * 并提供三种更新方式：接受远端 / 智能合并 / 保留本地
 */
import React from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../data/store'

const TYPE_LABELS = {
  project: '项目',
  task: '待办',
  phase: '阶段',
  milestone: '里程碑',
  default: '节点',
}

function getTypeLabel(type) {
  return TYPE_LABELS[type] || TYPE_LABELS.default
}

function formatValue(val) {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') return JSON.stringify(val)
  if (typeof val === 'boolean') return val ? '是' : '否'
  return String(val)
}

const KEY_LABELS = {
  label: '名称',
  name: '名称',
  status: '状态',
  priority: '优先级',
  quad: '象限',
  deadline: '截止日期',
  description: '描述',
  pom: '番茄钟',
  collab: '协作',
  type: '类型',
  progress: '进度',
  assignees: '负责人',
  collabMembers: '协作人',
  completedAt: '完成时间',
  parentId: '父节点',
}

function getKeyLabel(key) {
  return KEY_LABELS[key] || key
}

const STATUS_LABELS = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
}

function formatStatus(val) {
  return STATUS_LABELS[val] || val
}

export default function SyncNotification() {
  const { state, resolveSync, hideSyncNotif } = useApp()
  const pending = state.pendingSync

  // 仅当有 pendingSync 且用户点击提示后（syncNotifVisible=true）才显示弹窗
  if (!pending || !state.syncNotifVisible) return null

  const { diff } = pending
  const totalChanges = diff.added.length + diff.removed.length + diff.modified.length + diff.edgeChanges.length + (diff.userChanges?.length || 0)

  // 按类型统计更新条数
  const getItemType = (item) => item.type || item.changes?.[0]?.remote?.type || 'default'
  const allChanges = [...diff.added, ...diff.removed, ...diff.modified]
  const projectChanges = allChanges.filter(item => getItemType(item) === 'project').length
  const taskChanges = allChanges.filter(item => getItemType(item) === 'task').length
  const otherChanges = allChanges.length - projectChanges - taskChanges

  // 数据汇总
  const localNodeCount = pending.localNodes?.length ?? 0
  const remoteNodeCount = pending.remoteData?.mmNodes?.length ?? 0
  const localEdgeCount = pending.localEdges?.length ?? 0
  const remoteEdgeCount = pending.remoteData?.mmEdges?.length ?? 0
  const sourceLabel = pending.source === 'gist' ? 'Gist 拉取' : 'WebSocket 同步'

  return createPortal(
    <div className="sync-notif-overlay" onClick={hideSyncNotif}>
    <div className="sync-notification" onClick={(e) => e.stopPropagation()}>
      {/* 标题栏 */}
      <div className="sync-notif-header">
        <div className="sync-notif-title">
          <span className="sync-notif-icon">↻</span>
          <span>检测到云端数据更新</span>
          <span className="sync-notif-badge">{totalChanges} 处变更</span>
        </div>
        <button className="sync-notif-close" onClick={hideSyncNotif} title="关闭">✕</button>
      </div>

      {/* 类型统计条 */}
      <div className="sync-notif-stats">
        {projectChanges > 0 && (
          <span className="sync-notif-stat sync-notif-stat-project">
            📁 项目 {projectChanges} 条更新
          </span>
        )}
        {taskChanges > 0 && (
          <span className="sync-notif-stat sync-notif-stat-task">
            ✓ 待办 {taskChanges} 条更新
          </span>
        )}
        {otherChanges > 0 && (
          <span className="sync-notif-stat sync-notif-stat-other">
            ◇ 其他 {otherChanges} 条
          </span>
        )}
        {diff.edgeChanges.length > 0 && (
          <span className="sync-notif-stat sync-notif-stat-edge">
            ↔ 连线变更
          </span>
        )}
        {diff.userChanges?.length > 0 && (
          <span className="sync-notif-stat sync-notif-stat-other">
            👥 成员 {diff.userChanges.length} 人更新
          </span>
        )}
        <span className="sync-notif-stat-source">云端</span>
      </div>

      <div className="sync-notif-body">
          {/* 数据汇总：本地 vs 云端对比 */}
          <div className="sync-diff-summary">
            <div className="sync-diff-summary-item">
              <span className="sync-diff-summary-label">数据来源</span>
              <span className="sync-diff-summary-value">云端</span>
            </div>
            <div className="sync-diff-summary-item">
              <span className="sync-diff-summary-label">时间</span>
              <span className="sync-diff-summary-value">{new Date(pending.timestamp).toLocaleString('zh-CN')}</span>
            </div>
            <div className="sync-diff-summary-item">
              <span className="sync-diff-summary-label">本地数据</span>
              <span className="sync-diff-summary-value">{localNodeCount} 个节点 / {localEdgeCount} 条关联</span>
            </div>
            <div className="sync-diff-summary-item">
              <span className="sync-diff-summary-label">云端数据</span>
              <span className="sync-diff-summary-value">{remoteNodeCount} 个节点 / {remoteEdgeCount} 条关联</span>
            </div>
          </div>

          {totalChanges === 0 ? (
            <div className="sync-diff-empty">数据一致，无变更</div>
          ) : (
            <div className="sync-diff-text-list">
              {/* 新增 */}
              {diff.added.map(item => (
                <div key={`add-${item.id}`} className="sync-diff-text-line sync-diff-text-add">
                  + {getTypeLabel(item.type)} {item.label}（云端新增）
                </div>
              ))}
              {/* 删除 */}
              {diff.removed.map(item => (
                <div key={`rm-${item.id}`} className="sync-diff-text-line sync-diff-text-remove">
                  − {getTypeLabel(item.type)} {item.label}（云端已删除）
                </div>
              ))}
              {/* 修改 */}
              {diff.modified.map(item => (
                <div key={`mod-${item.id}`} className="sync-diff-text-modify-group">
                  <div className="sync-diff-text-line sync-diff-text-modify">
                    ~ {getTypeLabel(item.type)} {item.label}：
                  </div>
                  {item.changes.map((c, i) => (
                    <div key={i} className="sync-diff-text-line sync-diff-text-modify-detail">
                      {'　'}{getKeyLabel(c.key)}：{c.key === 'status' ? formatStatus(c.local) : formatValue(c.local)} → {c.key === 'status' ? formatStatus(c.remote) : formatValue(c.remote)}
                    </div>
                  ))}
                </div>
              ))}
              {/* 连线变化 */}
              {diff.edgeChanges.map((ec, i) => (
                <div key={`edge-${i}`} className="sync-diff-text-line sync-diff-text-edge">
                  ↔ 关联关系：{ec.localCount} 条 → {ec.remoteCount} 条
                </div>
              ))}
              {/* 样式变化 */}
              {diff.styleChanges?.map((sc, i) => (
                <div key={`style-${i}`} className="sync-diff-text-line sync-diff-text-style">
                  ~ {KEY_LABELS[sc.key] || sc.key} 有变化
                </div>
              ))}
              {/* 成员变化 */}
              {diff.userChanges?.map((uc, i) => (
                <div key={`user-${i}`} className={`sync-diff-text-line ${uc.type === 'added' ? 'sync-diff-text-add' : uc.type === 'removed' ? 'sync-diff-text-remove' : 'sync-diff-text-modify'}`}>
                  {uc.type === 'added' ? '+' : uc.type === 'removed' ? '−' : '~'} 成员 {uc.name}（{uc.type === 'added' ? '云端新增' : uc.type === 'removed' ? '云端已删除' : '信息变更'}）
                </div>
              ))}
            </div>
          )}

        </div>

        {/* 操作按钮（固定在悬浮窗底部）*/}
        <div className="sync-notif-actions">
          <button className="btn btn-primary" onClick={() => resolveSync('remote')}>
            ✓ 接受远端
          </button>
          <button className="btn btn-blue" onClick={() => resolveSync('merge')}>
            ⇄ 智能合并
          </button>
          <button className="btn btn-secondary" onClick={() => resolveSync('local')}>
            ✕ 保留本地
          </button>
        </div>
        <p className="sync-notif-hint">
          接受远端：用远端数据完全替换本地｜智能合并：远端新增/修改合并到本地，本地独有保留｜保留本地：不做更改
        </p>
    </div>
    </div>,
    document.body
  )
}
