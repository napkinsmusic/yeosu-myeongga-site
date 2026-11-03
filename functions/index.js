const { createHash } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');
const { defineString } = require('firebase-functions/params');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { getPaymentAdapter } = require('./payment/payment-adapters');

initializeApp();

const db = getFirestore();
const REGION = 'asia-northeast3';
const MAX_ORDER_ITEMS = 30;
const MAX_QUANTITY_PER_ITEM = 99;
const PAYMENT_MODE = defineString('PAYMENT_MODE', { default: 'DISABLED' });

function requireAdminAuth(request) {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
  }
  return request.auth;
}

function requireText(value, fieldName, maximumLength) {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${fieldName} 값이 올바르지 않습니다.`);
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) {
    throw new HttpsError('invalid-argument', `${fieldName} 값을 확인해 주세요.`);
  }
  return normalized;
}

function optionalText(value, maximumLength) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.trim().length > maximumLength) {
    throw new HttpsError('invalid-argument', '입력값이 허용 범위를 벗어났습니다.');
  }
  return value.trim();
}

function normalizePhone(value, fieldName) {
  const phone = requireText(value, fieldName, 20);
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 12) {
    throw new HttpsError('invalid-argument', `${fieldName} 번호를 확인해 주세요.`);
  }
  return phone;
}

function normalizeEmail(value) {
  const email = requireText(value, '이메일', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', '이메일 주소를 확인해 주세요.');
  }
  return email;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ORDER_ITEMS) {
    throw new HttpsError('invalid-argument', '주문상품을 확인해 주세요.');
  }

  return items.map((item) => {
    const productId = requireText(item?.productId, '상품 ID', 120);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
      throw new HttpsError('invalid-argument', '상품 수량을 확인해 주세요.');
    }
    const optionId = item?.optionId ? requireText(item.optionId, '옵션 ID', 120) : '';
    return { productId, quantity, optionId };
  });
}

function resolveProductPrice(product, optionId) {
  const options = Array.isArray(product.options) ? product.options : [];
  if (options.length > 0) {
    const option = options.find((item) => item.id === optionId);
    if (!option) {
      throw new HttpsError('invalid-argument', '상품 옵션을 선택해 주세요.');
    }
    const price = Number(option.price);
    if (!Number.isSafeInteger(price) || price < 0) {
      throw new HttpsError('failed-precondition', '상품 가격 설정을 확인해 주세요.');
    }
    return { price, optionLabel: option.label || '' };
  }

  const regularPrice = Number(product.price);
  const salePrice =
    product.salePrice === null || product.salePrice === undefined
      ? null
      : Number(product.salePrice);
  const price = salePrice ?? regularPrice;
  if (!Number.isSafeInteger(price) || price < 0) {
    throw new HttpsError('failed-precondition', '상품 가격 설정을 확인해 주세요.');
  }
  return { price, optionLabel: '' };
}

function getSeoulDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}${values.month}${values.day}`;
}

function normalizeOrderPayload(data) {
  const customer = data?.customer || {};
  const shippingAddress = data?.shippingAddress || {};
  const clientOrderKey = requireText(data?.clientOrderKey, '주문 요청 ID', 80);

  if (!/^[a-zA-Z0-9-]{20,80}$/.test(clientOrderKey)) {
    throw new HttpsError('invalid-argument', '주문 요청 ID가 올바르지 않습니다.');
  }

  return {
    clientOrderKey,
    items: normalizeItems(data?.items),
    customer: {
      name: requireText(customer.name, '주문자 이름', 50),
      phone: normalizePhone(customer.phone, '주문자 연락처'),
      email: normalizeEmail(customer.email),
    },
    shippingAddress: {
      receiver: requireText(shippingAddress.receiver, '받는 사람', 50),
      phone: normalizePhone(shippingAddress.phone, '배송지 연락처'),
      zipcode: requireText(shippingAddress.zipcode, '우편번호', 10),
      address1: requireText(shippingAddress.address1, '주소', 200),
      address2: requireText(shippingAddress.address2, '상세주소', 200),
      request: optionalText(shippingAddress.request, 100),
    },
  };
}

