// DSH Remote - Mobile UI Enhancer for DeepSeek Harness Web GUI
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function initMobileEnhancements() {
    // Only mount mobile helpers if not already mounted
    if (document.getElementById('dsh-mobile-hamburger')) return;

    // 1. Create Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'dsh-mobile-backdrop';
    backdrop.id = 'dsh-mobile-backdrop';
    document.body.appendChild(backdrop);

    // 2. Create Hamburger Toggle Button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dsh-mobile-hamburger-btn';
    btn.id = 'dsh-mobile-hamburger';
    btn.setAttribute('aria-label', 'Toggle navigation menu');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;
    document.body.appendChild(btn);

    // Toggle drawer on click
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.body.classList.toggle('dsh-mobile-sidebar-open');
    });

    // Close on backdrop tap
    backdrop.addEventListener('click', () => {
      document.body.classList.remove('dsh-mobile-sidebar-open');
    });

    // Close when tapping links or buttons inside the sidebar
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;

      const sidebar = document.querySelector('[class*="_sidebarCol"]');
      if (sidebar && sidebar.contains(target)) {
        // If clicking a session row or new session button inside sidebar, close drawer on mobile
        if (target.closest('a') || target.closest('button') || target.closest('[role="button"]')) {
          setTimeout(() => {
            document.body.classList.remove('dsh-mobile-sidebar-open');
          }, 120);
        }
      }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.body.classList.remove('dsh-mobile-sidebar-open');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileEnhancements);
  } else {
    initMobileEnhancements();
  }
})();
