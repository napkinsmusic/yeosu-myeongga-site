/*
 * 상품 상세 정보가 확정되기 전 사용하는 카탈로그 초안입니다.
 * 가격, 이미지, 용량, 재고가 입력되기 전에는 상세 페이지와 주문으로 연결하지 않습니다.
 */
(function initializeProductData(global) {
  const categories = [
    { id: 'jang', name: '게장·장', displayOrder: 1 },
    { id: 'kimchi', name: '김치', displayOrder: 2 },
    { id: 'fish', name: '생선', displayOrder: 3 },
    { id: 'side-dish', name: '젓갈·반찬', displayOrder: 4 },
    { id: 'gift-set', name: '선물세트', displayOrder: 5 },
  ];

  const productGroups = [
    {
      category: 'kimchi',
      names: ['돌산 갓김치', '파김치', '알타리김치', '고들빼기'],
    },
    {
      category: 'jang',
      names: [
        '꽃게 간장게장',
        '돌게 간장게장',
        '새우대하장',
        '전복 장조림',
        '전복대하장',
      ],
    },
    {
      category: 'fish',
      names: ['고등어', '갈치', '스팀으로 찐 민어', '굴비', '스팀으로 찐 보리굴비', '옥돔'],
    },
    {
      category: 'side-dish',
      names: [
        '갈치속젓',
        '고추장 굴비',
        '백명란',
        '백명란 + 고추장굴비',
        '멸치소(지리)',
        '멸치중(고주바)',
        '멸치 세트',
      ],
    },
    {
      category: 'gift-set',
      names: [
        '보리굴비 + 갓김치',
        '민어 + 보리굴비 + 갓김치',
        '락앤락 전복 장조림 세트',
        '기타 복합 구성 상품',
      ],
    },
  ];

  const ids = [
    ['dolsan-gat-kimchi', 'green-onion-kimchi', 'altari-kimchi', 'gat-godeulppaegi'],
    [
      'blue-crab-soy-gejang',
      'stone-crab-soy-gejang',
      'prawn-jang',
      'abalone-jangjorim',
      'abalone-prawn-jang',
    ],
    ['mackerel', 'hairtail', 'croaker', 'gulbi', 'steamed-barley-gulbi', 'tilefish'],
    [
      'hairtail-jeotgal',
      'gochujang-gulbi',
      'pollack-roe',
      'pollack-roe-gulbi-jangajji',
      'anchovy-small-jiri',
      'anchovy-medium-gojuba',
      'anchovy-set',
    ],
    [
      'barley-gulbi-gat-kimchi',
      'croaker-barley-gulbi-gat-kimchi',
      'locknlock-abalone-jangjorim-set',
      'mixed-gift-set',
    ],
  ];

  const featuredProductOrder = new Map([
    ['blue-crab-soy-gejang', 1],
    ['dolsan-gat-kimchi', 2],
    ['croaker-soup', 3],
    ['steamed-barley-gulbi', 4],
  ]);

  const productDisplayOrder = new Map([
    'blue-crab-soy-gejang',
    'dolsan-gat-kimchi',
    'croaker-soup',
    'steamed-barley-gulbi',
    'prawn-jang',
    'abalone-jangjorim',
    'gochujang-gulbi',
    'pollack-roe',
    'hairtail',
    'gulbi',
    'mackerel',
    'tilefish',
    'croaker',
    'hairtail-jeotgal',
  ].map((id, index) => [id, index]));

  const hiddenProductIds = new Set([
    'abalone-prawn-jang',
    'pollack-roe-gulbi-jangajji',
    'anchovy-set',
    // 돌게 간장게장. 다시 노출하려면 이 항목을 지우면 됩니다.
    'stone-crab-soy-gejang',
    // 고들빼기. 다시 노출하려면 이 항목을 지우면 됩니다.
    'gat-godeulppaegi',
    // 파김치. 다시 노출하려면 이 항목을 지우면 됩니다.
    'green-onion-kimchi',
    // 알타리김치. 다시 노출하려면 이 항목을 지우면 됩니다.
    'altari-kimchi',
    // 멸치소(지리). 다시 노출하려면 이 항목을 지우면 됩니다.
    'anchovy-small-jiri',
    // 멸치중(고주바). 다시 노출하려면 이 항목을 지우면 됩니다.
    'anchovy-medium-gojuba',
    // 굴비. 다시 노출하려면 이 항목을 지우면 됩니다.
    'gulbi',
    // 갈치속젓. 다시 노출하려면 이 항목을 지우면 됩니다.
    'hairtail-jeotgal',
  ]);
  const hiddenCategoryIds = new Set(['gift-set']);

  function assetUrl(path) {
    const root = window.YEOSU_ASSET_ROOT || './';
    return path.startsWith('./') ? root + path.slice(2) : path;
  }

  window.YEOSU_ASSET_URL = assetUrl;

  function namedProductImage(name) {
    return assetUrl(`./assets/images/products/${name}.png`);
  }

  function namedProductVideo(name) {
    return assetUrl(`./assets/video/products/${name}.mp4`);
  }

  let productNumber = 0;
  const products = productGroups.flatMap((group, groupIndex) =>
    group.names.map((name, displayOrder) => {
      productNumber += 1;
      const id = ids[groupIndex][displayOrder];
      const image = namedProductImage(name);
      return {
        id,
        productCode: `YM-D${String(productNumber).padStart(3, '0')}`,
        name,
        category: group.category,
        price: null,
        originalPrice: null,
        salePrice: null,
        description: '',
        shortDescription: '',
        images: [],
        thumbnail: image,
        video: namedProductVideo(name),
        stock: null,
        isSoldOut: false,
        isFeatured: featuredProductOrder.has(id),
        featuredOrder: featuredProductOrder.get(id) ?? null,
        shippingFee: null,
        origin: '',
        manufacturer: '(주)전남산업콘텐츠연구원',
        storageMethod: '',
        displayOrder: displayOrder + 1,
        isVisible: !hiddenProductIds.has(id) && !hiddenCategoryIds.has(group.category),
        isDeleted: false,
        isDraft: true,
      };
    }),
  );

  products.push({
    id: 'croaker-soup',
    productCode: `YM-D${String(productNumber + 1).padStart(3, '0')}`,
    name: '민어곰탕',
    category: 'featured-only',
    price: null,
    originalPrice: null,
    salePrice: null,
    description: '',
    shortDescription: '',
    images: [],
    thumbnail: namedProductImage('민어곰탕'),
    video: namedProductVideo('민어곰탕'),
    stock: null,
    isSoldOut: false,
    isFeatured: true,
    featuredOrder: featuredProductOrder.get('croaker-soup'),
    shippingFee: null,
    origin: '',
    manufacturer: '(주)전남산업콘텐츠연구원',
    storageMethod: '',
    displayOrder: 1,
    isVisible: true,
    isDeleted: false,
    isDraft: true,
  });

  const productDraftExtras = {
    'steamed-barley-gulbi': {
      name: '보리굴비',
      nameNote: '(스팀으로 찐)',
      options: [
        { id: '1pc', label: '1마리', price: 15000 },
        { id: '5pc-kimchi', label: '5마리 + 갓김치 1Kg', price: 75000 },
        { id: '10pc-kimchi', label: '10마리 + 갓김치 1Kg', price: 150000 },
      ],
    },
    croaker: {
      name: '민어',
      nameNote: '(스팀으로 찐)',
    },
    'croaker-soup': {
      options: [
        { id: '1pack', label: '1팩', price: 32000 },
        { id: '2pack', label: '2팩', price: 60000 },
      ],
    },
    'prawn-jang': {
      options: [
        { id: '500g', label: '500g', price: 25000 },
        { id: '1kg', label: '1Kg', price: 40000 },
        { id: '2kg', label: '2Kg', price: 70000 },
      ],
    },
    'abalone-jangjorim': {
      options: [
        { id: '500g', label: '500g', price: 30000 },
        { id: '1kg', label: '1Kg', price: 60000 },
        { id: '2kg', label: '2Kg', price: 85000 },
      ],
    },
    'dolsan-gat-kimchi': {
      options: [
        { id: '1kg', label: '1Kg', price: 12500 },
        { id: '3kg', label: '3Kg', price: 29900 },
        { id: '5kg', label: '5Kg', price: 46500 },
      ],
    },
    'blue-crab-soy-gejang': {
      storageMethod: '냉장보관',
      options: [
        { id: '1-3kg', label: '1.3Kg', price: 40000 },
        { id: '2-5kg', label: '2.5Kg', price: 80000 },
        { id: '3-5kg', label: '3.5Kg', price: 120000 },
      ],
      productInfoSheet: {
        rows: [
          ['제품명', '꽃게간장게장'],
          ['판매가격·내용량', '1.3kg 40,000원 / 2.5kg 80,000원 / 3.5kg 120,000원'],
          ['식품의 유형', '절임식품'],
          [
            '원재료명',
            '꽃게 55%, 육수 38%(다시멸치 25%, 다시마 15%, 양파즙 15%, 생강 15%, 매실 15%, 사과 15%), 간장 6.5%, 마늘 0.3%, 표고버섯 0.2%',
          ],
          ['원산지', '국내산'],
          ['제조사 정보', '(주)여수명가 / 전라남도 여수시 돌산읍 신추길 6'],
          ['소비기한', '제품에 별도 표기된 소비기한 참조'],
          ['포장재질', ''],
          ['영양정보', '100g당 아래 표 참조'],
          ['유전자변형식품 여부', ''],
          ['수입신고 여부', '국내 제조 제품'],
          ['소비자 안전 주의사항', ''],
        ],
        nutrition: {
          title: '영양정보 (100g당)',
          columns: ['영양성분', '함량'],
          items: [
            ['열량', '107.3kcal'],
            ['나트륨', '1,232.7mg'],
            ['탄수화물', '12.9g'],
            ['당류', '7.8g'],
            ['지방', '1.3g'],
            ['포화지방', '0.4g'],
            ['트랜스지방', '불검출'],
            ['콜레스테롤', '91.2mg'],
            ['단백질', '11.5g'],
            ['식이섬유', '1.0g'],
            ['칼슘', '91.2mg'],
            ['철', '1.1mg'],
            ['칼륨', '111.0mg'],
            ['비타민 D', '불검출'],
          ],
        },
      },
    },
  };

  products.forEach((product) => {
    const extras = productDraftExtras[product.id];
    if (extras) Object.assign(product, extras);
  });

  products.sort(
    (a, b) =>
      (productDisplayOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (productDisplayOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );

  global.YEOSU_STORE = Object.freeze({
    catalogMode: 'draft',
    categories: Object.freeze(categories),
    products: Object.freeze(products),
  });
})(window);