exports.createOrder = onCall(
  {
    region: REGION,
    timeoutSeconds: 30,
    memory: '256MiB',
    enforceAppCheck: false,
  },
  async (request) => {
    const payload = normalizeOrderPayload(request.data);
    const uid = request.auth?.uid || null;
    const orderRef = db.collection('orders').doc();
    const requestHash = createHash('sha256')
      .update(payload.clientOrderKey)
      .digest('hex');
    const requestRef = db.collection('orderRequests').doc(requestHash);
    const dateKey = getSeoulDateKey();
    const counterRef = db.collection('orderCounters').doc(dateKey);

    return db.runTransaction(async (transaction) => {
      const previousRequest = await transaction.get(requestRef);
      if (previousRequest.exists) {
        const previous = previousRequest.data();
        if ((previous.uid || null) !== uid) {
          throw new HttpsError('already-exists', '이미 사용된 주문 요청입니다.');
        }
        return {
          orderId: previous.orderId,
          orderNumber: previous.orderNumber,
          status: 'PENDING_PAYMENT',
          duplicated: true,
        };
      }

      const productRefs = payload.items.map(({ productId }) =>
        db.collection('products').doc(productId));
      const productSnapshots = await Promise.all(
        productRefs.map((productRef) => transaction.get(productRef)),
      );
      const counterSnapshot = await transaction.get(counterRef);

      let productsTotal = 0;
      let shippingFee = 0;
      const orderItems = payload.items.map((requestedItem, index) => {
        const productSnapshot = productSnapshots[index];
        if (!productSnapshot.exists) {
          throw new HttpsError('failed-precondition', '판매하지 않는 상품이 포함되어 있습니다.');
        }

        const product = productSnapshot.data();
        if (product.isVisible !== true || product.isDeleted === true || product.isSoldOut === true) {
          throw new HttpsError('failed-precondition', `${product.name || '상품'}은 구매할 수 없습니다.`);
        }
        if (!Number.isInteger(product.stock) || product.stock < requestedItem.quantity) {
          throw new HttpsError('failed-precondition', `${product.name || '상품'}의 재고가 부족합니다.`);
        }

        const { price, optionLabel } = resolveProductPrice(product, requestedItem.optionId);

        const itemShippingFee = Number(product.shippingFee) || 0;
        const subtotal = price * requestedItem.quantity;
        productsTotal += subtotal;
        shippingFee = Math.max(shippingFee, itemShippingFee);

        return {
          productId: productSnapshot.id,
          productName: product.name,
          optionId: requestedItem.optionId || '',
          optionLabel,
          thumbnail: product.thumbnail || '',
          price,
          quantity: requestedItem.quantity,
          subtotal,
        };
      });

      const nextSequence = (counterSnapshot.data()?.sequence || 0) + 1;
      const orderNumber = `YM-${dateKey}-${String(nextSequence).padStart(5, '0')}`;
      const discount = 0;
      const paidAmount = productsTotal + shippingFee - discount;
      const now = FieldValue.serverTimestamp();

      transaction.set(counterRef, {
        sequence: nextSequence,
        updatedAt: now,
      }, { merge: true });

      transaction.create(orderRef, {
        orderId: orderRef.id,
        orderNumber,
        customer: {
          uid,
          ...payload.customer,
        },
        shippingAddress: payload.shippingAddress,
        items: orderItems,
        pricing: {
          productsTotal,
          shippingFee,
          discount,
          paidAmount,
        },
        payment: {
          provider: null,
          paymentKey: null,
          method: null,
          status: 'PENDING',
          approvedAt: null,
        },
        orderStatus: 'PENDING_PAYMENT',
        shipping: {
          courier: null,
          trackingNumber: null,
          shippedAt: null,
          deliveredAt: null,
        },
        inventoryCommitted: false,
        createdAt: now,
        updatedAt: now,
        expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
      });

      transaction.create(requestRef, {
        orderId: orderRef.id,
        orderNumber,
        uid,
        createdAt: now,
      });

      return {
        orderId: orderRef.id,
        orderNumber,
        status: 'PENDING_PAYMENT',
        duplicated: false,
      };
    });
  },
);

exports.verifyAdminAccess = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
  },
  (request) => {
    const auth = requireAdminAuth(request);
    return {
      isAdmin: true,
      uid: auth.uid,
    };
  },
);

exports.getPaymentConfig = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
  },
  () => {
    const mode = PAYMENT_MODE.value();
    return {
      mode: mode === 'TEST' ? 'TEST' : 'DISABLED',
      productionReady: false,
    };
  },
);

