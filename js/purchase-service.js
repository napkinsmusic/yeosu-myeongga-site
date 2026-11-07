(function initializePurchaseService(global) {
  const PURCHASE_KEY = 'yeosuMyeongga.directPurchase.v1';

  function normalize(item) {
    if (!item || typeof item.productId !== 'string' || !item.productId) return null;
    const quantity = Math.max(Number.parseInt(item.quantity, 10) || 1, 1);
    return {
      productId: item.productId,
      optionId: typeof item.optionId === 'string' && item.optionId ? item.optionId : null,
      quantity,
    };
  }

  function setItems(items) {
    sessionStorage.removeItem('yeosuMyeongga.clientOrderKey.v1');
    const next = (Array.isArray(items) ? items : []).map(normalize).filter(Boolean);
    sessionStorage.setItem(PURCHASE_KEY, JSON.stringify(next));
    return next;
  }

  function setItem({ productId, optionId = null, quantity }) {
    return setItems([{ productId, optionId, quantity }]);
  }

  function getItems() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(PURCHASE_KEY) || 'null');
      if (Array.isArray(raw)) return raw.map(normalize).filter(Boolean);
      const single = normalize(raw);
      return single ? [single] : [];
    } catch {
      return [];
    }
  }

  function getItem() {
    return getItems()[0] || null;
  }

  function clear() {
    sessionStorage.removeItem(PURCHASE_KEY);
  }

  global.YEOSU_PURCHASE = Object.freeze({
    setItem,
    setItems,
    getItem,
    getItems,
    clear,
  });
})(window);
