# 여수명가 쇼핑몰 — 테스트 및 배포 체크리스트

> 현재 상태는 **배포 전 개발본**입니다. 실제 Firebase 배포는 수행하지 않았습니다.
> 아래 항목을 모두 테스트하고 운영 결제 준비를 마친 뒤에만 배포하십시오.

## 1. 새로 만든 파일

### 고객 쇼핑몰

- `product.html`, `checkout.html`, `order-complete.html`, `error.html`
- `css/product.css`, `css/checkout.css`
- `css/order-complete.css`, `css/error.css`
- `js/products.js`, `js/product.js`, `js/purchase-service.js`, `js/store-config.js`
- `js/checkout.js`, `js/order-complete.js`, `js/error.js`
- `js/firebase/firebase-config.js`
- `js/services/product-service.js`
- `js/services/order-service.js`
- `js/services/payment-service.js`
- `js/services/auth-service.js`

### 관리자

- `admin/login.html`, `admin/index.html`, `admin/orders.html`
- `admin/products.html`, `admin/inventory.html`, `admin/sales.html`
- `css/admin.css`, `css/admin-orders.css`, `css/admin-products.css`
- `css/admin-inventory.css`, `css/admin-sales.css`
- `js/admin-login.js`, `js/admin.js`, `js/admin-dashboard.js`
- `js/admin-orders.js`, `js/admin-products.js`
- `js/admin-inventory.js`, `js/admin-sales.js`
- `js/services/admin-order-service.js`
- `js/services/admin-product-service.js`
- `js/services/admin-sales-service.js`

### Firebase 서버·보안

- `functions/index.js`
- `functions/package.json`
- `functions/.env.example`
- `functions/payment/payment-adapters.js`
- `functions/scripts/set-admin.js`
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`

## 2. 수정한 기존 파일

- `index.html`: 상품 데이터 렌더링 및 상세페이지 연결
- `js/main.js`: 상품 렌더링, 검색, 공통 메시지
- `css/style.css`: 공통 반응형·접근성·메시지 UI
- `404.html`: 브랜드 오류 화면
- `firebase.json`: Functions, Firestore, Storage, Hosting 보안 헤더
- `.gitignore`: Firebase 환경파일과 서비스 계정 키 제외
- `README.md`: 현재 프로젝트 구조 안내

## 3. Firebase에서 직접 설정할 것

1. Firebase 프로젝트를 **개발/운영 2개로 분리**해 생성
2. Authentication에서 이메일/비밀번호 로그인 활성화
3. Cloud Firestore 데이터베이스 생성
4. Firebase Storage 활성화
5. Cloud Functions 2세대 사용을 위한 결제 계정(Blaze 요금제) 확인
6. Firebase App Check 등록 및 검증 완료 후 Functions의 `enforceAppCheck` 활성화
7. `.firebaserc.example`을 참고하여 `.firebaserc` 연결
8. 관리자에서 `기존 상품 가져오기` 실행
9. 모든 상품의 실제 재고·원산지·보관방법·상품정보고시 입력
10. `settings/storefront.catalogInitialized` 상태 확인

## 4. 아직 TEST MODE인 기능

- 카드·간편결제 등 PG 결제 전체
- `PAYMENT_MODE=TEST`의 서버 테스트 결제
- 테스트 결제 통계는 실제 매출 collection과 분리
- 주소 검색 API는 Adapter만 있고 직접 입력 상태
- 상품 이미지는 기존 SVG 또는 등록한 Storage 이미지 사용

현재 기본 결제 모드는 `DISABLED`입니다. TEST 모드는 개발 Firebase 프로젝트에서만 사용하십시오.

## 5. 실제 결제를 받기 전에 할 것

1. PG사와 계약하고 운영·테스트 상점 키 발급
2. `functions/payment/payment-adapters.js`에 실제 Provider Adapter 구현
3. 결제 요청·승인·웹훅 검증을 모두 서버에서 처리
4. PG 승인금액과 Firestore 주문금액 비교
5. 웹훅 서명 검증과 중복 callback 테스트
6. 취소·부분취소·환불 서버 로직 구현
7. 실제 결제 완료 트랜잭션에서 `stats`, `dailyStats`, `productStats`, `dailyProductStats` 갱신
8. `productionReady`가 서버 검증 완료 후에만 `true`가 되도록 변경
9. TEST 주문과 실제 주문이 같은 Firebase 프로젝트에 섞이지 않도록 분리
10. 개인정보처리방침·이용약관·배송/교환/환불 정책 확정

## 6. 관리자 계정 생성 방법

1. Firebase Console → Authentication에서 이메일 사용자를 생성합니다.
2. 신뢰할 수 있는 로컬 환경 또는 Google Cloud Shell에서 Functions 의존성을 설치합니다.
3. 프로젝트 외부의 안전한 위치에서 Application Default Credentials를 설정합니다.
4. `functions` 폴더에서 다음 명령을 실행합니다.

```bash
npm run admin:grant -- admin@example.com
```

권한 제거:

```bash
npm run admin:grant -- admin@example.com --remove
```

권한 변경 후 해당 계정은 반드시 로그아웃 후 다시 로그인해야 합니다. 서비스 계정 JSON은 프로젝트 폴더에 저장하거나 Git에 커밋하지 마십시오.

## 7. Firebase 배포 명령어

아래 명령은 **테스트 완료 후** 실제 앱 루트에서 실행합니다.

```bash
npm install -g firebase-tools
firebase login
firebase use --add
cd functions
npm install
cd ..
firebase emulators:start
```

규칙과 서버를 먼저 배포하고 Hosting을 마지막에 배포합니다.

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
firebase deploy --only hosting
```

