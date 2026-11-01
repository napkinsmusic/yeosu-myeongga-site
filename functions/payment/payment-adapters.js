const { HttpsError } = require('firebase-functions/v2/https');

class TestPaymentAdapter {
  async confirm({ orderId, amount }) {
    return {
      provider: 'TEST',
      paymentKey: `TEST-${orderId}`,
      method: 'TEST',
      amount,
      approved: true,
      testOrder: true,
    };
  }
}

class ProductionPaymentAdapter {
  async confirm() {
    throw new HttpsError(
      'failed-precondition',
      '운영 PG Provider가 연결되지 않았습니다.',
    );
  }
}

function getPaymentAdapter(mode) {
  if (mode === 'TEST') return new TestPaymentAdapter();
  return new ProductionPaymentAdapter();
}

module.exports = {
  getPaymentAdapter,
};
