(function initializeAdminProducts() {
  const service = window.YEOSU_ADMIN_PRODUCT_SERVICE;
  const form = document.querySelector('[data-product-form]');
  const rows = document.querySelector('[data-product-rows]');
  const loading = document.querySelector('[data-product-loading]');
  const empty = document.querySelector('[data-product-empty]');
  const message = document.querySelector('[data-admin-message]');
  const editor = document.querySelector('[data-product-editor]');
  const editorBackdrop = document.querySelector('[data-product-editor-backdrop]');
  const editorMessage = document.querySelector('[data-editor-message]');
  const imagePreview = document.querySelector('[data-image-preview]');
  const searchInput = document.querySelector('[data-product-search]');
  const showHidden = document.querySelector('[data-show-hidden]');
  const formatWon = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
  const categoryNames = {
    gajang: '게장',
    jeonbok: '전복',
    kimchi: '갓김치',
    fish: '굴비·생선',
    jeotgal: '젓갈',
    'gift-set': '선물세트',
  };
  let products = [];
  let isNewProduct = false;

  const displayImageUrl = (url) =>
    url?.startsWith('./assets/') ? `../${url.slice(2)}` : url;

  function createState(text, className = '') {
    const state = document.createElement('span');
    state.className = `product-state ${className}`.trim();
    state.textContent = text;
    return state;
  }

  function getFilteredProducts() {
    const keyword = searchInput.value.trim().toLowerCase();
    return products.filter((product) => {
      if (!showHidden.checked && product.isDeleted) return false;
      return !keyword
        || product.name.toLowerCase().includes(keyword)
        || product.productCode.toLowerCase().includes(keyword);
    });
  }

  function renderProducts() {
    const filtered = getFilteredProducts();
    rows.replaceChildren();

    filtered.forEach((product) => {
      const row = document.createElement('tr');

      const orderCell = document.createElement('td');
      const orderButtons = document.createElement('div');
      orderButtons.className = 'order-buttons';
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'order-move-button';
      up.textContent = '↑';
      up.setAttribute('aria-label', `${product.name} 순서 올리기`);
      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'order-move-button';
      down.textContent = '↓';
      down.setAttribute('aria-label', `${product.name} 순서 내리기`);
      up.addEventListener('click', () => moveProduct(product.id, -1));
      down.addEventListener('click', () => moveProduct(product.id, 1));
      orderButtons.append(up, down);
      orderCell.append(orderButtons);

      const imageCell = document.createElement('td');
      if (product.thumbnail) {
        const image = document.createElement('img');
        image.src = displayImageUrl(product.thumbnail);
        image.alt = '';
        imageCell.append(image);
      }

      const nameCell = document.createElement('td');
      nameCell.className = 'product-name-cell';
      nameCell.textContent = product.name;
      const categoryCell = document.createElement('td');
      categoryCell.textContent = categoryNames[product.category] || product.category;
      const priceCell = document.createElement('td');
      priceCell.textContent = formatWon(product.salePrice ?? product.price);
      const originalPriceCell = document.createElement('td');
      originalPriceCell.textContent = formatWon(product.originalPrice);
      const stockCell = document.createElement('td');
      stockCell.textContent = `${product.stock ?? 0}개`;
      const saleStateCell = document.createElement('td');
      saleStateCell.append(
        product.isSoldOut
          ? createState('품절', 'is-sold-out')
          : createState('판매중'),
      );
      const visibilityCell = document.createElement('td');
      visibilityCell.append(
        product.isVisible && !product.isDeleted
          ? createState('노출')
          : createState('숨김', 'is-off'),
      );
      const createdCell = document.createElement('td');
      createdCell.textContent = product.createdAt
        ? new Intl.DateTimeFormat('ko-KR').format(new Date(product.createdAt))
        : '-';

      const actionsCell = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'product-row-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = '수정';
      edit.addEventListener('click', () => openEditor(product));
      const hide = document.createElement('button');
      hide.type = 'button';
      hide.textContent = product.isDeleted ? '숨김됨' : '숨김';
      hide.disabled = product.isDeleted;
      hide.addEventListener('click', () => requestHideProduct(product, hide));
      actions.append(edit, hide);
      actionsCell.append(actions);

      row.append(
        orderCell, imageCell, nameCell, categoryCell, priceCell,
        originalPriceCell, stockCell, saleStateCell, visibilityCell,
        createdCell, actionsCell,
      );
      rows.append(row);
    });

    empty.hidden = filtered.length > 0;
  }

  async function loadProducts() {
    loading.hidden = false;
    message.textContent = '';
    try {
      const result = await service.listProducts();
      products = result.products.sort((a, b) => a.displayOrder - b.displayOrder);
      renderProducts();
    } catch (error) {
      console.error('상품 목록 조회 실패', error);
      message.textContent = error.message || '상품 목록을 불러오지 못했습니다.';
    } finally {
      loading.hidden = true;
    }
  }

  function renderImagePreview(urls) {
    imagePreview.replaceChildren();
    urls.filter(Boolean).forEach((url) => {
      const image = document.createElement('img');
      image.src = displayImageUrl(url);
      image.alt = '상품 이미지 미리보기';
      imagePreview.append(image);
    });
  }

  function openEditor(product = null) {
    form.reset();
    editorMessage.textContent = '';
    isNewProduct = !product;

    if (product) {
      document.querySelector('[data-editor-title]').textContent = '상품 수정';
      const values = {
        productId: product.id,
        name: product.name,
        productCode: product.productCode,
        category: product.category,
        displayOrder: product.displayOrder,
        shortDescription: product.shortDescription,
        description: product.description,
        thumbnail: product.thumbnail,
        existingImages: JSON.stringify(product.images || []),
        originalPrice: product.originalPrice,
        price: product.price,
        salePrice: product.salePrice ?? '',
        stock: product.stock ?? 0,
        shippingFee: product.shippingFee,
        origin: product.origin,
        manufacturer: product.manufacturer,
        storageMethod: product.storageMethod,
        foodType: product.productInfo?.foodType,
        content: product.productInfo?.content,
        ingredients: product.productInfo?.ingredients,
        expiration: product.productInfo?.expiration,
        packagingMaterial: product.productInfo?.packagingMaterial,
        nutrition: product.productInfo?.nutrition,
        consumerSafetyNotice: product.productInfo?.consumerSafetyNotice,
        customerServicePhone: product.productInfo?.customerServicePhone,
      };
      Object.entries(values).forEach(([name, value]) => {
        if (form.elements[name]) form.elements[name].value = value ?? '';
      });
      form.elements.isFeatured.checked = product.isFeatured;
      form.elements.isVisible.checked = product.isVisible && !product.isDeleted;
      form.elements.isSoldOut.checked = product.isSoldOut;
      renderImagePreview([product.thumbnail, ...(product.images || [])]);
    } else {
      document.querySelector('[data-editor-title]').textContent = '새 상품 등록';
      form.elements.productId.value =
        window.crypto?.randomUUID?.() || `product-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      form.elements.displayOrder.value = products.length + 1;
      form.elements.stock.value = 0;
      form.elements.shippingFee.value = 0;
      form.elements.isVisible.checked = true;
      form.elements.customerServicePhone.value = '010 3353 2724';
      form.elements.existingImages.value = '[]';
      renderImagePreview([]);
    }

    editor.classList.add('is-open');
    editorBackdrop.classList.add('is-open');
    editor.setAttribute('aria-hidden', 'false');
  }

  function closeEditor() {
    editor.classList.remove('is-open');
    editorBackdrop.classList.remove('is-open');
    editor.setAttribute('aria-hidden', 'true');
  }

  async function moveProduct(productId, direction) {
    const index = products.findIndex((product) => product.id === productId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= products.length) return;
    [products[index], products[nextIndex]] = [products[nextIndex], products[index]];
    renderProducts();
    try {
      await service.updateOrder(products.map((product) => product.id));
      products.forEach((product, productIndex) => {
        product.displayOrder = productIndex + 1;
      });
      message.textContent = '상품 노출순서를 변경했습니다.';
    } catch (error) {
      message.textContent = error.message || '상품 순서 변경에 실패했습니다.';
      await loadProducts();
    }
  }

  async function requestHideProduct(product, button) {
    if (button.dataset.confirming !== 'true') {
      button.dataset.confirming = 'true';
      button.textContent = '숨김 확인';
      window.setTimeout(() => {
        button.dataset.confirming = 'false';
        button.textContent = '숨김';
      }, 3000);
      return;
    }

    button.disabled = true;
    try {
      await service.hideProduct(product.id);
      message.textContent = '상품을 숨김 처리했습니다. 과거 주문정보는 유지됩니다.';
      await loadProducts();
    } catch (error) {
      message.textContent = error.message || '상품 숨김 처리에 실패했습니다.';
      button.disabled = false;
    }
  }

  function buildProductPayload(images, thumbnail) {
    const getValue = (name) => form.elements[name].value.trim();
    return {
      productCode: getValue('productCode'),
      name: getValue('name'),
      category: getValue('category'),
      price: Number(getValue('price')),
      originalPrice: Number(getValue('originalPrice')),
      salePrice: getValue('salePrice') === '' ? null : Number(getValue('salePrice')),
      description: getValue('description'),
      shortDescription: getValue('shortDescription'),
      images,
      thumbnail,
      stock: Number(getValue('stock')),
      isSoldOut: form.elements.isSoldOut.checked,
      isFeatured: form.elements.isFeatured.checked,
      shippingFee: Number(getValue('shippingFee')),
      origin: getValue('origin'),
      manufacturer: getValue('manufacturer'),
      storageMethod: getValue('storageMethod'),
      displayOrder: Number(getValue('displayOrder')),
      isVisible: form.elements.isVisible.checked,
      productInfo: {
        foodType: getValue('foodType'),
        content: getValue('content'),
        ingredients: getValue('ingredients'),
        expiration: getValue('expiration'),
        packagingMaterial: getValue('packagingMaterial'),
        nutrition: getValue('nutrition'),
        geneticModification: '',
        consumerSafetyNotice: getValue('consumerSafetyNotice'),
        importDeclaration: '',
        customerServicePhone: getValue('customerServicePhone'),
      },
    };
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const saveButton = form.querySelector('[type="submit"]');
    saveButton.disabled = true;
    editorMessage.textContent = '상품을 저장하고 있습니다.';

    try {
      const productId = form.elements.productId.value;
      let thumbnail = form.elements.thumbnail.value;
      let images = JSON.parse(form.elements.existingImages.value || '[]');
      const thumbnailFile = form.elements.thumbnailFile.files[0];
      const additionalFiles = [...form.elements.imageFiles.files].slice(0, 10);

      if (thumbnailFile) {
        thumbnail = await service.uploadProductImage(productId, thumbnailFile);
      }
      for (const file of additionalFiles) {
        images.push(await service.uploadProductImage(productId, file));
      }
      images = [...new Set(images)].slice(0, 10);
      if (!thumbnail) thumbnail = images[0] || '';
      if (thumbnail && !images.includes(thumbnail)) images.unshift(thumbnail);

      await service.saveProduct({
        productId,
        createOnly: isNewProduct,
        product: buildProductPayload(images.slice(0, 10), thumbnail),
      });
      editorMessage.textContent = '상품을 저장했습니다.';
      await loadProducts();
      window.setTimeout(closeEditor, 500);
    } catch (error) {
      console.error('상품 저장 실패', error);
      editorMessage.textContent = error.message || '상품 저장에 실패했습니다.';
    } finally {
      saveButton.disabled = false;
    }
  });

  document.querySelector('[data-import-products]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    message.textContent = '기존 상품을 중복 확인하며 가져오고 있습니다.';
    let imported = 0;
    let skipped = 0;

    for (const product of window.YEOSU_STORE.products) {
      try {
        await service.saveProduct({
          productId: product.id,
          createOnly: true,
          product: {
            ...product,
            stock: Number.isInteger(product.stock) ? product.stock : 0,
            isSoldOut: !Number.isInteger(product.stock) || product.isSoldOut,
          },
        });
        imported += 1;
      } catch (error) {
        if (String(error.code).includes('already-exists')) skipped += 1;
        else {
          message.textContent = `${product.name} 가져오기 실패: ${error.message}`;
          button.disabled = false;
          return;
        }
      }
    }

    message.textContent = `기존 상품 ${imported}개 등록, 중복 ${skipped}개 건너뜀. 재고를 확인해 주세요.`;
    button.disabled = false;
    await loadProducts();
  });

  searchInput.addEventListener('input', renderProducts);
  showHidden.addEventListener('change', renderProducts);
  document.querySelector('[data-new-product]').addEventListener('click', () => openEditor());
  document.querySelector('[data-editor-close]').addEventListener('click', closeEditor);
  document.querySelector('[data-editor-cancel]').addEventListener('click', closeEditor);
  editorBackdrop.addEventListener('click', closeEditor);

  if (window.YEOSU_ADMIN_READY_USER) loadProducts();
  else window.addEventListener('yeosu:admin-ready', loadProducts, { once: true });
})();
