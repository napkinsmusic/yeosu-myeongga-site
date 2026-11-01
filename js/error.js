(function initializeErrorPage() {
  const errorType = new URLSearchParams(window.location.search).get('type') || 'unknown';
  const errorMessages = {
    'product-not-found': {
      code: 'PRODUCT',
      title: '상품을 찾을 수 없습니다.',
      description: '판매가 종료되었거나 올바르지 않은 상품 주소입니다.',
    },
    'sold-out': {
      code: 'SOLD OUT',
      title: '품절된 상품입니다.',
      description: '현재 구매할 수 없는 상품입니다. 다른 상품을 확인해 주세요.',
    },
    'payment-failed': {
      code: 'PAYMENT',
      title: '결제를 완료하지 못했습니다.',
      description: '결제수단과 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
    },
    'network-error': {
      code: 'NETWORK',
      title: '네트워크 연결을 확인해 주세요.',
      description: '인터넷 연결이 복구된 후 다시 시도해 주세요.',
    },
    'order-failed': {
      code: 'ORDER',
      title: '주문을 생성하지 못했습니다.',
      description: '상품 수량과 배송정보를 확인한 뒤 다시 시도해 주세요.',
    },
    'login-required': {
      code: 'LOGIN',
      title: '로그인이 필요합니다.',
      description: '이 페이지를 확인하려면 먼저 로그인해 주세요.',
    },
    'admin-forbidden': {
      code: 'ADMIN',
      title: '관리자 권한이 없습니다.',
      description: '허가된 관리자 계정으로 로그인해 주세요.',
    },
    unknown: {
      code: 'NOTICE',
      title: '요청을 처리할 수 없습니다.',
      description: '잠시 후 다시 시도해 주세요.',
    },
  };
  const selected = errorMessages[errorType] || errorMessages.unknown;

  document.querySelector('[data-error-code]').textContent = selected.code;
  document.querySelector('[data-error-title]').textContent = selected.title;
  document.querySelector('[data-error-description]').textContent = selected.description;
  document.querySelector('[data-error-retry]').addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = './index.html';
  });
})();
