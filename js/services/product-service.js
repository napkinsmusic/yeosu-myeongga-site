(function initializeProductService(global) {
  let productsPromise;
  let source = 'local';

  function getLocalProducts() {
    return [...(global.YEOSU_STORE?.products ?? [])];
  }

  function normalizeProduct(documentSnapshot) {
    const data = documentSnapshot.data();
    return {
      id: documentSnapshot.id,
      productCode: data.productCode || '',
      name: data.name || '',
      category: data.category || '',
      price: Number(data.price) || 0,
      originalPrice: Number(data.originalPrice) || Number(data.price) || 0,
      salePrice:
        data.salePrice === null || data.salePrice === undefined
          ? null
          : Number(data.salePrice),
      description: data.description || '',
      shortDescription: data.shortDescription || '',
      images: Array.isArray(data.images) ? data.images : [],
      thumbnail: data.thumbnail || '',
      video: data.video || '',
      stock: Number.isInteger(data.stock) ? data.stock : null,
      isSoldOut: Boolean(data.isSoldOut),
      isFeatured: Boolean(data.isFeatured),
      shippingFee: Number(data.shippingFee) || 0,
      origin: data.origin || '',
      manufacturer: data.manufacturer || '',
      storageMethod: data.storageMethod || '',
      productInfo: data.productInfo || {},
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
      deletedAt: data.deletedAt || null,
      displayOrder: Number(data.displayOrder) || 0,
      isVisible: data.isVisible === true,
      isDeleted: data.isDeleted === true,
    };
  }

  async function loadProducts() {
    const firebase = await global.YEOSU_FIREBASE_READY;
    if (!firebase?.available) {
      global.YEOSU_RUNTIME_PRODUCTS = getLocalProducts();
      return global.YEOSU_RUNTIME_PRODUCTS;
    }

    try {
      const {
        collection,
        doc,
        getDoc,
        getDocs,
        query,
        where,
      } = firebase.sdk.firestore;

      /*
       * 초기 데이터 이전 전에는 settings/storefront.catalogInitialized가
       * false 또는 미등록 상태이므로 기존 로컬 상품을 유지합니다.
       * 데이터 이전 완료 후 관리자 서버에서 true로 변경합니다.
       */
      const storefrontSettings = await getDoc(doc(firebase.db, 'settings', 'storefront'));
      const catalogInitialized =
        storefrontSettings.exists()
        && storefrontSettings.data().catalogInitialized === true;

      if (!catalogInitialized) {
        global.YEOSU_RUNTIME_PRODUCTS = getLocalProducts();
        return global.YEOSU_RUNTIME_PRODUCTS;
      }

      const productsQuery = query(
        collection(firebase.db, 'products'),
        where('isVisible', '==', true),
        where('isDeleted', '==', false),
      );
      const snapshot = await getDocs(productsQuery);
      source = 'firestore';
      global.YEOSU_RUNTIME_PRODUCTS = snapshot.docs
        .map(normalizeProduct)
        .filter((product) => !product.isDeleted)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      return global.YEOSU_RUNTIME_PRODUCTS;
    } catch (error) {
      console.error('상품 데이터를 불러오지 못했습니다.', error);
      global.YEOSU_RUNTIME_PRODUCTS = getLocalProducts();
      return global.YEOSU_RUNTIME_PRODUCTS;
    }
  }

  function listProducts({ refresh = false } = {}) {
    if (!productsPromise || refresh) productsPromise = loadProducts();
    return productsPromise;
  }

  async function getProduct(productId) {
    const products = await listProducts();
    return products.find(
      (product) => product.id === productId && product.isVisible && !product.isDeleted,
    ) ?? null;
  }

  global.YEOSU_PRODUCT_SERVICE = Object.freeze({
    listProducts,
    getProduct,
    getSource: () => source,
  });
})(window);
