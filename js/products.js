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
      productInfoSheet: {
        rows: [
          ['제품명', '보리굴비 (스팀으로 찐)'],
          ['판매가격·내용량', '1마리 15,000원'],
          ['식품의 유형', '기타 수산물가공품 (비살균)'],
          ['원재료명', '굴비 100%'],
          ['원산지', '수입산 (제조: 한국 영광)'],
          ['제조사 정보', '(주)여수명가 / 전라남도 여수시 돌산읍 신추길 6 (품목제조보고번호: 2006050649761)'],
          ['소비기한', '제조일로부터 2년 (제품 별도 표기일까지)'],
          ['포장재질', 'PE/PPT 포장 (냉동 보관)'],
          ['영양정보', '1팩(1회 제공량)당 아래 표 참조'],
          ['유전자변형식품 여부', '해당 없음'],
          ['수입신고 여부', '수입산 원재료 사용 (수입신고 확인 필요)'],
          [
            '소비자 안전 주의사항',
            '알레르기 유발물질: 조기(굴비) 함유 / 냉동(-18℃ 이하) 보관 및 섭취 시 잔가시 주의',
          ],
        ],
        nutrition: {
          title: '영양정보 (1팩 / 1회 제공량당)',
          columns: ['영양성분', '함량'],
          items: [
            ['열량', '138kcal (지방으로부터 열량 31kcal)'],
            ['나트륨', '78mg (3%)'],
            ['총탄수화물', '1.06g (0%)'],
            ['당분', '0g'],
            ['식이섬유', '0g (0%)'],
            ['총지방', '3.47g (5%)'],
            ['포화지방', '1.119g (6%)'],
            ['다포화지방', '0.617g'],
            ['불포화지방', '1.161g'],
            ['콜레스테롤', '72mg (24%)'],
            ['단백질', '24.84g'],
            ['칼륨', '490mg'],
            ['비타민 A', '2%'],
            ['칼슘', '3%'],
            ['비타민 C', '1%'],
            ['철분', '2%'],
          ],
        },
      },
    },
    croaker: {
      name: '민어',
      nameNote: '(스팀으로 찐)',
      options: [
        { id: '1pc', label: '1개', price: 13000 },
        { id: '3pc', label: '3개', price: 37500 },
        { id: '5pc', label: '5개', price: 60000 },
      ],
    },
    'croaker-soup': {
      options: [
        { id: '1pack', label: '1팩', price: 32000 },
        { id: '2pack', label: '2팩', price: 60000 },
      ],
      productInfoSheet: {
        rows: [
          ['제품명', '민어곰탕'],
          ['판매가격·내용량', '1팩 32,000원 / 2팩 60,000원'],
          ['식품의 유형', '즉석조리식품'],
          [
            '원재료명',
            '민어, 정제수, 전복, 표고버섯, 계란, 대파, 고추, 마늘, 생강, 소금, 조미육수 등 (실제 라벨 배합비로 교체 필요)',
          ],
          ['원산지', '국내산(자연산)'],
          ['제조사 정보', '(주)여수명가 / 전라남도 여수시 돌산읍 신추길 6'],
          ['소비기한', '제품 별도 표기일까지(냉동 -18℃ 이하 또는 냉장 0~10℃ 보관)'],
          ['포장재질', '플라스틱 용기(폴리프로필렌/PP) 또는 파우치'],
          ['영양정보', '100g당 아래 표 참조(임시 추정치)'],
          ['유전자변형식품 여부', '해당 없음'],
          ['수입신고 여부', '해당 없음'],
          [
            '소비자 안전 주의사항',
            '알레르기 유발물질: 전복, 계란 함유 / 조리·섭취 시 뜨거운 국물 및 잔가시 주의',
          ],
        ],
        nutrition: {
          title: '영양정보 (100g당 · 임시 추정치)',
          columns: ['영양성분', '함량'],
          items: [
            ['열량', '약 65kcal'],
            ['나트륨', '약 320mg'],
            ['탄수화물', '약 1.5g'],
            ['당류', '약 0.5g'],
            ['지방', '약 2.0g'],
            ['포화지방', '약 0.5g'],
            ['트랜스지방', '0g'],
            ['콜레스테롤', '약 35mg'],
            ['단백질', '약 10.0g'],
            ['식이섬유', '약 0.2g'],
          ],
        },
      },
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
    'gochujang-gulbi': {
      options: [
        { id: '1pc', label: '1개', price: 17900 },
        { id: '2pc', label: '2개', price: 34000 },
        { id: '5pc', label: '5개', price: 75000 },
      ],
    },
    'pollack-roe': {
      options: [
        { id: '1pc', label: '1개', price: 9900 },
        { id: '2pc', label: '2개', price: 19000 },
        { id: '3pc', label: '3개', price: 27000 },
        { id: '5pc', label: '5개', price: 42500 },
      ],
    },
    hairtail: {
      options: [
        { id: '1pc', label: '1개', price: 12000 },
        { id: '3pc', label: '3개', price: 33000 },
        { id: '5pc', label: '5개', price: 50000 },
      ],
    },
    mackerel: {
      options: [
        { id: '1pc', label: '1개', price: 4500 },
        { id: '3pc', label: '3개', price: 13000 },
        { id: '5pc', label: '5개', price: 20000 },
        { id: '7pc', label: '7개', price: 26000 },
      ],
    },
    tilefish: {
      options: [
        { id: '1pc', label: '1개', price: 13500 },
        { id: '3pc', label: '3개', price: 39000 },
        { id: '5pc', label: '5개', price: 62500 },
      ],
    },
    'dolsan-gat-kimchi': {
      options: [
        { id: '1kg', label: '1Kg', price: 12500 },
        { id: '3kg', label: '3Kg', price: 29900 },
        { id: '5kg', label: '5Kg', price: 46500 },
      ],
      productInfoSheet: {
        rows: [
          ['제품명', '돌산 갓김치'],
          ['판매가격·내용량', '1kg 12,500원'],
          ['식품의 유형', '김치'],
          [
            '원재료명',
            '갓 74%, 밀가루풀 9.6%, 멸치젓 4.3%, 고춧가루 3.39%, 마늘 1.79%, 새우젓 1.4%, 소금 1%, 표고버섯 1%, 건고추 0.97%, 양파 0.88%, 대파 0.75%, 쪽파 0.6%, 생강 0.32%',
          ],
          ['원산지', '국내산(자연산)'],
          ['제조사 정보', '(주)여수명가 / 전라남도 여수시 돌산읍 신추길 6 (품목보고번호: 20060506497-7)'],
          ['소비기한', '제조일로부터 6개월 (제품 별도 표기일까지)'],
          ['포장재질', '플라스틱 용기(폴리프로필렌/PP)'],
          ['영양정보', '100g당 아래 표 참조'],
          ['유전자변형식품 여부', '해당 없음'],
          ['수입신고 여부', '해당 없음'],
          ['소비자 안전 주의사항', '알레르기 유발물질: 밀, 새우 함유 / 수령 후 냉장(0~10℃) 보관'],
        ],
        nutrition: {
          title: '영양정보 (100g당)',
          columns: ['영양성분', '함량'],
          items: [
            ['열량', '62.7kcal'],
            ['나트륨', '1,126.5mg (56%)'],
            ['탄수화물', '11.7g (4%)'],
            ['당류', '8.0g (8%)'],
            ['지방', '0.3g (1%)'],
            ['포화지방', '0.0g (0%)'],
            ['트랜스지방', '불검출'],
            ['콜레스테롤', '2.6mg (1%)'],
            ['단백질', '3.3g (6%)'],
          ],
        },
      },
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
          ['원산지', '국내산(자연산)'],
          ['제조사 정보', '(주)여수명가 / 전라남도 여수시 돌산읍 신추길 6'],
          ['소비기한', '제품 별도 표기일까지'],
          ['포장재질', '플라스틱 용기(폴리프로필렌/PP)'],
          ['영양정보', '100g당 아래 표 참조'],
          ['유전자변형식품 여부', '해당 없음'],
          ['수입신고 여부', '해당 없음'],
          ['소비자 안전 주의사항', '알레르기 유발물질: 게, 대두, 밀 함유 / 수령 후 냉장(0~10℃) 보관'],
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
