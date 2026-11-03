(async function initializeCheckoutPage() {
  const products = window.YEOSU_PRODUCT_SERVICE
    ? await window.YEOSU_PRODUCT_SERVICE.listProducts()
    : window.YEOSU_STORE?.products ?? [];
  const purchaseItem = window.YEOSU_PURCHASE.getItem();
  const emptySection = document.querySelector('[data-checkout-empty]');
  const form = document.querySelector('[data-checkout-form]');
  const productsContainer = document.querySelector('[data-checkout-products]');
  const checkoutMessage = document.querySelector('[data-checkout-message]');
  const formatWon = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;

  const product = purchaseItem
    ? products.find(
        (item) =>
          item.id === purchaseItem.productId
          && item.isVisible
          && !item.isDeleted,
      )
    : null;
  const maximumQuantity =
    product && !product.isSoldOut
      ? (Number.isInteger(product.stock) ? Math.max(product.stock, 0) : 999)
      : 0;
  const validItems =
    product && maximumQuantity > 0
      ? [{
          ...purchaseItem,
          product,
          quantity: Math.min(purchaseItem.quantity, maximumQuantity),
        }]
      : [];

  if (validItems.length === 0) {
    emptySection.hidden = false;
    return;
  }

  form.hidden = false;
  const submitButton = form.querySelector('[type="submit"]');

  try {
    const paymentConfig = await window.YEOSU_PAYMENT_SERVICE.getConfig();
    if (paymentConfig.mode === 'TEST') {
      document.querySelector('[data-test-mode]').hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = 'TEST 주문 및 결제';
    } else {
      submitButton.disabled = true;
      submitButton.textContent = '결제 준비 중';
      checkoutMessage.textContent = '운영 결제 Provider가 아직 연결되지 않았습니다.';
    }
  } catch (error) {
    console.error('결제 설정 확인 실패', error);
    submitButton.disabled = true;
    submitButton.textContent = '결제 연결 오류';
    checkoutMessage.textContent = '결제 설정을 확인할 수 없습니다.';
  }

  let productsTotal = 0;
  let shippingFee = 0;

  validItems.forEach(({ product, quantity }) => {
    const price = product.salePrice ?? product.price;
    const subtotal = price * quantity;
    productsTotal += subtotal;
    shippingFee = Math.max(shippingFee, product.shippingFee || 0);

    const article = document.createElement('article');
    article.className = 'checkout-product';

    const image = document.createElement('img');
    image.src = product.thumbnail;
    image.alt = product.name;

    const info = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = product.name;
    if (product.nameNote) {
      const note = document.createElement('span');
      note.className = 'product-name-note';
      note.textContent = product.nameNote;
      name.append(note);
    }
    const meta = document.createElement('p');
    meta.textContent = `${formatWon(price)} · 수량 ${quantity}개`;
    info.append(name, meta);

    const itemTotal = document.createElement('strong');
    itemTotal.textContent = formatWon(subtotal);

    article.append(image, info, itemTotal);
    productsContainer.append(article);
  });

  document.querySelector('[data-checkout-products-total]').textContent = formatWon(productsTotal);
  document.querySelector('[data-checkout-shipping]').textContent = formatWon(shippingFee);
  document.querySelector('[data-checkout-discount]').textContent = '0원';
  document.querySelector('[data-checkout-total]').textContent = formatWon(productsTotal + shippingFee);

  const requestSelect = document.querySelector('[data-shipping-request]');
  const directRequestField = document.querySelector('[data-direct-request]');
  const directRequestInput = directRequestField.querySelector('input');

  requestSelect.addEventListener('change', () => {
    const usesDirectInput = requestSelect.value === 'DIRECT';
    directRequestField.hidden = !usesDirectInput;
    directRequestInput.required = usesDirectInput;
    if (!usesDirectInput) directRequestInput.value = '';
  });

  document.querySelector('[data-copy-orderer]').addEventListener('change', (event) => {
    if (!event.currentTarget.checked) return;
    form.elements.receiver.value = form.elements.customerName.value;
    form.elements.shippingPhone.value = form.elements.customerPhone.value;
  });

  /*
   * PHASE 6 이후 카카오 우편번호 또는 다른 주소 제공자의 Adapter로
   * 이 함수 내부만 교체하면 주문서 필드 구조를 유지할 수 있습니다.
   */
  async function openAddressSearch() {
    document.querySelector('[data-address-message]').textContent =
      '주소 검색 API는 아직 연결되지 않았습니다. 현재는 직접 입력해 주세요.';
    return null;
  }

  window.YEOSU_ADDRESS = Object.freeze({ open: openAddressSearch });
  document.querySelector('[data-address-search]').addEventListener('click', openAddressSearch);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const request =
      requestSelect.value === 'DIRECT'
        ? directRequestInput.value.trim()
        : requestSelect.value;
    const orderInput = {
      customer: {
        name: form.elements.customerName.value,
        phone: form.elements.customerPhone.value,
        email: form.elements.customerEmail.value,
      },
      shippingAddress: {
        receiver: form.elements.receiver.value,
        phone: form.elements.shippingPhone.value,
        zipcode: form.elements.zipcode.value,
        address1: form.elements.address1.value,
        address2: form.elements.address2.value,
        request,
      },
      items: validItems.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      })),
    };

    submitButton.disabled = true;
    submitButton.textContent = 'TEST 결제 처리 중...';
    checkoutMessage.textContent = '';

    try {
      const order = await window.YEOSU_ORDER_SERVICE.createOrder(orderInput);
      const payment = await window.YEOSU_PAYMENT_SERVICE.pay({
        orderId: order.orderId,
      });
      if (payment.status !== 'PAID') {
        throw new Error('결제 완료 상태를 확인할 수 없습니다.');
      }

      window.YEOSU_PURCHASE.clear();
      window.YEOSU_ORDER_SERVICE.resetClientOrderKey();
      checkoutMessage.textContent =
        `${order.orderNumber} TEST 주문이 완료되었습니다.`;
      window.location.href =
        `./order-complete.html?orderId=${encodeURIComponent(order.orderId)}`;
    } catch (error) {
      console.error('주문 생성 실패', error);
      submitButton.disabled = false;
      submitButton.textContent = 'TEST 주문 및 결제';
      checkoutMessage.textContent =
        error.code === 'firebase/unavailable'
          ? 'Firebase 프로젝트 연결 후 주문을 생성할 수 있습니다.'
          : error.message || '주문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    }
  });
})();
