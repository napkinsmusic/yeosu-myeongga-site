(async function initializeAdminPage() {
  const loading = document.querySelector('[data-admin-loading]');
  const content = document.querySelector('[data-admin-content]');

  try {
    const adminUser = await window.YEOSU_AUTH_SERVICE.requireAdmin();
    if (!adminUser) return;

    document.querySelector('[data-admin-email]').textContent = adminUser.email || '';
    loading.hidden = true;
    content.hidden = false;
    window.YEOSU_ADMIN_READY_USER = adminUser;
    window.dispatchEvent(new CustomEvent('yeosu:admin-ready', { detail: { user: adminUser } }));
  } catch (error) {
    console.error('관리자 권한 확인 실패', error);
    loading.querySelector('p').textContent =
      'Firebase 연결 또는 관리자 권한을 확인할 수 없습니다.';
    return;
  }

  const sidebar = document.querySelector('[data-admin-sidebar]');
  const backdrop = document.querySelector('[data-admin-sidebar-backdrop]');
  const openSidebar = () => {
    sidebar.classList.add('is-open');
    backdrop.classList.add('is-open');
  };
  const closeSidebar = () => {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-open');
  };

  document.querySelector('[data-admin-menu-open]').addEventListener('click', openSidebar);
  document.querySelector('[data-admin-menu-close]').addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);

  document.querySelectorAll('[data-future-menu]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      document.querySelector('[data-admin-message]').textContent =
        '이 관리 기능은 다음 단계에서 연결됩니다.';
      closeSidebar();
    });
  });

  document.querySelector('[data-admin-logout]').addEventListener('click', async () => {
    await window.YEOSU_AUTH_SERVICE.signOut();
    window.location.replace('./login.html');
  });
})();
