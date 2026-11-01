(function initializeAdminSalesService(global) {
  async function getSalesStats(filters) {
    const firebase = await global.YEOSU_FIREBASE_READY;
    if (!firebase?.available) throw new Error('Firebase 연결이 필요합니다.');
    const callable = firebase.sdk.functions.httpsCallable(
      firebase.functions,
      'getAdminSalesStats',
    );
    const response = await callable(filters);
    return response.data;
  }

  global.YEOSU_ADMIN_SALES_SERVICE = Object.freeze({
    getSalesStats,
  });
})(window);
