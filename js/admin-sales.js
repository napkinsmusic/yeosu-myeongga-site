(function initializeAdminSales() {
  const service = window.YEOSU_ADMIN_SALES_SERVICE;
  const form = document.querySelector('[data-sales-filter]');
  const message = document.querySelector('[data-admin-message]');
  const chart = document.querySelector('[data-sales-chart]');
  const productsTable = document.querySelector('[data-sales-products-table]');
  const productsEmpty = document.querySelector('[data-sales-products-empty]');
  const formatWon = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;

  function toInputDate(date) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
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
    }

    form.elements.startDate.value = toInputDate(start);
    form.elements.endDate.value = toInputDate(end);
    document.querySelectorAll('[data-sales-period]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.salesPeriod === period);
    });
  }

  function renderChart(daily) {
    chart.replaceChildren();
    const maximumRevenue = Math.max(...daily.map((day) => day.revenue), 0);

    daily.forEach((day) => {
      const item = document.createElement('div');
      item.className = 'sales-bar-item';
      item.title = `${day.date}: ${formatWon(day.revenue)} / ${day.orderCount}건`;

      const track = document.createElement('div');
      track.className = 'sales-bar-track';
      const bar = document.createElement('div');
      bar.className = 'sales-bar';
      bar.style.height = maximumRevenue
        ? `${Math.max((day.revenue / maximumRevenue) * 100, 1)}%`
        : '2px';
      track.append(bar);

      const label = document.createElement('span');
      label.textContent = day.date.slice(5).replace('-', '.');
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
      row.append(name, quantity, revenue);
      productsTable.append(row);
    });
    productsEmpty.hidden = products.length > 0;
  }

  async function loadSales() {
    message.textContent = '매출 데이터를 불러오고 있습니다.';
    try {
      const result = await service.getSalesStats({
        startDate: form.elements.startDate.value,
        endDate: form.elements.endDate.value,
      });
      document.querySelector('[data-sales-revenue]').textContent =
        formatWon(result.summary.revenue);
      document.querySelector('[data-sales-orders]').textContent =
        `${result.summary.orderCount}건`;
      document.querySelector('[data-sales-products]').textContent =
        `${result.summary.productsSold}개`;
      document.querySelector('[data-sales-average]').textContent =
        formatWon(result.summary.averageOrderAmount);
      renderChart(result.daily);
      renderProducts(result.products);

      const hasTestOrders = result.testSummary.orderCount > 0;
      document.querySelector('[data-test-sales]').hidden = !hasTestOrders;
      if (hasTestOrders) {
        document.querySelector('[data-test-sales-summary]').textContent =
          `동일 기간 TEST 주문 ${result.testSummary.orderCount}건, ${formatWon(result.testSummary.revenue)}`;
      }
      message.textContent = '';
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
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    document.querySelectorAll('[data-sales-period]').forEach((button) => {
      button.classList.remove('is-active');
    });
    loadSales();
  });

  setPeriod('month');
  if (window.YEOSU_ADMIN_READY_USER) loadSales();
  else window.addEventListener('yeosu:admin-ready', loadSales, { once: true });
})();
