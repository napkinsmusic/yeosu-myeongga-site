(async function initializeProductPage() {
  const store = window.YEOSU_STORE ?? { products: [], categories: [] };
  const productId = new URLSearchParams(window.location.search).get('id');
  const product = store.catalogMode === 'draft'
    ? store.products.find(
        (item) => item.id === productId && item.isVisible && !item.isDeleted,
      )
    : window.YEOSU_PRODUCT_SERVICE
      ? await window.YEOSU_PRODUCT_SERVICE.getProduct(productId)
      : store.products.find(
          (item) => item.id === productId && item.isVisible && !item.isDeleted,
        );

  const errorSection = document.querySelector('[data-product-error]');
  const content = document.querySelector('[data-product-content]');

  if (!product) {
    errorSection.hidden = false;
    return;
  }

  const formatWon = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;
  const isPollackRoe = product.id === 'pollack-roe';
  const temporaryPrice = isPollackRoe ? 35000 : null;
  const productOptions = Array.isArray(product.options) ? product.options : [];
  const hasOptions = productOptions.length > 0;
  const defaultOption = productOptions
    .filter((option) => Number.isFinite(option.price))
    .reduce((lowest, option) => (
      !lowest || option.price < lowest.price ? option : lowest
    ), null);
  const shopConfig = window.SHOP_CONFIG ?? {};
  const hasManagedStock = Number.isInteger(product.stock);
  const isSoldOut = product.isSoldOut || (hasManagedStock && product.stock <= 0);
  const isDraft = product.isDraft === true || product.price === null;
  let selectedOption = null;
  let quantity = 1;

  function getUnitPrice() {
    if (selectedOption) return selectedOption.price;
    if (temporaryPrice !== null) return temporaryPrice;
    return product.salePrice ?? product.price;
  }

  function getShippingFee(productAmount) {
    const freeFrom = Number(shopConfig.shippingFreeFrom) || 70000;
    const configuredFee = Number(shopConfig.shippingFee);
    const shippingFee = Number.isFinite(configuredFee) ? configuredFee : 3000;
    return productAmount >= freeFrom ? 0 : shippingFee;
  }

  document.body.classList.toggle('has-draft-product', isDraft);
  document.title = `${product.name} | 여수명가`;
  content.hidden = false;

  const productInfoToggle = document.querySelector('[data-product-info-toggle]');
  const productInfoPanel = document.querySelector('[data-product-info-panel]');
  const productInfoLabel = document.querySelector('[data-product-info-label]');
  productInfoToggle.addEventListener('click', () => {
    const open = productInfoToggle.getAttribute('aria-expanded') !== 'true';
    productInfoToggle.setAttribute('aria-expanded', String(open));
    productInfoPanel.hidden = !open;
    productInfoLabel.textContent = open ? '상품정보 접기' : '상품정보 더보기';
  });

  if (isPollackRoe) {
    document.querySelector('[data-standard-product-info]').hidden = true;
    document.querySelector('[data-pollack-roe-notice]').hidden = false;
    document.querySelector('[data-pollack-roe-shipping-method]').hidden = false;
  }

  const setText = (selector, value, fallback = '정보 등록 예정') => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value || fallback;
  };

  const categoryElement = document.querySelector('[data-product-category]');
  if (categoryElement) categoryElement.hidden = true;
  const productName = document.querySelector('[data-product-name]');
  if (productName) {
    const label = document.createElement('span');
    label.className = 'product-name-text';
    label.textContent = product.name;
    if (product.nameNote) {
      const note = document.createElement('span');
      note.className = 'product-name-note';
      note.textContent = product.nameNote;
      label.append(note);
    }
    productName.replaceChildren(label);
    if (product.isFeatured) {
      const badge = document.createElement('span');
      badge.className = 'popular-badge';
      badge.textContent = '인기';
      productName.append(badge);
    }
  }
  const shortDescription = document.querySelector('[data-product-short-description]');
  if (shortDescription) {
    if (product.shortDescription) {
      shortDescription.textContent = product.shortDescription;
    } else {
      shortDescription.hidden = true;
    }
  }
  const shippingNotice =
    shopConfig.shippingNotice ||
    '3,000원 | 7만원 이상 구매 시 무료';
  setText(
    '[data-product-shipping]',
    shippingNotice,
    '3,000원 | 7만원 이상 구매 시 무료',
  );
  setText('[data-product-manufacturer]', product.manufacturer);
  setText('[data-product-storage]', product.storageMethod);

  const priceContainer = document.querySelector('[data-product-price]');
  const optionField = document.querySelector('[data-product-options]');
  const optionSelect = document.querySelector('[data-product-option]');

  function appendOptionPrice(option) {
    const salePrice = document.createElement('strong');
    salePrice.textContent = `${formatWon(option.price)} (${option.label})`;
    priceContainer.append(salePrice);
  }

  function renderPrice() {
    priceContainer.replaceChildren();
    if (selectedOption) {
      appendOptionPrice(selectedOption);
      return;
    }
    if (defaultOption) {
      appendOptionPrice(defaultOption);
      return;
    }
    if (temporaryPrice !== null) {
      const salePrice = document.createElement('strong');
      salePrice.textContent = formatWon(temporaryPrice);
      priceContainer.append(salePrice);
      return;
    }
    if (isDraft) {
      const draftPrice = document.createElement('strong');
      draftPrice.textContent = '가격 준비 중';
      priceContainer.append(draftPrice);
      return;
    }
    if (product.salePrice !== null && product.originalPrice > product.salePrice) {
      const originalPrice = document.createElement('del');
      originalPrice.textContent = formatWon(product.originalPrice);
      priceContainer.append(originalPrice);
    }
    const salePrice = document.createElement('strong');
    salePrice.textContent = formatWon(getUnitPrice());
    priceContainer.append(salePrice);
  }

  function readSelectedOption() {
    if (!hasOptions) return null;
    selectedOption = productOptions.find((option) => option.id === optionSelect.value) ?? null;
    return selectedOption;
  }

  let optionToggle = null;

  if (hasOptions) {
    optionField.hidden = false;
    const picker = document.createElement('div');
    picker.className = 'option-picker';
    optionToggle = document.createElement('button');
    optionToggle.type = 'button';
    optionToggle.id = 'product-option-toggle';
    optionToggle.className = 'option-toggle';
    optionToggle.textContent = '선택해 주세요';
    optionToggle.setAttribute('aria-haspopup', 'listbox');
    optionToggle.setAttribute('aria-expanded', 'false');
    document.querySelector('.option-field label')?.setAttribute('for', optionToggle.id);

    const menu = document.createElement('div');
    menu.className = 'option-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', '필수 선택');

    const closeOptionMenu = () => {
      menu.hidden = true;
      optionToggle.setAttribute('aria-expanded', 'false');
    };

    const applyOptionChange = () => {
      readSelectedOption();
      optionToggle.textContent = selectedOption
        ? `${selectedOption.label} — ${formatWon(selectedOption.price)}`
        : '선택해 주세요';
      menu.querySelectorAll('[data-option-id]').forEach((choice) => {
        const selected = choice.dataset.optionId === selectedOption?.id;
        choice.classList.toggle('is-selected', selected);
        choice.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
      if (selectedOption) {
        optionSelect.classList.remove('is-invalid');
        optionToggle.classList.remove('is-invalid');
      }
      renderPrice();
      updateQuantity(quantity);
    };

    productOptions.forEach((option) => {
      const item = document.createElement('option');
      item.value = option.id;
      item.textContent = `${option.label} — ${formatWon(option.price)}`;
      optionSelect.append(item);

      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'option-choice';
      choice.dataset.optionId = option.id;
      choice.setAttribute('role', 'option');
      choice.setAttribute('aria-selected', 'false');
      choice.textContent = `${option.label} — ${formatWon(option.price)}`;
      choice.addEventListener('click', () => {
        optionSelect.value = option.id;
        applyOptionChange();
        closeOptionMenu();
      });
      menu.append(choice);
    });

    optionToggle.addEventListener('click', () => {
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      optionToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    document.addEventListener('click', (event) => {
      if (!picker.contains(event.target)) closeOptionMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeOptionMenu();
    });
    optionSelect.addEventListener('change', applyOptionChange);
    optionSelect.addEventListener('input', applyOptionChange);
    picker.append(optionToggle, menu);
    optionField.append(picker);
  }

  renderPrice();

  const detailImages = document.querySelector('[data-product-detail-images]');
  const detailImagesSection = detailImages?.closest('.detail-images');
  if (detailImagesSection) detailImagesSection.hidden = true;

  const post = document.querySelector('[data-product-post]');
  const track = document.querySelector('[data-product-post-track]');
  const dots = document.querySelector('[data-product-post-dots]');
  const prevButton = document.querySelector('[data-post-prev]');
  const nextButton = document.querySelector('[data-post-next]');
  let activeIndex = 0;

  const uniquePaths = (paths) => paths.filter((path, index, allPaths) => path && allPaths.indexOf(path) === index);

  const assetUrl = window.YEOSU_ASSET_URL || ((path) => path);

  async function findExistingVideo() {
    const candidates = uniquePaths([
      product.video,
      assetUrl(`./assets/video/products/${product.name}.mp4`),
      assetUrl(`./assets/video/products/${product.id}.mp4`),
    ]);

    for (const url of candidates) {
      try {
        const response = await fetch(encodeURI(url), { method: 'HEAD' });
        if (response.ok) return url;
      } catch {
        // 다음 후보 경로를 확인합니다.
      }
    }

    return '';
  }

  function imagePaths() {
    const listed = [
      product.thumbnail,
      ...(Array.isArray(product.images) ? product.images : []),
      ...(Array.isArray(product.cardNews) ? product.cardNews : []),
    ].map((item) => (typeof item === 'string' ? item : item?.image));
    return uniquePaths(listed);
  }

  function createSlide(item, index, total) {
    let slide;
    if (item.type === 'video') {
      slide = document.createElement('div');
      slide.className = 'product-post-slide is-video';
      const video = document.createElement('video');
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('aria-label', `${product.name} 영상`);
      video.src = encodeURI(item.src);
      slide.append(video);
    } else if (item.type === 'image') {
      slide = document.createElement('div');
      slide.className = 'product-post-slide is-image';
      const image = document.createElement('img');
      image.src = encodeURI(item.src);
      image.alt = product.name;
      slide.append(image);
    }

    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-label', `${index + 1} / ${total}`);
    return slide;
  }

  function syncVideo() {
    track.querySelectorAll('video').forEach((video) => {
      const slide = video.closest('.product-post-slide');
      const index = [...track.children].indexOf(slide);
      if (index === activeIndex) video.play().catch(() => {});
      else video.pause();
    });
  }

  function updatePostControls() {
    const count = track.children.length;
    const multiple = count > 1;
    prevButton.hidden = !multiple;
    nextButton.hidden = !multiple;
    dots.hidden = !multiple;
    prevButton.disabled = activeIndex <= 0;
    nextButton.disabled = activeIndex >= count - 1;
    [...track.children].forEach((slide, index) => {
      slide.toggleAttribute('inert', index !== activeIndex);
    });
    [...dots.children].forEach((dot, index) => {
      const selected = index === activeIndex;
      dot.classList.toggle('is-active', selected);
      if (selected) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    post.setAttribute('aria-label', `${product.name} 포스팅, ${activeIndex + 1} / ${count}`);
  }

  function goToSlide(index) {
    const count = track.children.length;
    const nextIndex = Math.min(Math.max(index, 0), count - 1);
    track.scrollTo({ left: nextIndex * track.clientWidth, behavior: 'smooth' });
  }

  async function renderProductPost() {
    const slides = [];
    imagePaths().forEach((src) => {
      slides.push({ type: 'image', src });
    });

    track.replaceChildren();
    dots.replaceChildren();
    if (slides.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'product-post-slide product-post-empty';
      empty.textContent = '미디어 준비중';
      track.append(empty);
      updatePostControls();
      return;
    }

    slides.forEach((item, index) => {
      track.append(createSlide(item, index, slides.length));
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `${index + 1}번째 장`);
      dot.addEventListener('click', () => goToSlide(index));
      dots.append(dot);
    });

    activeIndex = 0;
    updatePostControls();
    syncVideo();
  }

  track.addEventListener('scroll', () => {
    const width = track.clientWidth || 1;
    const index = Math.round(track.scrollLeft / width);
    if (index === activeIndex) return;
    activeIndex = index;
    updatePostControls();
    syncVideo();
  }, { passive: true });

  prevButton.addEventListener('click', () => goToSlide(activeIndex - 1));
  nextButton.addEventListener('click', () => goToSlide(activeIndex + 1));
  post.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToSlide(activeIndex + 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToSlide(activeIndex - 1);
    }
  });
  window.addEventListener('resize', () => {
    track.scrollTo({ left: activeIndex * track.clientWidth, behavior: 'auto' });
  });

  renderProductPost();

  const quantityInput = document.querySelector('[data-quantity]');
  const totalElement = document.querySelector('[data-product-total]');
  const shippingStatus = document.querySelector('[data-product-shipping-status]');
  const shippingFeeElement = document.querySelector('[data-product-shipping-fee]');
  const minusButton = document.querySelector('[data-quantity-minus]');
  const plusButton = document.querySelector('[data-quantity-plus]');

  if (hasManagedStock && product.stock > 0) {
    quantityInput.max = String(product.stock);
  }

  function updateQuantity(nextQuantity) {
    const maximum = hasManagedStock && product.stock > 0 ? product.stock : Infinity;
    quantity = Math.min(Math.max(Number.parseInt(nextQuantity, 10) || 1, 1), maximum);
    quantityInput.value = String(quantity);
    const unitPrice = getUnitPrice();
    const pricePending = (hasOptions && !selectedOption) || (isDraft && unitPrice === null);
    if (pricePending) {
      shippingStatus.hidden = true;
      totalElement.textContent = hasOptions && !selectedOption ? '선택해 주세요' : '가격 준비 중';
    } else {
      const productAmount = unitPrice * quantity;
      const shippingFee = getShippingFee(productAmount);
      shippingStatus.hidden = false;
      shippingFeeElement.textContent = shippingFee === 0 ? '무료배송' : formatWon(shippingFee);
      shippingFeeElement.classList.toggle('is-free', shippingFee === 0);
      totalElement.textContent = formatWon(productAmount + shippingFee);
    }
    minusButton.disabled = quantity <= 1 || isSoldOut;
    plusButton.disabled = quantity >= maximum || isSoldOut;
  }

  minusButton.addEventListener('click', () => updateQuantity(quantity - 1));
  plusButton.addEventListener('click', () => updateQuantity(quantity + 1));
  quantityInput.addEventListener('change', () => updateQuantity(quantityInput.value));
  updateQuantity(1);

  const purchaseButtons = [
    document.querySelector('[data-buy-now]'),
    document.querySelector('[data-mobile-buy]'),
    document.querySelector('[data-add-cart]'),
    document.querySelector('[data-mobile-cart]'),
  ].filter(Boolean);
  const actionMessage = document.querySelector('[data-action-message]');
  const stockMessage = document.querySelector('[data-stock-message]');
  const mobilePurchaseBar = document.querySelector('[data-mobile-purchase]');
  const kakaoFab = document.querySelector('.kakao-fab');
  const storageSection = document.querySelector('[data-storage-section]');

  mobilePurchaseBar.hidden = false;
  mobilePurchaseBar.setAttribute('aria-hidden', 'true');
  if (kakaoFab) kakaoFab.setAttribute('aria-hidden', 'true');

  const setPurchaseBarVisible = (visible) => {
    mobilePurchaseBar.classList.toggle('is-visible', visible);
    mobilePurchaseBar.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (kakaoFab) kakaoFab.setAttribute('aria-hidden', visible ? 'false' : 'true');
  };

  if (storageSection && 'IntersectionObserver' in window) {
    const updatePurchaseBar = ([entry]) => {
      const reachedStorage =
        entry.isIntersecting || entry.boundingClientRect.top < 0;
      setPurchaseBarVisible(reachedStorage);
    };
    const observer = new IntersectionObserver(updatePurchaseBar, { threshold: 0 });
    observer.observe(storageSection);
  } else {
    setPurchaseBarVisible(true);
  }

  if (isSoldOut) {
    stockMessage.hidden = false;
    stockMessage.textContent = '현재 품절된 상품입니다.';
    purchaseButtons.forEach((button) => {
      if (button.tagName === 'A') {
        button.removeAttribute('href');
        button.setAttribute('aria-disabled', 'true');
        button.classList.add('is-disabled');
      } else {
        button.disabled = true;
      }
      button.textContent = '품절';
    });
    quantityInput.disabled = true;
  } else {
    const requireOption = () => {
      if (hasOptions) readSelectedOption();
      if (hasOptions && !selectedOption) {
        optionSelect.classList.add('is-invalid');
        optionToggle?.classList.add('is-invalid');
        (optionToggle || optionSelect).focus();
        const message = '옵션을 선택해 주세요.';
        actionMessage.textContent = message;
        window.YEOSU_UI?.showMessage(message, 'info');
        return false;
      }
      return true;
    };

    const currentItem = () => ({
      productId: product.id,
      optionId: selectedOption?.id || null,
      quantity,
    });

    const buyNow = (event) => {
      if (!requireOption()) return;
      if (getUnitPrice() === null) {
        const message = '가격 준비 중인 상품입니다.';
        actionMessage.textContent = message;
        window.YEOSU_UI?.showMessage(message, 'info');
        return;
      }
      window.YEOSU_PURCHASE.setItem(currentItem());
      window.YEOSU_ORDER_FLOW.open({
        trigger: event.currentTarget,
        product,
        option: selectedOption,
        quantity,
      });
    };

    const addToCart = () => {
      if (!requireOption()) return;
      if (getUnitPrice() === null) {
        const message = '가격 준비 중인 상품입니다.';
        actionMessage.textContent = message;
        window.YEOSU_UI?.showMessage(message, 'info');
        return;
      }
      window.YEOSU_CART.add(currentItem());
      const message = '장바구니에 담았습니다.';
      actionMessage.textContent = message;
      window.YEOSU_UI?.showMessage(message, 'success');
    };

    document.querySelector('[data-buy-now]')?.addEventListener('click', buyNow);
    document.querySelector('[data-mobile-buy]')?.addEventListener('click', buyNow);
    document.querySelector('[data-add-cart]')?.addEventListener('click', addToCart);
    document.querySelector('[data-mobile-cart]')?.addEventListener('click', addToCart);

    const paymentModal = document.querySelector('[data-payment-modal]');
    const closePaymentModal = () => {
      paymentModal.classList.remove('is-open');
      paymentModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
    };
    document.querySelector('[data-payment-close]').addEventListener('click', closePaymentModal);
    paymentModal.addEventListener('click', (event) => {
      if (event.target === paymentModal) closePaymentModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('[data-order-step-modal]')?.classList.contains('is-open')) return;
      if (paymentModal.classList.contains('is-open')) closePaymentModal();
    });
  }

  const openKakaoInquiry = () => {
    const channelUrl = shopConfig.kakaoChannelUrl;
    if (!channelUrl) {
      const message = '카카오톡 채널 URL을 연결한 뒤 이용할 수 있습니다.';
      actionMessage.textContent = message;
      window.YEOSU_UI?.showMessage(message, 'info');
      return;
    }
    window.open(channelUrl, '_blank', 'noopener,noreferrer');
  };
  [
    document.querySelector('[data-kakao-inquiry]'),
    document.querySelector('[data-mobile-kakao]'),
  ].filter(Boolean).forEach((button) => {
    button.addEventListener('click', openKakaoInquiry);
  });

  const productInfoRows = [
    ['productNamePriceContent', '제품명·가격·내용량', '구매 전 제공'],
    ['foodType', '식품의 유형', '구매 전 제공'],
    ['ingredientsOrigin', '원재료명·원산지', '구매 전 제공'],
    ['manufacturerInfo', '제조사 정보', '구매 전 제공'],
    ['expiration', '소비기한', '구매 전 제공. 개별 제품의 실제 날짜 표기 방식은 확인 필요'],
    ['packagingMaterial', '포장재질', '해당 제품에 적용되는 식품 표시사항인지 확인'],
    ['nutrition', '영양정보', '영양표시 대상 식품에 해당할 때'],
    ['geneticModification', '유전자변형식품 여부', 'GMO 표시 대상에 해당할 때'],
    ['importDeclaration', '수입신고 여부', '수입식품에 해당할 때'],
    ['consumerSafetyNotice', '소비자 안전 주의사항', '해당 제품에 적용되는 주의사항'],
  ];
  const productInfoContainer = document.querySelector('[data-product-info]');
  const appendInfoRow = (label, value) => {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    productInfoContainer.append(row);
  };

  if (product.productInfoSheet?.rows) {
    product.productInfoSheet.rows.forEach(([label, value]) => appendInfoRow(label, value));
  } else {
    productInfoRows.forEach(([key, label, fallback]) => {
      appendInfoRow(label, product.productInfo?.[key] || fallback);
    });
  }

  const nutrition = product.productInfoSheet?.nutrition;
  if (nutrition) {
    const section = document.createElement('section');
    section.className = 'nutrition-facts';
    const heading = document.createElement('h3');
    heading.textContent = nutrition.title;
    const table = document.createElement('table');
    const caption = document.createElement('caption');
    caption.className = 'visually-hidden';
    caption.textContent = nutrition.title;
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (let column = 0; column < 2; column += 1) {
      nutrition.columns.forEach((name) => {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.textContent = name;
        headRow.append(cell);
      });
    }
    head.append(headRow);
    const body = document.createElement('tbody');
    for (let index = 0; index < nutrition.items.length; index += 2) {
      const row = document.createElement('tr');
      nutrition.items.slice(index, index + 2).forEach(([name, amount]) => {
        const nameCell = document.createElement('th');
        nameCell.scope = 'row';
        nameCell.textContent = name;
        const amountCell = document.createElement('td');
        amountCell.textContent = amount;
        row.append(nameCell, amountCell);
      });
      body.append(row);
    }
    table.append(caption, head, body);
    section.append(heading, table);
    productInfoContainer.insertAdjacentElement('afterend', section);
  }

  function initPhotoLogoFade() {
    if (!document.body.classList.contains('has-photo-logo')) return;
    const header = document.querySelector('.site-header');
    const photo = document.querySelector('[data-product-post]');
    if (!header || !photo) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = photo.getBoundingClientRect();
      const fadeDistance = Math.max(90, Math.min(180, rect.height * 0.3));
      const opacity = Math.max(0, Math.min(1, rect.bottom / fadeDistance));
      header.style.opacity = String(opacity);
      header.style.visibility = opacity < 0.02 ? 'hidden' : 'visible';
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
  }

  initPhotoLogoFade();
})();
