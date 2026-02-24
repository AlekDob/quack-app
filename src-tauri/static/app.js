// Quack Remote Dashboard — Vanilla JS SPA
// No build step, no dependencies. ~300 lines.

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
};

// ── WebSocket ──────────────────────────────────────────────────
function connectWs() {
  if (!state.token) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/ws?token=${state.token}`;

  try {
    state.ws = new WebSocket(url);

    state.ws.onopen = () => {
      state.wsConnected = true;
      render();
    };

    state.ws.onclose = () => {
      state.wsConnected = false;
      render();
      // Reconnect after 3s
      setTimeout(connectWs, 3000);
    };

    state.ws.onmessage = (evt) => {
      try {
        const event = JSON.parse(evt.data);
        handleWsEvent(event);
      } catch { /* ignore parse errors */ }
    };
  } catch { /* ignore connection errors, will retry */ }
}

function handleWsEvent(event) {
  switch (event.type) {
    case 'agent_status': {
      const agent = state.agents.find(a => a.id === event.agentId || a.label === event.label);
      if (agent) {
        agent.status = event.status;
        render();
      }
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
    state.sessions = sessions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
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

// ── Agents Tab ─────────────────────────────────────────────────
function renderAgents() {
  if (!state.agents.length) {
    return '<div class="empty"><div class="empty-icon">🦆</div><div class="empty-text">No agents configured</div></div>';
  }
  return state.agents.map(a => `
    <div class="card">
      <div class="card-header">
        <div class="card-avatar">${a.avatar ? '' : '🦆'}</div>
        <div class="card-info">
          <div class="card-name">${esc(a.label || a.id)}</div>
          <div class="card-meta">${esc(a.workingOn || a.cwd || '')}</div>
        </div>
        <span class="badge badge-${a.status || 'idle'}">${a.status || 'idle'}</span>
      </div>
      ${a.branch ? `<div class="card-meta" style="margin-top:4px">🔀 ${esc(a.branch)}</div>` : ''}
    </div>
  `).join('');
}

// ── Sessions Tab ───────────────────────────────────────────────
function renderSessions() {
  if (!state.sessions.length) {
    return '<div class="empty"><div class="empty-icon">💬</div><div class="empty-text">No sessions yet</div></div>';
  }
  return `<div class="card">${
    state.sessions.slice(0, 30).map(s => `
      <div class="session-item">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="session-title">${esc(s.title || 'Untitled')}</span>
          <span class="badge badge-${s.status === 'in_progress' ? 'running' : s.status === 'done' ? 'done' : 'idle'}">${s.status}</span>
        </div>
        <div class="session-meta">${timeAgo(s.createdAt)}${s.messageCount ? ` · ${s.messageCount} msgs` : ''}</div>
      </div>
    `).join('')
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
          ${state.agents.map(a => `<option value="${a.id}">${esc(a.label || a.id)}</option>`).join('')}
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
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Init ───────────────────────────────────────────────────────
render();
if (state.token) {
  loadData();
  connectWs();
}
