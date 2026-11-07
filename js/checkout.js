(async function initializeCheckoutPage() {
  const products = window.YEOSU_PRODUCT_SERVICE
    ? await window.YEOSU_PRODUCT_SERVICE.listProducts()
    : window.YEOSU_STORE?.products ?? [];
  const purchaseItems = typeof window.YEOSU_PURCHASE.getItems === 'function'
    ? window.YEOSU_PURCHASE.getItems()
    : (window.YEOSU_PURCHASE.getItem() ? [window.YEOSU_PURCHASE.getItem()] : []);
  const emptySection = document.querySelector('[data-checkout-empty]');
  const form = document.querySelector('[data-checkout-form]');
  const productsContainer = document.querySelector('[data-checkout-products]');
  const checkoutMessage = document.querySelector('[data-checkout-message]');
  const formatWon = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
  const shopConfig = window.SHOP_CONFIG ?? {};

  function findProduct(productId) {
    return products.find(
      (item) => item.id === productId && item.isVisible && !item.isDeleted,
    ) ?? null;
  }

  function getUnitPrice(product, selectedOption) {
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

  const validItems = purchaseItems.flatMap((purchaseItem) => {
    const product = findProduct(purchaseItem.productId);
    if (!product || product.isSoldOut) return [];
    const productOptions = Array.isArray(product.options) ? product.options : [];
    const selectedOption = productOptions.find((option) => option.id === purchaseItem.optionId) ?? null;
    if (productOptions.length > 0 && !selectedOption) return [];
    const unitPrice = getUnitPrice(product, selectedOption);
    const maximumQuantity = Number.isInteger(product.stock) ? Math.max(product.stock, 0) : 999;
    if (maximumQuantity < 1) return [];
    return [{
      ...purchaseItem,
      product,
      option: selectedOption,
      quantity: Math.min(purchaseItem.quantity, maximumQuantity),
      unitPrice,
    }];
  });
  const hasValidPrice = validItems.every((item) => Number.isSafeInteger(item.unitPrice) && item.unitPrice >= 0);

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
    const displayPrice = Number.isFinite(unitPrice) ? unitPrice : 0;
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

  const CHECKOUT_DRAFT_KEY = 'yeosuMyeongga.checkoutDraft.v1';
  const address1Input = form.querySelector('[name="address1"]');
  const address2Input = form.querySelector('[name="address2"]');
  const zipcodeInput = form.querySelector('[name="zipcode"]');
  const addressMessage = document.querySelector('[data-address-message]');
  const addressSearchButton = document.querySelector('[data-address-search]');

  function getPostcodeConstructor() {
    return window.daum?.Postcode || window.kakao?.Postcode || null;
  }

  function loadPostcodeScript() {
    if (getPostcodeConstructor()) return Promise.resolve();

    const existing = document.querySelector('script[data-postcode-script]');
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('postcode')), { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      script.async = true;
      script.dataset.postcodeScript = '';
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('postcode')), { once: true });
      document.head.append(script);
    });
  }

  function getRoadAddress(data) {
    const roadAddress = data.roadAddress || data.autoRoadAddress || '';
    if (!roadAddress) return data.address || data.jibunAddress || '';
    if (data.buildingName) return `${roadAddress} (${data.buildingName})`;
    return roadAddress;
  }

  function ensurePostcodeLayer() {
    let layer = document.querySelector('[data-postcode-layer]');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.className = 'postcode-overlay';
    layer.hidden = true;
    layer.setAttribute('data-postcode-layer', '');
    layer.innerHTML = `
      <div class="postcode-panel" role="dialog" aria-modal="true" aria-labelledby="postcode-title">
        <div class="postcode-toolbar">
          <strong id="postcode-title">주소 검색</strong>
          <button type="button" class="postcode-close" data-postcode-close>닫기</button>
        </div>
        <div class="postcode-embed" data-postcode-embed></div>
      </div>
    `;
    document.body.append(layer);
    layer.querySelector('[data-postcode-close]').addEventListener('click', closePostcodeLayer);
    return layer;
  }

  function closePostcodeLayer() {
    const layer = document.querySelector('[data-postcode-layer]');
    if (layer) layer.hidden = true;
    document.body.classList.remove('postcode-open');
  }

  function applySelectedAddress(data) {
    const roadAddress = getRoadAddress(data);
    zipcodeInput.value = data.zonecode || '';
    address1Input.value = roadAddress;
    addressMessage.textContent = '';
    closePostcodeLayer();
    address2Input.focus();
  }

  async function openAddressSearch() {
    const existingLayer = document.querySelector('[data-postcode-layer]');
    if (existingLayer && !existingLayer.hidden) return;

    addressMessage.textContent = '';
    try {
      await loadPostcodeScript();
    } catch {
      addressMessage.textContent = '주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      return;
    }

    const Postcode = getPostcodeConstructor();
    if (!Postcode) {
      addressMessage.textContent = '주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      return;
    }

    const layer = ensurePostcodeLayer();
    const embed = layer.querySelector('[data-postcode-embed]');
    embed.replaceChildren();
    layer.hidden = false;
    document.body.classList.add('postcode-open');

    new Postcode({
      oncomplete: applySelectedAddress,
      onclose: closePostcodeLayer,
      width: '100%',
      height: '100%',
      animation: false,
    }).embed(embed);
  }

  function getShippingRequest() {
    if (requestSelect.value === 'DIRECT') return directRequestInput.value.trim();
    return requestSelect.value.trim();
  }

  function collectCheckoutDraft() {
    const formData = new FormData(form);
    const name = String(formData.get('customerName') || '').trim();
    const phone = String(formData.get('customerPhone') || '').trim();
    const zipcode = String(formData.get('zipcode') || '').trim();
    const address1 = String(formData.get('address1') || '').trim();
    const address2 = String(formData.get('address2') || '').trim();

    return {
      customer: { name, phone },
      shippingAddress: {
        receiver: name,
        phone,
        zipcode,
        address1,
        address2,
        request: getShippingRequest(),
      },
      items: validItems.map(({ product, option, quantity }) => ({
        productId: product.id,
        optionId: option?.id || null,
        quantity,
      })),
    };
  }

  window.YEOSU_ADDRESS = Object.freeze({ open: openAddressSearch });
  addressSearchButton.addEventListener('click', openAddressSearch);
  address1Input.addEventListener('click', openAddressSearch);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePostcodeLayer();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const draft = collectCheckoutDraft();
    if (!draft.shippingAddress.zipcode || !draft.shippingAddress.address1) {
      checkoutMessage.textContent = '주소를 검색해 주세요.';
      openAddressSearch();
      return;
    }

    sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
    checkoutMessage.textContent = '결제는 PG 연결 후 진행됩니다.';
  });
})();
