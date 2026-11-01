(function initializePaymentService(global) {
  class DisabledPaymentAdapter {
    async pay() {
      const error = new Error('운영 결제 Provider가 연결되지 않았습니다.');
      error.code = 'payment/disabled';
      throw error;
    }
  }

  class TestPaymentAdapter {
    constructor(firebase) {
      this.firebase = firebase;
    }

    async pay({ orderId }) {
      const confirmPayment = this.firebase.sdk.functions.httpsCallable(
        this.firebase.functions,
        'confirmTestPayment',
      );
      const response = await confirmPayment({ orderId });
      return response.data;
    }
  }

  async function getConfig() {
    const firebase = await global.YEOSU_FIREBASE_READY;
    if (!firebase?.available) {
      return { mode: 'DISABLED', productionReady: false };
    }

    const getPaymentConfig = firebase.sdk.functions.httpsCallable(
      firebase.functions,
      'getPaymentConfig',
    );
    const response = await getPaymentConfig();
    return response.data;
  }

  async function getAdapter() {
    const firebase = await global.YEOSU_FIREBASE_READY;
    const config = await getConfig();
    if (firebase?.available && config.mode === 'TEST') {
      return { adapter: new TestPaymentAdapter(firebase), config };
    }
    return { adapter: new DisabledPaymentAdapter(), config };
  }

  async function pay(order) {
    const { adapter, config } = await getAdapter();
    const result = await adapter.pay(order);
    return { ...result, mode: config.mode };
  }

  global.YEOSU_PAYMENT_SERVICE = Object.freeze({
    getConfig,
    pay,
  });
})(window);
