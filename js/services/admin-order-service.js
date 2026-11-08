(function initializeAdminOrderService(global) {
  const ORDER_STATUS_LABELS = Object.freeze({
    PENDING_PAYMENT: '입금 대기',
    PAID: '결제완료',
    PREPARING: '배송준비',
    SHIPPED: '배송중',
    DELIVERED: '배송완료',
    CANCEL_REQUESTED: '취소요청',
    CANCELLED: '취소완료',
    REFUND_REQUESTED: '환불요청',
    REFUNDED: '환불완료',
  });

  const COURIERS = Object.freeze([
    { code: 'CJ', name: 'CJ대한통운' },
    { code: 'LOTTE', name: '롯데택배' },
    { code: 'HANJIN', name: '한진택배' },
    { code: 'LOGEN', name: '로젠택배' },
    { code: 'POST', name: '우체국택배' },
    { code: 'OTHER', name: '기타' },
  ]);

  async function callAdminFunction(functionName, data = {}) {
    const firebase = await global.YEOSU_FIREBASE_READY;
    if (!firebase?.available) {
      throw new Error('Firebase 연결이 필요합니다.');
    }
    const callable = firebase.sdk.functions.httpsCallable(
      firebase.functions,
      functionName,
    );
    const response = await callable(data);
    return response.data;
  }

  global.YEOSU_ADMIN_ORDER_SERVICE = Object.freeze({
    statusLabels: ORDER_STATUS_LABELS,
    couriers: COURIERS,
    getDashboard: () => callAdminFunction('getAdminDashboard'),
    listOrders: (filters) => callAdminFunction('listAdminOrders', filters),
    getOrder: (orderId) => callAdminFunction('getAdminOrder', { orderId }),
    updateStatus: (payload) => callAdminFunction('updateAdminOrderStatus', payload),
  });
})(window);
