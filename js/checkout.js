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
  const shopConfig = window.SHOP_CONFIG ?? {};

  const product = purchaseItem
    ? products.find(
        (item) =>
          item.id === purchaseItem.productId
          && item.isVisible
          && !item.isDeleted,
      )
    : null;
  const productOptions = Array.isArray(product?.options) ? product.options : [];
  const selectedOption = productOptions.find((option) => option.id === purchaseItem?.optionId) ?? null;
  const requiresOption = productOptions.length > 0;

  function getUnitPrice() {
    if (selectedOption && Number.isFinite(selectedOption.price)) return selectedOption.price;
    if (product?.id === 'pollack-roe') return 35000;
    const salePrice = product?.salePrice;
    const price = salePrice ?? product?.price;
    return Number.isFinite(price) ? price : null;
  }

  function getShippingFee(productAmount) {
    const freeFrom = Number(shopConfig.shippingFreeFrom) || 70000;
    const configuredFee = Number(shopConfig.shippingFee);
    const shippingFee = Number.isFinite(configuredFee) ? configuredFee : 3000;
    return productAmount >= freeFrom ? 0 : shippingFee;
  }

  const unitPrice = getUnitPrice();
  const hasValidPrice = Number.isSafeInteger(unitPrice) && unitPrice >= 0;
  const maximumQuantity =
    product && !product.isSoldOut
      ? (Number.isInteger(product.stock) ? Math.max(product.stock, 0) : 999)
      : 0;
  const validItems =
    product && maximumQuantity > 0 && (!requiresOption || selectedOption)
      ? [{
          ...purchaseItem,
          product,
          option: selectedOption,
          quantity: Math.min(purchaseItem.quantity, maximumQuantity),
          unitPrice,
        }]
      : [];

  if (validItems.length === 0) {
    emptySection.hidden = false;
    return;
  }

  form.hidden = false;
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = false;
  submitButton.textContent = '결제하기';

  let productsTotal = 0;
  validItems.forEach(({ product, option, quantity, unitPrice }) => {
    const displayPrice = hasValidPrice ? unitPrice : 0;
    const subtotal = displayPrice * quantity;
    productsTotal += subtotal;

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
    info.append(name);

    if (option?.label) {
      const optionLine = document.createElement('p');
      optionLine.textContent = `옵션 ${option.label}`;
      info.append(optionLine);
    }

    const meta = document.createElement('p');
    meta.textContent = hasValidPrice
      ? `${formatWon(displayPrice)} · 수량 ${quantity}개`
      : `가격 준비 중 · 수량 ${quantity}개`;
    info.append(meta);

    const itemTotal = document.createElement('strong');
    itemTotal.textContent = hasValidPrice ? formatWon(subtotal) : '가격 준비 중';

    article.append(image, info, itemTotal);
    productsContainer.append(article);
  });

  const shippingFee = hasValidPrice ? getShippingFee(productsTotal) : 0;
  document.querySelector('[data-checkout-products-total]').textContent =
    hasValidPrice ? formatWon(productsTotal) : '가격 준비 중';
  document.querySelector('[data-checkout-shipping]').textContent =
    hasValidPrice ? formatWon(shippingFee) : '-';
  document.querySelector('[data-checkout-discount]').textContent = '0원';
  document.querySelector('[data-checkout-total]').textContent =
    hasValidPrice ? formatWon(productsTotal + shippingFee) : '가격 준비 중';

  const requestSelect = document.querySelector('[data-shipping-request]');
  const directRequestField = document.querySelector('[data-direct-request]');
  const directRequestInput = directRequestField.querySelector('input');

  requestSelect.addEventListener('change', () => {
    const usesDirectInput = requestSelect.value === 'DIRECT';
    directRequestField.hidden = !usesDirectInput;
    directRequestInput.required = usesDirectInput;
    if (!usesDirectInput) directRequestInput.value = '';
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

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    checkoutMessage.textContent = '결제는 PG 연결 후 진행됩니다.';
  });
})();
