(function initializePurchaseService(global) {
  const PURCHASE_KEY = 'yeosuMyeongga.directPurchase.v1';

  function setItem({ productId, optionId = null, quantity }) {
    sessionStorage.removeItem('yeosuMyeongga.clientOrderKey.v1');
    const item = {
      productId,
      optionId: typeof optionId === 'string' && optionId ? optionId : null,
      quantity: Math.max(Number.parseInt(quantity, 10) || 1, 1),
    };
    sessionStorage.setItem(PURCHASE_KEY, JSON.stringify(item));
    return item;
  }

  function getItem() {
    try {
      const item = JSON.parse(sessionStorage.getItem(PURCHASE_KEY) || 'null');
      if (
        !item
        || typeof item.productId !== 'string'
        || !Number.isInteger(item.quantity)
        || item.quantity < 1
      ) {
        return null;
      }
      return {
        productId: item.productId,
        optionId: typeof item.optionId === 'string' && item.optionId ? item.optionId : null,
        quantity: item.quantity,
      };
    } catch {
      return null;
    }
  }

  function clear() {
    sessionStorage.removeItem(PURCHASE_KEY);
  }

  global.YEOSU_PURCHASE = Object.freeze({
    setItem,
    getItem,
    clear,
  });
})(window);
