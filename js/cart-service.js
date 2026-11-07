(function initializeCartService(global) {
  const CART_KEY = 'yeosuMyeongga.cart.v1';

  function normalize(item) {
    if (!item || typeof item.productId !== 'string' || !item.productId) return null;
    const quantity = Math.max(Number.parseInt(item.quantity, 10) || 1, 1);
    return {
      productId: item.productId,
      optionId: typeof item.optionId === 'string' && item.optionId ? item.optionId : null,
      quantity,
    };
  }

  function itemKey(item) {
    return `${item.productId}::${item.optionId || ''}`;
  }

  function readItems() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.map(normalize).filter(Boolean);
    } catch {
      return [];
    }
  }

  function writeItems(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items.map(normalize).filter(Boolean)));
    refreshBadges();
    global.dispatchEvent(new CustomEvent('yeosu:cart-change', { detail: { count: count() } }));
  }

  function getItems() {
    return readItems();
  }

  function count() {
    return readItems().reduce((sum, item) => sum + item.quantity, 0);
  }

  function add({ productId, optionId = null, quantity = 1 }) {
    const next = normalize({ productId, optionId, quantity });
    if (!next) return getItems();
    const items = readItems();
    const existing = items.find((item) => itemKey(item) === itemKey(next));
    if (existing) existing.quantity += next.quantity;
    else items.push(next);
    writeItems(items);
    return items;
  }

  function update({ productId, optionId = null, quantity }) {
    const parsed = Number.parseInt(quantity, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return remove({ productId, optionId });
    }
    const key = itemKey({ productId, optionId });
    const items = readItems()
      .map((item) => {
        if (itemKey(item) !== key) return item;
        return normalize({ ...item, quantity: parsed });
      })
      .filter(Boolean);
    writeItems(items);
    return items;
  }

  function remove({ productId, optionId = null }) {
    const key = itemKey({ productId, optionId });
    const items = readItems().filter((item) => itemKey(item) !== key);
    writeItems(items);
    return items;
  }

  function clear() {
    writeItems([]);
  }

  function refreshBadges() {
    const total = count();
    document.querySelectorAll('[data-cart-count]').forEach((badge) => {
      badge.hidden = total < 1;
      badge.textContent = total > 99 ? '99+' : String(total);
    });
  }

  global.YEOSU_CART = Object.freeze({
    add,
    update,
    remove,
    clear,
    getItems,
    count,
    refreshBadges,
  });

  refreshBadges();
})(window);