exports.confirmTestPayment = onCall(
  {
    region: REGION,
    timeoutSeconds: 30,
    memory: '256MiB',
    enforceAppCheck: false,
  },
  async (request) => {
    if (PAYMENT_MODE.value() !== 'TEST') {
      throw new HttpsError('failed-precondition', 'TEST 결제가 비활성화되어 있습니다.');
    }

    const orderId = requireText(request.data?.orderId, '주문 ID', 120);
    const orderRef = db.collection('orders').doc(orderId);
    const initialOrderSnapshot = await orderRef.get();
    if (!initialOrderSnapshot.exists) {
      throw new HttpsError('not-found', '주문을 찾을 수 없습니다.');
    }

    const initialOrder = initialOrderSnapshot.data();
    if (
      initialOrder.payment?.status === 'PAID'
      && initialOrder.inventoryCommitted === true
    ) {
      return {
        orderId,
        orderNumber: initialOrder.orderNumber,
        status: 'PAID',
        duplicated: true,
        testOrder: initialOrder.testOrder === true,
      };
    }
    const paymentAdapter = getPaymentAdapter('TEST');
    const paymentResult = await paymentAdapter.confirm({
      orderId,
      amount: initialOrder.pricing.paidAmount,
    });

    if (
      paymentResult.approved !== true
      || paymentResult.amount !== initialOrder.pricing.paidAmount
    ) {
      throw new HttpsError('failed-precondition', '결제금액 검증에 실패했습니다.');
    }

    return db.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) {
        throw new HttpsError('not-found', '주문을 찾을 수 없습니다.');
      }

      const order = orderSnapshot.data();
      if (order.payment?.status === 'PAID' && order.inventoryCommitted === true) {
        return {
          orderId,
          orderNumber: order.orderNumber,
          status: 'PAID',
          duplicated: true,
          testOrder: order.testOrder === true,
        };
      }
      if (order.orderStatus !== 'PENDING_PAYMENT' || order.payment?.status !== 'PENDING') {
        throw new HttpsError('failed-precondition', '결제할 수 없는 주문 상태입니다.');
      }
      if (paymentResult.amount !== order.pricing.paidAmount) {
        throw new HttpsError('failed-precondition', '주문금액과 결제금액이 일치하지 않습니다.');
      }

      const productRefs = order.items.map((item) =>
        db.collection('products').doc(item.productId));
      const productSnapshots = await Promise.all(
        productRefs.map((productRef) => transaction.get(productRef)),
      );

      const inventoryUpdates = order.items.map((item, index) => {
        const productSnapshot = productSnapshots[index];
        if (!productSnapshot.exists) {
          throw new HttpsError('failed-precondition', '상품 재고 정보를 찾을 수 없습니다.');
        }
        const product = productSnapshot.data();
        if (!Number.isInteger(product.stock) || product.stock < item.quantity) {
          throw new HttpsError(
            'failed-precondition',
            `${item.productName}의 결제 가능한 재고가 부족합니다.`,
          );
        }
        return {
          item,
          productRef: productRefs[index],
          remainingStock: product.stock - item.quantity,
        };
      });

      const now = FieldValue.serverTimestamp();
      inventoryUpdates.forEach(({ item, productRef, remainingStock }) => {
        transaction.update(productRef, {
          stock: remainingStock,
          isSoldOut: remainingStock === 0,
          updatedAt: now,
        });

        const logRef = db.collection('inventoryLogs').doc(`${orderId}_${item.productId}`);
        transaction.create(logRef, {
          orderId,
          orderNumber: order.orderNumber,
          productId: item.productId,
          type: 'SALE',
          quantity: -item.quantity,
          remainingStock,
          createdAt: now,
        });
      });

      const paidDateKey = getSeoulDateKey();
      const productsSold = order.items.reduce((sum, item) => sum + item.quantity, 0);
      transaction.set(db.collection('testStats').doc('overall'), {
        orderCount: FieldValue.increment(1),
        revenue: FieldValue.increment(order.pricing.paidAmount),
        productsSold: FieldValue.increment(productsSold),
        updatedAt: now,
      }, { merge: true });
      transaction.set(db.collection('testDailyStats').doc(paidDateKey), {
        dateKey: paidDateKey,
        orderCount: FieldValue.increment(1),
        revenue: FieldValue.increment(order.pricing.paidAmount),
        productsSold: FieldValue.increment(productsSold),
        updatedAt: now,
      }, { merge: true });
      order.items.forEach((item) => {
        transaction.set(db.collection('testProductStats').doc(item.productId), {
          productId: item.productId,
          productName: item.productName,
          quantity: FieldValue.increment(item.quantity),
          revenue: FieldValue.increment(item.subtotal),
          updatedAt: now,
        }, { merge: true });
        transaction.set(
          db.collection('testDailyProductStats').doc(`${paidDateKey}_${item.productId}`),
          {
            dateKey: paidDateKey,
            productId: item.productId,
            productName: item.productName,
            quantity: FieldValue.increment(item.quantity),
            revenue: FieldValue.increment(item.subtotal),
            updatedAt: now,
          },
          { merge: true },
        );
      });

      transaction.update(orderRef, {
        'payment.provider': paymentResult.provider,
        'payment.paymentKey': paymentResult.paymentKey,
        'payment.method': paymentResult.method,
        'payment.status': 'PAID',
        'payment.approvedAt': now,
        orderStatus: 'PAID',
        inventoryCommitted: true,
        testOrder: true,
        expiresAt: FieldValue.delete(),
        updatedAt: now,
      });

      return {
        orderId,
        orderNumber: order.orderNumber,
        status: 'PAID',
        duplicated: false,
        testOrder: true,
      };
    });
  },
);

