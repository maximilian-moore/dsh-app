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

  // DOM Elements
  const btnToggle = document.getElementById('btn-toggle-sessions');
  const btnClose = document.getElementById('btn-close-drawer');
  const drawer = document.getElementById('sessions-drawer');
  const sessionTitle = document.getElementById('session-title');
  const statusBadge = document.getElementById('status-badge');

  // Toggle drawer
  btnToggle.addEventListener('click', () => {
    drawer.classList.remove('hidden');
  });

  btnClose.addEventListener('click', () => {
    drawer.classList.add('hidden');
  });

  // Check health endpoint
  async function checkHealth() {
    try {
      const res = await fetch('/mobile/api/health');
      if (res.ok) {
        const data = await res.json();
        statusBadge.className = 'status-indicator online';
        sessionTitle.textContent = data.status === 'ok' ? 'Ready' : 'Connected';
      } else {
        statusBadge.className = 'status-indicator';
        sessionTitle.textContent = 'Disconnected';
      }
    } catch (err) {
      statusBadge.className = 'status-indicator';
      sessionTitle.textContent = 'Offline';
    }
  }

  checkHealth();
})();
