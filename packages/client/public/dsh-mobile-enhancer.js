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

        // A. If clicking the sidebar's collapse button while wide/expanded:
        // On mobile, the user intends to CLOSE the drawer, NOT collapse DSH into a 56px rail!
        const toggleBtn = target.closest('button[class*="_toggle"]');
        if (toggleBtn && window.innerWidth <= 768) {
          const hasRail = sidebar.querySelector('[class*="_railMark"]');
          if (!hasRail) {
            e.preventDefault();
            e.stopPropagation();
            document.body.classList.remove('dsh-mobile-sidebar-open');
            return;
          }
        }

        // B. If clicking Settings trigger in the sidebar:
        // Let the modal open on top of the drawer (z-index: 2005). Do not close drawer yet
        // so ancestor elements remain mounted and active.
        const settingsTrigger = target.closest('[class*="_settingsArea"], [class*="_triggerRow"], [class*="_trigger"]');
        if (settingsTrigger) {
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

    // 3. Settings Navigation Enhancer for Mobile (Top dropdown selector)
    function setupSettingsMobileNav(dialog) {
      if (!dialog || window.innerWidth > 768) return;
      const nav = dialog.querySelector('nav') || dialog.querySelector('[class*="_nav"]');
      if (!nav) return;

      const navList = nav.querySelector('[class*="_navList"]');
      if (!navList) return;

      const buttons = Array.from(navList.querySelectorAll('button'));
      if (buttons.length === 0) return;

      let mobileNav = nav.querySelector('#dsh-mobile-settings-nav');
      let select = mobileNav ? mobileNav.querySelector('#dsh-mobile-settings-select') : null;

      if (!mobileNav) {
        mobileNav = document.createElement('div');
        mobileNav.id = 'dsh-mobile-settings-nav';
        mobileNav.className = 'dsh-mobile-settings-nav';
        mobileNav.innerHTML = `
          <div class="dsh-mobile-settings-select-wrap">
            <select id="dsh-mobile-settings-select" class="dsh-mobile-settings-select" aria-label="Settings Section">
            </select>
            <div class="dsh-mobile-settings-select-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        `;

        select = mobileNav.querySelector('#dsh-mobile-settings-select');

        buttons.forEach((btn, idx) => {
          const option = document.createElement('option');
          option.value = String(idx);
          const labelText =
            btn.querySelector('[class*="_navLabel"]')?.textContent?.trim() ||
            btn.textContent?.trim() ||
            `Section ${idx + 1}`;
          option.textContent = labelText;
          if (btn.getAttribute('aria-current') === 'true' || btn.className.includes('active')) {
            option.selected = true;
          }
          select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
          const idx = parseInt(e.target.value, 10);
          if (!isNaN(idx) && buttons[idx]) {
            buttons[idx].click();
          }
        });

        const navTitle = nav.querySelector('[class*="_navTitle"]');
        if (navTitle && navTitle.nextSibling) {
          nav.insertBefore(mobileNav, navTitle.nextSibling);
        } else {
          nav.appendChild(mobileNav);
        }
      } else if (select) {
        // Re-populate if section count changed (e.g. locale change or dynamic plugins)
        if (select.options.length !== buttons.length) {
          select.innerHTML = '';
          buttons.forEach((btn, idx) => {
            const option = document.createElement('option');
            option.value = String(idx);
            const labelText =
              btn.querySelector('[class*="_navLabel"]')?.textContent?.trim() ||
              btn.textContent?.trim() ||
              `Section ${idx + 1}`;
            option.textContent = labelText;
            if (btn.getAttribute('aria-current') === 'true' || btn.className.includes('active')) {
              option.selected = true;
            }
            select.appendChild(option);
          });
        } else {
          // Keep selected option in sync with active button
          const activeIdx = buttons.findIndex(
            (btn) => btn.getAttribute('aria-current') === 'true' || btn.className.includes('active')
          );
          if (activeIdx >= 0 && select.value !== String(activeIdx)) {
            select.value = String(activeIdx);
          }
        }
      }
    }

    // Watch for dialog open/close in DOM and sync settings mobile nav
    const observer = new MutationObserver(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        if (!document.body.classList.contains('dsh-dialog-open')) {
          document.body.classList.add('dsh-dialog-open');
        }
        setupSettingsMobileNav(dialog);
      } else {
        if (document.body.classList.contains('dsh-dialog-open')) {
          document.body.classList.remove('dsh-dialog-open');
          // When dialog closes, close sidebar drawer so user is back on chat screen
          document.body.classList.remove('dsh-mobile-sidebar-open');
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-current']
    });

    // Re-check settings nav on resize
    window.addEventListener('resize', () => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        setupSettingsMobileNav(dialog);
      }
    });

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
