/**
 * 思维导图 - 基于 SWDT 独立思维导图应用
 *
 * 通过 iframe 嵌入 public/mindmap.html，实现完全隔离的样式与逻辑。
 * 思维导图数据通过 localStorage 自动持久化，独立于 SDD store。
 *
 * 功能：
 *   - 多种风格主题（霓虹/海洋/日落/森林/极简/糖果）
 *   - 结构模板（SWOT/项目计划/读书笔记等）
 *   - 拖拽改变节点层级
 *   - 撤销/缩放/折叠
 *   - 键盘快捷键
 */

import React, { useState, useRef, useCallback } from 'react'

export default function MindMap() {
  const [loaded, setLoaded] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const containerRef = useRef(null)
  const iframeRef = useRef(null)

  // ===== 全屏切换 =====
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }, [])

  // 监听全屏状态变化
  React.useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // ===== 在新窗口打开 =====
  const openInNewTab = useCallback(() => {
    window.open('./mindmap.html', '_blank')
  }, [])

  return (
    <div
      ref={containerRef}
      className="swdt-mindmap-wrap"
      style={{
        width: '100%',
        height: 'calc(100vh - 140px)',
        minHeight: '500px',
        position: 'relative',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: '#1a1a2e',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* 加载提示 */}
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)', fontSize: '14px', gap: '12px',
        }}>
          <div style={{
            width: 32, height: 32,
            border: '3px solid rgba(255,255,255,0.15)',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            animation: 'swdt-spin 0.8s linear infinite',
          }} />
          <span>正在加载思维导图...</span>
        </div>
      )}

      {/* iframe 嵌入 SWDT 思维导图 */}
      <iframe
        ref={iframeRef}
        src="./mindmap.html"
        title="思维导图"
        onLoad={() => setLoaded(true)}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: loaded ? 'block' : 'none',
        }}
        allowFullScreen
      />

      {/* 右上角操作按钮 */}
      {loaded && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          display: 'flex',
          gap: 6,
          zIndex: 10,
        }}>
          <button
            onClick={openInNewTab}
            title="在新窗口打开"
            style={{
              width: 32, height: 32,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(30,30,50,0.85)',
              backdropFilter: 'blur(8px)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.16)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(30,30,50,0.85)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
            }}
          >
            ⤢
          </button>
          <button
            onClick={toggleFullscreen}
            title={fullscreen ? '退出全屏' : '全屏'}
            style={{
              width: 32, height: 32,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(30,30,50,0.85)',
              backdropFilter: 'blur(8px)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.16)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(30,30,50,0.85)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
            }}
          >
            {fullscreen ? '⤓' : '⛶'}
          </button>
        </div>
      )}
    </div>
  )
}
