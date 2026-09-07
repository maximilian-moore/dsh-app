// DSH Remote - Mobile UI Enhancer for DeepSeek Harness Web GUI
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Helper to ensure DSH sidebar is always in the expanded (wide) state on mobile
  function ensureSidebarExpanded() {
    if (window.innerWidth > 768) return;
    const sidebar = document.querySelector('[class*="_sidebarCol"]');
    if (!sidebar) return;

    // Check if sidebar has collapsed indicator or rail
    const isCollapsed =
      sidebar.querySelector('[class*="_collapsed"]') ||
      sidebar.querySelector('[class*="_railMark"]') ||
      sidebar.querySelector('[class*="_rail"]') ||
      document.querySelector('[data-sidebar-collapsed="true"]');

    if (isCollapsed) {
      const toggleBtn =
        sidebar.querySelector('[class*="_railMark"]')?.closest('button') ||
        sidebar.querySelector('button[class*="_toggle"]');
      if (toggleBtn) {
        toggleBtn.click();
      }
    }
  }

  // 2. Silently refresh / mint SameSite=Lax cookie from bridge in background
  function refreshSameSiteCookie() {
    try {
      fetch('/mobile/api/auth', { method: 'POST' }).catch(() => {
        // Fallback silently if bridge is offline or unavailable
      });
    } catch {
      // Ignore
    }
  }

  function initMobileEnhancements() {
    refreshSameSiteCookie();

    // Only mount mobile helpers once
    if (document.getElementById('dsh-mobile-hamburger')) return;

    // Create Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'dsh-mobile-backdrop';
    backdrop.id = 'dsh-mobile-backdrop';
    document.body.appendChild(backdrop);

    // Create Hamburger Toggle Button
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

    // Toggle drawer on click & ensure sidebar contents are wide/expanded
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !document.body.classList.contains('dsh-mobile-sidebar-open');
      document.body.classList.toggle('dsh-mobile-sidebar-open');
      if (willOpen) {
        ensureSidebarExpanded();
        // Check once more after animation starts
        setTimeout(ensureSidebarExpanded, 50);
      }
    });

    // Close on backdrop tap
    backdrop.addEventListener('click', () => {
      document.body.classList.remove('dsh-mobile-sidebar-open');
    });

    // Intercept clicks inside sidebar
    document.addEventListener(
      'click',
      (e) => {
        const target = e.target;
        if (!target) return;

        const sidebar = document.querySelector('[class*="_sidebarCol"]');
        if (!sidebar || !sidebar.contains(target)) return;

        // A. If the user clicks the toggle button while the sidebar is already wide/expanded:
        // On mobile, the user intends to CLOSE the drawer, NOT collapse DSH into an unusable 56px rail!
        const toggleBtn = target.closest('button[class*="_toggle"]');
        if (toggleBtn && window.innerWidth <= 768) {
          const hasRail = sidebar.querySelector('[class*="_railMark"]');
          if (!hasRail) {
            // It's in expanded mode; prevent collapse and close mobile drawer instead
            e.preventDefault();
            e.stopPropagation();
            document.body.classList.remove('dsh-mobile-sidebar-open');
            return;
          }
        }

        // B. If clicking Settings trigger in the sidebar, close the mobile drawer so Settings modal takes full screen
        const settingsTrigger = target.closest('[class*="_settingsArea"], [class*="_triggerRow"], [class*="_trigger"]');
        if (settingsTrigger) {
          setTimeout(() => {
            document.body.classList.remove('dsh-mobile-sidebar-open');
          }, 80);
          return;
        }

        // C. If clicking a session row or New Session button inside sidebar, close drawer on mobile
        if (target.closest('a') || target.closest('button') || target.closest('[role="button"]')) {
          setTimeout(() => {
            document.body.classList.remove('dsh-mobile-sidebar-open');
          }, 120);
        }
      },
      true // Capture phase
    );

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.body.classList.remove('dsh-mobile-sidebar-open');
      }
    });

    // On mobile load, ensure sidebar is expanded when rendered
    setTimeout(ensureSidebarExpanded, 200);
    setTimeout(ensureSidebarExpanded, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileEnhancements);
  } else {
    initMobileEnhancements();
  }
})();