exports.getOrderReceipt = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
  },
  async (request) => {
    const orderId = requireText(request.data?.orderId, '주문 ID', 120);
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();
    if (!orderSnapshot.exists) {
      throw new HttpsError('not-found', '주문을 찾을 수 없습니다.');
    }

    const order = orderSnapshot.data();
    const uid = request.auth?.uid || null;
    const isAdmin = request.auth?.token?.admin === true;
    const isOwner = Boolean(uid && order.customer?.uid === uid);
    let hasGuestProof = false;

    if (!isAdmin && !isOwner) {
      const clientOrderKey = requireText(
        request.data?.clientOrderKey,
        '주문 확인 키',
        80,
      );
      const requestHash = createHash('sha256').update(clientOrderKey).digest('hex');
      const orderRequestSnapshot = await db.collection('orderRequests').doc(requestHash).get();
      hasGuestProof =
        orderRequestSnapshot.exists
        && orderRequestSnapshot.data().orderId === orderId;
    }

    if (!isAdmin && !isOwner && !hasGuestProof) {
      throw new HttpsError('permission-denied', '주문을 확인할 권한이 없습니다.');
    }
    if (order.payment?.status !== 'PAID') {
      throw new HttpsError('failed-precondition', '결제가 완료되지 않은 주문입니다.');
    }

    const toIsoString = (timestamp) =>
      timestamp?.toDate ? timestamp.toDate().toISOString() : null;

    return {
      orderId,
      orderNumber: order.orderNumber,
      customer: order.customer,
      shippingAddress: order.shippingAddress,
      items: order.items,
      pricing: order.pricing,
      payment: {
        provider: order.payment.provider,
        method: order.payment.method,
        status: order.payment.status,
        approvedAt: toIsoString(order.payment.approvedAt),
      },
      orderStatus: order.orderStatus,
      testOrder: order.testOrder === true,
      createdAt: toIsoString(order.createdAt),
    };
  },
);

function timestampToIso(timestamp) {
  return timestamp?.toDate ? timestamp.toDate().toISOString() : null;
}

function serializeAdminOrder(orderSnapshot, includeDetails = false) {
  const order = orderSnapshot.data();
  const serialized = {
    orderId: orderSnapshot.id,
    orderNumber: order.orderNumber,
    customer: order.customer,
    items: order.items || [],
    pricing: order.pricing,
    payment: {
      provider: order.payment?.provider || null,
      method: order.payment?.method || null,
      status: order.payment?.status || 'PENDING',
      approvedAt: timestampToIso(order.payment?.approvedAt),
    },
    orderStatus: order.orderStatus,
    shipping: {
      courier: order.shipping?.courier || null,
      trackingNumber: order.shipping?.trackingNumber || null,
      shippedAt: timestampToIso(order.shipping?.shippedAt),
      deliveredAt: timestampToIso(order.shipping?.deliveredAt),
    },
    testOrder: order.testOrder === true,
    createdAt: timestampToIso(order.createdAt),
    updatedAt: timestampToIso(order.updatedAt),
  };

  if (includeDetails) serialized.shippingAddress = order.shippingAddress;
  return serialized;
}

exports.getAdminDashboard = onCall(
  {
    region: REGION,
    timeoutSeconds: 30,
    memory: '256MiB',
    enforceAppCheck: false,
  },
  async (request) => {
    requireAdminAuth(request);
    const todayKey = getSeoulDateKey();
    const recentDateKeys = Array.from({ length: 7 }, (_, index) =>
      getSeoulDateKey(new Date(Date.now() - index * 24 * 60 * 60 * 1000)));

    const [
      todaySnapshot,
      overallSnapshot,
      recentDailySnapshots,
      topProductsSnapshot,
      recentOrdersSnapshot,
      preparingCountSnapshot,
      shippedCountSnapshot,
    ] = await Promise.all([
      db.collection('dailyStats').doc(todayKey).get(),
      db.collection('stats').doc('overall').get(),
      Promise.all(recentDateKeys.map((dateKey) =>
        db.collection('dailyStats').doc(dateKey).get())),
      db.collection('productStats').orderBy('quantity', 'desc').limit(5).get(),
      db.collection('orders').orderBy('createdAt', 'desc').limit(10).get(),
      db.collection('orders').where('orderStatus', '==', 'PREPARING').count().get(),
      db.collection('orders').where('orderStatus', '==', 'SHIPPED').count().get(),
    ]);

    const recentSevenDays = recentDailySnapshots.reduce(
      (totals, snapshot) => {
        const day = snapshot.data() || {};
        totals.revenue += Number(day.revenue) || 0;
        totals.orderCount += Number(day.orderCount) || 0;
        return totals;
      },
      { revenue: 0, orderCount: 0 },
    );

    const today = todaySnapshot.data() || {};
    const overall = overallSnapshot.data() || {};
    return {
      today: {
        orderCount: Number(today.orderCount) || 0,
        revenue: Number(today.revenue) || 0,
        preparingCount: preparingCountSnapshot.data().count,
        shippedCount: shippedCountSnapshot.data().count,
      },
      recentSevenDays,
      overall: {
        orderCount: Number(overall.orderCount) || 0,
        revenue: Number(overall.revenue) || 0,
      },
      topProducts: topProductsSnapshot.docs.map((snapshot) => ({
        productId: snapshot.id,
        productName: snapshot.data().productName || '',
        quantity: Number(snapshot.data().quantity) || 0,
        revenue: Number(snapshot.data().revenue) || 0,
      })),
      recentOrders: recentOrdersSnapshot.docs.map((snapshot) =>
        serializeAdminOrder(snapshot)),
    };
  },
);

