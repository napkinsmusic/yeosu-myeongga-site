(function initializeStoreConfig(global) {
  global.SHOP_CONFIG = Object.freeze({
    phoneNumber: '010 3353 2724',
    phoneHref: 'tel:01033532724',
    smsOrderNumber: '01033532724',
    smsOrderDisplayNumber: '010 3353 2724',

    // 여수명가 카카오톡 채널의 실제 URL을 입력하세요.
    // 예: https://pf.kakao.com/_채널코드/chat
    kakaoChannelUrl: '',

    shippingFreeFrom: 70000,
    shippingFee: 3000,
    shippingNotice: '3,000원 | 7만원 이상 구매 시 무료',
  });
})(window);
