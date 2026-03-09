/**
 * Quack Registry - React implementations for the Quack Component Catalog
 *
 * Maps each catalog component to its React implementation.
 * Uses Quack's dark theme CSS variables for consistent styling.
 */
import { defineRegistry } from '@json-render/react';
import { quackCatalog } from './quackCatalog';
import React, { useState } from 'react';

export const { registry: quackRegistry } = defineRegistry(quackCatalog, {
  actions: {
    copy_to_clipboard: async (params: unknown) => {
      const text = typeof params === 'string' ? params : JSON.stringify(params);
      await navigator.clipboard.writeText(text);
    },
    open_link: async (params: unknown) => {
      const url = typeof params === 'string' ? params : (params as unknown as Record<string, string>)?.url;
      if (url) window.open(url, '_blank');
    },
    open_file: async (params: unknown) => {
      const path = typeof params === 'string' ? params : (params as unknown as Record<string, string>)?.path;
      if (path) console.log('[quackRegistry] open_file:', path);
    },
    expand_section: async () => { /* handled by component state */ },
  } as never,
  components: {
    // Layout
    Card: ({ props, children }) => (
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        backdropFilter: 'blur(10px)',
      }}>
        {props.title && <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: props.subtitle ? '2px' : '12px', color: 'var(--color-text, #e0e0e0)' }}>{props.title}</div>}
        {props.subtitle && <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #999)', marginBottom: '12px' }}>{props.subtitle}</div>}
        {children}
      </div>
    ),

    Section: ({ props, children }) => {
      const SectionInner = () => {
        const [expanded, setExpanded] = useState(props.defaultExpanded !== false);
        return (
          <div style={{ marginBottom: '8px' }}>
            <button
              onClick={() => props.collapsible && setExpanded(!expanded)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--color-text, #e0e0e0)', fontSize: '14px', fontWeight: 600, cursor: props.collapsible ? 'pointer' : 'default', padding: '4px 0', width: '100%' }}
            >
              {props.collapsible && <span style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>&#9654;</span>}
              {props.title}
            </button>
            {expanded && <div style={{ paddingLeft: '8px', marginTop: '8px' }}>{children}</div>}
          </div>
        );
      };
      return <SectionInner />;
    },

    Columns: ({ props, children }) => (
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${props.columns || 2}, 1fr)`,
        gap: props.gap === 'sm' ? '8px' : props.gap === 'lg' ? '24px' : '16px',
      }}>
        {children}
      </div>
    ),

    // Content
    Heading: ({ props }) => {
      const level = props.level || 'h2';
      const sizes: Record<string, string> = { h1: '24px', h2: '20px', h3: '16px', h4: '14px' };
      return React.createElement(level, { style: { color: 'var(--color-text, #e0e0e0)', fontSize: sizes[level], margin: '8px 0' } }, props.text);
    },

    Text: ({ props }) => {
      const styles: Record<string, React.CSSProperties> = {
        body: { fontSize: '14px', lineHeight: '1.6', color: 'var(--color-text, #e0e0e0)' },
        caption: { fontSize: '12px', color: 'var(--color-text-secondary, #999)' },
        code: { fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', fontSize: '13px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: '#e0e0e0' },
      };
      return <p style={styles[props.variant || 'body']}>{props.content}</p>;
    },

    Badge: ({ props }) => {
      const colors: Record<string, string> = {
        default: 'rgba(255,255,255,0.1)', success: 'rgba(16,185,129,0.2)',
        warning: 'rgba(245,158,11,0.2)', error: 'rgba(239,68,68,0.2)', info: 'rgba(59,130,246,0.2)',
      };
      const textColors: Record<string, string> = {
        default: '#ccc', success: '#34d399', warning: '#fbbf24', error: '#f87171', info: '#60a5fa',
      };
      return (
        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500, background: colors[props.color || 'default'], color: textColors[props.color || 'default'] }}>
          {props.label}
        </span>
      );
    },

    CodeBlock: ({ props }) => (
      <div style={{ marginBottom: '8px' }}>
        {props.title && <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #999)', marginBottom: '4px' }}>{props.title}</div>}
        <pre style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px', overflow: 'auto', fontSize: '13px', fontFamily: 'var(--font-mono, monospace)', color: '#e0e0e0', margin: 0 }}>
          <code>{props.code}</code>
        </pre>
      </div>
    ),

    Image: ({ props }) => (
      <figure style={{ margin: '8px 0' }}>
        <img src={props.src} alt={props.alt} style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }} />
        {props.caption && <figcaption style={{ fontSize: '12px', color: 'var(--color-text-secondary, #999)', marginTop: '4px', textAlign: 'center' }}>{props.caption}</figcaption>}
      </figure>
    ),

    // Data display
    Table: ({ props }) => (
      <div style={{ overflowX: 'auto', marginBottom: '8px' }}>
        {props.caption && <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #999)', marginBottom: '4px' }}>{props.caption}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              {props.headers.map((h, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-text-secondary, #999)', fontWeight: 600, fontSize: '12px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-text, #e0e0e0)' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),

    Metric: ({ props }) => (
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #999)', marginBottom: '4px' }}>{props.label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text, #e0e0e0)' }}>{props.value}</span>
          {props.change && (
            <span style={{ fontSize: '13px', color: props.trend === 'up' ? '#34d399' : props.trend === 'down' ? '#f87171' : '#999' }}>
              {props.trend === 'up' ? '\u2191' : props.trend === 'down' ? '\u2193' : ''} {props.change}
            </span>
          )}
        </div>
      </div>
    ),

    ProgressBar: ({ props }) => {
      const barColors: Record<string, string> = { default: '#60a5fa', success: '#34d399', warning: '#fbbf24', error: '#f87171' };
      return (
        <div style={{ marginBottom: '8px' }}>
          {props.label && <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #999)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}><span>{props.label}</span><span>{props.value}%</span></div>}
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${props.value}%`, background: barColors[props.color || 'default'], borderRadius: '3px', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      );
    },

    List: ({ props }) => {
      const Tag = props.ordered ? 'ol' : 'ul';
      return (
        <Tag style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text, #e0e0e0)', lineHeight: '1.8' }}>
          {props.items.map((item, i) => (
            <li key={i}>{props.icon ? `${props.icon} ${item}` : item}</li>
          ))}
        </Tag>
      );
    },

    KeyValue: ({ props }) => (
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px', fontSize: '13px' }}>
        {props.pairs.map((pair, i) => (
          <React.Fragment key={i}>
            <span style={{ color: 'var(--color-text-secondary, #999)', fontWeight: 500 }}>{pair.key}</span>
            <span style={{ color: 'var(--color-text, #e0e0e0)' }}>{pair.value}</span>
          </React.Fragment>
        ))}
      </div>
    ),

    // Interactive
    Link: ({ props }) => (
      <a
        href={props.href}
        target={props.external ? '_blank' : undefined}
        rel={props.external ? 'noopener noreferrer' : undefined}
        style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '14px' }}
      >
        {props.label} {props.external && '\u2197'}
      </a>
    ),

    Button: ({ props, emit }) => (
      <button
        onClick={() => emit('press')}
        style={{
          padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'opacity 0.2s',
          ...(props.variant === 'primary' ? { background: '#FF6B35', color: '#fff' } :
            props.variant === 'ghost' ? { background: 'transparent', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' } :
            { background: 'rgba(255,255,255,0.08)', color: '#e0e0e0' }),
        }}
      >
        {props.label}
      </button>
    ),

    Tabs: ({ props, children }) => {
      const TabsInner = () => {
        const [active, setActive] = useState(props.defaultTab || props.tabs[0]?.id);
        return (
          <div>
            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '12px' }}>
              {props.tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActive(tab.id)} style={{ padding: '8px 16px', background: 'none', border: 'none', color: active === tab.id ? '#FF6B35' : 'var(--color-text-secondary, #999)', borderBottom: active === tab.id ? '2px solid #FF6B35' : '2px solid transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                  {tab.label}
                </button>
              ))}
            </div>
            {children}
          </div>
        );
      };
      return <TabsInner />;
    },

    // Alert
    Alert: ({ props }) => {
      const styles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
        info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#93c5fd', icon: '\u2139\uFE0F' },
        success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: '#6ee7b7', icon: '\u2705' },
        warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#fcd34d', icon: '\u26A0\uFE0F' },
        error: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#fca5a5', icon: '\u274C' },
      };
      const s = styles[props.type || 'info'];
      return (
        <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: s.text }}>
          {props.title && <div style={{ fontWeight: 600, marginBottom: '4px' }}>{s.icon} {props.title}</div>}
          <div>{props.message}</div>
        </div>
      );
    },
  },
});
