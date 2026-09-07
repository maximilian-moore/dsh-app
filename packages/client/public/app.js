// DSH Remote PWA Client Script
(function () {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/mobile/sw.js', { scope: '/mobile/' })
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // State
  const state = {
    activeSessionId: null,
    sessions: [],
    models: [],
    workspaces: [],
    selectedModel: 'deepseek-v4-flash',
    selectedWorkspace: ''
  };

  // DOM Elements
  const btnToggle = document.getElementById('btn-toggle-sessions');
  const btnClose = document.getElementById('btn-close-drawer');
  const btnNewSession = document.getElementById('btn-new-session');
  const drawer = document.getElementById('sessions-drawer');
  const sessionsList = document.getElementById('sessions-list');
  const sessionTitle = document.getElementById('session-title');
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');

  // Selectors
  const modelSelect = document.getElementById('model-select');
  const currentModelLabel = document.getElementById('current-model-label');
  const workspaceSelect = document.getElementById('workspace-select');
  const currentWorkspaceLabel = document.getElementById('current-workspace-label');

  // Input
  const promptInput = document.getElementById('prompt-input');
  const btnSend = document.getElementById('btn-send');

  // Drawer Controls
  btnToggle.addEventListener('click', () => {
    drawer.classList.remove('hidden');
    loadSessions(); // refresh list on open
  });

  btnClose.addEventListener('click', () => {
    drawer.classList.add('hidden');
  });

  btnNewSession.addEventListener('click', () => {
    state.activeSessionId = null;
    sessionTitle.textContent = 'New Session';
    document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
    drawer.classList.add('hidden');
    promptInput.focus();
  });

  // Format relative timestamp
  function formatTimestamp(ts) {
    if (!ts) return '';
    const now = Date.now();
    const diffMs = now - ts;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Health check & Connection indicator
  async function checkHealth() {
    try {
      const res = await fetch('/mobile/api/health');
      if (res.ok) {
        statusBadge.className = 'status-indicator online';
        statusText.textContent = 'Ready';
      } else {
        statusBadge.className = 'status-indicator offline';
        statusText.textContent = 'Error';
      }
    } catch {
      statusBadge.className = 'status-indicator offline';
      statusText.textContent = 'Offline';
    }
  }

  // Load Models
  async function loadModels() {
    try {
      const res = await fetch('/mobile/api/models');
      if (!res.ok) return;
      const data = await res.json();
      state.models = data.models || [];
      state.selectedModel = data.defaultModel || 'deepseek-v4-flash';

      modelSelect.innerHTML = '';
      state.models.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.name || m.id} (${m.provider})`;
        if (m.id === state.selectedModel) {
          opt.selected = true;
        }
        modelSelect.appendChild(opt);
      });

      updateModelLabel(state.selectedModel);
    } catch (err) {
      console.warn('[PWA] Failed to load models:', err);
    }
  }

  function updateModelLabel(modelId) {
    const found = state.models.find((m) => m.id === modelId);
    currentModelLabel.textContent = found ? (found.name || found.id) : modelId;
  }

  modelSelect.addEventListener('change', (e) => {
    state.selectedModel = e.target.value;
    updateModelLabel(state.selectedModel);
  });

  // Load Workspaces
  async function loadWorkspaces() {
    try {
      const res = await fetch('/mobile/api/workspaces');
      if (!res.ok) return;
      const data = await res.json();
      state.workspaces = data.workspaces || [];
      state.selectedWorkspace = data.current || '';

      workspaceSelect.innerHTML = '';
      state.workspaces.forEach((ws) => {
        const opt = document.createElement('option');
        opt.value = ws.path;
        opt.textContent = ws.name;
        if (ws.path === state.selectedWorkspace || ws.isCurrent) {
          opt.selected = true;
          state.selectedWorkspace = ws.path;
        }
        workspaceSelect.appendChild(opt);
      });

      updateWorkspaceLabel(state.selectedWorkspace);
    } catch (err) {
      console.warn('[PWA] Failed to load workspaces:', err);
    }
  }

  function updateWorkspaceLabel(wsPath) {
    const found = state.workspaces.find((w) => w.path === wsPath);
    currentWorkspaceLabel.textContent = found ? found.name : 'Workspace';
  }

  workspaceSelect.addEventListener('change', (e) => {
    state.selectedWorkspace = e.target.value;
    updateWorkspaceLabel(state.selectedWorkspace);
  });

  // Load Sessions
  async function loadSessions() {
    try {
      const res = await fetch('/mobile/api/sessions');
      if (!res.ok) {
        sessionsList.innerHTML = '<div class="loading-placeholder">Failed to load sessions</div>';
        return;
      }
      const data = await res.json();
      state.sessions = data.sessions || [];

      if (state.sessions.length === 0) {
        sessionsList.innerHTML = '<div class="loading-placeholder">No sessions found</div>';
        return;
      }

      sessionsList.innerHTML = '';
      state.sessions.forEach((s) => {
        const item = document.createElement('div');
        item.className = 'session-item' + (s.id === state.activeSessionId ? ' active' : '');
        item.dataset.id = s.id;

        const timeStr = formatTimestamp(s.updatedAt || s.createdAt);
        const wsTag = s.workspaceName ? `<span class="session-workspace-tag">${s.workspaceName}</span>` : '';

        item.innerHTML = `
          <div class="session-item-header">
            ${wsTag}
            <span class="session-time">${timeStr}</span>
          </div>
          <div class="session-item-title">${s.title}</div>
        `;

        item.addEventListener('click', () => {
          selectSession(s);
          drawer.classList.add('hidden');
        });

        sessionsList.appendChild(item);
      });
    } catch (err) {
      console.warn('[PWA] Failed to load sessions:', err);
      sessionsList.innerHTML = '<div class="loading-placeholder">Error loading sessions</div>';
    }
  }

  function selectSession(session) {
    state.activeSessionId = session.id;
    sessionTitle.textContent = session.title;
    document.querySelectorAll('.session-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.id === session.id);
    });

    if (session.cwd) {
      state.selectedWorkspace = session.cwd;
      workspaceSelect.value = session.cwd;
      updateWorkspaceLabel(session.cwd);
    }
  }

  // Auto-resize prompt textarea
  promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
  });

  // Initialize
  checkHealth();
  loadModels();
  loadWorkspaces();
  loadSessions();

  // Periodic health ping
  setInterval(checkHealth, 15000);
})();