exports.listAdminOrders = onCall(
  {
    region: REGION,
    timeoutSeconds: 30,
    memory: '256MiB',
    enforceAppCheck: false,
  },
  async (request) => {
    requireAdminAuth(request);
    const data = request.data || {};
    const maximumResults = Math.min(
      Math.max(Number.parseInt(data.limit, 10) || 200, 1),
      500,
    );

    let ordersQuery = db.collection('orders').orderBy('createdAt', 'desc');
    if (data.startDate) {
      const startDate = new Date(data.startDate);
      if (Number.isNaN(startDate.getTime())) {
        throw new HttpsError('invalid-argument', '조회 시작일이 올바르지 않습니다.');
      }
      ordersQuery = ordersQuery.where('createdAt', '>=', Timestamp.fromDate(startDate));
    }
    if (data.endDate) {
      const endDate = new Date(data.endDate);
      if (Number.isNaN(endDate.getTime())) {
        throw new HttpsError('invalid-argument', '조회 종료일이 올바르지 않습니다.');
      }
      ordersQuery = ordersQuery.where('createdAt', '<=', Timestamp.fromDate(endDate));
    }

    const snapshot = await ordersQuery.limit(500).get();
    const statusGroups = {
      PAID: ['PAID'],
      PREPARING: ['PREPARING'],
      SHIPPED: ['SHIPPED'],
      DELIVERED: ['DELIVERED'],
      CANCEL: ['CANCEL_REQUESTED', 'CANCELLED'],
      REFUND: ['REFUND_REQUESTED', 'REFUNDED'],
    };
    const allowedStatuses = statusGroups[data.status] || null;
    const keyword = optionalText(data.keyword, 100).toLowerCase();
    const searchType = data.searchType || 'all';

    const matchesKeyword = (order) => {
      if (!keyword) return true;
      const phoneKeyword = keyword.replace(/\D/g, '');
      const fields = {
        orderNumber: [order.orderNumber],
        customerName: [order.customer?.name],
        phone: [
          order.customer?.phone,
          order.customer?.phone?.replace(/\D/g, ''),
        ],
        productName: (order.items || []).map((item) => item.productName),
      };
      const values = searchType === 'all'
        ? Object.values(fields).flat()
        : fields[searchType] || [];
      return values.some((value) => {
        const normalized = String(value || '').toLowerCase();
        return normalized.includes(keyword)
          || Boolean(phoneKeyword && normalized.includes(phoneKeyword));
      });
    };

    const orders = snapshot.docs
      .filter((orderSnapshot) => {
        const order = orderSnapshot.data();
        return (!allowedStatuses || allowedStatuses.includes(order.orderStatus))
          && matchesKeyword(order);
      })
      .slice(0, maximumResults)
      .map((orderSnapshot) => serializeAdminOrder(orderSnapshot, true));

    return {
      orders,
      scannedCount: snapshot.size,
      truncated: snapshot.size === 500,
    };
  },
);

exports.getAdminOrder = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
  },
  async (request) => {
    requireAdminAuth(request);
    const orderId = requireText(request.data?.orderId, '주문 ID', 120);
    const orderSnapshot = await db.collection('orders').doc(orderId).get();
    if (!orderSnapshot.exists) {
      throw new HttpsError('not-found', '주문을 찾을 수 없습니다.');
    }
    return serializeAdminOrder(orderSnapshot, true);
  },
);

exports.updateAdminOrderStatus = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
  },
  async (request) => {
    const auth = requireAdminAuth(request);
    const orderId = requireText(request.data?.orderId, '주문 ID', 120);
    const nextStatus = requireText(request.data?.orderStatus, '주문 상태', 40);
    const orderRef = db.collection('orders').doc(orderId);
    const allowedTransitions = {
      PAID: ['PREPARING'],
      PREPARING: ['SHIPPED'],
      SHIPPED: ['DELIVERED'],
    };

    await db.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) {
        throw new HttpsError('not-found', '주문을 찾을 수 없습니다.');
      }

      const order = orderSnapshot.data();
      if (!(allowedTransitions[order.orderStatus] || []).includes(nextStatus)) {
        throw new HttpsError('failed-precondition', '허용되지 않는 주문 상태 변경입니다.');
      }

      const now = FieldValue.serverTimestamp();
      const updates = {
        orderStatus: nextStatus,
        updatedAt: now,
        statusHistory: FieldValue.arrayUnion({
          from: order.orderStatus,
          to: nextStatus,
          changedBy: auth.uid,
          changedAt: Timestamp.now(),
        }),
      };

      if (nextStatus === 'SHIPPED') {
        const courier = requireText(request.data?.courier, '택배사', 40);
        const trackingNumber = requireText(request.data?.trackingNumber, '송장번호', 60);
        const allowedCouriers = ['CJ', 'LOTTE', 'HANJIN', 'LOGEN', 'POST', 'OTHER'];
        if (!allowedCouriers.includes(courier)) {
          throw new HttpsError('invalid-argument', '지원하지 않는 택배사입니다.');
        }
        updates['shipping.courier'] = courier;
        updates['shipping.trackingNumber'] = trackingNumber;
        updates['shipping.shippedAt'] = now;
      }
      if (nextStatus === 'DELIVERED') {
        updates['shipping.deliveredAt'] = now;
      }

      transaction.update(orderRef, updates);
    });

    return { orderId, orderStatus: nextStatus };
  },
);

