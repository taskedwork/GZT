/**
 * 关于页面 - 版本信息与开源许可证声明
 */
import React from 'react'
import { useApp } from '../data/store'

const openSourceComponents = [
  { name: 'React', version: '19.x', license: 'MIT', copyright: 'Copyright (c) Meta Platforms, Inc.' },
  { name: 'React DOM', version: '19.x', license: 'MIT', copyright: 'Copyright (c) Meta Platforms, Inc.' },
  { name: 'Vite', version: '8.x', license: 'MIT', copyright: 'Copyright (c) Yuxi (Evan) You' },
  { name: 'Express', version: '4.x', license: 'MIT', copyright: 'Copyright (c) TJ Holowaychuk, Douglas Christopher Wilson' },
  { name: 'ws', version: '8.x', license: 'MIT', copyright: 'Copyright (c) Einar Otto Stangvik, Luigi Pinca' },
  { name: 'jsonwebtoken', version: '9.x', license: 'MIT', copyright: 'Copyright (c) 2015 auth0' },
  { name: 'bcryptjs', version: '2.x', license: 'MIT', copyright: 'Copyright (c) 2012 Nevell Savoie' },
  { name: 'cors', version: '2.x', license: 'MIT', copyright: 'Copyright (c) 2013 Troy Goode' },
  { name: 'uuid', version: '9.x', license: 'MIT', copyright: 'Copyright (c) 2010-2020 Robert Kieffer' },
  { name: 'jsMind', version: '0.9.1', license: 'BSD-3-Clause', copyright: 'Copyright (c) 2014 hizzgdev@163.com' },
]

export default function About() {
  const { state } = useApp()

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #8b9cff, #a78bfa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', color: '#fff', fontWeight: 700,
        }}>S</div>
        <h2 style={{ margin: 0, fontSize: '1.3rem' }}>SDD工作台</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.8rem' }}>v1.0.0 · 项目流程管理工具</p>
      </div>

      {/* 功能简介 */}
      <section style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '.9rem' }}>功能特性</h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--muted)', fontSize: '.8rem', lineHeight: 1.8 }}>
          <li>思维导图节点编辑与可视化</li>
          <li>四象限优先级待办管理</li>
          <li>WebSocket 实时数据同步</li>
          <li>多用户协作与权限管理</li>
          <li>番茄钟与数据导入导出</li>
        </ul>
      </section>

      {/* 开源组件许可证 */}
      <section style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '.9rem' }}>开源组件声明</h3>
        <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: '.75rem' }}>
          本软件使用了以下开源软件包，感谢这些项目的作者和贡献者。完整许可证文本见项目根目录 THIRD_PARTY_LICENSES.txt。
        </p>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: '.75rem',
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 600 }}>组件</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 600 }}>版本</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)', fontWeight: 600 }}>协议</th>
            </tr>
          </thead>
          <tbody>
            {openSourceComponents.map(c => (
              <tr key={c.name} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px' }}>{c.name}</td>
                <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>{c.version}</td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{
                    display: 'inline-block', padding: '1px 6px', borderRadius: 4,
                    fontSize: '.68rem', fontWeight: 600,
                    background: c.license === 'BSD-3-Clause' ? 'rgba(253,203,110,.15)' : 'rgba(85,239,196,.15)',
                    color: c.license === 'BSD-3-Clause' ? '#fdcb6e' : '#55efc4',
                  }}>{c.license}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* MIT 许可证摘要 */}
      <section style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '.9rem' }}>MIT 许可证摘要</h3>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.72rem', lineHeight: 1.7 }}>
          React、Express、ws、jsonwebtoken、bcryptjs、cors、uuid 等组件使用 MIT 许可证。<br />
          MIT 许可证允许自由使用、修改和分发，要求保留版权声明和许可证文本，不要求公开源代码。
        </p>
      </section>

      {/* BSD-3 许可证摘要 */}
      <section style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, marginBottom: 20,
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '.9rem' }}>BSD-3-Clause 许可证摘要（jsMind）</h3>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.72rem', lineHeight: 1.7 }}>
          jsMind 使用 BSD 3-Clause 许可证。允许自由使用和分发，要求：<br />
          1. 分发源码时保留版权声明和许可证<br />
          2. 分发二进制形式时在文档中包含版权声明和许可证<br />
          3. 不得使用 jsMind 名称或贡献者名称进行产品背书
        </p>
      </section>

      {/* 页脚 */}
      <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--muted)', fontSize: '.68rem' }}>
        <p style={{ margin: 0 }}>SDD工作台 · 项目流程管理工具</p>
        <p style={{ margin: '4px 0 0', opacity: 0.6 }}>本软件按"原样"提供，不作任何明示或暗示的保证</p>
      </div>
    </div>
  )
}
