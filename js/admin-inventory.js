(function initializeAdminInventory() {
  const service = window.YEOSU_ADMIN_PRODUCT_SERVICE;
  const rows = document.querySelector('[data-inventory-rows]');
  const loading = document.querySelector('[data-inventory-loading]');
  const empty = document.querySelector('[data-inventory-empty]');
  const message = document.querySelector('[data-admin-message]');
  const settingsForm = document.querySelector('[data-inventory-settings]');
  const searchInput = document.querySelector('[data-inventory-search]');
  const lowStockOnly = document.querySelector('[data-low-stock-only]');
  let products = [];
  let lowStockThreshold = 5;

  const displayImageUrl = (url) =>
    url?.startsWith('./assets/') ? `../${url.slice(2)}` : url;

  function getInventoryStatus(product) {
    if (product.stock === 0 || product.isSoldOut) {
      return { label: '품절', className: 'is-out' };
    }
    if (product.stock <= lowStockThreshold) {
      return { label: '재고 부족', className: 'is-low' };
    }
    return { label: '정상', className: '' };
  }

  function renderInventory() {
    const keyword = searchInput.value.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (product.isDeleted) return false;
      if (keyword && !product.name.toLowerCase().includes(keyword)) return false;
      if (lowStockOnly.checked && product.stock > lowStockThreshold) return false;
      return true;
    });

    rows.replaceChildren();
    filtered.forEach((product) => {
      const row = document.createElement('tr');
      const productCell = document.createElement('td');
      const productInfo = document.createElement('div');
      productInfo.className = 'inventory-product';
      if (product.thumbnail) {
        const image = document.createElement('img');
        image.src = displayImageUrl(product.thumbnail);
        image.alt = '';
        productInfo.append(image);
      }
      const name = document.createElement('strong');
      name.textContent = product.name;
      productInfo.append(name);
      productCell.append(productInfo);

      const stockCell = document.createElement('td');
      stockCell.textContent = `${product.stock}개`;
      const salesCell = document.createElement('td');
      salesCell.textContent = `${product.cumulativeSales}개`;

      const statusCell = document.createElement('td');
      const statusData = getInventoryStatus(product);
      const status = document.createElement('span');
      status.className = `inventory-status ${statusData.className}`.trim();
      status.textContent = statusData.label;
      statusCell.append(status);

      const updateCell = document.createElement('td');
      const updateForm = document.createElement('form');
      updateForm.className = 'inventory-stock-form';
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.value = String(product.stock);
      input.setAttribute('aria-label', `${product.name} 재고`);
      const button = document.createElement('button');
      button.type = 'submit';
      button.textContent = '저장';
      updateForm.append(input, button);
      updateForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        button.disabled = true;
        try {
          const result = await service.updateStock(product.id, Number(input.value));
          product.stock = result.stock;
          product.isSoldOut = result.isSoldOut;
          message.textContent = `${product.name} 재고를 ${result.stock}개로 변경했습니다.`;
          renderInventory();
        } catch (error) {
          message.textContent = error.message || '재고 변경에 실패했습니다.';
        } finally {
          button.disabled = false;
        }
      });
      updateCell.append(updateForm);

      row.append(productCell, stockCell, salesCell, statusCell, updateCell);
      rows.append(row);
    });

    empty.hidden = filtered.length > 0;
  }

  async function loadInventory() {
    loading.hidden = false;
    try {
      const result = await service.getInventory();
      products = result.products;
      lowStockThreshold = result.lowStockThreshold;
      settingsForm.elements.lowStockThreshold.value = String(lowStockThreshold);
      renderInventory();
    } catch (error) {
      console.error('재고 조회 실패', error);
      message.textContent = error.message || '재고를 불러오지 못했습니다.';
    } finally {
      loading.hidden = true;
    }
  }

  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = settingsForm.querySelector('button');
    button.disabled = true;
    try {
      const result = await service.updateInventorySettings(
        Number(settingsForm.elements.lowStockThreshold.value),
      );
      lowStockThreshold = result.lowStockThreshold;
      message.textContent = `재고 부족 기준을 ${lowStockThreshold}개 이하로 변경했습니다.`;
      renderInventory();
    } catch (error) {
      message.textContent = error.message || '재고 설정 저장에 실패했습니다.';
    } finally {
      button.disabled = false;
    }
  });

  searchInput.addEventListener('input', renderInventory);
  lowStockOnly.addEventListener('change', renderInventory);

  if (window.YEOSU_ADMIN_READY_USER) loadInventory();
  else window.addEventListener('yeosu:admin-ready', loadInventory, { once: true });
})();