function requireInteger(value, fieldName, minimum = 0) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new HttpsError('invalid-argument', `${fieldName} 값을 확인해 주세요.`);
  }
  return number;
}

function normalizeProductPayload(data) {
  const categories = ['gajang', 'jeonbok', 'kimchi', 'fish', 'jeotgal', 'gift-set'];
  const category = requireText(data.category, '카테고리', 40);
  if (!categories.includes(category)) {
    throw new HttpsError('invalid-argument', '지원하지 않는 상품 카테고리입니다.');
  }

  const price = requireInteger(data.price, '판매가격');
  const originalPrice = requireInteger(data.originalPrice, '정상가격');
  const salePrice =
    data.salePrice === null || data.salePrice === undefined || data.salePrice === ''
      ? null
      : requireInteger(data.salePrice, '할인가격');
  if (salePrice !== null && salePrice > originalPrice) {
    throw new HttpsError('invalid-argument', '할인가격은 정상가격보다 클 수 없습니다.');
  }

  const images = Array.isArray(data.images)
    ? data.images.slice(0, 10).map((url) => requireText(url, '상품 이미지 URL', 1200))
    : [];
  const thumbnail = optionalText(data.thumbnail, 1200);
  const isAllowedImageUrl = (url) =>
    !url || url.startsWith('https://') || url.startsWith('./assets/');
  if (!isAllowedImageUrl(thumbnail) || images.some((url) => !isAllowedImageUrl(url))) {
    throw new HttpsError('invalid-argument', '상품 이미지 URL이 올바르지 않습니다.');
  }

  const productInfoSource = data.productInfo || {};
  const productInfoFields = [
    'foodType', 'content', 'ingredients', 'expiration', 'packagingMaterial',
    'nutrition', 'geneticModification', 'consumerSafetyNotice',
    'importDeclaration', 'customerServicePhone',
  ];
  const productInfo = Object.fromEntries(
    productInfoFields.map((field) => [field, optionalText(productInfoSource[field], 2000)]),
  );
  const stock = requireInteger(data.stock, '재고');

  return {
    productCode: requireText(data.productCode, '상품코드', 50).toUpperCase(),
    name: requireText(data.name, '상품명', 150),
    category,
    price: salePrice ?? price,
    originalPrice,
    salePrice,
    description: optionalText(data.description, 20000),
    shortDescription: optionalText(data.shortDescription, 500),
    images,
    thumbnail: thumbnail || images[0] || '',
    stock,
    isSoldOut: stock === 0 || data.isSoldOut === true,
    isFeatured: data.isFeatured === true,
    shippingFee: requireInteger(data.shippingFee, '배송비'),
    origin: optionalText(data.origin, 200),
    manufacturer: optionalText(data.manufacturer, 200),
    storageMethod: optionalText(data.storageMethod, 1000),
    productInfo,
    displayOrder: requireInteger(data.displayOrder, '노출순서'),
    isVisible: data.isVisible === true,
    isDeleted: false,
    deletedAt: null,
  };
}

exports.listAdminProducts = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
  },
  async (request) => {
    requireAdminAuth(request);
    const [productsSnapshot, statsSnapshot] = await Promise.all([
      db.collection('products').orderBy('displayOrder').limit(1000).get(),
      db.collection('productStats').limit(1000).get(),
    ]);
    const stats = new Map(statsSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data()]));

    return {
      products: productsSnapshot.docs.map((snapshot) => {
        const product = snapshot.data();
        return {
          id: snapshot.id,
          ...product,
          createdAt: timestampToIso(product.createdAt),
          updatedAt: timestampToIso(product.updatedAt),
          deletedAt: timestampToIso(product.deletedAt),
          cumulativeSales: Number(stats.get(snapshot.id)?.quantity) || 0,
          cumulativeRevenue: Number(stats.get(snapshot.id)?.revenue) || 0,
        };
      }),
    };
  },
);

