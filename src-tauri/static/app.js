// Quack Remote Dashboard — Vanilla JS SPA
// No build step, no dependencies.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ── State ──────────────────────────────────────────────────────
const state = {
  token: window.__QUACK_TOKEN__ || localStorage.getItem('quack_token') || '',
  tab: 'agents',
  agents: [],
  sessions: [],
  jobs: [],
  status: null,
  ws: null,
  wsConnected: false,
  loading: true,
  chatSession: null,   // session object for chat view
  chatMessages: [],    // messages in current chat
  chatLoading: false,
  chatSending: false,
  chatPollTimer: null, // polling timer for live updates
  drawer: null,        // { agentId, agentName } when execute drawer is open
  refreshing: false,   // pull-to-refresh in progress
  autoRefreshTimer: null, // stealth auto-refresh timer
};

// ── API Client ─────────────────────────────────────────────────
const api = {
  base() {
    return `${location.protocol}//${location.host}/api`;
  },
  headers() {
    return {
      'Authorization': `Bearer ${state.token}`,
      'Content-Type': 'application/json',
    };
  },
  async get(path) {
    const res = await fetch(`${this.base()}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(`${this.base()}${path}`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },
  avatarUrl(filename) {
    return `${this.base()}/avatars/${encodeURIComponent(filename)}`;
  },
};

// ── WebSocket ──────────────────────────────────────────────────
function connectWs() {
  if (!state.token) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/ws?token=${state.token}`;
  try {
    state.ws = new WebSocket(url);
    state.ws.onopen = () => { state.wsConnected = true; render(); };
    state.ws.onclose = () => {
      state.wsConnected = false;
      render();
      setTimeout(connectWs, 3000);
    };
    state.ws.onmessage = (evt) => {
      try { handleWsEvent(JSON.parse(evt.data)); } catch {}
    };
  } catch {}
}

function handleWsEvent(event) {
  switch (event.type) {
    case 'agent_status': {
      const agent = state.agents.find(a => a.id === event.agentId || a.name === event.label);
      if (agent) { agent.status = event.status; render(); }
      break;
    }
    case 'session_created':
      toast(`New session: ${event.title}`, 'success');
      loadData();
      break;
    case 'session_completed':
      toast('Session completed', 'success');
      loadData();
      // If watching this session, refresh messages
      if (state.chatSession && state.chatSession.id === event.sessionId) {
        pollChatMessages();
      }
      break;
    case 'job_fired':
      toast(`Job fired: ${event.jobName}`, 'success');
      break;
    case 'job_completed':
      loadData();
      break;
  }
}

// ── Data Loading ───────────────────────────────────────────────
async function loadData() {
  try {
    const [statusData, agents, sessions, jobs] = await Promise.all([
      api.get('/status'),
      api.get('/agents'),
      api.get('/sessions'),
      api.get('/jobs'),
    ]);
    state.status = statusData;
    state.agents = agents;
    state.sessions = sessions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
    state.jobs = jobs;
    state.loading = false;
  } catch (err) {
    state.loading = false;
    if (err.message.includes('401')) {
      state.token = '';
      localStorage.removeItem('quack_token');
    }
  }
  render();
}

// ── Pull-to-Refresh ───────────────────────────────────────────
let pullStartY = 0;
let pulling = false;

function initPullToRefresh() {
  const app = $('#app');
  if (!app) return;

  app.addEventListener('touchstart', (e) => {
    // Only activate at top of scroll
    if (app.scrollTop <= 0 && !state.chatSession && !state.drawer) {
      pullStartY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  app.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const pullDistance = e.touches[0].clientY - pullStartY;
    const indicator = $('#pull-indicator');
    if (indicator && pullDistance > 0) {
      const progress = Math.min(pullDistance / 100, 1);
      indicator.style.height = `${Math.min(pullDistance * 0.5, 50)}px`;
      indicator.style.opacity = progress;
      indicator.querySelector('.pull-spinner').style.transform = `rotate(${pullDistance * 3}deg)`;
    }
  }, { passive: true });

  app.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;
    const indicator = $('#pull-indicator');
    if (indicator && parseInt(indicator.style.height) >= 45) {
      refreshData();
    }
    if (indicator) {
      indicator.style.height = '0px';
      indicator.style.opacity = '0';
    }
  });
}

async function refreshData() {
  if (state.refreshing) return;
  state.refreshing = true;
  render();
  await loadData();
  state.refreshing = false;
  render();
}

// ── Stealth Auto-Refresh ──────────────────────────────────────
function startAutoRefresh() {
  stopAutoRefresh();
  // Refresh data every 30s silently (no spinner, no toast)
  state.autoRefreshTimer = setInterval(async () => {
    if (state.chatSession || state.drawer || state.loading) return;
    try {
      const [statusData, agents, sessions, jobs] = await Promise.all([
        api.get('/status'),
        api.get('/agents'),
        api.get('/sessions'),
        api.get('/jobs'),
      ]);
      state.status = statusData;
      state.agents = agents;
      state.sessions = sessions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
      state.jobs = jobs;
      render();
    } catch {}
  }, 30000);
}

function stopAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

// ── Chat ───────────────────────────────────────────────────────
async function openChat(session) {
  state.chatSession = session;
  state.chatMessages = [];
  state.chatLoading = true;
  state.drawer = null; // close drawer if open
  render();
  try {
    const messages = await api.get(`/sessions/${session.id}/messages`);
    state.chatMessages = messages;
    state.chatLoading = false;
  } catch (err) {
    state.chatLoading = false;
    toast(`Failed to load chat: ${err.message}`, 'error');
  }
  render();
  scrollChatToBottom();
  startChatPolling();
}

async function pollChatMessages() {
  if (!state.chatSession) return;
  try {
    const messages = await api.get(`/sessions/${state.chatSession.id}/messages`);
    const hadMessages = state.chatMessages.length;
    state.chatMessages = messages;
    if (messages.length > hadMessages) {
      render();
      scrollChatToBottom();
    }
  } catch {}
}

function startChatPolling() {
  stopChatPolling();
  state.chatPollTimer = setInterval(pollChatMessages, 3000);
}

function stopChatPolling() {
  if (state.chatPollTimer) {
    clearInterval(state.chatPollTimer);
    state.chatPollTimer = null;
  }
}

async function sendMessage() {
  const input = $('#chat-input');
  if (!input || !input.value.trim() || state.chatSending) return;
  const message = input.value.trim();
  input.value = '';
  state.chatSending = true;

  // Optimistic: add to UI immediately
  state.chatMessages.push({ role: 'user', content: message });
  render();
  scrollChatToBottom();

  try {
    await api.post(`/sessions/${state.chatSession.id}/send`, { message });
  } catch (err) {
    toast(`Send failed: ${err.message}`, 'error');
  }
  state.chatSending = false;
  render();
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    const container = $('#chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  });
}

// ── Execute (via drawer) ──────────────────────────────────────
async function executeFromDrawer() {
  const prompt = $('#drawer-prompt')?.value?.trim();
  if (!prompt || !state.drawer) return;

  const { agentId } = state.drawer;
  const sendBtn = $('#drawer-send');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await api.post('/execute', { agentId, prompt });
    if (res.success && res.sessionId) {
      state.drawer = null;
      toast('Agent started!', 'success');
      // Reload sessions then open the chat for the new session
      await loadData();
      const newSession = state.sessions.find(s => s.id === res.sessionId);
      if (newSession) {
        openChat(newSession);
      }
    } else {
      toast(res.error || 'Execute failed', 'error');
    }
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
  if (sendBtn) sendBtn.disabled = false;
}

// ── Toast ──────────────────────────────────────────────────────
function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Render ─────────────────────────────────────────────────────
function render() {
  const app = $('#app');
  if (!state.token) {
    app.innerHTML = renderLogin();
    bindEvents();
    return;
  }
  if (state.loading) {
    app.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
    return;
  }
  // Chat view (full screen)
  if (state.chatSession) {
    app.innerHTML = renderChat();
    bindEvents();
    return;
  }

  app.innerHTML = `
    ${renderHeader()}
    ${renderStats()}
    ${renderTabs()}
    ${renderContent()}
    ${state.drawer ? renderDrawer() : ''}
  `;
  bindEvents();
}

function renderLogin() {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80dvh;gap:20px">
      <div style="font-size:60px">🦆</div>
      <h1 style="font-size:24px;font-weight:700">Quack Remote</h1>
      <p style="color:var(--text-secondary);font-size:14px;text-align:center">
        Enter your API token from<br>Quack Settings → Remote API
      </p>
      <input id="token-input" type="password" class="select" placeholder="Paste your token..."
        style="max-width:320px;text-align:center">
      <button id="login-btn" class="btn btn-primary btn-block" style="max-width:320px">Connect</button>
    </div>
  `;
}

function renderHeader() {
  return `
    <div id="pull-indicator" class="pull-indicator" style="height:0px;opacity:0">
      <div class="pull-spinner">↻</div>
    </div>
    ${state.refreshing ? '<div class="refresh-bar"><div class="refresh-bar-fill"></div></div>' : ''}
    <div class="header">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="header-duck">🦆</span>
        <span class="header-title">Quack</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn-refresh ${state.refreshing ? 'spinning' : ''}" id="refresh-btn" title="Refresh">↻</button>
        <span class="header-status ${state.wsConnected ? '' : 'offline'}">
          <span class="ws-dot ${state.wsConnected ? 'connected' : 'disconnected'}"></span>
          ${state.wsConnected ? 'Live' : 'Offline'}
        </span>
      </div>
    </div>
  `;
}

function renderStats() {
  const s = state.status;
  if (!s) return '';
  return `
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${s.agentCount}</div>
        <div class="stat-label">Agents</div>
      </div>
      <div class="stat">
        <div class="stat-value">${s.activeSessionCount}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat">
        <div class="stat-value">${state.jobs.filter(j => j.enabled).length}</div>
        <div class="stat-label">Jobs</div>
      </div>
    </div>
  `;
}

function renderTabs() {
  const tabs = [
    { id: 'agents', label: 'Agents' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'jobs', label: 'Jobs' },
  ];
  return `
    <div class="tab-nav">
      ${tabs.map(t => `
        <button class="tab-btn ${state.tab === t.id ? 'active' : ''}" data-tab="${t.id}">
          ${t.label}
        </button>
      `).join('')}
    </div>
  `;
}

function renderContent() {
  switch (state.tab) {
    case 'agents': return renderAgents();
    case 'sessions': return renderSessions();
    case 'jobs': return renderJobs();
    default: return '';
  }
}

// ── Agents Tab — Grouped by Project with Active Sessions ──────
function renderAgents() {
  if (!state.agents.length) {
    return '<div class="empty"><div class="empty-icon">🦆</div><div class="empty-text">No agents configured</div></div>';
  }

  const groups = {};
  state.agents.forEach(a => {
    const project = a.projectName || 'Unassigned';
    if (!groups[project]) groups[project] = [];
    groups[project].push(a);
  });

  const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  return sorted.map(([project, agents]) => `
    <div class="project-group">
      <div class="project-header">
        <span class="project-name">${esc(project)}</span>
        <span class="project-count">${agents.length}</span>
      </div>
      ${agents.map(a => renderAgentWithSessions(a)).join('')}
    </div>
  `).join('');
}

function renderAgentWithSessions(a) {
  const activeSessions = state.sessions.filter(
    s => s.agentId === a.id && s.status !== 'done'
  );

  const avatarHtml = a.avatar
    ? `<img class="agent-avatar" src="${api.avatarUrl(a.avatar)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      + `<div class="agent-avatar agent-avatar-fallback" style="display:none;background:${a.color || 'var(--accent)'}">🦆</div>`
    : `<div class="agent-avatar agent-avatar-fallback" style="background:${a.color || 'var(--accent)'}">🦆</div>`;

  const statusClass = a.status === 'running' ? 'running' : a.status === 'error' ? 'error' : 'idle';

  return `
    <div class="agent-block">
      <div class="agent-card">
        <div class="agent-card-left">
          ${avatarHtml}
          <div class="agent-card-info">
            <div class="agent-name">${esc(a.name || 'Agent')}</div>
            <div class="agent-role">${esc(a.role || '')}</div>
          </div>
        </div>
        <div class="agent-card-right">
          <span class="badge badge-${statusClass}">${a.status || 'idle'}</span>
          <button class="btn-icon btn-new-session" data-open-drawer="${a.id}" title="New session">+</button>
        </div>
      </div>
      ${activeSessions.length ? `
        <div class="agent-sessions">
          ${activeSessions.map(s => `
            <div class="agent-session-item" data-open-chat="${s.id}">
              <span class="session-dot ${s.status === 'in_progress' ? 'active' : ''}"></span>
              <span class="session-title-inline">${esc(s.title || 'Untitled')}</span>
              <span class="session-time-inline">${timeAgo(s.createdAt)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ── Execute Drawer (bottom sheet) ─────────────────────────────
function renderDrawer() {
  const agent = state.agents.find(a => a.id === state.drawer.agentId);
  const agentName = agent ? agent.name : 'Agent';
  return `
    <div class="drawer-overlay" id="drawer-overlay"></div>
    <div class="drawer" id="drawer">
      <div class="drawer-handle"></div>
      <div class="drawer-header">
        <span class="drawer-title">New session</span>
        <span class="drawer-agent">${esc(agentName)}</span>
      </div>
      <div class="drawer-body">
        <textarea id="drawer-prompt" class="textarea" placeholder="What should the agent do?" rows="3" autofocus></textarea>
        <button id="drawer-send" class="btn btn-primary btn-block">
          Send
        </button>
      </div>
    </div>
  `;
}

// ── Chat View ─────────────────────────────────────────────────
function renderChat() {
  const s = state.chatSession;
  const agent = state.agents.find(a => a.id === s.agentId);
  const agentName = agent ? agent.name : 'Agent';

  return `
    <div class="chat-view">
      <div class="chat-header">
        <button class="chat-back" id="back-btn">←</button>
        <div class="chat-header-info">
          <div class="chat-header-title">${esc(s.title || 'Untitled')}</div>
          <div class="chat-header-agent">${esc(agentName)}</div>
        </div>
        <div class="chat-header-live">
          <span class="ws-dot ${state.wsConnected ? 'connected' : 'disconnected'}"></span>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages">
        ${state.chatLoading
          ? '<div class="loading-center"><div class="spinner"></div></div>'
          : state.chatMessages.length
            ? state.chatMessages.map(m => `
                <div class="chat-bubble ${m.role}">
                  <div class="chat-bubble-content">${formatMessage(m.content)}</div>
                </div>
              `).join('')
            : '<div class="empty-inline">Waiting for agent response...</div>'
        }
      </div>
      <div class="chat-input-bar">
        <input id="chat-input" type="text" class="chat-input" placeholder="Type a message..."
          ${state.chatSending ? 'disabled' : ''}>
        <button id="chat-send" class="btn btn-primary btn-send"
          ${state.chatSending ? 'disabled' : ''}>
          ${state.chatSending ? '...' : '→'}
        </button>
      </div>
    </div>
  `;
}

function formatMessage(content) {
  if (!content) return '';
  return esc(content)
    .replace(/\n/g, '<br>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

// ── Sessions Tab ───────────────────────────────────────────────
function renderSessions() {
  if (!state.sessions.length) {
    return '<div class="empty"><div class="empty-icon">💬</div><div class="empty-text">No sessions yet</div></div>';
  }
  return `<div class="card">${
    state.sessions.slice(0, 30).map(s => {
      const agent = state.agents.find(a => a.id === s.agentId);
      return `
        <div class="session-item" data-open-chat="${s.id}" style="cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="session-title">${esc(s.title || 'Untitled')}</span>
            <span class="badge badge-${s.status === 'in_progress' ? 'running' : s.status === 'done' ? 'done' : 'idle'}">${s.status}</span>
          </div>
          <div class="session-meta">
            ${agent ? esc(agent.name) + ' · ' : ''}${timeAgo(s.createdAt)}${s.messageCount ? ` · ${s.messageCount} msgs` : ''}
          </div>
        </div>
      `;
    }).join('')
  }</div>`;
}

// ── Jobs Tab ───────────────────────────────────────────────────
function renderJobs() {
  if (!state.jobs.length) {
    return '<div class="empty"><div class="empty-icon">⏰</div><div class="empty-text">No automation jobs</div></div>';
  }
  return state.jobs.map(j => `
    <div class="card">
      <div class="job-row">
        <div class="job-info">
          <div class="job-name">${esc(j.name)}</div>
          <div class="job-schedule">${esc(j.cronExpression)} · ${esc(j.agentName)}</div>
          ${j.lastRunStatus ? `<div class="card-meta" style="margin-top:2px">Last: ${j.lastRunStatus}</div>` : ''}
        </div>
        <div class="job-actions">
          <span class="badge ${j.enabled ? 'badge-enabled' : 'badge-disabled'}">${j.enabled ? 'ON' : 'OFF'}</span>
          <button class="btn btn-secondary btn-sm" data-fire-job="${j.id}">Fire</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Event Binding ──────────────────────────────────────────────
function bindEvents() {
  // Login
  const loginBtn = $('#login-btn');
  if (loginBtn) {
    loginBtn.onclick = () => {
      const input = $('#token-input');
      if (input && input.value.trim()) {
        state.token = input.value.trim();
        localStorage.setItem('quack_token', state.token);
        state.loading = true;
        render();
        loadData();
        connectWs();
      }
    };
    const tokenInput = $('#token-input');
    if (tokenInput) {
      tokenInput.onkeydown = (e) => { if (e.key === 'Enter') loginBtn.click(); };
    }
    return;
  }

  // Back button (chat view → main)
  const backBtn = $('#back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      stopChatPolling();
      state.chatSession = null;
      state.chatMessages = [];
      render();
    };
  }

  // Chat send
  const chatSend = $('#chat-send');
  if (chatSend) {
    chatSend.onclick = sendMessage;
    const chatInput = $('#chat-input');
    if (chatInput) {
      chatInput.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };
      chatInput.focus();
    }
  }

  // Open chat from session items
  $$('[data-open-chat]').forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      const session = state.sessions.find(s => s.id === el.dataset.openChat);
      if (session) openChat(session);
    };
  });

  // Open drawer (+ button on agent)
  $$('[data-open-drawer]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const agentId = btn.dataset.openDrawer;
      const agent = state.agents.find(a => a.id === agentId);
      state.drawer = { agentId, agentName: agent?.name || 'Agent' };
      render();
      // Focus textarea after render
      requestAnimationFrame(() => {
        const textarea = $('#drawer-prompt');
        if (textarea) textarea.focus();
      });
    };
  });

  // Drawer overlay (close on tap)
  const overlay = $('#drawer-overlay');
  if (overlay) {
    overlay.onclick = () => { state.drawer = null; render(); };
  }

  // Drawer send button
  const drawerSend = $('#drawer-send');
  if (drawerSend) {
    drawerSend.onclick = executeFromDrawer;
    const drawerPrompt = $('#drawer-prompt');
    if (drawerPrompt) {
      // Cmd+Enter or Ctrl+Enter to send
      drawerPrompt.onkeydown = (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) executeFromDrawer();
      };
    }
  }

  // Refresh button
  const refreshBtn = $('#refresh-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => refreshData();
  }

  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.onclick = () => { state.tab = btn.dataset.tab; render(); };
  });

  // Fire job
  $$('[data-fire-job]').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await api.post(`/jobs/${btn.dataset.fireJob}/fire`);
        toast('Job fired!', 'success');
      } catch (err) {
        toast(`Error: ${err.message}`, 'error');
      }
      btn.disabled = false;
    };
  });
}

// ── Helpers ────────────────────────────────────────────────────
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ── Init ───────────────────────────────────────────────────────
render();
if (state.token) {
  loadData();
  connectWs();
  initPullToRefresh();
  startAutoRefresh();
}
