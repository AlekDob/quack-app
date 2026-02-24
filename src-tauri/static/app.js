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

async function openChat(session) {
  state.chatSession = session;
  state.chatMessages = [];
  state.chatLoading = true;
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
    toast('Message sent', 'success');
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
  // Chat view
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
    <div class="header">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="header-duck">🦆</span>
        <span class="header-title">Quack</span>
      </div>
      <span class="header-status ${state.wsConnected ? '' : 'offline'}">
        <span class="ws-dot ${state.wsConnected ? 'connected' : 'disconnected'}"></span>
        ${state.wsConnected ? 'Live' : 'Offline'}
      </span>
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
    { id: 'execute', label: 'Execute' },
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
    case 'execute': return renderExecute();
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
  // Find active sessions for this agent (not done)
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
          <button class="btn-icon btn-new-session" data-new-session="${a.id}" title="New session">+</button>
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

// ── Chat View ─────────────────────────────────────────────────
function renderChat() {
  const s = state.chatSession;
  const agent = state.agents.find(a => a.id === s.agentId);
  const agentName = agent ? agent.name : 'Agent';

  return `
    <div class="chat-view">
      <div class="chat-header">
        <button class="detail-back" id="back-btn">←</button>
        <div class="chat-header-info">
          <div class="chat-header-title">${esc(s.title || 'Untitled')}</div>
          <div class="chat-header-agent">${esc(agentName)}</div>
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
            : '<div class="empty-inline">No messages yet</div>'
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
  // Basic markdown-like formatting: code blocks, bold, newlines
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

// ── Execute Tab ────────────────────────────────────────────────
function renderExecute() {
  return `
    <div class="card">
      <div class="execute-form">
        <select id="exec-agent" class="select">
          <option value="">Select an agent...</option>
          ${state.agents.map(a => `<option value="${a.id}">${esc(a.name || a.id)}</option>`).join('')}
        </select>
        <textarea id="exec-prompt" class="textarea" placeholder="What should the agent do?"></textarea>
        <button id="exec-btn" class="btn btn-primary btn-block">Execute</button>
      </div>
    </div>
  `;
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

  // Back button (chat view)
  const backBtn = $('#back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
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
      // Auto-focus input
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

  // New session button
  $$('[data-new-session]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const agentId = btn.dataset.newSession;
      const agent = state.agents.find(a => a.id === agentId);
      // Switch to execute tab with agent pre-selected
      state.tab = 'execute';
      render();
      const select = $('#exec-agent');
      if (select) select.value = agentId;
      const textarea = $('#exec-prompt');
      if (textarea) textarea.focus();
    };
  });

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

  // Execute
  const execBtn = $('#exec-btn');
  if (execBtn) {
    execBtn.onclick = async () => {
      const agentId = $('#exec-agent')?.value;
      const prompt = $('#exec-prompt')?.value?.trim();
      if (!agentId || !prompt) { toast('Select agent and enter prompt', 'error'); return; }
      execBtn.disabled = true;
      try {
        const res = await api.post('/execute', { agentId, prompt });
        if (res.success) {
          toast('Agent executing!', 'success');
          $('#exec-prompt').value = '';
        } else {
          toast(res.error || 'Failed', 'error');
        }
      } catch (err) {
        toast(`Error: ${err.message}`, 'error');
      }
      execBtn.disabled = false;
    };
  }
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
}
