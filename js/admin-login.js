(async function initializeAdminLogin() {
  const form = document.querySelector('[data-admin-login-form]');
  const message = document.querySelector('[data-login-message]');
  const submitButton = form.querySelector('[type="submit"]');
  const reason = new URLSearchParams(window.location.search).get('reason');

  if (reason === 'forbidden') {
    message.textContent = '관리자 권한이 없는 계정입니다.';
  } else if (reason === 'login-required') {
    message.textContent = '관리자 로그인이 필요합니다.';
  }

  try {
    const currentUser = await window.YEOSU_AUTH_SERVICE.getCurrentUser();
    if (currentUser && await window.YEOSU_AUTH_SERVICE.verifyAdmin(currentUser)) {
      window.location.replace('./index.html');
      return;
    }
  } catch (error) {
    if (error.code === 'auth/firebase-unavailable') {
      message.textContent = 'Firebase Authentication 연결이 필요합니다.';
    }
  }

  const getErrorMessage = (error) => {
    const messages = {
      'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
      'auth/invalid-email': '이메일 형식을 확인해 주세요.',
      'auth/too-many-requests': '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      'auth/user-disabled': '사용이 중지된 계정입니다.',
      'auth/firebase-unavailable': 'Firebase Authentication 연결이 필요합니다.',
    };
    return messages[error.code] || '로그인 중 오류가 발생했습니다.';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = '권한 확인 중...';
    message.textContent = '';

    try {
      const user = await window.YEOSU_AUTH_SERVICE.signIn(
        form.elements.email.value,
        form.elements.password.value,
      );
      const isAdmin = await window.YEOSU_AUTH_SERVICE.verifyAdmin(user);
      if (!isAdmin) {
        await window.YEOSU_AUTH_SERVICE.signOut();
        message.textContent = '관리자 권한이 없는 계정입니다.';
        return;
      }
      window.location.replace('./index.html');
    } catch (error) {
      console.error('관리자 로그인 실패', error);
      message.textContent = getErrorMessage(error);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = '로그인';
    }
  });
})();