exports.saveAdminProduct = onCall(
  {
    region: REGION,
    timeoutSeconds: 30,
    enforceAppCheck: false,
  },
  async (request) => {
    const auth = requireAdminAuth(request);
    const data = request.data || {};
    const product = normalizeProductPayload(data.product);
    const requestedId = optionalText(data.productId, 120);
    if (requestedId && !/^[a-zA-Z0-9_-]{10,120}$/.test(requestedId)) {
      throw new HttpsError('invalid-argument', '상품 ID가 올바르지 않습니다.');
    }

    const productRef = requestedId
      ? db.collection('products').doc(requestedId)
      : db.collection('products').doc();
    const codeHash = createHash('sha256').update(product.productCode).digest('hex');
    const codeRef = db.collection('productCodes').doc(codeHash);

    await db.runTransaction(async (transaction) => {
      const productSnapshot = await transaction.get(productRef);
      const codeSnapshot = await transaction.get(codeRef);
      let previousCodeRef = null;
      let previousCodeSnapshot = null;

      if (productSnapshot.exists && data.createOnly === true) {
        throw new HttpsError('already-exists', '이미 등록된 상품입니다.');
      }
      if (codeSnapshot.exists && codeSnapshot.data().productId !== productRef.id) {
        throw new HttpsError('already-exists', '이미 사용 중인 상품코드입니다.');
      }

      const previousCode = productSnapshot.data()?.productCode;
      if (previousCode && previousCode !== product.productCode) {
        const previousCodeHash = createHash('sha256').update(previousCode).digest('hex');
        previousCodeRef = db.collection('productCodes').doc(previousCodeHash);
        previousCodeSnapshot = await transaction.get(previousCodeRef);
      }

      const now = FieldValue.serverTimestamp();
      transaction.set(productRef, {
        ...product,
        createdAt: productSnapshot.exists
          ? productSnapshot.data().createdAt || now
          : now,
        createdBy: productSnapshot.exists
          ? productSnapshot.data().createdBy || auth.uid
          : auth.uid,
        updatedAt: now,
        updatedBy: auth.uid,
      });
      transaction.set(codeRef, {
        productId: productRef.id,
        productCode: product.productCode,
        updatedAt: now,
      });
      transaction.set(db.collection('settings').doc('storefront'), {
        catalogInitialized: true,
        updatedAt: now,
        updatedBy: auth.uid,
      }, { merge: true });
      if (
        previousCodeRef
        && previousCodeSnapshot?.exists
        && previousCodeSnapshot.data().productId === productRef.id
      ) {
        transaction.delete(previousCodeRef);
      }
    });

    return { productId: productRef.id };
  },
);

exports.hideAdminProduct = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
  },
  async (request) => {
    const auth = requireAdminAuth(request);
    const productId = requireText(request.data?.productId, '상품 ID', 120);
    const productRef = db.collection('products').doc(productId);
    const snapshot = await productRef.get();
    if (!snapshot.exists) throw new HttpsError('not-found', '상품을 찾을 수 없습니다.');
    await productRef.update({
      isVisible: false,
      isDeleted: true,
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: auth.uid,
    });
    return { productId };
  },
);

exports.updateAdminProductOrder = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
  },
  async (request) => {
    const auth = requireAdminAuth(request);
    const productIds = request.data?.productIds;
    if (!Array.isArray(productIds) || productIds.length > 1000) {
      throw new HttpsError('invalid-argument', '상품 순서값이 올바르지 않습니다.');
    }
    const uniqueIds = [...new Set(productIds.map((id) => requireText(id, '상품 ID', 120)))];
    if (uniqueIds.length !== productIds.length) {
      throw new HttpsError('invalid-argument', '중복된 상품 ID가 있습니다.');
    }

    const batch = db.batch();
    uniqueIds.forEach((productId, index) => {
      batch.update(db.collection('products').doc(productId), {
        displayOrder: index + 1,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: auth.uid,
      });
    });
    await batch.commit();
    return { updatedCount: uniqueIds.length };
  },
);

exports.getAdminInventory = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
  },
  async (request) => {
    requireAdminAuth(request);
    const [productsSnapshot, statsSnapshot, settingsSnapshot] = await Promise.all([
      db.collection('products').orderBy('displayOrder').limit(1000).get(),
      db.collection('productStats').limit(1000).get(),
      db.collection('settings').doc('inventory').get(),
    ]);
    const stats = new Map(statsSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data()]));
    return {
      lowStockThreshold: Number(settingsSnapshot.data()?.lowStockThreshold) || 5,
      products: productsSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        name: snapshot.data().name,
        thumbnail: snapshot.data().thumbnail || '',
        stock: Number(snapshot.data().stock) || 0,
        isSoldOut: snapshot.data().isSoldOut === true,
        isVisible: snapshot.data().isVisible === true,
        isDeleted: snapshot.data().isDeleted === true,
        cumulativeSales: Number(stats.get(snapshot.id)?.quantity) || 0,
      })),
    };
  },
);

