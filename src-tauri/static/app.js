// Quack Remote Dashboard — Vanilla JS SPA
// No build step, no dependencies.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ── State ──────────────────────────────────────────────────────
const state = {
  token: window.__QUACK_TOKEN__ || localStorage.getItem('quack_token') || '',
  tab: 'taskhub',
  agents: [],
  sessions: [],
  jobs: [],
  status: null,
  ws: null,
  wsConnected: false,
  wsLastConnectedAt: 0,
  loading: true,
  chatSession: null,   // session object for chat view
  chatMessages: [],    // messages in current chat
  chatLoading: false,
  chatSending: false,
  chatPollTimer: null, // polling timer for live updates
  chatTotalMessages: 0,  // total messages on server
  chatLoadingMore: false, // loading older messages
  drawer: null,        // { agentId, agentName } when execute drawer is open
  refreshing: false,   // pull-to-refresh in progress
  autoRefreshTimer: null, // stealth auto-refresh timer
  fallbackPollTimer: null, // polling fallback when WS is down >10s
  ordering: null,      // { repoOrder: { order, colors }, agentOrders }
  namedGroups: [],     // ProjectGroup[] from /api/groups
  projectColors: {},   // projectPath -> hex (loaded from /api/project-colors)
  taskHubQuery: '',    // search input value for Task Hub
  // FAB new-chat bottom-sheet: { step: 1|2|3, projectPath?, projectName?, agentId?, agentName?, prompt?, model? }
  newChat: null,
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
    state.ws.onopen = () => {
      state.wsConnected = true;
      state.wsLastConnectedAt = Date.now();
      stopFallbackPolling();
      // Catch-up on any state we may have missed during the gap
      loadData();
      render();
    };
    state.ws.onclose = () => {
      state.wsConnected = false;
      render();
      // Start polling fallback after 10s of disconnection
      setTimeout(() => {
        if (!state.wsConnected) startFallbackPolling();
      }, 10_000);
      setTimeout(connectWs, 3000);
    };
    state.ws.onmessage = (evt) => {
      try { handleWsEvent(JSON.parse(evt.data)); } catch {}
    };
  } catch {}
}

// Update a single session in-place by id. Returns true if updated.
function patchSession(sessionId, patch) {
  const idx = state.sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return false;
  state.sessions[idx] = { ...state.sessions[idx], ...patch };
  return true;
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
      patchSession(event.sessionId, { status: event.status || 'done' });
      // If watching this session, refresh messages
      if (state.chatSession && state.chatSession.id === event.sessionId) {
        pollChatMessages();
      }
      render();
      break;
    case 'session_streaming': {
      const patched = patchSession(event.sessionId, { isStreaming: !!event.isStreaming });
      if (!patched) { loadData(); return; }
      render();
      break;
    }
    case 'pending_question': {
      const patched = patchSession(event.sessionId, { pendingQuestionCount: event.count || 0 });
      if (!patched) { loadData(); return; }
      render();
      break;
    }
    case 'message_added': {
      const patched = patchSession(event.sessionId, {
        lastMessageRole: event.role,
        lastMessageStatus: event.status || null,
        lastActivityAt: event.timestamp || Date.now(),
        updatedAt: event.timestamp || Date.now(),
      });
      if (!patched) { loadData(); return; }
      // If watching this session and a new assistant message arrived, poll
      if (state.chatSession && state.chatSession.id === event.sessionId) {
        pollChatMessages();
      }
      render();
      break;
    }
    case 'session_updated': {
      const patched = patchSession(event.sessionId, {
        updatedAt: event.updatedAt || Date.now(),
        ...(event.lastMessageRole != null ? { lastMessageRole: event.lastMessageRole } : {}),
        ...(event.lastMessageStatus != null ? { lastMessageStatus: event.lastMessageStatus } : {}),
      });
      if (!patched) { loadData(); return; }
      render();
      break;
    }
    case 'job_fired':
      toast(`Job fired: ${event.jobName}`, 'success');
      break;
    case 'job_completed':
      loadData();
      break;
  }
}

// ── Polling Fallback (when WS is down) ────────────────────────
function startFallbackPolling() {
  if (state.fallbackPollTimer) return;
  console.log('[Quack Remote] WS offline — switching to polling fallback (5s)');
  state.fallbackPollTimer = setInterval(() => {
    if (state.wsConnected) { stopFallbackPolling(); return; }
    if (state.chatSession) return; // chat view already has its own poller
    loadData();
  }, 5_000);
}

function stopFallbackPolling() {
  if (state.fallbackPollTimer) {
    clearInterval(state.fallbackPollTimer);
    state.fallbackPollTimer = null;
  }
}

