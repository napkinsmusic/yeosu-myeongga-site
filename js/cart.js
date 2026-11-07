(async function initializeCartPage() {
  const products = window.YEOSU_PRODUCT_SERVICE
    ? await window.YEOSU_PRODUCT_SERVICE.listProducts()
    : window.YEOSU_STORE?.products ?? [];
  const emptySection = document.querySelector('[data-cart-empty]');
  const cartPanel = document.querySelector('[data-cart-panel]');
  const list = document.querySelector('[data-cart-items]');
  const shopConfig = window.SHOP_CONFIG ?? {};
  const formatWon = (value) => `${new Intl.NumberFormat('ko-KR').format(value)}원`;

  function findProduct(productId) {
    return products.find((item) => item.id === productId && item.isVisible && !item.isDeleted) ?? null;
  }

  function getUnitPrice(product, option) {
    if (option && Number.isFinite(option.price)) return option.price;
    if (product?.id === 'pollack-roe') return 35000;
    const price = product?.salePrice ?? product?.price;
    return Number.isFinite(price) ? price : null;
  }

  function getShippingFee(productAmount) {
    const freeFrom = Number(shopConfig.shippingFreeFrom) || 70000;
    const configuredFee = Number(shopConfig.shippingFee);
    const shippingFee = Number.isFinite(configuredFee) ? configuredFee : 3000;
    return productAmount >= freeFrom ? 0 : shippingFee;
  }

  function resolveLines() {
    return (window.YEOSU_CART?.getItems() ?? []).flatMap((item) => {
      const product = findProduct(item.productId);
      if (!product || product.isSoldOut) return [];
      const options = Array.isArray(product.options) ? product.options : [];
      const option = options.find((entry) => entry.id === item.optionId) ?? null;
      if (options.length > 0 && !option) return [];
      const unitPrice = getUnitPrice(product, option);
      if (!Number.isFinite(unitPrice)) return [];
      const maximum = Number.isInteger(product.stock) ? Math.max(product.stock, 0) : 999;
      if (maximum < 1) return [];
      return [{
        ...item,
        product,
        option,
        quantity: Math.min(item.quantity, maximum),
        unitPrice,
        maximum,
      }];
    });
  }

  function render() {
    const lines = resolveLines();
    list.replaceChildren();

    if (lines.length === 0) {
      emptySection.hidden = false;
      cartPanel.hidden = true;
      return;
    }

    emptySection.hidden = true;
    cartPanel.hidden = false;

    let productsTotal = 0;
    lines.forEach((line) => {
      const subtotal = line.unitPrice * line.quantity;
      productsTotal += subtotal;

      const article = document.createElement('article');
      article.className = 'checkout-product cart-item';

      const image = document.createElement('img');
      image.src = line.product.thumbnail;
      image.alt = line.product.name;

      const info = document.createElement('div');
      const name = document.createElement('h3');
      name.textContent = line.product.name;
      if (line.product.nameNote) {
        const note = document.createElement('span');
        note.className = 'product-name-note';
        note.textContent = line.product.nameNote;
        name.append(note);
      }
      info.append(name);

      if (line.option?.label) {
        const optionLine = document.createElement('p');
        optionLine.textContent = line.option.label;
        info.append(optionLine);
      }

      const controls = document.createElement('div');
      controls.className = 'cart-item-controls';

      const quantity = document.createElement('div');
      quantity.className = 'quantity-control';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.setAttribute('aria-label', '수량 줄이기');
      minus.textContent = '−';
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = String(line.maximum);
      input.value = String(line.quantity);
      input.setAttribute('aria-label', `${line.product.name} 수량`);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.setAttribute('aria-label', '수량 늘리기');
      plus.textContent = '+';
      quantity.append(minus, input, plus);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'cart-item-remove';
      remove.textContent = '삭제';

      const changeQty = (next) => {
        window.YEOSU_CART.update({
          productId: line.productId,
          optionId: line.optionId,
          quantity: next,
        });
        render();
      };

      minus.disabled = line.quantity <= 1;
      plus.disabled = line.quantity >= line.maximum;
      minus.addEventListener('click', () => changeQty(line.quantity - 1));
      plus.addEventListener('click', () => changeQty(line.quantity + 1));
      input.addEventListener('change', () => changeQty(input.value));
      remove.addEventListener('click', () => {
        window.YEOSU_CART.remove({ productId: line.productId, optionId: line.optionId });
        render();
      });

      controls.append(quantity, remove);
      info.append(controls);

      const itemTotal = document.createElement('strong');
      itemTotal.textContent = formatWon(subtotal);

      article.append(image, info, itemTotal);
      list.append(article);
    });

    const shippingFee = getShippingFee(productsTotal);
    document.querySelector('[data-cart-products-total]').textContent = formatWon(productsTotal);
    document.querySelector('[data-cart-shipping]').textContent =
      shippingFee === 0 ? '무료배송' : formatWon(shippingFee);
    document.querySelector('[data-cart-total]').textContent = formatWon(productsTotal + shippingFee);
  }

  document.querySelector('[data-cart-checkout]')?.addEventListener('click', () => {
    const lines = resolveLines();
    if (lines.length === 0) return;
    window.YEOSU_PURCHASE.setItems(lines.map((line) => ({
      productId: line.productId,
      optionId: line.optionId,
      quantity: line.quantity,
    })));
    window.location.href = './checkout.html';
  });

  render();
})();
