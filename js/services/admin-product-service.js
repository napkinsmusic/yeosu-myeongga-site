(function initializeAdminProductService(global) {
  async function callAdminFunction(functionName, data = {}) {
    const firebase = await global.YEOSU_FIREBASE_READY;
    if (!firebase?.available) throw new Error('Firebase 연결이 필요합니다.');
    const callable = firebase.sdk.functions.httpsCallable(
      firebase.functions,
      functionName,
    );
    const response = await callable(data);
    return response.data;
  }

  async function uploadProductImage(productId, file) {
    if (!file.type.startsWith('image/')) {
      throw new Error('이미지 파일만 업로드할 수 있습니다.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('이미지 파일은 10MB 이하여야 합니다.');
    }

    const firebase = await global.YEOSU_FIREBASE_READY;
    if (!firebase?.available) throw new Error('Firebase Storage 연결이 필요합니다.');
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const fileId = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storageRef = firebase.sdk.storage.ref(
      firebase.storage,
      `products/${productId}/${fileId}.${extension}`,
    );
    const snapshot = await firebase.sdk.storage.uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: { productId },
    });
    return firebase.sdk.storage.getDownloadURL(snapshot.ref);
  }

  global.YEOSU_ADMIN_PRODUCT_SERVICE = Object.freeze({
    listProducts: () => callAdminFunction('listAdminProducts'),
    saveProduct: (payload) => callAdminFunction('saveAdminProduct', payload),
    hideProduct: (productId) => callAdminFunction('hideAdminProduct', { productId }),
    updateOrder: (productIds) =>
      callAdminFunction('updateAdminProductOrder', { productIds }),
    getInventory: () => callAdminFunction('getAdminInventory'),
    updateStock: (productId, stock) =>
      callAdminFunction('updateAdminStock', { productId, stock }),
    updateInventorySettings: (lowStockThreshold) =>
      callAdminFunction('updateInventorySettings', { lowStockThreshold }),
    uploadProductImage,
  });
})(window);
