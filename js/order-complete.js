(async function initializeOrderCompletePage() {
  const loading = document.querySelector('[data-order-loading]');
  const errorSection = document.querySelector('[data-order-error]');
  const content = document.querySelector('[data-order-content]');
  const orderId = new URLSearchParams(window.location.search).get('orderId');
  const formatWon = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
  const setText = (selector, value, fallback = '-') => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value || fallback;
  };

  try {
    if (!orderId) throw new Error('주문번호가 올바르지 않습니다.');
    const order = await window.YEOSU_ORDER_SERVICE.getOrderReceipt(orderId);

    loading.hidden = true;
    content.hidden = false;
    document.querySelector('[data-test-order]').hidden = !order.testOrder;

    setText('[data-order-number]', order.orderNumber);
    setText(
      '[data-order-date]',
      order.createdAt
        ? new Intl.DateTimeFormat('ko-KR', {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: 'Asia/Seoul',
          }).format(new Date(order.createdAt))
        : '',
    );
    setText('[data-customer-name]', order.customer.name);
    setText('[data-customer-phone]', order.customer.phone);
    setText('[data-customer-email]', order.customer.email);
    setText('[data-receiver]', order.shippingAddress.receiver);
    setText('[data-shipping-phone]', order.shippingAddress.phone);
    setText(
      '[data-shipping-address]',
      `(${order.shippingAddress.zipcode}) ${order.shippingAddress.address1} ${order.shippingAddress.address2}`,
    );
    setText('[data-shipping-request]', order.shippingAddress.request);
    setText('[data-receipt-products-total]', formatWon(order.pricing.productsTotal));
    setText('[data-receipt-shipping]', formatWon(order.pricing.shippingFee));
    setText('[data-receipt-discount]', formatWon(order.pricing.discount));
    setText('[data-receipt-paid]', formatWon(order.pricing.paidAmount));
    setText(
      '[data-payment-method]',
      order.payment.method === 'TEST' ? 'TEST 결제 (실제 결제 아님)' : order.payment.method,
    );

    const itemsContainer = document.querySelector('[data-order-items]');
    order.items.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'receipt-item';

      const image = document.createElement('img');
      image.src = item.thumbnail;
      image.alt = item.productName;

      const info = document.createElement('div');
      const name = document.createElement('h3');
      name.textContent = item.productName;
      const meta = document.createElement('p');
      meta.textContent = `${formatWon(item.price)} · 수량 ${item.quantity}개`;
      info.append(name, meta);

      const subtotal = document.createElement('strong');
      subtotal.textContent = formatWon(item.subtotal);

      article.append(image, info, subtotal);
      itemsContainer.append(article);
    });
  } catch (error) {
    console.error('주문정보 확인 실패', error);
    loading.hidden = true;
    errorSection.hidden = false;
    setText(
      '[data-order-error-message]',
      error.message,
      '주문정보를 확인할 수 없습니다.',
    );
  }
})();
