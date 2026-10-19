/* ==========================================================================
   BEST PAINTS - поведение страницы
   Без зависимостей. Ничего не слушает scroll напрямую: только
   IntersectionObserver, поэтому прокрутка остаётся плавной на мобильных.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. высота шапки в CSS-переменную ------------------------- */
  var hdr = document.getElementById('hdr');

  function syncHeaderHeight() {
    if (!hdr) return;
    document.documentElement.style.setProperty('--hdr-h', hdr.offsetHeight + 'px');
  }
  syncHeaderHeight();
  window.addEventListener('resize', syncHeaderHeight, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeaderHeight);

  /* ---------- 2. состояние "прокручено" через сторож-элемент ------------ */
  if (hdr && 'IntersectionObserver' in window) {
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none';
    document.body.prepend(sentinel);

    new IntersectionObserver(function (entries) {
      hdr.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }

  /* ---------- 3. мобильное меню ---------------------------------------- */
  var burger = document.getElementById('burger');
  var mobnav = document.getElementById('mobnav');

  function setMenu(open) {
    if (!burger || !mobnav) return;
    burger.setAttribute('aria-expanded', String(open));
    mobnav.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
  }

  if (burger && mobnav) {
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    mobnav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
    // при переходе на десктопную ширину меню закрывается
    var mq = window.matchMedia('(min-width:1180px)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- 4. появление блоков при прокрутке ------------------------- */
  var revealables = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 5. модалка обратного звонка ------------------------------- */
  var modal = document.getElementById('callback');

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-modal-open]')) {
      e.preventDefault();
      setMenu(false);
      if (modal && typeof modal.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    }
    if (e.target.closest('[data-modal-close]') && modal) modal.close();
  });

  // клик по подложке закрывает окно
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target !== modal) return;
      var r = modal.getBoundingClientRect();
      var outside = e.clientX < r.left || e.clientX > r.right ||
                    e.clientY < r.top  || e.clientY > r.bottom;
      if (outside) modal.close();
    });
  }

  /* ---------- 6. FAQ: открыт только один пункт -------------------------- */
  var faqItems = document.querySelectorAll('.faq details');
  faqItems.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      faqItems.forEach(function (other) { if (other !== d) other.open = false; });
    });
  });

  /* ---------- 7. карусель портфолио ------------------------------------- */
  var cases = document.getElementById('cases');

  if (cases) {
    var slides  = cases.querySelectorAll('.case');
    var curEl   = document.getElementById('cases-cur');
    var totalEl = document.getElementById('cases-total');
    var navBtns = document.querySelectorAll('[data-cases]');

    if (totalEl) totalEl.textContent = String(slides.length);

    // шаг прокрутки = ширина карточки + зазор между карточками
    function step() {
      if (slides.length < 2) return cases.clientWidth;
      return slides[1].offsetLeft - slides[0].offsetLeft;
    }

    function activeIndex() {
      var i = Math.round(cases.scrollLeft / step());
      return Math.min(Math.max(i, 0), slides.length - 1);
    }

    function sync() {
      var i = activeIndex();
      if (curEl) curEl.textContent = String(i + 1);
      // правый край с запасом в 2px: дробные значения scrollLeft
      var atStart = cases.scrollLeft <= 1;
      var atEnd   = cases.scrollLeft >= cases.scrollWidth - cases.clientWidth - 2;
      navBtns.forEach(function (b) {
        b.disabled = (b.dataset.cases === '-1') ? atStart : atEnd;
      });
    }

    navBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        cases.scrollBy({ left: step() * Number(b.dataset.cases), behavior: reduced ? 'auto' : 'smooth' });
      });
    });

    var tick;
    cases.addEventListener('scroll', function () {
      clearTimeout(tick);
      tick = setTimeout(sync, 90);
    }, { passive: true });

    window.addEventListener('resize', sync, { passive: true });
    sync();
  }

  /* ---------- 8. бриф: сборка текста, копия, скачивание, мессенджеры ---- */
  var form = document.getElementById('brief-form');

  if (form) {
    var out      = document.getElementById('brief-out');
    var pre      = document.getElementById('brief-text');
    var waLink   = document.getElementById('brief-wa');
    var copyBtn  = document.getElementById('brief-copy');
    var dlBtn    = document.getElementById('brief-dl');
    var WA_PHONE = '79254796759';

    function buildBrief() {
      var lines = ['Запрос на смету. Best Paints', ''];

      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        var value = (el.value || '').trim();
        if (!value) return;
        if (el.type === 'date') {
          var parts = value.split('-');
          value = parts[2] + '.' + parts[1] + '.' + parts[0];
        }
        lines.push(el.name + ': ' + value);
      });

      lines.push('', 'Отправлено с сайта Best Paints');
      return lines.join('\n');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = buildBrief();
      pre.textContent = text;
      out.classList.add('is-visible');
      if (waLink) waLink.href = 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(text);
      out.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = pre.textContent;
        var done = function () {
          var label = copyBtn.textContent;
          copyBtn.textContent = 'Скопировано';
          setTimeout(function () { copyBtn.textContent = label; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () {});
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (err) {}
          document.body.removeChild(ta);
        }
      });
    }

    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        var blob = new Blob([pre.textContent], { type: 'text/plain;charset=utf-8' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url;
        a.download = 'best-paints-brief.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
    }
  }

})();
