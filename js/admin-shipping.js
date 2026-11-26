(function initializeAdminShipping() {
  const service = window.YEOSU_ADMIN_ORDER_SERVICE;
  const form = document.querySelector('[data-shipping-filter]');
  const rowsContainer = document.querySelector('[data-shipping-rows]');
  const empty = document.querySelector('[data-shipping-empty]');
  const loading = document.querySelector('[data-shipping-loading]');
  const message = document.querySelector('[data-admin-message]');
  const printSheet = document.querySelector('[data-print-root]');
  const selectAll = document.querySelector('[data-shipping-select-all]');
  const SHIPPABLE = new Set(['PAID', 'PREPARING']);

  let loadedOrders = [];

  function toInputDate(date) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  function setPeriod(period) {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    if (period === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end = new Date(start);
    } else if (period === '7') {
      start.setDate(start.getDate() - 6);
    }
    form.elements.startDate.value = toInputDate(start);
    form.elements.endDate.value = toInputDate(end);
    document.querySelectorAll('[data-shipping-period]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.shippingPeriod === period);
    });
  }

  function visibleOrders() {
    const includePending = form.querySelector('[data-include-pending]').checked;
    const includeTest = form.querySelector('[data-include-test]').checked;
    return loadedOrders.filter((order) => {
      if (!includeTest && order.testOrder === true) return false;
      if (SHIPPABLE.has(order.orderStatus)) return true;
      return includePending && order.orderStatus === 'PENDING_PAYMENT';
    });
  }

  function selectedOrders() {
    const ids = new Set(
      [...rowsContainer.querySelectorAll('[data-shipping-check]:checked')].map((input) => input.value),
    );
    return visibleOrders().filter((order) => ids.has(order.orderId));
  }

  function updateSelectedCount() {
    const visible = visibleOrders();
    const selected = selectedOrders().length;
    document.querySelector('[data-shipping-count]').textContent = String(visible.length);
    document.querySelector('[data-shipping-selected]').textContent = String(selected);
    selectAll.checked = visible.length > 0 && selected === visible.length;
    selectAll.indeterminate = selected > 0 && selected < visible.length;
  }

  function itemSummary(order) {
    return (order.items || [])
      .map((item) => `${item.productName}${item.optionLabel ? `(${item.optionLabel})` : ''} x${item.quantity}`)
      .join(', ');
  }

  function addressLine(order) {
    const address = order.shippingAddress || {};
    return `[${address.zipcode || '-'}] ${address.address1 || ''} ${address.address2 || ''}`.trim();
  }

  function renderOrders() {
    const orders = visibleOrders();
    rowsContainer.replaceChildren();
    orders.forEach((order) => {
      const row = document.createElement('tr');
      const checkCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.value = order.orderId;
      checkbox.dataset.shippingCheck = 'true';
      checkbox.setAttribute('aria-label', `${order.orderNumber} 선택`);
      checkbox.addEventListener('click', (event) => event.stopPropagation());
      checkbox.addEventListener('change', updateSelectedCount);
      checkCell.append(checkbox);

      const numberCell = document.createElement('td');
      numberCell.textContent = order.orderNumber;
      if (order.testOrder === true) {
        const tag = document.createElement('span');
        tag.className = 'shipping-tag';
        tag.textContent = 'TEST';
        numberCell.append(tag);
      }

      const statusCell = document.createElement('td');
      statusCell.textContent = service.statusLabels[order.orderStatus] || order.orderStatus;
      const receiverCell = document.createElement('td');
      receiverCell.textContent = order.shippingAddress?.receiver || order.customer?.name || '-';
      const phoneCell = document.createElement('td');
      phoneCell.textContent = order.shippingAddress?.phone || order.customer?.phone || '-';
      const addressCell = document.createElement('td');
      addressCell.textContent = addressLine(order);
      const itemsCell = document.createElement('td');
      itemsCell.textContent = itemSummary(order) || '-';
      const requestCell = document.createElement('td');
      requestCell.textContent = order.shippingAddress?.request || '-';

      row.append(
        checkCell, numberCell, statusCell, receiverCell,
        phoneCell, addressCell, itemsCell, requestCell,
      );
      rowsContainer.append(row);
    });
    empty.hidden = orders.length > 0;
    updateSelectedCount();
  }

  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function downloadSheet() {
    const orders = selectedOrders();
    if (orders.length === 0) {
      message.textContent = '접수 파일로 저장할 주문을 선택해 주세요.';
      return;
    }
    const headers = [
      '수하인명', '수하인전화', '수하인휴대폰', '수하인우편번호', '수하인주소',
      '상품명', '수량', '배송메시지', '운임구분', '주문번호', '구분',
    ];
    const rows = orders.map((order) => {
      const address = order.shippingAddress || {};
      const quantity = (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      return [
        address.receiver || order.customer?.name || '',
        address.phone || order.customer?.phone || '',
        order.customer?.phone || '',
        address.zipcode || '',
        `${address.address1 || ''} ${address.address2 || ''}`.trim(),
        itemSummary(order),
        quantity,
        address.request || '',
        '선불',
        order.orderNumber,
        order.testOrder === true ? 'TEST' : '실주문',
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yeosu-lotte-sheet-${toInputDate(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.textContent = `${orders.length}건 접수 파일을 저장했습니다.`;
  }

  function appendDefinition(list, termText, descriptionText) {
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = termText;
    description.textContent = descriptionText || '-';
    list.append(term, description);
  }

  function printSheetForSelected() {
    const orders = selectedOrders();
    if (orders.length === 0) {
      message.textContent = '인쇄할 주문을 선택해 주세요.';
      return;
    }
    printSheet.replaceChildren();
    orders.forEach((order) => {
      const slip = document.createElement('article');
      slip.className = 'shipping-slip';
      const header = document.createElement('header');
      const titleWrap = document.createElement('div');
      const kicker = document.createElement('p');
      kicker.textContent = '여수명가 출고 주문서';
      const title = document.createElement('h2');
      title.textContent = order.orderNumber;
      titleWrap.append(kicker, title);
      const mark = document.createElement('span');
      mark.textContent = order.testOrder === true ? 'TEST' : '실주문';
      header.append(titleWrap, mark);

      const facts = document.createElement('dl');
      const address = order.shippingAddress || {};
      appendDefinition(facts, '받는 사람', address.receiver || order.customer?.name);
      appendDefinition(facts, '연락처', address.phone || order.customer?.phone);
      appendDefinition(facts, '주소', addressLine(order));
      appendDefinition(facts, '요청사항', address.request);
      appendDefinition(facts, '주문자', order.customer?.name);

      const table = document.createElement('table');
      const head = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['상품', '수량', '금액'].forEach((label) => {
        const cell = document.createElement('th');
        cell.textContent = label;
        headRow.append(cell);
      });
      head.append(headRow);
      const body = document.createElement('tbody');
      (order.items || []).forEach((item) => {
        const itemRow = document.createElement('tr');
        [item.productName, `${item.quantity}개`, `${new Intl.NumberFormat('ko-KR').format(item.subtotal || 0)}원`]
          .forEach((value) => {
            const cell = document.createElement('td');
            cell.textContent = value;
            itemRow.append(cell);
          });
        body.append(itemRow);
      });
      table.append(head, body);
      slip.append(header, facts, table);
      printSheet.append(slip);
    });

    document.body.classList.add('is-printing-orders');
    window.print();
    document.body.classList.remove('is-printing-orders');
  }

  async function loadOrders() {
    loading.hidden = false;
    empty.hidden = true;
    message.textContent = '';
    const startValue = form.elements.startDate.value;
    const endValue = form.elements.endDate.value;
    try {
      const result = await service.listOrders({
        startDate: new Date(`${startValue}T00:00:00`).toISOString(),
        endDate: new Date(`${endValue}T23:59:59.999`).toISOString(),
        limit: 500,
      });
      loadedOrders = result.orders || [];
      renderOrders();
      message.textContent = result.truncated
        ? '조회 범위가 500건을 초과했습니다. 기간을 좁혀 주세요.'
        : '';
    } catch (error) {
      console.error('배송 주문 조회 실패', error);
      loadedOrders = [];
      renderOrders();
      message.textContent = error.message || '주문을 불러오지 못했습니다.';
    } finally {
      loading.hidden = true;
    }
  }

  document.querySelectorAll('[data-shipping-period]').forEach((button) => {
    button.addEventListener('click', () => {
      setPeriod(button.dataset.shippingPeriod);
      loadOrders();
    });
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    document.querySelectorAll('[data-shipping-period]').forEach((button) => {
      button.classList.remove('is-active');
    });
    loadOrders();
  });
  form.querySelector('[data-include-pending]').addEventListener('change', renderOrders);
  form.querySelector('[data-include-test]').addEventListener('change', renderOrders);
  selectAll.addEventListener('change', () => {
    rowsContainer.querySelectorAll('[data-shipping-check]').forEach((input) => {
      input.checked = selectAll.checked;
    });
    updateSelectedCount();
  });
  document.querySelector('[data-download-sheet]').addEventListener('click', downloadSheet);
  document.querySelector('[data-print-sheet]').addEventListener('click', printSheetForSelected);

  setPeriod('today');
  if (window.YEOSU_ADMIN_READY_USER) loadOrders();
  else window.addEventListener('yeosu:admin-ready', loadOrders, { once: true });
})();
