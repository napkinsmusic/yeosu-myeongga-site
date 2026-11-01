(function initializeAdminOrders() {
  const service = window.YEOSU_ADMIN_ORDER_SERVICE;
  const filtersForm = document.querySelector('[data-order-filters]');
  const rowsContainer = document.querySelector('[data-order-rows]');
  const loading = document.querySelector('[data-order-loading]');
  const empty = document.querySelector('[data-order-empty]');
  const adminMessage = document.querySelector('[data-admin-message]');
  const drawer = document.querySelector('[data-order-drawer]');
  const drawerBackdrop = document.querySelector('[data-order-drawer-backdrop]');
  const detailContainer = document.querySelector('[data-order-detail]');
  const statusEditor = document.querySelector('[data-status-editor]');
  const nextStatusSelect = document.querySelector('[data-next-status]');
  const shippingInputs = document.querySelector('[data-shipping-inputs]');
  const courierSelect = document.querySelector('[data-courier]');
  const trackingInput = document.querySelector('[data-tracking-number]');
  const statusMessage = document.querySelector('[data-status-message]');
  const formatWon = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat('ko-KR', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: 'Asia/Seoul',
        }).format(new Date(value))
      : '-';
  let currentOrders = [];
  let currentOrderId = null;

  const courierNames = Object.fromEntries(
    service.couriers.map(({ code, name }) => [code, name]),
  );

  function statusLabel(status) {
    return service.statusLabels[status] || status || '-';
  }

  function shippingStatusLabel(status) {
    if (status === 'PREPARING') return '배송준비';
    if (status === 'SHIPPED') return '배송중';
    if (status === 'DELIVERED') return '배송완료';
    return '배송대기';
  }

  function createStatusChip(label, status) {
    const chip = document.createElement('span');
    chip.className = `status-chip status-${String(status).toLowerCase()}`;
    chip.textContent = label;
    return chip;
  }

  function renderOrders() {
    rowsContainer.replaceChildren();
    currentOrders.forEach((order) => {
      const row = document.createElement('tr');
      row.dataset.orderId = order.orderId;

      const selectionCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'order-row-checkbox';
      checkbox.setAttribute('aria-label', `${order.orderNumber} 주문 선택`);
      checkbox.addEventListener('click', (event) => event.stopPropagation());
      selectionCell.append(checkbox);

      const orderNumberCell = document.createElement('td');
      orderNumberCell.textContent = order.orderNumber;
      if (order.testOrder) {
        const testBadge = document.createElement('span');
        testBadge.className = 'test-mini-badge';
        testBadge.textContent = 'TEST';
        orderNumberCell.append(testBadge);
      }

      const dateCell = document.createElement('td');
      dateCell.textContent = formatDate(order.createdAt);
      const customerCell = document.createElement('td');
      customerCell.textContent = order.customer?.name || '-';
      const phoneCell = document.createElement('td');
      phoneCell.textContent = order.customer?.phone || '-';

      const productCell = document.createElement('td');
      const productName = document.createElement('span');
      productName.className = 'order-product-name';
      const firstItem = order.items[0];
      productName.textContent = firstItem
        ? `${firstItem.productName}${order.items.length > 1 ? ` 외 ${order.items.length - 1}건` : ''}`
        : '-';
      productCell.append(productName);

      const quantityCell = document.createElement('td');
      quantityCell.textContent = String(
        order.items.reduce((sum, item) => sum + item.quantity, 0),
      );
      const amountCell = document.createElement('td');
      amountCell.textContent = formatWon(order.pricing?.paidAmount || 0);
      const paymentCell = document.createElement('td');
      paymentCell.textContent =
        order.payment?.method === 'TEST' ? 'TEST' : order.payment?.method || '-';

      const orderStatusCell = document.createElement('td');
      orderStatusCell.append(createStatusChip(statusLabel(order.orderStatus), order.orderStatus));
      const shippingStatusCell = document.createElement('td');
      shippingStatusCell.append(
        createStatusChip(shippingStatusLabel(order.orderStatus), order.orderStatus),
      );

      row.append(
        selectionCell,
        orderNumberCell,
        dateCell,
        customerCell,
        phoneCell,
        productCell,
        quantityCell,
        amountCell,
        paymentCell,
        orderStatusCell,
        shippingStatusCell,
      );
      row.addEventListener('click', () => openOrderDetail(order.orderId));
      rowsContainer.append(row);
    });

    document.querySelector('[data-order-count]').textContent = String(currentOrders.length);
    empty.hidden = currentOrders.length > 0;
  }

  function getFilterPayload() {
    const startValue = filtersForm.elements.startDate.value;
    const endValue = filtersForm.elements.endDate.value;
    return {
      startDate: startValue
        ? new Date(`${startValue}T00:00:00`).toISOString()
        : null,
      endDate: endValue
        ? new Date(`${endValue}T23:59:59.999`).toISOString()
        : null,
      status: filtersForm.elements.status.value,
      searchType: filtersForm.elements.searchType.value,
      keyword: filtersForm.elements.keyword.value.trim(),
      limit: 500,
    };
  }

  async function loadOrders() {
    loading.hidden = false;
    empty.hidden = true;
    adminMessage.textContent = '';
    try {
      const result = await service.listOrders(getFilterPayload());
      currentOrders = result.orders;
      renderOrders();
      if (result.truncated) {
        adminMessage.textContent =
          '조회 범위가 500건을 초과했습니다. 기간 또는 검색 조건을 좁혀 주세요.';
      }
    } catch (error) {
      console.error('관리자 주문 조회 실패', error);
      currentOrders = [];
      renderOrders();
      adminMessage.textContent = error.message || '주문을 불러오지 못했습니다.';
    } finally {
      loading.hidden = true;
    }
  }

  function appendDefinitionList(section, entries) {
    const list = document.createElement('dl');
    entries.forEach(([termText, descriptionText]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = termText;
      description.textContent = descriptionText || '-';
      row.append(term, description);
      list.append(row);
    });
    section.append(list);
  }

  function createDetailSection(title) {
    const section = document.createElement('section');
    section.className = 'order-detail-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.append(heading);
    return section;
  }

  function configureStatusEditor(order) {
    const nextStatuses = {
      PAID: ['PREPARING'],
      PREPARING: ['SHIPPED'],
      SHIPPED: ['DELIVERED'],
    }[order.orderStatus] || [];

    nextStatusSelect.replaceChildren();
    nextStatuses.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = statusLabel(status);
      nextStatusSelect.append(option);
    });
    statusEditor.hidden = nextStatuses.length === 0;
    shippingInputs.hidden = nextStatusSelect.value !== 'SHIPPED';
    trackingInput.value = '';
    statusMessage.textContent = '';
  }

  function renderOrderDetail(order) {
    document.querySelector('[data-detail-order-number]').textContent = order.orderNumber;
    detailContainer.replaceChildren();

    const orderSection = createDetailSection('주문');
    appendDefinitionList(orderSection, [
      ['주문번호', order.orderNumber],
      ['주문일', formatDate(order.createdAt)],
      ['주문상태', statusLabel(order.orderStatus)],
      ['결제상태', order.payment?.status === 'PAID' ? '결제완료' : '결제대기'],
    ]);

    const customerSection = createDetailSection('구매자');
    appendDefinitionList(customerSection, [
      ['이름', order.customer?.name],
      ['전화번호', order.customer?.phone],
      ['이메일', order.customer?.email],
    ]);

    const shippingSection = createDetailSection('배송');
    appendDefinitionList(shippingSection, [
      ['받는 사람', order.shippingAddress?.receiver],
      ['연락처', order.shippingAddress?.phone],
      [
        '주소',
        `(${order.shippingAddress?.zipcode || ''}) ${order.shippingAddress?.address1 || ''} ${order.shippingAddress?.address2 || ''}`,
      ],
      ['요청사항', order.shippingAddress?.request],
      ['택배사', courierNames[order.shipping?.courier] || order.shipping?.courier],
      ['송장번호', order.shipping?.trackingNumber],
    ]);

    const productsSection = createDetailSection('상품');
    order.items.forEach((item) => {
      const itemElement = document.createElement('div');
      itemElement.className = 'order-detail-item';
      const image = document.createElement('img');
      image.src = item.thumbnail;
      image.alt = item.productName;
      const info = document.createElement('div');
      const name = document.createElement('p');
      name.textContent = item.productName;
      const meta = document.createElement('span');
      meta.textContent = `${formatWon(item.price)} × ${item.quantity}개`;
      info.append(name, meta);
      const subtotal = document.createElement('strong');
      subtotal.textContent = formatWon(item.subtotal);
      itemElement.append(image, info, subtotal);
      productsSection.append(itemElement);
    });

    const paymentSection = createDetailSection('결제');
    appendDefinitionList(paymentSection, [
      ['상품금액', formatWon(order.pricing?.productsTotal || 0)],
      ['배송비', formatWon(order.pricing?.shippingFee || 0)],
      ['할인', formatWon(order.pricing?.discount || 0)],
      ['총 결제금액', formatWon(order.pricing?.paidAmount || 0)],
      ['결제수단', order.payment?.method === 'TEST' ? 'TEST 결제' : order.payment?.method],
    ]);

    detailContainer.append(
      orderSection,
      customerSection,
      shippingSection,
      productsSection,
      paymentSection,
    );
    configureStatusEditor(order);
  }

  async function openOrderDetail(orderId) {
    currentOrderId = orderId;
    drawer.classList.add('is-open');
    drawerBackdrop.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    detailContainer.textContent = '주문 상세정보를 불러오고 있습니다.';
    statusEditor.hidden = true;

    try {
      const order = await service.getOrder(orderId);
      if (currentOrderId === orderId) renderOrderDetail(order);
    } catch (error) {
      detailContainer.textContent = error.message || '주문정보를 불러오지 못했습니다.';
    }
  }

  function closeOrderDetail() {
    currentOrderId = null;
    drawer.classList.remove('is-open');
    drawerBackdrop.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function setPeriod(period) {
    const now = new Date();
    const toInputDate = (date) => {
      const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return offsetDate.toISOString().slice(0, 10);
    };
    let start = new Date(now);
    let end = new Date(now);

    if (period === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end = new Date(start);
    } else if (period !== 'today') {
      start.setDate(start.getDate() - Number(period) + 1);
    }

    filtersForm.elements.startDate.value = toInputDate(start);
    filtersForm.elements.endDate.value = toInputDate(end);
    document.querySelectorAll('[data-period]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.period === period);
    });
  }

  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function downloadCsv() {
    if (currentOrders.length === 0) {
      adminMessage.textContent = '다운로드할 주문이 없습니다.';
      return;
    }
    const headers = [
      '주문번호', '주문일', '주문자', '연락처', '받는사람', '배송연락처',
      '우편번호', '주소', '상세주소', '상품명', '수량', '결제금액',
      '주문상태', '택배사', '송장번호',
    ];
    const rows = currentOrders.flatMap((order) =>
      order.items.map((item) => [
        order.orderNumber,
        formatDate(order.createdAt),
        order.customer?.name,
        order.customer?.phone,
        order.shippingAddress?.receiver,
        order.shippingAddress?.phone,
        order.shippingAddress?.zipcode,
        order.shippingAddress?.address1,
        order.shippingAddress?.address2,
        item.productName,
        item.quantity,
        order.pricing?.paidAmount,
        statusLabel(order.orderStatus),
        courierNames[order.shipping?.courier] || order.shipping?.courier || '',
        order.shipping?.trackingNumber || '',
      ]));
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yeosu-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  service.couriers.forEach(({ code, name }) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    courierSelect.append(option);
  });

  filtersForm.addEventListener('submit', (event) => {
    event.preventDefault();
    loadOrders();
  });
  document.querySelectorAll('[data-period]').forEach((button) => {
    button.addEventListener('click', () => setPeriod(button.dataset.period));
  });
  document.querySelector('[data-download-csv]').addEventListener('click', downloadCsv);
  document.querySelector('[data-order-drawer-close]').addEventListener('click', closeOrderDetail);
  drawerBackdrop.addEventListener('click', closeOrderDetail);
  nextStatusSelect.addEventListener('change', () => {
    shippingInputs.hidden = nextStatusSelect.value !== 'SHIPPED';
  });

  document.querySelector('[data-save-status]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const payload = {
      orderId: currentOrderId,
      orderStatus: nextStatusSelect.value,
    };
    if (payload.orderStatus === 'SHIPPED') {
      payload.courier = courierSelect.value;
      payload.trackingNumber = trackingInput.value.trim();
      if (!payload.trackingNumber) {
        statusMessage.textContent = '송장번호를 입력해 주세요.';
        return;
      }
    }

    button.disabled = true;
    statusMessage.textContent = '저장 중...';
    try {
      await service.updateStatus(payload);
      statusMessage.textContent = '주문 상태를 변경했습니다.';
      await loadOrders();
      await openOrderDetail(currentOrderId);
    } catch (error) {
      statusMessage.textContent = error.message || '상태 변경에 실패했습니다.';
    } finally {
      button.disabled = false;
    }
  });

  const selectAll = document.querySelector('[data-order-select-all]');
  selectAll.addEventListener('change', () => {
    document.querySelectorAll('.order-row-checkbox').forEach((checkbox) => {
      checkbox.checked = selectAll.checked;
    });
  });

  setPeriod('30');
  if (window.YEOSU_ADMIN_READY_USER) loadOrders();
  else window.addEventListener('yeosu:admin-ready', loadOrders, { once: true });
})();
