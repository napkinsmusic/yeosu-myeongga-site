# 여수명가 쇼핑몰

기존 여수명가 메인 디자인을 유지하면서 확장한 Firebase 기반 쇼핑몰 개발본입니다.
현재는 테스트 및 Firebase 설정 전 상태이며 실제 배포는 수행하지 않았습니다.

## 주요 화면

- `index.html` — 메인 및 상품 검색
- `product.html` — 상품 상세
- `checkout.html` — 바로구매 주문서 및 TEST 결제
- `order-complete.html` — 서버 검증 주문 완료
- `admin/` — 관리자 인증, 주문, 상품, 재고, 매출

## Firebase 구조

- Authentication — 관리자 및 향후 고객 인증
- Firestore — 상품, 주문, 재고 로그, 통계
- Storage — 관리자 상품 이미지
- Cloud Functions — 주문·결제·권한·재고 검증
- Hosting — 정적 고객/관리자 화면

Firebase Web Config는 소스에 직접 작성하지 않고 Firebase Hosting의
`/__/firebase/init.json`에서 불러옵니다.

## 중요한 원칙

- 브라우저가 보낸 상품 가격과 결제금액을 신뢰하지 않습니다.
- 결제 완료 후 서버 트랜잭션에서만 재고를 차감합니다.
- 관리자 권한은 Firebase Custom Claims로 확인합니다.
- 상품 삭제는 과거 주문 보존을 위해 숨김 처리합니다.
- 기본 결제 모드는 `DISABLED`이며 실제 PG는 아직 연결되지 않았습니다.

## 테스트 및 배포

Firebase 설정, 관리자 생성, 테스트 순서, 배포 명령과 운영 전 남은 항목은
[`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md)를 확인하십시오.

운영 결제, 보안 규칙, 모바일 전체 주문 흐름을 검증하기 전에는 실제 배포하지 마십시오.