// ── Data Loading ───────────────────────────────────────────────
async function loadData() {
  try {
    const [statusData, agents, sessions, jobs, ordering, namedGroups, projectColors] = await Promise.all([
      api.get('/status'),
      api.get('/agents'),
      api.get('/sessions'),
      api.get('/jobs'),
      api.get('/ordering').catch(() => null),
      api.get('/groups').catch(() => []),
      api.get('/project-colors').catch(() => ({})),
    ]);
    state.status = statusData;
    state.agents = agents;
    state.sessions = sessions
      .slice()
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
      .slice(0, 100);
    state.jobs = jobs;
    state.ordering = ordering;
    state.namedGroups = namedGroups || [];
    state.projectColors = projectColors || {};
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
    if (state.chatSession || state.drawer || state.newChat || state.loading) return;
    try {
      const [statusData, agents, sessions, jobs, ordering, namedGroups, projectColors] = await Promise.all([
        api.get('/status'),
        api.get('/agents'),
        api.get('/sessions'),
        api.get('/jobs'),
        api.get('/ordering').catch(() => null),
        api.get('/groups').catch(() => []),
        api.get('/project-colors').catch(() => ({})),
      ]);
      state.status = statusData;
      state.agents = agents;
      state.sessions = sessions
        .slice()
        .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
        .slice(0, 100);
      state.jobs = jobs;
      state.ordering = ordering;
      state.namedGroups = namedGroups || [];
      state.projectColors = projectColors || {};
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
const INITIAL_MSG_LIMIT = 3;
const LOAD_MORE_LIMIT = 10;

async function openChat(session) {
  state.chatSession = session;
  state.chatMessages = [];
  state.chatLoading = true;
  state.chatTotalMessages = 0;
  state.chatLoadingMore = false;
  state.drawer = null; // close drawer if open
  render();
  try {
    // Fetch last N messages and latest session status in parallel
    const res = await fetch(`${api.base()}/sessions/${session.id}/messages?limit=${INITIAL_MSG_LIMIT}`, {
      headers: api.headers(),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const messages = await res.json();
    state.chatTotalMessages = parseInt(res.headers.get('x-total-count') || '0', 10);

    const sessionInfo = await api.get(`/sessions/${session.id}`).catch(() => null);
    state.chatMessages = messages;
    if (sessionInfo && sessionInfo.status) {
      state.chatSession.status = sessionInfo.status;
    }
    state.chatLoading = false;
  } catch (err) {
    state.chatLoading = false;
    toast(`Failed to load chat: ${err.message}`, 'error');
  }
  render();
  scrollChatToBottom();
  startChatPolling();
}

async function loadMoreMessages() {
  if (state.chatLoadingMore || !state.chatSession) return;
  // Already have all messages
  if (state.chatMessages.length >= state.chatTotalMessages) return;

  state.chatLoadingMore = true;
  render();

  const container = $('#chat-messages');
  const prevHeight = container ? container.scrollHeight : 0;

  try {
    const offset = state.chatMessages.filter(m => !m._optimistic).length;
    const res = await fetch(
      `${api.base()}/sessions/${state.chatSession.id}/messages?limit=${LOAD_MORE_LIMIT}&offset=${offset}`,
      { headers: api.headers() }
    );
    if (!res.ok) throw new Error(`${res.status}`);
    const olderMessages = await res.json();
    state.chatTotalMessages = parseInt(res.headers.get('x-total-count') || '0', 10);

    // Prepend older messages
    state.chatMessages = [...olderMessages, ...state.chatMessages];
  } catch (e) {
    toast('Failed to load older messages', 'error');
  }

  state.chatLoadingMore = false;
  render();

  // Maintain scroll position after prepending
  if (container) {
    requestAnimationFrame(() => {
      const newContainer = $('#chat-messages');
      if (newContainer) {
        newContainer.scrollTop = newContainer.scrollHeight - prevHeight;
      }
    });
  }
}

async function pollChatMessages() {
  if (!state.chatSession) return;
  try {
    // Only fetch the tail — enough to detect new messages
    const pollLimit = Math.max(INITIAL_MSG_LIMIT, 5);
    const [res, sessionInfo, agents] = await Promise.all([
      fetch(`${api.base()}/sessions/${state.chatSession.id}/messages?limit=${pollLimit}`, {
        headers: api.headers(),
      }),
      api.get(`/sessions/${state.chatSession.id}`).catch(() => null),
      api.get('/agents').catch(() => null),
    ]);
    // Keep agent status fresh while in chat view (auto-refresh skips chat)
    if (agents) state.agents = agents;
    if (!res.ok) return;
    const tailMessages = await res.json();
    const serverTotal = parseInt(res.headers.get('x-total-count') || '0', 10);

    const hadCount = state.chatMessages.length;
    const lastContent = state.chatMessages[hadCount - 1]?.content || '';
    const wasActive = isSessionActive(state.chatSession);
    const wasAgentBusy = isAgentBusy(state.chatSession.agentId);
    const prevTotal = state.chatTotalMessages;

    // How many new messages appeared on server since our last fetch
    const newCount = serverTotal - prevTotal;
    state.chatTotalMessages = serverTotal;

    if (newCount > 0 && tailMessages.length > 0) {
      // Append only the genuinely new messages at the end
      const newMessages = tailMessages.slice(-newCount);
      // Remove optimistic messages that are now on server
      const nonOptimistic = state.chatMessages.filter(m => {
        if (!m._optimistic) return true;
        return !newMessages.some(n => n.role === 'user' && n.content === m.content);
      });
      state.chatMessages = [...nonOptimistic, ...newMessages];
    } else {
      // No new messages — update last message content if streaming changed it
      const serverLast = tailMessages[tailMessages.length - 1];
      const localLast = state.chatMessages[state.chatMessages.length - 1];
      if (serverLast && localLast && !localLast._optimistic &&
          serverLast.content !== localLast.content) {
        localLast.content = serverLast.content;
      }
    }

    // Preserve optimistic messages if server hasn't caught up
    const optimistic = state.chatMessages.filter(m => m._optimistic);
    if (optimistic.length && serverTotal <= prevTotal) {
      // Server hasn't processed our message yet — keep optimistic
    }

    if (sessionInfo && sessionInfo.status) {
      state.chatSession.status = sessionInfo.status;
    }

    const nowActive = isSessionActive(state.chatSession);
    const nowAgentBusy = isAgentBusy(state.chatSession.agentId);
    const currentCount = state.chatMessages.length;
    const newLastContent = state.chatMessages[currentCount - 1]?.content || '';

    if (currentCount !== hadCount || newLastContent !== lastContent || wasActive !== nowActive || wasAgentBusy !== nowAgentBusy) {
      render();
      scrollChatToBottom();
      // Notify when a new assistant message arrives
      if (newCount > 0) {
        const lastNew = state.chatMessages[state.chatMessages.length - 1];
        if (lastNew && lastNew.role === 'assistant') {
          notifyNewMessage(lastNew.content || 'Agent replied');
        }
      }
    }
  } catch (e) {
    // Silently retry — session may not exist in storage yet
  }
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
  if (!input || !input.textContent.trim() || state.chatSending) return;
  const message = input.textContent.trim();
  input.textContent = '';
  state.chatSending = true;

  // Optimistic: add to UI immediately (flagged so polling preserves it)
  state.chatMessages.push({ role: 'user', content: message, _optimistic: true });
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

  const { agentId, agentName } = state.drawer;
  const model = $('#drawer-model')?.value || '';
  const sendBtn = $('#drawer-send');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const body = { agentId, prompt };
    if (model) body.model = model;
    const res = await api.post('/execute', body);
    if (res.success && res.sessionId) {
      // Open chat immediately with a virtual session (don't wait for loadData)
      const virtualSession = {
        id: res.sessionId,
        title: prompt.slice(0, 60) + (prompt.length > 60 ? '...' : ''),
        agentId,
        status: 'in_progress',
        createdAt: Date.now(),
      };
      state.drawer = null;
      state.chatSession = virtualSession;
      state.chatMessages = [{ role: 'user', content: prompt, _optimistic: true }];
      state.chatLoading = false;
      render();
      scrollChatToBottom();
      startChatPolling();
      // Background: reload sessions so list stays in sync
      loadData();
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
    ${notifBannerType() ? renderNotifBanner(notifBannerType()) : ''}
    ${renderStats()}
    ${renderTabs()}
    ${renderContent()}
    ${renderFab()}
    ${state.drawer ? renderDrawer() : ''}
    ${state.newChat ? renderNewChatSheet() : ''}
  `;
  bindEvents();
}

function renderFab() {
  // Hide FAB while bottom-sheets are open
  if (state.drawer || state.newChat) return '';
  return `<button id="fab-new" class="fab-new" title="New conversation">+</button>`;
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

function renderNotifBanner(type) {
  if (type === 'install') {
    return `
      <div class="notif-banner" id="notif-banner">
        <span>Add to Home Screen to receive push notifications when agents reply</span>
        <div class="notif-banner-actions">
          <button id="notif-dismiss" class="btn btn-secondary btn-sm">OK</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="notif-banner" id="notif-banner">
      <span>Enable notifications to get alerts when agents reply</span>
      <div class="notif-banner-actions">
        <button id="notif-enable" class="btn btn-primary btn-sm">Enable</button>
        <button id="notif-dismiss" class="btn btn-secondary btn-sm">Later</button>
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
  const badge = computeTaskHubBadge();
  const tabs = [
    { id: 'taskhub', label: 'Task Hub', badge },
    { id: 'agents', label: 'Agents' },
    { id: 'jobs', label: 'Jobs' },
  ];
  return `
    <div class="tab-nav">
      ${tabs.map(t => `
        <button class="tab-btn ${state.tab === t.id ? 'active' : ''}" data-tab="${t.id}">
          ${t.label}${t.badge ? `<span class="tab-badge">${t.badge}</span>` : ''}
        </button>
      `).join('')}
    </div>
  `;
}

function renderContent() {
  switch (state.tab) {
    case 'taskhub': return renderTaskHub();
    case 'agents': return renderAgents();
    case 'jobs': return renderJobs();
    default: return '';
  }
}

// ── Ordering Helpers ───────────────────────────────────────────
function getRepoKey(agent) {
  if (!agent.projectPath) return null;
  const parts = agent.projectPath.split('/').filter(Boolean);
  return `repo-${parts[parts.length - 1] || ''}`;
}

function sortRepositoryGroups(entries) {
  if (!state.ordering?.repoOrder?.order?.length) return entries;
  const order = state.ordering.repoOrder.order;
  const orderMap = new Map(order.map((key, i) => [key, i]));
  return [...entries].sort(([, aAgents], [, bAgents]) => {
    const aKey = getRepoKey(aAgents[0]);
    const bKey = getRepoKey(bAgents[0]);
    const aIdx = aKey != null ? (orderMap.get(aKey) ?? 9999) : 9999;
    const bIdx = bKey != null ? (orderMap.get(bKey) ?? 9999) : 9999;
    return aIdx - bIdx;
  });
}

function sortAgentsInRepo(agents) {
  if (!agents.length) return agents;
  const repoPath = agents[0]?.projectPath;
  if (!repoPath || !state.ordering?.agentOrders) {
    return [...agents].sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
  }
  const orderData = state.ordering.agentOrders[repoPath];
  if (!orderData) {
    return [...agents].sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
  }
  // Find the first matching branch key, fallback to any key
  const branchKey = agents[0]?.branch ? `${agents[0].branch}-main` : 'main-main';
  const savedOrder = orderData[branchKey] || Object.values(orderData)[0];
  if (!savedOrder?.length) {
    return [...agents].sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
  }
  const orderMap = new Map(savedOrder.map((id, i) => [id, i]));
  return [...agents].sort((a, b) => {
    const aIdx = orderMap.has(a.id) ? orderMap.get(a.id) : 9999;
    const bIdx = orderMap.has(b.id) ? orderMap.get(b.id) : 9999;
    return aIdx - bIdx;
  });
}

// Brain: gotcha-mobile-session-dot-status
// Single source of truth for agent busy state — used by list AND chat view
function isAgentBusy(agentId) {
  const agent = state.agents.find(a => a.id === agentId);
  return agent && (agent.status === 'busy' || agent.status === 'running');
}

// Mirror Mac dot colors: yellow=agent busy, green=agent idle/ready
function getSessionDotClass(agentStatus, isNewest) {
  const agentBusy = agentStatus === 'running' || agentStatus === 'busy';
  if (agentBusy && isNewest) return 'working';
  return 'ready';
}

// ── Agents Tab — Grouped by Project with Active Sessions ──────
function renderAgents() {
  if (!state.agents.length) {
    return '<div class="empty"><div class="empty-icon">🦆</div><div class="empty-text">No agents configured</div></div>';
  }

  // 1. Group agents by projectName
  const groups = {};
  state.agents.forEach(a => {
    const project = a.projectName || 'Unassigned';
    if (!groups[project]) groups[project] = [];
    groups[project].push(a);
  });

  // 2. Sort repo groups by saved order (or fallback to lastActiveAt)
  let sortedEntries = sortRepositoryGroups(Object.entries(groups));

  // 3. Sort agents within each repo
  sortedEntries = sortedEntries.map(([key, agents]) => [key, sortAgentsInRepo(agents)]);

  // 4. Build sections: named groups + standalone repos
  const sections = [];
  const usedKeys = new Set();

  if (state.namedGroups.length > 0) {
    // Map repoKey → entry for quick lookup
    const entryByKey = new Map();
    sortedEntries.forEach(([key, agents]) => {
      const rk = getRepoKey(agents[0]);
      if (rk) entryByKey.set(rk, [key, agents]);
    });

    // For each named group, find the position of its first member in the sorted order
    const groupPositions = state.namedGroups.map(ng => {
      const memberPaths = ng.projects.map(p => p.path);
      const matchedEntries = [];
      let minIdx = 9999;
      sortedEntries.forEach(([key, agents], idx) => {
        if (agents.some(a => memberPaths.includes(a.projectPath))) {
          matchedEntries.push([key, agents]);
          if (idx < minIdx) minIdx = idx;
        }
      });
      return { group: ng, entries: matchedEntries, position: minIdx };
    }).filter(g => g.entries.length > 0).sort((a, b) => a.position - b.position);

    // Insert named groups at their positions, mark repos as used
    let sIdx = 0;
    const gpQueue = [...groupPositions];
    sortedEntries.forEach(([key, agents], idx) => {
      // Emit any named groups whose position matches this index
      while (gpQueue.length > 0 && gpQueue[0].position <= idx) {
        const gp = gpQueue.shift();
        gp.entries.forEach(([k]) => usedKeys.add(k));
        sections.push({ type: 'named', group: gp.group, entries: gp.entries });
      }
      if (!usedKeys.has(key)) {
        sections.push({ type: 'repo', key, agents });
      }
    });
    // Emit any remaining named groups
    while (gpQueue.length > 0) {
      const gp = gpQueue.shift();
      gp.entries.forEach(([k]) => usedKeys.add(k));
      sections.push({ type: 'named', group: gp.group, entries: gp.entries });
    }
  } else {
    sortedEntries.forEach(([key, agents]) => {
      sections.push({ type: 'repo', key, agents });
    });
  }

  // 5. Render
  return sections.map(section => {
    if (section.type === 'named') {
      const totalAgents = section.entries.reduce((sum, [, a]) => sum + a.length, 0);
      return `
        <div class="project-group">
          <div class="project-header">
            <span class="project-name">${esc(section.group.name)}</span>
            <span class="project-count">${totalAgents}</span>
          </div>
          ${section.entries.map(([, agents]) =>
            agents.map(a => renderAgentWithSessions(a)).join('')
          ).join('')}
        </div>`;
    }
    return `
      <div class="project-group">
        <div class="project-header">
          <span class="project-name">${esc(section.agents[0]?.projectName || section.key)}</span>
          <span class="project-count">${section.agents.length}</span>
        </div>
        ${section.agents.map(a => renderAgentWithSessions(a)).join('')}
      </div>`;
  }).join('');
}

function renderAgentWithSessions(a) {
  const activeSessions = state.sessions.filter(
    s => s.agentId === a.id && s.status !== 'done'
  );

  const avatarHtml = a.avatar
    ? `<img class="agent-avatar" src="${api.avatarUrl(a.avatar)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      + `<div class="agent-avatar agent-avatar-fallback" style="display:none;background:${a.color || 'var(--accent)'}">🦆</div>`
    : `<div class="agent-avatar agent-avatar-fallback" style="background:${a.color || 'var(--accent)'}">🦆</div>`;

  const statusClass = (a.status === 'running' || a.status === 'busy') ? 'busy' : a.status === 'error' ? 'error' : 'idle';

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
          ${activeSessions.map((s, i) => `
            <div class="agent-session-item" data-open-chat="${s.id}">
              <span class="session-dot ${getSessionDotClass(a.status, i === 0)}"></span>
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
        <select id="drawer-model" class="select">
          <option value="" selected>Default (agent preset)</option>
          <option value="opus">Opus</option>
          <option value="sonnet">Sonnet</option>
          <option value="haiku">Haiku</option>
        </select>
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
        <div class="chat-back" id="back-btn">←</div>
        <div class="chat-header-info">
          <div class="chat-header-title">${esc(s.title || 'Untitled')}</div>
          <div class="chat-header-agent">${esc(agentName)}</div>
        </div>
        <div class="chat-header-live">
          <span class="session-dot ${getSessionDotClass(agent?.status, true)}"></span>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages">
        ${state.chatLoading
          ? '<div class="loading-center"><div class="spinner"></div></div>'
          : state.chatMessages.length
            ? (() => {
                const hasMore = state.chatMessages.filter(m => !m._optimistic).length < state.chatTotalMessages;
                const loadMoreHtml = hasMore
                  ? `<div class="load-more" id="load-more">${state.chatLoadingMore
                      ? '<div class="spinner" style="margin:0 auto"></div>'
                      : '<span>Load older messages</span>'}</div>`
                  : '';
                const lastMsg = state.chatMessages[state.chatMessages.length - 1];
                const showTyping = isAgentBusy(s.agentId) && (!lastMsg || lastMsg.role === 'user');
                return loadMoreHtml + state.chatMessages.map(m => {
                  if (m.role === 'tool') {
                    return `<div class="tool-uses">${m.content.split('\n').map(t =>
                      `<span class="tool-pill">${esc(t)}</span>`
                    ).join('')}</div>`;
                  }
                  return `<div class="chat-bubble ${m.role}">
                    <div class="chat-bubble-content">${formatMessage(m.content)}</div>
                  </div>`;
                }).join('') + (showTyping ? renderTypingIndicator() : '');
              })()
            : '<div class="empty-inline">Waiting for agent response...</div>'
        }
      </div>
      ${isAgentBusy(s.agentId) ? '' : `<div class="chat-input-bar">
        <div id="chat-input" class="chat-input" contenteditable="${state.chatSending ? 'false' : 'true'}"
          enterkeyhint="send" data-placeholder="Type a message..."></div>
        <div id="chat-send" class="btn btn-primary btn-send"
          style="${state.chatSending ? 'opacity:0.4;pointer-events:none' : 'cursor:pointer'}">
          ${state.chatSending ? '...' : '→'}
        </div>
      </div>`}
    </div>
  `;
}

function formatMessage(content) {
  if (!content) return '';
  let html = esc(content);
  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic (single * not preceded/followed by *)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  // Headers (## → h3, # → h2)
  html = html.replace(/^### (.+)$/gm, '<strong style="font-size:14px">$1</strong>');
  html = html.replace(/^## (.+)$/gm, '<strong style="font-size:15px">$1</strong>');
  html = html.replace(/^# (.+)$/gm, '<strong style="font-size:16px">$1</strong>');
  // Bullet lists
  html = html.replace(/^[-*] (.+)$/gm, '<span class="md-bullet">$1</span>');
  // Newlines (but not inside <pre>)
  html = html.replace(/\n/g, '<br>');
  // Clean up <br> inside <pre>
  html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_, code) =>
    `<pre><code>${code.replace(/<br>/g, '\n')}</code></pre>`
  );
  return html;
}

function isSessionActive(session) {
  if (!session) return false;
  const status = session.status || '';
  return status === 'in_progress' || status === 'running' || status === '';
}

function renderTypingIndicator() {
  return `
    <div class="chat-bubble assistant typing-indicator">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
}

// ── Task Hub Tab (mirrors desktop TaskHubView) ────────────────
// Brain: pattern-remote-api-architecture
// Mirrors src/components/TaskHubView.tsx priority logic for the mobile PWA.

const TASKHUB_SECTION_LABELS = {
  1: 'Needs attention',
  2: 'Working',
  3: 'Agent done',
  4: 'Other',
};
const TASKHUB_PRIORITY_COLOR = {
  1: '#a855f7', // purple
  2: '#22c55e', // green
  3: '#f59e0b', // orange
  4: null,
};

// Brain: gotcha-mobile-session-dot-status
// session.status === 'in_progress' is a disk flag, NOT real-time activity.
// Without live-state (isStreaming) AND without a busy agent, treat as P4 (Other),
// otherwise every never-closed session sticks in Working forever.
function computePriority(s, agentStatus) {
  if ((s.pendingQuestionCount ?? 0) > 0) return 1;
  const agentBusy = agentStatus === 'busy' || agentStatus === 'running';
  const liveStreaming = s.isStreaming || s.lastMessageStatus === 'streaming';
  if (liveStreaming || agentBusy) return 2;
  if (
    s.lastMessageRole === 'assistant' &&
    (s.lastMessageStatus === 'complete' || s.lastMessageStatus == null)
  ) {
    return 3;
  }
  return 4;
}

function computeTaskHubBadge() {
  return state.sessions.reduce((n, s) => {
    if (s.status === 'done') return n;
    const agent = state.agents.find(a => a.id === s.agentId);
    const p = computePriority(s, agent?.status);
    return p === 1 || p === 3 ? n + 1 : n;
  }, 0);
}

function getProjectColor(projectPath) {
  if (!projectPath) return null;
  return state.projectColors[projectPath] || null;
}

function getProjectColorFromSession(s) {
  return s.projectColor || getProjectColor(s.projectPath) || null;
}

function renderTaskHub() {
  const query = (state.taskHubQuery || '').trim().toLowerCase();

  const filtered = state.sessions.filter(s => {
    if (s.status === 'done') return false;
    if (!query) return true;
    const agent = state.agents.find(a => a.id === s.agentId);
    const haystack = `${s.title || ''} ${s.projectName || ''} ${agent?.name || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  // Group by priority, sort by updatedAt desc within group
  const groups = { 1: [], 2: [], 3: [], 4: [] };
  filtered.forEach(s => {
    const agent = state.agents.find(a => a.id === s.agentId);
    groups[computePriority(s, agent?.status)].push(s);
  });
  Object.keys(groups).forEach(k => {
    groups[k].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  });

  const search = `
    <div class="taskhub-search-wrap">
      <input id="taskhub-search" class="taskhub-search" type="search"
        placeholder="Search tasks" value="${esc(state.taskHubQuery || '')}" />
    </div>
  `;

  if (filtered.length === 0) {
    return search + '<div class="empty"><div class="empty-icon">✨</div><div class="empty-text">No active sessions. Tap + to start one.</div></div>';
  }

  const sections = [1, 2, 3, 4]
    .filter(p => groups[p].length > 0)
    .map(p => renderTaskHubSection(p, groups[p]))
    .join('');

  return `<div class="taskhub">${search}${sections}</div>`;
}

function renderTaskHubSection(priority, sessions) {
  return `
    <div class="taskhub-section">
      <div class="taskhub-section-header">
        <span class="taskhub-section-label">${TASKHUB_SECTION_LABELS[priority]}</span>
        <span class="taskhub-section-count">${sessions.length}</span>
      </div>
      <div class="taskhub-list">
        ${sessions.map((s, i) => renderTaskHubItem(s, priority, i, sessions.length)).join('')}
      </div>
    </div>
  `;
}

function renderTaskHubItem(s, priority, idx, total) {
  const accent = TASKHUB_PRIORITY_COLOR[priority];
  const accentStyle = accent ? `border-left-color:${accent}` : 'border-left-color:transparent';
  const opacity = priority === 4
    ? (total === 1 ? 0.7 : Math.max(0.4, 0.75 - (idx / Math.max(total, 1)) * 0.35))
    : 1;
  const agent = state.agents.find(a => a.id === s.agentId);
  const dotClass = getSessionDotClass(agent?.status, idx === 0);

  const projectColor = getProjectColorFromSession(s);
  const projectChip = state.sessions.length > 1 && s.projectName && projectColor
    ? `<span class="project-chip" style="--proj:${projectColor}">${esc(s.projectName.toLowerCase())}</span>`
    : '';

  const avatarHtml = agent?.avatar
    ? `<img class="taskhub-avatar" src="${api.avatarUrl(agent.avatar)}" alt="" onerror="this.style.display='none'">`
    : `<div class="taskhub-avatar taskhub-avatar-fallback" style="background:${agent?.color || 'var(--accent)'}">🦆</div>`;

  return `
    <div class="taskhub-item" data-open-chat="${s.id}" style="${accentStyle};opacity:${opacity}">
      <span class="session-dot ${dotClass}"></span>
      ${projectChip}
      <span class="taskhub-title">${esc(s.title || 'Untitled')}</span>
      ${avatarHtml}
      <span class="taskhub-time">${timeAgo(s.updatedAt || s.createdAt)}</span>
    </div>
  `;
}

// ── New-chat Bottom Sheet (FAB '+' → 3 steps) ─────────────────
function renderNewChatSheet() {
  const nc = state.newChat;
  return `
    <div class="drawer-overlay" id="new-chat-overlay"></div>
    <div class="drawer new-chat-sheet">
      <div class="drawer-handle"></div>
      <div class="drawer-header">
        <span class="drawer-title">${nc.step === 1 ? 'Choose project' : nc.step === 2 ? 'Choose agent' : 'New conversation'}</span>
        ${nc.step > 1
          ? `<button class="btn-link" id="nc-back">← Back</button>`
          : `<button class="btn-link" id="nc-close">Cancel</button>`}
      </div>
      <div class="drawer-body">
        ${renderNewChatStep(nc)}
      </div>
    </div>
  `;
}

function uniqueProjects() {
  const map = new Map();
  state.agents.forEach(a => {
    if (!a.projectPath || !a.projectName) return;
    if (!map.has(a.projectPath)) map.set(a.projectPath, a.projectName);
  });
  return [...map.entries()].map(([projectPath, projectName]) => ({ projectPath, projectName }));
}

function renderNewChatStep(nc) {
  if (nc.step === 1) {
    const projects = uniqueProjects();
    if (!projects.length) {
      return '<div class="empty-inline">No projects available. Open a project in Quack desktop first.</div>';
    }
    return `
      <div class="nc-list">
        ${projects.map(p => {
          const color = getProjectColor(p.projectPath) || 'var(--accent)';
          return `
            <button class="nc-row" data-nc-project="${esc(p.projectPath)}" data-nc-project-name="${esc(p.projectName)}">
              <span class="nc-color-dot" style="background:${color}"></span>
              <span class="nc-row-label">${esc(p.projectName)}</span>
              <span class="nc-row-meta">${
                state.agents.filter(a => a.projectPath === p.projectPath).length
              } agents</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  if (nc.step === 2) {
    const agents = state.agents.filter(a => a.projectPath === nc.projectPath);
    if (!agents.length) {
      return '<div class="empty-inline">No agents in this project.</div>';
    }
    return `
      <div class="nc-list">
        ${agents.map(a => `
          <button class="nc-row" data-nc-agent="${esc(a.id)}" data-nc-agent-name="${esc(a.name || 'Agent')}">
            ${a.avatar
              ? `<img class="nc-avatar" src="${api.avatarUrl(a.avatar)}" alt="" onerror="this.style.display='none'">`
              : `<span class="nc-avatar" style="background:${a.color || 'var(--accent)'};display:inline-flex;align-items:center;justify-content:center">🦆</span>`}
            <span class="nc-row-label">${esc(a.name || 'Agent')}</span>
            <span class="nc-row-meta">${esc(a.role || '')}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  // Step 3: prompt
  return `
    <div class="nc-summary">
      <span class="nc-pill">${esc(nc.projectName)}</span>
      <span class="nc-arrow">›</span>
      <span class="nc-pill">${esc(nc.agentName)}</span>
    </div>
    <select id="nc-model" class="select">
      <option value="" selected>Default (agent preset)</option>
      <option value="opus">Opus</option>
      <option value="sonnet">Sonnet</option>
      <option value="haiku">Haiku</option>
    </select>
    <textarea id="nc-prompt" class="textarea" placeholder="What should the agent do?" rows="4" autofocus>${esc(nc.prompt || '')}</textarea>
    <button id="nc-send" class="btn btn-primary btn-block">Start conversation</button>
  `;
}

async function startNewChat() {
  const nc = state.newChat;
  if (!nc) return;
  const prompt = $('#nc-prompt')?.value?.trim();
  if (!prompt) { toast('Please enter a prompt', 'error'); return; }
  const model = $('#nc-model')?.value || '';
  const sendBtn = $('#nc-send');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const body = { agentId: nc.agentId, prompt };
    if (model) body.model = model;
    if (nc.projectPath) body.projectPath = nc.projectPath;
    const res = await api.post('/execute', body);
    if (res.success && res.sessionId) {
      const virtualSession = {
        id: res.sessionId,
        title: prompt.slice(0, 60) + (prompt.length > 60 ? '...' : ''),
        agentId: nc.agentId,
        status: 'in_progress',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        projectName: nc.projectName,
        projectPath: nc.projectPath,
      };
      state.newChat = null;
      state.chatSession = virtualSession;
      state.chatMessages = [{ role: 'user', content: prompt, _optimistic: true }];
      state.chatLoading = false;
      render();
      scrollChatToBottom();
      startChatPolling();
      loadData();
    } else {
      toast(res.error || 'Failed to start conversation', 'error');
      if (sendBtn) sendBtn.disabled = false;
    }
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
    if (sendBtn) sendBtn.disabled = false;
  }
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

  // Notification banner
  const notifEnable = $('#notif-enable');
  if (notifEnable) notifEnable.onclick = handleEnableNotifications;
  const notifDismiss = $('#notif-dismiss');
  if (notifDismiss) notifDismiss.onclick = dismissNotifBanner;

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

  // Load more messages (tap or scroll to top)
  const loadMore = $('#load-more');
  if (loadMore) loadMore.onclick = loadMoreMessages;
  const chatContainer = $('#chat-messages');
  if (chatContainer) {
    chatContainer.onscroll = () => {
      if (chatContainer.scrollTop < 40 && !state.chatLoadingMore) {
        loadMoreMessages();
      }
    };
  }

  // Chat send
  const chatSend = $('#chat-send');
  if (chatSend) {
    chatSend.onclick = sendMessage;
    const chatInput = $('#chat-input');
    if (chatInput) {
      chatInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      };
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

  // Task Hub search
  const taskhubSearch = $('#taskhub-search');
  if (taskhubSearch) {
    taskhubSearch.oninput = (e) => {
      state.taskHubQuery = e.target.value;
      // Partial re-render: only the task hub content (avoid losing input focus)
      const container = $('.taskhub');
      if (container) {
        const newHtml = renderTaskHub();
        container.outerHTML = newHtml;
        // Re-bind after replace
        bindEvents();
        const newInput = $('#taskhub-search');
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(state.taskHubQuery.length, state.taskHubQuery.length);
        }
      }
    };
  }

  // FAB "+" — open new-chat sheet (step 1)
  const fab = $('#fab-new');
  if (fab) {
    fab.onclick = () => {
      state.newChat = { step: 1 };
      render();
    };
  }

  // New-chat sheet: overlay close
  const ncOverlay = $('#new-chat-overlay');
  if (ncOverlay) {
    ncOverlay.onclick = () => { state.newChat = null; render(); };
  }
  const ncClose = $('#nc-close');
  if (ncClose) ncClose.onclick = () => { state.newChat = null; render(); };
  const ncBack = $('#nc-back');
  if (ncBack) {
    ncBack.onclick = () => {
      if (state.newChat && state.newChat.step > 1) {
        state.newChat = { ...state.newChat, step: state.newChat.step - 1 };
        render();
      }
    };
  }
  // Step 1 → 2: choose project
  $$('[data-nc-project]').forEach(btn => {
    btn.onclick = () => {
      state.newChat = {
        ...state.newChat,
        projectPath: btn.dataset.ncProject,
        projectName: btn.dataset.ncProjectName,
        step: 2,
      };
      render();
    };
  });
  // Step 2 → 3: choose agent
  $$('[data-nc-agent]').forEach(btn => {
    btn.onclick = () => {
      state.newChat = {
        ...state.newChat,
        agentId: btn.dataset.ncAgent,
        agentName: btn.dataset.ncAgentName,
        step: 3,
      };
      render();
      requestAnimationFrame(() => {
        const ta = $('#nc-prompt');
        if (ta) ta.focus();
      });
    };
  });
  // Step 3: submit
  const ncSend = $('#nc-send');
  if (ncSend) {
    ncSend.onclick = startNewChat;
    const ncPrompt = $('#nc-prompt');
    if (ncPrompt) {
      ncPrompt.onkeydown = (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) startNewChat();
      };
    }
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

// ── Service Worker & Notifications ────────────────────────────
let swRegistration = null;

async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register('/dashboard/sw.js');
    console.log('[SW] Registered');
  } catch (e) {
    console.warn('[SW] Registration failed:', e);
  }
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

// Returns: 'install' | 'enable' | false
function notifBannerType() {
  if (localStorage.getItem('quack_notif_dismissed')) return false;
  // Not installed as PWA → show install prompt
  if (!isStandalone()) return 'install';
  // Installed but Notification API not available (old iOS)
  if (!('Notification' in window)) return false;
  // Already granted or denied
  if (Notification.permission !== 'default') return false;
  return 'enable';
}

async function handleEnableNotifications() {
  const result = await Notification.requestPermission();
  console.log('[Notifications] Permission:', result);
  localStorage.setItem('quack_notif_dismissed', '1');
  render();
}

function dismissNotifBanner() {
  localStorage.setItem('quack_notif_dismissed', '1');
  render();
}

function notifyNewMessage(text) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const body = text.length > 120 ? text.slice(0, 117) + '...' : text;
  // Use SW for iOS PWA support, fallback to Notification API
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'NOTIFY', title: 'Quack Agent', body });
  } else {
    new Notification('Quack Agent', { body, icon: '/dashboard/icon-192.png', tag: 'quack-reply' });
  }
}

// ── Init ───────────────────────────────────────────────────────
render();
if (state.token) {
  loadData();
  connectWs();
  initPullToRefresh();
  startAutoRefresh();
  initServiceWorker();
}
