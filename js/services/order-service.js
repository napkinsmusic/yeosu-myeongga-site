(function initializeOrderService(global) {
  const PENDING_ORDER_KEY = 'yeosuMyeongga.pendingOrder.v1';
  const ORDER_PROOFS_KEY = 'yeosuMyeongga.orderProofs.v1';

  function createClientOrderKey() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    const randomPart = global.crypto
      ?.getRandomValues(new Uint32Array(4))
      .join('-');
    return `order-${Date.now()}-${randomPart || Math.random().toString(36).slice(2)}`;
  }

  function getClientOrderKey() {
    let key = sessionStorage.getItem('yeosuMyeongga.clientOrderKey.v1');
    if (!key) {
      key = createClientOrderKey();
      sessionStorage.setItem('yeosuMyeongga.clientOrderKey.v1', key);
    }
    return key;
  }

  function getOrderProofs() {
    try {
      const proofs = JSON.parse(sessionStorage.getItem(ORDER_PROOFS_KEY) || '{}');
      return proofs && typeof proofs === 'object' ? proofs : {};
    } catch {
      return {};
    }
  }

  async function createOrder(orderInput) {
    const firebase = await global.YEOSU_FIREBASE_READY;
    if (!firebase?.available) {
      const error = new Error('Firebase 연결 후 주문을 생성할 수 있습니다.');
      error.code = 'firebase/unavailable';
      throw error;
    }

    const createOrderCall = firebase.sdk.functions.httpsCallable(
      firebase.functions,
      'createOrder',
    );
    const clientOrderKey = getClientOrderKey();
    const response = await createOrderCall({
      ...orderInput,
      clientOrderKey,
    });

    sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(response.data));
    const proofs = getOrderProofs();
    proofs[response.data.orderId] = clientOrderKey;
    sessionStorage.setItem(ORDER_PROOFS_KEY, JSON.stringify(proofs));
    return response.data;
  }

  async function getOrderReceipt(orderId) {
    const firebase = await global.YEOSU_FIREBASE_READY;
    if (!firebase?.available) {
      throw new Error('Firebase 연결 후 주문을 확인할 수 있습니다.');
    }

    const getReceiptCall = firebase.sdk.functions.httpsCallable(
      firebase.functions,
      'getOrderReceipt',
    );
    const proofs = getOrderProofs();
    const response = await getReceiptCall({
      orderId,
      clientOrderKey: proofs[orderId] || getClientOrderKey(),
    });
    return response.data;
  }

  function resetClientOrderKey() {
    sessionStorage.removeItem('yeosuMyeongga.clientOrderKey.v1');
  }

  global.YEOSU_ORDER_SERVICE = Object.freeze({
    createOrder,
    getOrderReceipt,
    resetClientOrderKey,
    pendingOrderKey: PENDING_ORDER_KEY,
  });
})(window);
