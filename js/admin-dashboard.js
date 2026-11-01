(function initializeAdminDashboard() {
  const service = window.YEOSU_ADMIN_ORDER_SERVICE;
  const message = document.querySelector('[data-admin-message]');
  const formatWon = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat('ko-KR', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Seoul',
        }).format(new Date(value))
      : '-';

  function setText(selector, value) {
    document.querySelector(selector).textContent = String(value);
  }

  function appendCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.append(cell);
  }

  async function loadDashboard() {
    try {
      const dashboard = await service.getDashboard();
      setText('[data-today-orders]', `${dashboard.today.orderCount}건`);
      setText('[data-today-revenue]', formatWon(dashboard.today.revenue));
      setText('[data-preparing-orders]', `${dashboard.today.preparingCount}건`);
      setText('[data-shipped-orders]', `${dashboard.today.shippedCount}건`);
      setText('[data-week-revenue]', formatWon(dashboard.recentSevenDays.revenue));
      setText('[data-week-orders]', `${dashboard.recentSevenDays.orderCount}건`);
      setText('[data-total-revenue]', formatWon(dashboard.overall.revenue));
      setText('[data-total-orders]', `${dashboard.overall.orderCount}건`);

      const topProducts = document.querySelector('[data-top-products]');
      topProducts.replaceChildren();
      if (dashboard.topProducts.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'dashboard-empty';
        empty.textContent = '판매 데이터가 없습니다.';
        topProducts.append(empty);
      } else {
        dashboard.topProducts.forEach((product) => {
          const row = document.createElement('div');
          row.className = 'dashboard-list-row';
          const name = document.createElement('span');
          name.textContent = product.productName;
          const quantity = document.createElement('span');
          quantity.textContent = `${product.quantity}개`;
          const revenue = document.createElement('span');
          revenue.textContent = formatWon(product.revenue);
          row.append(name, quantity, revenue);
          topProducts.append(row);
        });
      }

      const recentOrders = document.querySelector('[data-recent-orders]');
      recentOrders.replaceChildren();
      dashboard.recentOrders.forEach((order) => {
        const row = document.createElement('tr');
        const firstItem = order.items[0];
        appendCell(row, order.orderNumber);
        appendCell(row, order.customer?.name || '-');
        appendCell(
          row,
          firstItem
            ? `${firstItem.productName}${order.items.length > 1 ? ` 외 ${order.items.length - 1}건` : ''}`
            : '-',
        );
        appendCell(
          row,
          `${order.items.reduce((sum, item) => sum + item.quantity, 0)}개`,
        );
        appendCell(row, formatWon(order.pricing?.paidAmount || 0));
        appendCell(row, order.payment?.status === 'PAID' ? '결제완료' : '결제대기');
        appendCell(row, service.statusLabels[order.orderStatus] || order.orderStatus);
        appendCell(row, formatDate(order.createdAt));
        recentOrders.append(row);
      });

      const notice = document.querySelector('[data-dashboard-loading]');
      notice.querySelector('strong').textContent = '대시보드가 최신 상태입니다.';
      notice.querySelector('p').textContent = '결제 완료 기준으로 집계합니다.';
    } catch (error) {
      console.error('관리자 대시보드 조회 실패', error);
      message.textContent = error.message || '대시보드를 불러오지 못했습니다.';
      const notice = document.querySelector('[data-dashboard-loading]');
      notice.querySelector('strong').textContent = '대시보드 조회 실패';
      notice.querySelector('p').textContent = 'Firebase Functions 배포 상태를 확인해 주세요.';
    }
  }

  if (window.YEOSU_ADMIN_READY_USER) loadDashboard();
  else window.addEventListener('yeosu:admin-ready', loadDashboard, { once: true });
})();