전체 동시 배포가 필요할 때만:

```bash
firebase deploy
```

## 8. 환경변수 / Secret 위치

- 비밀이 아닌 결제 모드 예시: `functions/.env.example`
- 실제 프로젝트 값: `functions/.env.<FIREBASE_PROJECT_ID>`
- 기본값: `PAYMENT_MODE=DISABLED`
- 개발 전용: `PAYMENT_MODE=TEST`
- PG Secret Key: Firebase Secret Manager 사용
- Firebase Web Config: 코드에 작성하지 않고 Hosting의 `/__/firebase/init.json` 사용

PG Secret 예시 이름은 Provider가 결정된 뒤 정합니다. Secret 값을 HTML, 브라우저 JavaScript, `.env.example`, Git에 넣지 마십시오.

## 9. 보안상 확인할 항목

- Firestore/Storage Rules를 Hosting보다 먼저 배포
- 일반 계정으로 다른 사용자의 주문 조회가 거부되는지 확인
- 일반 계정으로 상품·재고·주문 상태 수정이 거부되는지 확인
- 관리자 Custom Claim 제거 후 즉시 접근이 차단되는지 확인
- Functions App Check를 운영 전에 활성화
- TEST MODE가 운영 프로젝트에서 비활성화되어 있는지 확인
- PG 웹훅 서명·금액·주문번호 검증
- 결제 callback 반복 호출 시 재고가 한 번만 차감되는지 확인
- CSV 수식 삽입과 개인정보 파일 보관 정책 확인
- 서비스 계정 키, `.env`, PG Secret이 Git에 없는지 재검사
- 주문·고객정보 보존기간과 삭제 정책 확정
- Firestore 백업 및 복구 절차 준비

## 10. 실제 주문 테스트 순서

1. 개발 Firebase 프로젝트 연결
2. 규칙·Functions를 Emulator 또는 개발 프로젝트에 적용
3. 관리자 계정 생성 및 로그인
4. 기존 상품 가져오기
5. 상품 상세정보와 테스트 재고 입력
6. 상품 상세에서 바로구매·카카오톡 주문·전화 주문 확인
7. 바로구매 수량 증가·감소·재고 초과 방지 확인
8. Checkout 주문자·배송지 유효성 검사
9. TEST MODE 문구 확인 후 테스트 결제
10. 주문번호와 주문 완료 화면 확인
11. Firestore `orders`가 `PAID`인지 확인
12. 상품 재고가 정확히 한 번 차감됐는지 확인
13. 동일 결제 함수를 다시 호출해 이중 차감이 없는지 확인
14. 관리자 주문 목록·상세·CSV 확인
15. 배송준비 → 배송중(택배사·송장번호) → 배송완료 확인
16. TEST 매출이 실제 매출 합계에서 제외되는지 확인
17. 데스크톱, iPhone Safari, Android Chrome에서 전체 흐름 반복

## 운영 전 남은 기능과 자료

- 실제 PG Provider 및 취소·환불
- 카카오 우편번호 등 주소 검색 API
- 고객 회원가입·로그인·마이페이지
- 비회원 주문번호+전화번호 서버 조회
- 관리자 고객관리 전용 페이지
- 법률 검토된 이용약관·개인정보·배송/환불 문서
- 실제 상품 이미지·상세 이미지·`assets/video/hero.mp4`
- 지도 서비스 실제 매장 링크/임베드
- Node.js 설치 후 Functions 및 Rules Emulator 자동 테스트

이 목록이 완료되기 전에는 운영 주문과 실제 결제를 활성화하지 마십시오.
