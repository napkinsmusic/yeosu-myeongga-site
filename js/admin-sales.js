(function initializeAdminSales() {
  const orderService = window.YEOSU_ADMIN_ORDER_SERVICE;
  const productService = window.YEOSU_ADMIN_PRODUCT_SERVICE;
  const form = document.querySelector('[data-sales-filter]');
  const assumptionsForm = document.querySelector('[data-sales-assumptions]');
  const message = document.querySelector('[data-admin-message]');
  const chart = document.querySelector('[data-sales-chart]');
  const productsTable = document.querySelector('[data-sales-products-table]');
  const productsEmpty = document.querySelector('[data-sales-products-empty]');
  const costTable = document.querySelector('[data-sales-cost-table]');
  const includeTestInput = document.querySelector('[data-include-test]');
  const DRAFT_KEY = 'yeosuMyeongga.financeDraft.v1';
  const PAID_STATUSES = new Set(['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED']);
  const GROUP_TITLES = {
    day: '일별 매출',
    week: '주별 매출',
    month: '월별 매출',
    quarter: '분기별 매출',
    year: '연별 매출',
  };

  let currentGroup = 'day';
  let loadedOrders = [];
  let chartOrders = [];
  let chartTruncated = false;
  let productMap = new Map();

  const formatWon = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;

  function toInputDate(date) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  function readDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      return {
        cardFeePercent: Number.isFinite(Number(saved.cardFeePercent)) ? Number(saved.cardFeePercent) : 3.3,
        bankFeePerOrder: Number.isFinite(Number(saved.bankFeePerOrder)) ? Number(saved.bankFeePerOrder) : 0,
        courierCostPerOrder: Number.isFinite(Number(saved.courierCostPerOrder))
          ? Number(saved.courierCostPerOrder)
          : 3000,
        includeTest: saved.includeTest !== false,
        productCosts: saved.productCosts && typeof saved.productCosts === 'object'
          ? saved.productCosts
          : {},
      };
    } catch {
      return {
        cardFeePercent: 3.3,
        bankFeePerOrder: 0,
        courierCostPerOrder: 3000,
        includeTest: true,
        productCosts: {},
      };
    }
  }

  function writeDraft(draft) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function currentDraft() {
    const draft = readDraft();
    draft.cardFeePercent = Number(assumptionsForm.elements.cardFeePercent.value) || 0;
    draft.bankFeePerOrder = Number(assumptionsForm.elements.bankFeePerOrder.value) || 0;
    draft.courierCostPerOrder = Number(assumptionsForm.elements.courierCostPerOrder.value) || 0;
    draft.includeTest = includeTestInput.checked;
    return draft;
  }

  function fillAssumptions(draft) {
    assumptionsForm.elements.cardFeePercent.value = draft.cardFeePercent;
    assumptionsForm.elements.bankFeePerOrder.value = draft.bankFeePerOrder;
    assumptionsForm.elements.courierCostPerOrder.value = draft.courierCostPerOrder;
    includeTestInput.checked = draft.includeTest;
  }

  function seoulDateKey(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  }

  function eachDate(startDate, endDate) {
    const dates = [];
    const cursor = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    while (cursor <= end) {
      dates.push(toInputDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  function bucketOf(dateKey, group) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (group === 'week') {
      const weekday = date.getDay() || 7;
      date.setDate(date.getDate() - weekday + 1);
      const start = toInputDate(date);
      return { key: start, label: start.slice(5).replace('-', '.') };
    }
    if (group === 'month') {
      return { key: `${year}-${String(month).padStart(2, '0')}`, label: `${year}.${String(month).padStart(2, '0')}` };
    }
    if (group === 'quarter') {
      const quarter = Math.floor((month - 1) / 3) + 1;
      return { key: `${year}-Q${quarter}`, label: `${year} ${quarter}분기` };
    }
    if (group === 'year') {
      return { key: String(year), label: `${year}년` };
    }
    return { key: dateKey, label: dateKey.slice(5).replace('-', '.') };
  }

  function isCounted(order) {
    return PAID_STATUSES.has(order.orderStatus) || order.payment?.status === 'PAID';
  }

  function isBankPayment(order) {
    const method = String(order.payment?.method || '').toUpperCase();
    return method === '' || method === 'BANK' || method === 'TRANSFER' || method === 'ACCOUNT';
  }

  function productCost(productId, draft) {
    if (Object.prototype.hasOwnProperty.call(draft.productCosts, productId)) {
      const saved = draft.productCosts[productId];
      if (saved === '' || saved == null) return null;
      const number = Number(saved);
      return Number.isFinite(number) ? number : null;
    }
    const product = productMap.get(productId);
    if (product?.costPrice == null || product.costPrice === '') return null;
    const number = Number(product.costPrice);
    return Number.isFinite(number) ? number : null;
  }

  function setPeriod(period) {
    const now = new Date();
    let start = new Date(now);
    const end = new Date(now);

    if (period === 'week') {
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'quarter') {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterStartMonth, 1);
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    }

    form.elements.startDate.value = toInputDate(start);
    form.elements.endDate.value = toInputDate(end);
    document.querySelectorAll('[data-sales-period]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.salesPeriod === period);
    });

    const groupForPeriod = {
      today: 'day',
      week: 'day',
      month: 'day',
      quarter: 'month',
      year: 'month',
    };
    setGroup(groupForPeriod[period] || 'day');
  }

  function setGroup(group) {
    currentGroup = group;
    document.querySelectorAll('[data-sales-group]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.salesGroup === group);
    });
    document.querySelector('[data-sales-chart-title]').textContent = GROUP_TITLES[group];
  }

  function renderChart(buckets) {
    chart.replaceChildren();
    const chartEmpty = document.querySelector('[data-sales-chart-empty]');
    const hasRevenue = buckets.some((bucket) => bucket.revenue > 0);
    chart.hidden = !hasRevenue;
    chartEmpty.hidden = hasRevenue;
    if (!hasRevenue) return;

    const maximumRevenue = Math.max(...buckets.map((bucket) => bucket.revenue), 0);
    buckets.forEach((bucket) => {
      const item = document.createElement('div');
      item.className = 'sales-bar-item';
      item.style.minWidth = `${Math.max(38, bucket.label.length * 8)}px`;
      item.title = `${bucket.label}: ${formatWon(bucket.revenue)} / ${bucket.orderCount}건`;

      const track = document.createElement('div');
      track.className = 'sales-bar-track';
      const bar = document.createElement('div');
      bar.className = 'sales-bar';
      bar.style.height = maximumRevenue
        ? `${Math.max((bucket.revenue / maximumRevenue) * 100, bucket.revenue > 0 ? 1 : 0)}%`
        : '0';
      if (bucket.revenue === 0) bar.style.minHeight = '0';
      track.append(bar);

      const label = document.createElement('span');
      label.textContent = bucket.label;
      item.append(track, label);
      chart.append(item);
    });
  }

  function renderProducts(products) {
    productsTable.replaceChildren();
    products.forEach((product) => {
      const row = document.createElement('tr');
      const name = document.createElement('td');
      name.textContent = product.productName;
      const quantity = document.createElement('td');
      quantity.textContent = `${product.quantity}개`;
      const revenue = document.createElement('td');
      revenue.textContent = formatWon(product.revenue);
      const cost = document.createElement('td');
      cost.textContent = product.cost == null ? '원가 없음' : formatWon(product.cost);
      const margin = document.createElement('td');
      margin.textContent = product.cost == null ? '—' : formatWon(product.revenue - product.cost);
      row.append(name, quantity, revenue, cost, margin);
      productsTable.append(row);
    });
    productsEmpty.hidden = products.length > 0;
  }

  function renderCostEditor(draft) {
    const products = [...productMap.values()]
      .filter((product) => product.isDeleted !== true)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
    costTable.replaceChildren();
    products.forEach((product) => {
      const row = document.createElement('tr');
      const name = document.createElement('td');
      name.textContent = product.name;
      const price = document.createElement('td');
      price.textContent = formatWon(product.salePrice ?? product.price ?? 0);
      const costCell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.className = 'sales-cost-input';
      input.setAttribute('aria-label', `${product.name} 원가`);
      const saved = draft.productCosts[product.id];
      if (saved != null && saved !== '') input.value = saved;
      else if (product.costPrice != null && product.costPrice !== '') input.value = product.costPrice;
      input.placeholder = '미입력';
      input.addEventListener('change', () => {
        const next = currentDraft();
        next.productCosts[product.id] = input.value.trim();
        writeDraft(next);
        renderFromOrders();
      });
      costCell.append(input);
      row.append(name, price, costCell);
      costTable.append(row);
    });
  }

  function buildBuckets(orders) {
    const totals = new Map();
    const startDate = form.elements.startDate.value;
    const endDate = form.elements.endDate.value;
    const seedDates = currentGroup === 'day' && eachDate(startDate, endDate).length <= 62
      ? eachDate(startDate, endDate)
      : eachDate(startDate, endDate).filter((_, index, dates) => {
          if (currentGroup === 'day') return false;
          if (index === 0 || index === dates.length - 1) return true;
          const previous = bucketOf(dates[index - 1], currentGroup).key;
          return bucketOf(dates[index], currentGroup).key !== previous;
        });

    seedDates.forEach((dateKey) => {
      const bucket = bucketOf(dateKey, currentGroup);
      if (!totals.has(bucket.key)) {
        totals.set(bucket.key, { ...bucket, revenue: 0, orderCount: 0 });
      }
    });

    orders.forEach((order) => {
      const dateKey = seoulDateKey(order.payment?.approvedAt || order.createdAt);
      if (!dateKey || dateKey < startDate || dateKey > endDate) return;
      const bucket = bucketOf(dateKey, currentGroup);
      const current = totals.get(bucket.key) || { ...bucket, revenue: 0, orderCount: 0 };
      current.revenue += Number(order.pricing?.paidAmount) || 0;
      current.orderCount += 1;
      totals.set(bucket.key, current);
    });

    return [...totals.values()];
  }

  function renderFromOrders() {
    const draft = currentDraft();
    const counted = loadedOrders.filter((order) => isCounted(order));
    const testOrders = counted.filter((order) => order.testOrder === true);
    const realOrders = counted.filter((order) => order.testOrder !== true);
    const included = draft.includeTest ? counted : realOrders;
    const pendingCount = loadedOrders.filter((order) => order.orderStatus === 'PENDING_PAYMENT').length;

    let revenue = 0;
    let productsSold = 0;
    let fee = 0;
    let goodsCost = 0;
    let missingCost = false;
    const productTotals = new Map();

    included.forEach((order) => {
      const paidAmount = Number(order.pricing?.paidAmount) || 0;
      revenue += paidAmount;
      fee += isBankPayment(order)
        ? draft.bankFeePerOrder
        : Math.round(paidAmount * draft.cardFeePercent / 100);
      (order.items || []).forEach((item) => {
        const quantity = Number(item.quantity) || 0;
        productsSold += quantity;
        const unitCost = productCost(item.productId, draft);
        const lineCost = unitCost == null ? null : unitCost * quantity;
        if (lineCost == null) missingCost = true;
        else goodsCost += lineCost;

        const current = productTotals.get(item.productId) || {
          productName: item.productName,
          quantity: 0,
          revenue: 0,
          cost: 0,
          missingCost: false,
        };
        current.quantity += quantity;
        current.revenue += Number(item.subtotal) || 0;
        if (lineCost == null) current.missingCost = true;
        else current.cost += lineCost;
        productTotals.set(item.productId, current);
      });
    });

    const courierCost = included.length * draft.courierCostPerOrder;
    const profit = revenue - goodsCost - fee - courierCost;
    const average = included.length ? Math.round(revenue / included.length) : 0;

    document.querySelector('[data-sales-revenue]').textContent = formatWon(revenue);
    document.querySelector('[data-sales-orders]').textContent = `${included.length}건`;
    document.querySelector('[data-sales-products]').textContent = `${productsSold}개`;
    document.querySelector('[data-sales-average]').textContent = formatWon(average);
    document.querySelector('[data-sales-fee]').textContent = formatWon(fee);
    document.querySelector('[data-sales-cost]').textContent = formatWon(goodsCost);
    document.querySelector('[data-sales-courier]').textContent = formatWon(courierCost);
    document.querySelector('[data-sales-profit]').textContent = missingCost
      ? `${formatWon(profit)} *`
      : formatWon(profit);
    document.querySelector('[data-sales-pending]').textContent = `${pendingCount}건`;

    const warning = document.querySelector('[data-sales-cost-warning]');
    warning.hidden = !missingCost;
    warning.textContent = missingCost
      ? '원가가 비어 있는 상품이 있습니다. 순이익은 그 원가를 0원으로 두고 계산한 초안입니다.'
      : '';

    const testNotice = document.querySelector('[data-test-sales]');
    const testIncluded = included.some((order) => order.testOrder === true);
    testNotice.hidden = testOrders.length === 0 && !testIncluded;
    if (!testNotice.hidden) {
      document.querySelector('[data-test-sales-title]').textContent = testIncluded
        ? 'TEST 주문이 집계에 포함되어 있습니다.'
        : 'TEST 주문은 이번 집계에서 빠져 있습니다.';
      document.querySelector('[data-test-sales-summary]').textContent =
        `같은 기간 TEST ${testOrders.length}건, 실제 결제 ${realOrders.length}건`;
    }

    renderChart(buildBuckets(included));
    renderFinanceChart();
    renderProducts(
      [...productTotals.values()]
        .map((product) => ({
          ...product,
          cost: product.missingCost ? null : product.cost,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    );
  }

  function monthSlots(count) {
    const now = new Date();
    const slots = [];
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      slots.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        income: 0,
        outcome: 0,
        net: 0,
      });
    }
    const crossesYear = slots.some((slot) => slot.year !== now.getFullYear());
    slots.forEach((slot) => {
      slot.label = crossesYear || count === 12
        ? `${String(slot.year).slice(2)}.${slot.month}`
        : `${slot.month}월`;
    });
    return slots;
  }

  function orderEconomics(order, draft) {
    const income = Number(order.pricing?.paidAmount) || 0;
    const fee = isBankPayment(order)
      ? draft.bankFeePerOrder
      : Math.round(income * draft.cardFeePercent / 100);
    const goodsCost = (order.items || []).reduce((sum, item) => {
      const unitCost = productCost(item.productId, draft);
      return sum + (unitCost == null ? 0 : unitCost) * (Number(item.quantity) || 0);
    }, 0);
    const outcome = goodsCost + fee + draft.courierCostPerOrder;
    return { income, outcome, net: income - outcome };
  }

  function formatAxis(value) {
    const sign = value < 0 ? '-' : '';
    const absolute = Math.abs(value);
    if (absolute >= 100000000) {
      return `${sign}${(absolute / 100000000).toFixed(1).replace(/\.0$/, '')}억`;
    }
    if (absolute >= 10000) {
      const man = absolute / 10000;
      const text = man >= 10
        ? String(Math.round(man))
        : man.toFixed(1).replace(/\.0$/, '');
      return `${sign}${text}만`;
    }
    return `${sign}${new Intl.NumberFormat('ko-KR').format(absolute)}`;
  }

  function placeFinanceBar(bar, value, span, baseline) {
    const height = !span || value === 0
      ? 0
      : Math.max((Math.abs(value) / span) * 100, 1.2);
    bar.style.height = `${height}%`;
    if (value < 0) {
      bar.classList.add('is-negative');
      bar.style.bottom = `${baseline - height}%`;
      return;
    }
    bar.style.bottom = `${baseline}%`;
  }

  function renderFinanceChart() {
    const chartRoot = document.querySelector('[data-finance-chart]');
    const empty = document.querySelector('[data-finance-empty]');
    const note = document.querySelector('[data-finance-note]');
    const count = Number(document.querySelector('[data-finance-range]').value) || 6;
    const draft = currentDraft();
    const months = monthSlots(count);
    const byMonth = new Map(months.map((month) => [month.key, month]));

    chartOrders.forEach((order) => {
      if (!isCounted(order)) return;
      if (!draft.includeTest && order.testOrder === true) return;
      const dateKey = seoulDateKey(order.payment?.approvedAt || order.createdAt);
      const month = byMonth.get(dateKey.slice(0, 7));
      if (!month) return;
      const economics = orderEconomics(order, draft);
      month.income += economics.income;
      month.outcome += economics.outcome;
      month.net += economics.net;
    });

    const values = months.flatMap((month) => [month.income, month.outcome, month.net]);
    const maxPositive = Math.max(0, ...values);
    const maxNegative = Math.min(0, ...values);
    const span = Math.max(maxPositive - maxNegative, 1);
    const baseline = ((0 - maxNegative) / span) * 100;
    const hasOrders = months.some((month) => month.income > 0 || month.outcome > 0);

    chartRoot.replaceChildren();
    const scale = document.createElement('div');
    scale.className = 'finance-scale';
    const topLabel = document.createElement('span');
    topLabel.textContent = formatAxis(maxPositive);
    topLabel.style.top = '0';
    const zeroLabel = document.createElement('span');
    zeroLabel.textContent = '0';
    zeroLabel.style.bottom = `${baseline}%`;
    scale.append(topLabel, zeroLabel);
    if (maxNegative < 0) {
      const bottomLabel = document.createElement('span');
      bottomLabel.textContent = formatAxis(maxNegative);
      bottomLabel.style.bottom = '0';
      scale.append(bottomLabel);
    }

    const groups = document.createElement('div');
    groups.className = 'finance-groups';
    months.forEach((month) => {
      const column = document.createElement('div');
      column.className = 'finance-month';
      column.dataset.financeMonth = month.key;
      const track = document.createElement('div');
      track.className = 'finance-track';
      const baselineLine = document.createElement('span');
      baselineLine.className = 'finance-baseline';
      baselineLine.style.bottom = `${baseline}%`;
      track.append(baselineLine);

      [
        ['income', '매출', 'is-income'],
        ['outcome', '지출', 'is-outcome'],
        ['net', '순이익', 'is-net'],
      ].forEach(([key, name, className]) => {
        if (month[key] === 0) return;
        const bar = document.createElement('div');
        bar.className = `finance-bar ${className}`;
        bar.title = `${month.label} ${name} ${formatWon(month[key])}`;
        bar.setAttribute('aria-label', bar.title);
        placeFinanceBar(bar, month[key], span, baseline);
        track.append(bar);
      });

      const label = document.createElement('span');
      label.className = 'finance-month-label';
      label.textContent = month.label;
      label.title = `${month.label} 매출 ${formatWon(month.income)}, 지출 ${formatWon(month.outcome)}, 순이익 ${formatWon(month.net)}`;
      column.append(track, label);
      groups.append(column);
    });

    chartRoot.append(scale, groups);
    empty.hidden = true;
    const totals = months.reduce(
      (sum, month) => {
        sum.income += month.income;
        sum.outcome += month.outcome;
        sum.net += month.net;
        return sum;
      },
      { income: 0, outcome: 0, net: 0 },
    );
    if (!hasOrders) {
      note.textContent = '이 기간의 결제 주문이 없습니다. 지출은 상품원가, 수수료, 택배 원가의 합입니다.';
    } else if (chartTruncated) {
      note.textContent = '최근 주문이 500건을 넘어 그래프에 다 담기지 않았습니다. 지출은 상품원가, 수수료, 택배 원가의 합입니다.';
    } else {
      note.textContent = `그래프 합계 매출 ${formatWon(totals.income)} · 지출 ${formatWon(totals.outcome)} · 순이익 ${formatWon(totals.net)}. 지출은 상품원가, 수수료, 택배 원가의 합입니다.`;
    }
  }

  function chartStartDate() {
    const now = new Date();
    return toInputDate(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  }

  async function loadSales() {
    message.textContent = '매출 데이터를 불러오고 있습니다.';
    const startValue = form.elements.startDate.value;
    const endValue = form.elements.endDate.value;
    try {
      const [orderResult, chartResult, productResult] = await Promise.all([
        orderService.listOrders({
          startDate: new Date(`${startValue}T00:00:00`).toISOString(),
          endDate: new Date(`${endValue}T23:59:59.999`).toISOString(),
          limit: 500,
        }),
        orderService.listOrders({
          startDate: new Date(`${chartStartDate()}T00:00:00`).toISOString(),
          endDate: new Date(`${toInputDate(new Date())}T23:59:59.999`).toISOString(),
          limit: 500,
        }),
        productService.listProducts(),
      ]);
      loadedOrders = orderResult.orders || [];
      chartOrders = chartResult.orders || [];
      chartTruncated = chartResult.truncated === true;
      productMap = new Map((productResult.products || []).map((product) => [product.id, product]));
      renderCostEditor(readDraft());
      renderFromOrders();
      message.textContent = orderResult.truncated
        ? '조회 범위가 500건을 초과했습니다. 기간을 좁혀 주세요.'
        : '';
    } catch (error) {
      console.error('매출통계 조회 실패', error);
      message.textContent = error.message || '매출통계를 불러오지 못했습니다.';
    }
  }

  document.querySelectorAll('[data-sales-period]').forEach((button) => {
    button.addEventListener('click', () => {
      setPeriod(button.dataset.salesPeriod);
      loadSales();
    });
  });
  document.querySelectorAll('[data-sales-group]').forEach((button) => {
    button.addEventListener('click', () => {
      setGroup(button.dataset.salesGroup);
      renderFromOrders();
    });
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    document.querySelectorAll('[data-sales-period]').forEach((button) => {
      button.classList.remove('is-active');
    });
    loadSales();
  });
  includeTestInput.addEventListener('change', () => {
    writeDraft(currentDraft());
    if (loadedOrders.length || productMap.size) renderFromOrders();
    else renderFinanceChart();
  });
  assumptionsForm.addEventListener('change', () => {
    writeDraft(currentDraft());
    if (loadedOrders.length || productMap.size) renderFromOrders();
    else renderFinanceChart();
  });
  document.querySelector('[data-finance-range]').addEventListener('change', renderFinanceChart);

  fillAssumptions(readDraft());
  setPeriod('month');
  renderFinanceChart();
  if (window.YEOSU_ADMIN_READY_USER) loadSales();
  else window.addEventListener('yeosu:admin-ready', loadSales, { once: true });
})();
