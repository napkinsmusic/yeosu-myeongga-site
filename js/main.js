function showSiteMessage(message, type = 'info') {
  let region = document.querySelector('[data-site-messages]');
  if (!region) {
    region = document.createElement('div');
    region.className = 'site-messages';
    region.dataset.siteMessages = '';
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }

  const toast = document.createElement('div');
  toast.className = `site-toast is-${type}`;
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

window.YEOSU_UI = Object.freeze({ showMessage: showSiteMessage });

function createProductCard(product) {
  const article = document.createElement('article');
  article.className = `product-card${product.isDraft ? ' is-draft' : ''}`;

  const content = document.createElement('a');
  content.href = `./product.html?id=${encodeURIComponent(product.id)}`;
  content.dataset.productId = product.id;

  const placeholder = document.createElement('div');
  placeholder.className = 'product-image-placeholder';
  placeholder.setAttribute('aria-label', `${product.name} 상품 이미지 준비 중`);
  placeholder.textContent = '상품 이미지 준비 중';

  if (product.thumbnail) {
    const image = document.createElement('img');
    image.alt = product.name;
    image.loading = 'lazy';
    const showPlaceholder = () => {
      if (image.isConnected) image.replaceWith(placeholder);
    };
    image.addEventListener('error', showPlaceholder);
    content.append(image);
    image.src = product.thumbnail;
    if (image.complete && image.naturalWidth === 0) showPlaceholder();
  } else {
    content.append(placeholder);
  }

  const info = document.createElement('div');
  info.className = 'product-info';

  const name = document.createElement('h3');
  const label = document.createElement('span');
  label.className = 'product-name-text';
  label.textContent = product.name;
  if (product.nameNote) {
    const note = document.createElement('span');
    note.className = 'product-name-note';
    note.textContent = product.nameNote;
    label.append(note);
  }
  name.append(label);
  if (product.isFeatured) {
    const badge = document.createElement('span');
    badge.className = 'popular-badge';
    badge.textContent = '인기';
    name.append(badge);
  }

  const shipping = document.createElement('p');
  shipping.className = 'product-direct-ship';
  shipping.textContent = '여수 직배송';
  info.append(name, shipping);

  content.append(info);
  article.append(content);

  return article;
}

async function renderProducts() {
  const featuredContainer = document.querySelector('[data-featured-products]');
  if (!featuredContainer) return;

  const store = window.YEOSU_STORE;
  const products = store?.catalogMode === 'draft'
    ? store.products
    : window.YEOSU_PRODUCT_SERVICE
      ? await window.YEOSU_PRODUCT_SERVICE.listProducts()
      : store?.products ?? [];
  const visibleProducts = products.filter((product) => product.isVisible && !product.isDeleted);
  const featuredProducts = visibleProducts
    .filter((product) => product.isFeatured)
    .sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999));
  const featuredIds = new Set(featuredProducts.map((product) => product.id));
  const catalogProducts = visibleProducts.filter((product) => !featuredIds.has(product.id));

  featuredContainer.replaceChildren();
  [...featuredProducts, ...catalogProducts].forEach((product) => {
    featuredContainer.append(createProductCard(product));
  });
}

function animateScrollLeft(element, to, duration) {
  return new Promise((resolve) => {
    const from = element.scrollLeft;
    const change = to - from;
    if (Math.abs(change) < 1) {
      resolve();
      return;
    }

    const start = performance.now();
    const ease = (time) => (time < 0.5 ? 2 * time * time : 1 - ((-2 * time + 2) ** 2) / 2);
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      element.scrollLeft = from + change * ease(progress);
      if (progress < 1) window.requestAnimationFrame(step);
      else resolve();
    };
    window.requestAnimationFrame(step);
  });
}

function initCarouselPeekHints() {
  const tracks = [...document.querySelectorAll('[data-peek-hint]')];
  if (!tracks.length) return;

  const triggerPeek = (row) => {
    const track = row.querySelector('[data-peek-hint]');
    if (!track || track.dataset.peekPlayed === 'true') return;
    playCarouselPeek(track);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        triggerPeek(entry.target);
      });
    },
    { threshold: 0, rootMargin: '-46% 0px -46% 0px' },
  );

  tracks.forEach((track) => {
    const row = track.closest('.category-product-row') ?? track;
    observer.observe(row);
    row.addEventListener(
      'pointerenter',
      () => {
        triggerPeek(row);
      },
      { passive: true },
    );
  });
}