exports.updateAdminStock = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
  },
  async (request) => {
    const auth = requireAdminAuth(request);
    const productId = requireText(request.data?.productId, '상품 ID', 120);
    const nextStock = requireInteger(request.data?.stock, '재고');
    const productRef = db.collection('products').doc(productId);
    const logRef = db.collection('inventoryLogs').doc();

    await db.runTransaction(async (transaction) => {
      const productSnapshot = await transaction.get(productRef);
      if (!productSnapshot.exists) {
        throw new HttpsError('not-found', '상품을 찾을 수 없습니다.');
      }
      const previousStock = Number(productSnapshot.data().stock) || 0;
      const now = FieldValue.serverTimestamp();
      transaction.update(productRef, {
        stock: nextStock,
        isSoldOut: nextStock === 0,
        updatedAt: now,
        updatedBy: auth.uid,
      });
      transaction.create(logRef, {
        productId,
        productName: productSnapshot.data().name,
        type: 'ADMIN_ADJUSTMENT',
        previousStock,
        quantity: nextStock - previousStock,
        remainingStock: nextStock,
        changedBy: auth.uid,
        createdAt: now,
      });
    });
    return { productId, stock: nextStock, isSoldOut: nextStock === 0 };
  },
);

exports.updateInventorySettings = onCall(
  {
    region: REGION,
    enforceAppCheck: false,
  },
  async (request) => {
    const auth = requireAdminAuth(request);
    const lowStockThreshold = requireInteger(
      request.data?.lowStockThreshold,
      '재고 부족 기준',
      1,
    );
    await db.collection('settings').doc('inventory').set({
      lowStockThreshold,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: auth.uid,
    }, { merge: true });
    return { lowStockThreshold };
  },
);

function enumerateDateKeys(startDate, endDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new HttpsError('invalid-argument', '조회 기간 형식이 올바르지 않습니다.');
  }
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (
    Number.isNaN(start.getTime())
    || Number.isNaN(end.getTime())
    || start > end
  ) {
    throw new HttpsError('invalid-argument', '조회 기간을 확인해 주세요.');
  }

  const keys = [];
  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    if (keys.length >= 366) {
      throw new HttpsError('invalid-argument', '조회 기간은 최대 366일까지 가능합니다.');
    }
    keys.push(cursor.toISOString().slice(0, 10).replaceAll('-', ''));
  }
  return keys;
}

exports.getAdminSalesStats = onCall(
  {
    region: REGION,
    timeoutSeconds: 30,
    memory: '256MiB',
    enforceAppCheck: false,
  },
  async (request) => {
    requireAdminAuth(request);
    const startDate = requireText(request.data?.startDate, '조회 시작일', 10);
    const endDate = requireText(request.data?.endDate, '조회 종료일', 10);
    const dateKeys = enumerateDateKeys(startDate, endDate);
    const startKey = dateKeys[0];
    const endKey = dateKeys[dateKeys.length - 1];

    const [dailySnapshots, testDailySnapshots, productStatsSnapshot] = await Promise.all([
      Promise.all(dateKeys.map((dateKey) =>
        db.collection('dailyStats').doc(dateKey).get())),
      Promise.all(dateKeys.map((dateKey) =>
        db.collection('testDailyStats').doc(dateKey).get())),
      db.collection('dailyProductStats')
        .where('dateKey', '>=', startKey)
        .where('dateKey', '<=', endKey)
        .get(),
    ]);

    const daily = dailySnapshots.map((snapshot, index) => {
      const data = snapshot.data() || {};
      return {
        date: `${dateKeys[index].slice(0, 4)}-${dateKeys[index].slice(4, 6)}-${dateKeys[index].slice(6)}`,
        revenue: Number(data.revenue) || 0,
        orderCount: Number(data.orderCount) || 0,
        productsSold: Number(data.productsSold) || 0,
      };
    });
    const summary = daily.reduce(
      (totals, day) => {
        totals.revenue += day.revenue;
        totals.orderCount += day.orderCount;
        totals.productsSold += day.productsSold;
        return totals;
      },
      { revenue: 0, orderCount: 0, productsSold: 0 },
    );
    summary.averageOrderAmount = summary.orderCount
      ? Math.round(summary.revenue / summary.orderCount)
      : 0;

    const testSummary = testDailySnapshots.reduce(
      (totals, snapshot) => {
        const day = snapshot.data() || {};
        totals.revenue += Number(day.revenue) || 0;
        totals.orderCount += Number(day.orderCount) || 0;
        totals.productsSold += Number(day.productsSold) || 0;
        return totals;
      },
      { revenue: 0, orderCount: 0, productsSold: 0 },
    );

    const productTotals = new Map();
    productStatsSnapshot.docs.forEach((snapshot) => {
      const product = snapshot.data();
      const current = productTotals.get(product.productId) || {
        productId: product.productId,
        productName: product.productName,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += Number(product.quantity) || 0;
      current.revenue += Number(product.revenue) || 0;
      productTotals.set(product.productId, current);
    });

    return {
      period: { startDate, endDate },
      summary,
      testSummary,
      daily,
      products: [...productTotals.values()].sort((a, b) => b.revenue - a.revenue),
    };
  },
);
