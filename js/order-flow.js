(function initializeOrderFlow(global) {
  const DRAFT_KEY = 'yeosuMyeongga.orderSteps.v1';
  const LOCAL_ORDERS_KEY = 'yeosuMyeongga.localOrders.v1';
  const LOCAL_COUNTER_KEY = 'yeosuMyeongga.localOrderCounter.v1';
  const REQUEST_OPTIONS = [
    { id: 'door', label: '문 앞에 놓아주세요' },
    { id: 'call', label: '배송 전에 연락해 주세요' },
    { id: 'guard', label: '경비실에 맡겨 주세요' },
    { id: 'none', label: '요청사항 없어요', value: '' },
    { id: 'direct', label: '직접 입력할게요' },
  ];

  const formatWon = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function readDraft() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  }

  function writeDraft(patch) {
    const next = { ...readDraft(), ...patch };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    return next;
  }

  function getBank() {
    const shop = global.SHOP_CONFIG ?? {};
    return {
      bankName: shop.bankName || '농협은행',
      accountNumber: shop.bankAccountNumber || '000-0000-0000-00',
      accountHolder: shop.bankAccountHolder || '(주)전남산업콘텐츠연구원',
    };
  }

  function getShippingFee(productAmount) {
    const shop = global.SHOP_CONFIG ?? {};
    const freeFrom = Number(shop.shippingFreeFrom) || 70000;
    const configuredFee = Number(shop.shippingFee);
    const shippingFee = Number.isFinite(configuredFee) ? configuredFee : 3000;
    return productAmount >= freeFrom ? 0 : shippingFee;
  }

  function getSeoulDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}${values.month}${values.day}`;
  }

  function nextLocalOrderNumber() {
    const dateKey = getSeoulDateKey();
    let counters = {};
    try {
      counters = JSON.parse(localStorage.getItem(LOCAL_COUNTER_KEY) || '{}') || {};
    } catch {
      counters = {};
    }
    counters[dateKey] = (Number(counters[dateKey]) || 0) + 1;
    localStorage.setItem(LOCAL_COUNTER_KEY, JSON.stringify(counters));
    return `YM-${dateKey}-${String(counters[dateKey]).padStart(5, '0')}`;
  }

  function saveLocalOrder(order) {
    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
      if (!Array.isArray(orders)) orders = [];
    } catch {
      orders = [];
    }
    orders.unshift(order);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders.slice(0, 50)));
    sessionStorage.setItem('yeosuMyeongga.pendingOrder.v1', JSON.stringify(order));
    return order;
  }

  function formatPhone(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function isValidPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 12;
  }

  function requestLabel(draft) {
    if (draft.requestOption === 'none' || !draft.shippingRequest) return '요청사항 없어요';
    return draft.shippingRequest;
  }

  function getPostcodeConstructor() {
    return global.daum?.Postcode || global.kakao?.Postcode || null;
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

  const state = {
    open: false,
    history: ['name'],
    returnFocus: null,
    product: null,
    option: null,
    quantity: 1,
    submitting: false,
    postcodeListening: false,
    postcodeApplying: false,
  };

  function decodePostcodePayload(raw) {
    if (typeof raw !== 'string' || !raw.includes('action=')) return null;
    const parsed = {};
    raw.split('|').forEach((part) => {
      const index = part.indexOf('=');
      if (index < 1) return;
      const key = part.slice(0, index);
      const value = part.slice(index + 1);
      try {
        parsed[key] = decodeURIComponent(value);
      } catch {
        parsed[key] = value;
      }
    });
    return parsed.action ? parsed : null;
  }

  function onPostcodeWindowMessage(event) {
    if (!state.postcodeListening) return;
    const parsed = decodePostcodePayload(event.data);
    if (parsed?.action === 'done') applySelectedAddress(parsed);
  }

  function currentStep() {
    return state.history[state.history.length - 1] || 'name';
  }

  function cameFromReview() {
    return state.history.includes('review') && state.history.includes('edit');
  }

  function modal() {
    return $('[data-order-step-modal]');
  }

  function setError(text) {
    const step = currentStep();
    const target = $(`[data-order-step="${step}"] [data-order-step-error]`);
    if (target) target.textContent = text || '';
  }

  function showStep(step) {
    modal()?.querySelectorAll('[data-order-step]').forEach((panel) => {
      panel.hidden = panel.dataset.orderStep !== step;
    });
    const back = $('[data-order-prev]');
    const hideBack = step === 'name' || step === 'received';
    if (back) back.hidden = hideBack;
    setError('');
  }

  function fillFields() {
    const draft = readDraft();
    const nameInput = $('[data-order-name-input]');
    const phoneInput = $('[data-order-phone-input]');
    const address2Input = $('[data-order-address2-input]');
    const directInput = $('[data-order-request-direct]');
    if (nameInput) nameInput.value = draft.customerName || '';
    if (phoneInput) phoneInput.value = draft.customerPhone || '';
    if (address2Input) address2Input.value = draft.address2 || '';
    if (directInput) directInput.value = draft.requestDirect || '';
    updateAddressPreview(draft);
    updatePhoneGreeting(draft.customerName || '');
    updateRequestChoices(draft);
    updateReview(draft);
  }

  function updatePhoneGreeting(name) {
    const greeting = $('[data-order-phone-greeting]');
    if (greeting) greeting.textContent = name ? `감사합니다, ${name} 고객님!` : '감사합니다.';
  }

  function updateAddressPreview(draft = readDraft()) {
    const preview = $('[data-order-address-preview]');
    const more = $('[data-order-address-more]');
    const hasAddress = Boolean(draft.address1);
    if (preview) {
      preview.hidden = !hasAddress;
      const line = $('[data-order-address-text]');
      if (line) {
        line.textContent = [draft.zipcode ? `(${draft.zipcode})` : '', draft.address1]
          .filter(Boolean)
          .join(' ');
      }
    }
    if (more) more.hidden = !hasAddress;
    const confirm = $('[data-order-address-confirm-text]');
    if (confirm) {
      confirm.textContent = [
        draft.zipcode ? `(${draft.zipcode})` : '',
        draft.address1,
        draft.address2,
      ].filter(Boolean).join(' ');
    }
  }

  function updateRequestChoices(draft = readDraft()) {
    document.querySelectorAll('[data-request-option]').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.requestOption === draft.requestOption);
    });
    const directField = $('[data-order-request-direct-field]');
    const directSubmit = $('[data-order-request-direct-submit]');
    const showDirect = draft.requestOption === 'direct';
    if (directField) directField.hidden = !showDirect;
    if (directSubmit) directSubmit.hidden = !showDirect;
  }

  function lineSummary() {
    const product = state.product;
    const option = state.option;
    const quantity = state.quantity;
    const unitPrice = option?.price ?? product?.salePrice ?? product?.price;
    const productName = [product?.name, product?.nameNote].filter(Boolean).join(' ');
    const optionLabel = option?.label || '';
    const productsTotal = Number.isFinite(unitPrice) ? unitPrice * quantity : 0;
    const shippingFee = getShippingFee(productsTotal);
    return {
      productName,
      optionLabel,
      quantity,
      unitPrice,
      productsTotal,
      shippingFee,
      paidAmount: productsTotal + shippingFee,
    };
  }

  function updateReview(draft = readDraft()) {
    const summary = lineSummary();
    const set = (selector, value) => {
      const element = $(selector);
      if (element) element.textContent = value;
    };
    set('[data-review-product]', summary.optionLabel
      ? `${summary.productName} / ${summary.optionLabel}`
      : summary.productName);
    set('[data-review-quantity]', `${summary.quantity}개`);
    set('[data-review-name]', draft.customerName || '-');
    set('[data-review-phone]', draft.customerPhone || '-');
    set(
      '[data-review-address]',
      [draft.zipcode ? `(${draft.zipcode})` : '', draft.address1, draft.address2]
        .filter(Boolean)
        .join(' ') || '-',
    );
    set('[data-review-request]', requestLabel(draft));
    set('[data-review-shipping]', summary.shippingFee === 0 ? '무료배송' : formatWon(summary.shippingFee));
    set('[data-review-total]', formatWon(summary.paidAmount));
  }

  function focusStep(step) {
    const map = {
      name: '[data-order-name-input]',
      phone: '[data-order-phone-input]',
      address: '[data-order-address-search]',
      'address-confirm': '[data-order-address-yes]',
      request: '[data-request-option]',
      review: '[data-order-submit]',
      edit: '[data-order-edit="name"]',
      received: '[data-order-copy-account]',
    };
    const target = $(map[step]);
    window.setTimeout(() => target?.focus?.(), 0);
  }

  function goTo(step) {
    if (currentStep() !== step) state.history.push(step);
    showStep(step);
    fillFields();
    focusStep(step);
  }

  function goBack() {
    if (state.history.length < 2) return;
    state.history.pop();
    showStep(currentStep());
    fillFields();
    focusStep(currentStep());
  }

  function afterConfirm(nextStep) {
    if (cameFromReview() && nextStep !== 'address-confirm') {
      state.history = state.history.slice(0, state.history.lastIndexOf('review') + 1);
      showStep('review');
      fillFields();
      focusStep('review');
      return;
    }
    goTo(nextStep);
  }

  function closeFlow() {
    closePostcodeLayer();
    const root = modal();
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    state.open = false;
    state.returnFocus?.focus?.();
    state.returnFocus = null;
  }

  function openFlow({ trigger, product, option = null, quantity = 1 }) {
    state.product = product;
    state.option = option;
    state.quantity = Math.max(Number.parseInt(quantity, 10) || 1, 1);
    state.history = ['name'];
    state.submitting = false;
    state.returnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
    const root = modal();
    if (!root) return;
    fillFields();
    showStep('name');
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    state.open = true;
    focusStep('name');
  }

  function setPostcodeBlocking(open) {
    state.postcodeListening = open;
    document.body.classList.toggle('postcode-open', open);
    const root = modal();
    if (!root) return;
    root.classList.toggle('is-postcode-open', open);
    root.toggleAttribute('inert', open);
  }

  function closePostcodeLayer() {
    const layer = $('[data-postcode-layer]');
    if (layer) layer.hidden = true;
    setPostcodeBlocking(false);
  }

  function ensurePostcodeLayer() {
    let layer = $('[data-postcode-layer]');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'postcode-overlay';
    layer.hidden = true;
    layer.setAttribute('data-postcode-layer', '');
    layer.innerHTML = `
      <div class="postcode-panel" role="dialog" aria-modal="true" aria-labelledby="order-postcode-title">
        <div class="postcode-toolbar">
          <strong id="order-postcode-title">주소 검색</strong>
          <button type="button" class="postcode-close" data-postcode-close>닫기</button>
        </div>
        <div class="postcode-embed" data-postcode-embed></div>
      </div>
    `;
    document.body.append(layer);
    $('[data-postcode-close]', layer).addEventListener('click', closePostcodeLayer);
    return layer;
  }

  function applySelectedAddress(data) {
    if (state.postcodeApplying) return;
    state.postcodeApplying = true;
    try {
      writeDraft({
        zipcode: data.zonecode || '',
        address1: getRoadAddress(data),
      });
      closePostcodeLayer();
      updateAddressPreview();
      window.setTimeout(() => $('[data-order-address2-input]')?.focus(), 0);
    } catch (error) {
      setError('주소를 반영하지 못했습니다. 다시 선택해 주세요.');
      closePostcodeLayer();
    } finally {
      window.setTimeout(() => {
        state.postcodeApplying = false;
      }, 0);
    }
  }

  function connectPostcodeFrame(embed) {
    const frame = embed.querySelector('iframe');
    if (!frame) return;
    const connect = () => {
      try {
        const wrap = frame.contentWindow;
        if (!wrap || wrap.__yeosuPostcodeBound) return;
        wrap.__yeosuPostcodeBound = true;
        wrap.addEventListener('message', onPostcodeWindowMessage);
        const inner = frame.contentDocument?.querySelector('iframe');
        if (inner) {
          inner.style.display = 'block';
          inner.style.width = '100%';
          inner.style.height = '100%';
        }
      } catch {
        /* Kakao inner frame is cross-origin; wrapper frame is same-origin. */
      }
    };
    frame.addEventListener('load', connect);
    connect();
    window.setTimeout(connect, 0);
    window.setTimeout(connect, 400);
  }

  function embedPostcode(Postcode) {
    const layer = ensurePostcodeLayer();
    const embed = $('[data-postcode-embed]', layer);
    embed.replaceChildren();
    embed.style.width = '100%';
    embed.style.height = `${Math.max(window.innerHeight - 52, 400)}px`;
    document.body.append(layer);
    layer.hidden = false;
    setPostcodeBlocking(true);
    new Postcode({
      oncomplete: applySelectedAddress,
      onclose: closePostcodeLayer,
      width: '100%',
      height: '100%',
      animation: false,
    }).embed(embed);
    connectPostcodeFrame(embed);
  }

  function launchPostcode(Postcode) {
    embedPostcode(Postcode);
  }

  function openAddressSearch() {
    const existingLayer = $('[data-postcode-layer]');
    if (existingLayer && !existingLayer.hidden) return;
    setError('');
    const Postcode = getPostcodeConstructor();
    if (Postcode) {
      launchPostcode(Postcode);
      return;
    }
    loadPostcodeScript()
      .then(() => {
        const loaded = getPostcodeConstructor();
        if (!loaded) {
          setError('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
          setPostcodeBlocking(false);
          return;
        }
        embedPostcode(loaded);
      })
      .catch(() => {
        setError('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        setPostcodeBlocking(false);
      });
  }

  function confirmName() {
    const name = $('[data-order-name-input]')?.value.trim() || '';
    if (!name) {
      setError('성함을 알려주세요.');
      $('[data-order-name-input]')?.focus();
      return;
    }
    writeDraft({ customerName: name });
    afterConfirm('phone');
  }

  function confirmPhone() {
    const phone = formatPhone($('[data-order-phone-input]')?.value || '');
    if (!isValidPhone(phone)) {
      setError('연락받으실 전화번호를 확인해 주세요.');
      $('[data-order-phone-input]')?.focus();
      return;
    }
    writeDraft({ customerPhone: phone });
    afterConfirm('address');
  }

  function confirmAddress() {
    const draft = writeDraft({
      address2: $('[data-order-address2-input]')?.value.trim() || '',
    });
    if (!draft.zipcode || !draft.address1) {
      setError('주소를 검색해 주세요.');
      return;
    }
    if (!draft.address2) {
      setError('상세주소를 입력해 주세요.');
      $('[data-order-address2-input]')?.focus();
      return;
    }
    goTo('address-confirm');
  }

  function selectRequest(optionId) {
    setError('');
    const option = REQUEST_OPTIONS.find((item) => item.id === optionId);
    if (!option) return;
    if (option.id === 'direct') {
      writeDraft({ requestOption: 'direct' });
      updateRequestChoices();
      $('[data-order-request-direct]')?.focus();
      return;
    }
    writeDraft({
      requestOption: option.id,
      shippingRequest: option.value === '' ? '' : option.label,
      requestDirect: '',
    });
    afterConfirm('review');
  }

  function confirmDirectRequest() {
    const text = $('[data-order-request-direct]')?.value.trim() || '';
    if (!text) {
      setError('부탁하실 말씀을 입력해 주세요.');
      $('[data-order-request-direct]')?.focus();
      return;
    }
    writeDraft({
      requestOption: 'direct',
      shippingRequest: text.slice(0, 100),
      requestDirect: text.slice(0, 100),
    });
    afterConfirm('review');
  }

  async function copyAccountNumber() {
    const { accountNumber } = getBank();
    const note = $('[data-order-copy-message]');
    try {
      await navigator.clipboard.writeText(accountNumber);
      if (note) note.textContent = '계좌번호를 복사했습니다.';
    } catch {
      if (note) note.textContent = `복사에 실패했습니다. ${accountNumber}`;
    }
  }

  async function submitOrder() {
    if (state.submitting) return;
    const draft = readDraft();
    const summary = lineSummary();
    const submitButton = $('[data-order-submit]');
    state.submitting = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = '주문을 접수하는 중';
    }
    setError('');

    const orderInput = {
      customer: {
        name: draft.customerName,
        phone: draft.customerPhone,
      },
      shippingAddress: {
        receiver: draft.customerName,
        phone: draft.customerPhone,
        zipcode: draft.zipcode,
        address1: draft.address1,
        address2: draft.address2,
        request: draft.shippingRequest || '',
      },
      items: [{
        productId: state.product.id,
        optionId: state.option?.id || null,
        quantity: state.quantity,
      }],
    };

    let order = null;
    try {
      if (global.YEOSU_ORDER_SERVICE?.createOrder) {
        order = await global.YEOSU_ORDER_SERVICE.createOrder(orderInput);
      }
    } catch (error) {
      console.warn('서버 주문 접수에 실패해 로컬로 저장합니다.', error);
    }

    if (!order?.orderNumber) {
      order = saveLocalOrder({
        orderId: global.crypto?.randomUUID?.() || `local-${Date.now()}`,
        orderNumber: nextLocalOrderNumber(),
        orderStatus: 'PENDING_PAYMENT',
        status: 'PENDING_PAYMENT',
        ...orderInput,
        items: [{
          productId: state.product.id,
          productName: summary.productName,
          optionId: state.option?.id || '',
          optionLabel: summary.optionLabel,
          quantity: state.quantity,
          price: summary.unitPrice,
          subtotal: summary.productsTotal,
        }],
        pricing: {
          productsTotal: summary.productsTotal,
          shippingFee: summary.shippingFee,
          discount: 0,
          paidAmount: summary.paidAmount,
        },
        createdAt: Date.now(),
      });
    } else {
      saveLocalOrder({
        ...order,
        orderStatus: order.orderStatus || order.status || 'PENDING_PAYMENT',
        pricing: order.pricing || {
          paidAmount: summary.paidAmount,
          shippingFee: summary.shippingFee,
        },
      });
    }

    const bank = getBank();
    $('[data-received-order-number]').textContent = order.orderNumber;
    $('[data-received-amount]').textContent = formatWon(summary.paidAmount);
    $('[data-received-bank]').textContent = bank.bankName;
    $('[data-received-account]').textContent = bank.accountNumber;
    $('[data-received-holder]').textContent = bank.accountHolder;
    $('[data-order-copy-message]').textContent = '';
    global.YEOSU_PURCHASE?.clear?.();
    goTo('received');
    state.submitting = false;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = '네, 주문할게요';
    }
  }

  function bind() {
    const root = modal();
    if (!root || root.dataset.bound === 'true') return;
    root.dataset.bound = 'true';

    $('[data-order-step-close]', root)?.addEventListener('click', closeFlow);
    root.addEventListener('click', (event) => {
      if (event.target === root) closeFlow();
    });
    $('[data-order-prev]', root)?.addEventListener('click', goBack);

    $('[data-order-name-form]', root)?.addEventListener('submit', (event) => {
      event.preventDefault();
      confirmName();
    });
    $('[data-order-phone-form]', root)?.addEventListener('submit', (event) => {
      event.preventDefault();
      confirmPhone();
    });
    $('[data-order-address-form]', root)?.addEventListener('submit', (event) => {
      event.preventDefault();
      confirmAddress();
    });
    $('[data-order-request-direct-form]', root)?.addEventListener('submit', (event) => {
      event.preventDefault();
      confirmDirectRequest();
    });

    $('[data-order-phone-input]', root)?.addEventListener('input', (event) => {
      event.target.value = formatPhone(event.target.value);
    });
    $('[data-order-address-search]', root)?.addEventListener('click', openAddressSearch);
    $('[data-order-address-preview]', root)?.addEventListener('click', openAddressSearch);
    $('[data-order-address-yes]', root)?.addEventListener('click', () => afterConfirm('request'));
    $('[data-order-address-edit]', root)?.addEventListener('click', goBack);
    $('[data-order-submit]', root)?.addEventListener('click', submitOrder);
    $('[data-order-edit-open]', root)?.addEventListener('click', () => goTo('edit'));
    $('[data-order-copy-account]', root)?.addEventListener('click', copyAccountNumber);

    document.querySelectorAll('[data-request-option]').forEach((button) => {
      button.addEventListener('click', () => selectRequest(button.dataset.requestOption));
    });
    document.querySelectorAll('[data-order-edit]').forEach((button) => {
      button.addEventListener('click', () => goTo(button.dataset.orderEdit));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !state.open) return;
      if ($('[data-postcode-layer]') && !$('[data-postcode-layer]').hidden) {
        closePostcodeLayer();
        return;
      }
      closeFlow();
    });
    window.addEventListener('message', onPostcodeWindowMessage);
  }

  bind();

  global.YEOSU_ORDER_FLOW = Object.freeze({
    open: openFlow,
    close: closeFlow,
  });
})(window);