async function playCarouselPeek(track) {
  if (!track || track.dataset.peekPlayed === 'true' || track.scrollLeft > 8) return;
  if (track.clientWidth < 10) {
    window.setTimeout(() => playCarouselPeek(track), 200);
    return;
  }

  track.dataset.peekPlayed = 'true';

  const card = track.querySelector('.product-card');
  const peek = card
    ? card.getBoundingClientRect().width * 0.72
    : Math.max(track.clientWidth * 0.18, 120);

  track.style.scrollSnapType = 'none';
  await animateScrollLeft(track, peek, 700);
  await new Promise((resolve) => window.setTimeout(resolve, 480));
  await animateScrollLeft(track, 0, 700);
  track.style.scrollSnapType = '';
}

renderProducts();

function initHeroLogoFade() {
  const logo = document.querySelector('.centered-header .brand-logo');
  const hero = document.querySelector('.hero');
  const img = logo?.querySelector('img');
  if (!logo || !hero || !img) return;

  let running = false;

  const targetOpacity = () => {
    const rect = hero.getBoundingClientRect();
    if (rect.height <= 0) return 1;
    const traveled = Math.max(0, -rect.top);
    return Math.max(0, Math.min(1, 1 - traveled / rect.height));
  };

  const apply = (opacity) => {
    img.style.opacity = opacity.toFixed(4);
    logo.style.pointerEvents = opacity < 0.08 ? 'none' : '';
    logo.toggleAttribute('aria-hidden', opacity < 0.08);
  };

  const tick = () => {
    running = false;
    apply(targetOpacity());
  };

  const start = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  };

  apply(targetOpacity());
  window.addEventListener('scroll', start, { passive: true });
  window.addEventListener('resize', start);
}

initHeroLogoFade();

function initHeroVideoLoad() {
  const video = document.querySelector('.hero-video');
  const bar = document.querySelector('[data-hero-load]');
  if (!video || !bar) return;

  const fill = bar.querySelector('.hero-load-fill');
  const fillMs = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1600;
  const startedAt = performance.now();
  let done = false;
  let raf = 0;

  video.pause();

  const setFill = (ratio) => {
    const value = Math.max(0, Math.min(1, ratio));
    if (fill) fill.style.transform = `scaleX(${value})`;
    bar.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  };

  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    setFill(1);
    bar.classList.add('is-done');
    const play = video.play();
    if (play && typeof play.catch === 'function') play.catch(() => {});
    const remove = () => {
      if (bar.isConnected) bar.remove();
    };
    bar.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, 450);
  };

  const canPlay = () => video.readyState >= 3;

  const tick = (now) => {
    if (done) return;
    const timeRatio = fillMs === 0 ? 1 : Math.min(1, (now - startedAt) / fillMs);
    const visual = canPlay() ? timeRatio : Math.min(timeRatio, 0.92);
    setFill(visual);
    if (canPlay() && timeRatio >= 1) {
      finish();
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  video.addEventListener('error', finish, { once: true });
  raf = requestAnimationFrame(tick);
}

initHeroVideoLoad();

const thanksImage = document.querySelector('.thanks-banner img');
if (thanksImage) {
  const hideMissingThanksImage = () => {
    if (thanksImage.naturalWidth === 0) thanksImage.remove();
  };
  if (thanksImage.complete) hideMissingThanksImage();
  else thanksImage.addEventListener('error', hideMissingThanksImage, { once: true });
}

const thanksBanner = document.querySelector('.thanks-banner');
if (thanksBanner) {
  thanksBanner.classList.add('is-motion-ready');

  const threshold = Math.min(
    0.82,
    (window.innerHeight / thanksBanner.offsetHeight) * 0.82,
  );
  const resetThreshold = Math.max(0, threshold - 0.14);

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.intersectionRatio >= threshold) {
        thanksBanner.classList.add('is-copy-visible');
      } else if (entry.intersectionRatio <= resetThreshold) {
        thanksBanner.classList.remove('is-copy-visible');
      }
    },
    { threshold: [resetThreshold, threshold] },
  );

  observer.observe(thanksBanner);
}

window.addEventListener('offline', () => {
  showSiteMessage('네트워크 연결이 끊어졌습니다. 연결 상태를 확인해 주세요.', 'error');
});

window.addEventListener('online', () => {
  showSiteMessage('네트워크 연결이 복구되었습니다.', 'success');
});
