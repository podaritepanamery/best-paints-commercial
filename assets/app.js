/* ==========================================================================
   BEST PAINTS - поведение страницы
   Без зависимостей. Ничего не слушает scroll напрямую: только
   IntersectionObserver, поэтому прокрутка остаётся плавной на мобильных.
   ========================================================================== */
(function () {
  'use strict';

  var reduced  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WA_PHONE = '79362430591'; // общий номер WhatsApp - бриф-форма и форма вызова технолога

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {}, function () {});
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) {}
    document.body.removeChild(ta);
  }

  /* всплывающая плашка-уведомление по центру экрана (например, "бриф
     скопирован") - с подложкой, гасит страницу за собой */
  var toastLayer, toastTimer;

  function showToast(text, duration) {
    if (!toastLayer) {
      toastLayer = document.createElement('div');
      toastLayer.className = 'toast-layer';
      toastLayer.innerHTML = '<div class="toast"><i class="ph ph-check-circle" aria-hidden="true"></i><span></span></div>';
      document.body.appendChild(toastLayer);
    }
    toastLayer.querySelector('span').textContent = text;
    clearTimeout(toastTimer);
    // reflow, чтобы повторный вызов подряд снова проигрывал анимацию появления
    toastLayer.classList.remove('is-visible');
    void toastLayer.offsetWidth;
    toastLayer.classList.add('is-visible');
    toastTimer = setTimeout(function () { toastLayer.classList.remove('is-visible'); }, duration || 3000);
  }

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

  /* ---------- 5. модалки (обратный звонок, вызов технолога) -------------
     [data-modal-open] без значения открывает #callback (как раньше),
     со значением - модалку с этим id: data-modal-open="technologist". */
  var modals = document.querySelectorAll('dialog.modal');
  var packageChoice = ''; // какое решение выбрали перед открытием формы #package

  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    if (typeof m.showModal === 'function') m.showModal();
    else m.setAttribute('open', '');
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-modal-open]');
    if (opener) {
      e.preventDefault();
      setMenu(false);
      var modalId = opener.getAttribute('data-modal-open') || 'callback';
      if (modalId === 'package') packageChoice = opener.getAttribute('data-package') || '';
      openModal(modalId);
    }
    var closer = e.target.closest('[data-modal-close]');
    if (closer) {
      var dlg = closer.closest('dialog.modal');
      if (dlg) dlg.close();
    }
  });

  // клик по подложке закрывает окно
  modals.forEach(function (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target !== modal) return;
      var r = modal.getBoundingClientRect();
      var outside = e.clientX < r.left || e.clientX > r.right ||
                    e.clientY < r.top  || e.clientY > r.bottom;
      if (outside) modal.close();
    });
  });

  /* ---------- 5d. строка почты в модалке звонка: клик копирует адрес ---- */
  var emailCopyBtn = document.getElementById('callback-email');

  if (emailCopyBtn) {
    var emailLabel = emailCopyBtn.querySelector('span');
    var emailLabelText = emailLabel ? emailLabel.textContent : '';

    emailCopyBtn.addEventListener('click', function () {
      copyText(emailCopyBtn.getAttribute('data-copy') || '');
      if (!emailLabel) return;
      emailLabel.textContent = 'Скопировано!';
      setTimeout(function () { emailLabel.textContent = emailLabelText; }, 1800);
    });
  }

  /* ---------- 5a. форма "вызвать технолога": имя + телефон --------------
     Два обязательных поля. По сабмиту собираем текст и подставляем его
     в ссылку WhatsApp (Telegram текст в ссылку не принимает - так же,
     как и остальные telegram-ссылки на сайте), дальше пользователь сам
     нажимает и уходит в мессенджер. */
  var techForm = document.getElementById('tech-form');

  if (techForm) {
    var techOut = document.getElementById('tech-out');
    var techNote = document.getElementById('tech-note');
    var techWa = document.getElementById('tech-wa');

    techForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (typeof techForm.reportValidity === 'function' && !techForm.reportValidity()) return;

      var name = techForm.elements['Имя'].value.trim();
      var phone = techForm.elements['Телефон'].value.trim();
      var text = 'Здравствуйте! Хочу вызвать технолога.\nИмя: ' + name + '\nТелефон: ' + phone;

      if (techWa) techWa.href = 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(text);
      techForm.hidden = true;
      if (techOut) techOut.hidden = false;
      if (techNote) techNote.hidden = false;
    });
  }

  /* ---------- 5b. форма "выбрать решение": имя + телефон ---------------- */
  var packageForm = document.getElementById('package-form');

  if (packageForm) {
    var packageOut = document.getElementById('package-out');
    var packageNote = document.getElementById('package-note');
    var packageWa = document.getElementById('package-wa');

    packageForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (typeof packageForm.reportValidity === 'function' && !packageForm.reportValidity()) return;

      var name = packageForm.elements['Имя'].value.trim();
      var phone = packageForm.elements['Телефон'].value.trim();
      var text = 'Здравствуйте! Хочу выбрать решение' +
        (packageChoice ? ' "' + packageChoice + '"' : '') + '.\nИмя: ' + name + '\nТелефон: ' + phone;

      if (packageWa) packageWa.href = 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(text);
      packageForm.hidden = true;
      if (packageOut) packageOut.hidden = false;
      if (packageNote) packageNote.hidden = false;
    });
  }

  /* ---------- 5c. форма "обсудить ваш объект" (блок "Для бизнеса"): ------
     имя + телефон, та же механика, что и у формы технолога. */
  var businessForm = document.getElementById('business-form');

  if (businessForm) {
    var businessOut = document.getElementById('business-out');
    var businessNote = document.getElementById('business-note');
    var businessWa = document.getElementById('business-wa');

    businessForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (typeof businessForm.reportValidity === 'function' && !businessForm.reportValidity()) return;

      var name = businessForm.elements['Имя'].value.trim();
      var phone = businessForm.elements['Телефон'].value.trim();
      var text = 'Здравствуйте! Хочу обсудить покраску моего объекта.\nИмя: ' + name + '\nТелефон: ' + phone;

      if (businessWa) businessWa.href = 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(text);
      businessForm.hidden = true;
      if (businessOut) businessOut.hidden = false;
      if (businessNote) businessNote.hidden = false;
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

  /* ---------- 8. числа в портфолио: подгонка размера под одну строку ----
     .case__stat b в CSS уже white-space:nowrap; если число всё равно не
     помещается в свою колонку (длинное "25 лестниц и 1 400 пог. м" или
     узкая колонка на мобильном), здесь ему подбирается font-size поменьше -
     вместо переноса "1 200" / "000 \u20bd" на две строки.
     Размер подбирается ОДИН на всю строку цифр внутри карточки (а не
     отдельно для каждого числа): если одно число длинное, вся строка
     уменьшается вместе с ним, иначе соседние цифры разъезжаются по
     размеру и строка выглядит собранной из случайных кусков. ------------ */
  var statGroups = document.querySelectorAll('.case__stats');

  if (statGroups.length) {
    var MIN_STAT_FONT = 12;

    var shrinkToFit = function (el) {
      el.style.fontSize = '';
      var s = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 1 && s > MIN_STAT_FONT) {
        s -= 1;
        el.style.fontSize = s + 'px';
      }
    };

    var fitStatNumbers = function () {
      statGroups.forEach(function (group) {
        var stats = group.querySelectorAll('.case__stat');
        var nums  = group.querySelectorAll('.case__stat b');
        if (!nums.length) return;

        stats.forEach(function (p) { p.classList.remove('case__stat--wide'); });
        nums.forEach(function (el) { el.style.fontSize = ''; });

        var size = parseFloat(getComputedStyle(nums[0]).fontSize);
        var fits = function (list) {
          return [].every.call(list, function (el) { return el.scrollWidth <= el.clientWidth + 1; });
        };

        // шаг 1: вся строка цифр уменьшается вместе, одним размером
        while (!fits(nums) && size > MIN_STAT_FONT) {
          size -= 1;
          nums.forEach(function (el) { el.style.fontSize = size + 'px'; });
        }

        // шаг 2: если на минимальном размере число всё равно не влезло - это
        // не число, а длинная фраза ("25 лестниц и 1 400 пог. м"). Ей отдаётся
        // вся ширина карточки отдельной строкой, а не продавливается дальше
        // нечитаемым кеглем; остальные цифры в группе пересчитываются заново,
        // без оглядки на эту фразу, и могут вернуться к полному размеру.
        var overflowing = [].filter.call(nums, function (el) { return el.scrollWidth > el.clientWidth + 1; });
        if (overflowing.length) {
          overflowing.forEach(function (el) {
            el.closest('.case__stat').classList.add('case__stat--wide');
            shrinkToFit(el);
          });

          var rest = [].filter.call(nums, function (el) { return overflowing.indexOf(el) === -1; });
          if (rest.length) {
            rest.forEach(function (el) { el.style.fontSize = ''; });
            var restSize = parseFloat(getComputedStyle(rest[0]).fontSize);
            while (!fits(rest) && restSize > MIN_STAT_FONT) {
              restSize -= 1;
              rest.forEach(function (el) { el.style.fontSize = restSize + 'px'; });
            }
          }
        }
      });
    };

    // слайды карусели лежат за пределами экрана, но не display:none -
    // ширина колонок известна сразу, дожидаться видимости не нужно
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitStatNumbers);
    } else {
      fitStatNumbers();
    }

    var statTick;
    window.addEventListener('resize', function () {
      clearTimeout(statTick);
      statTick = setTimeout(fitStatNumbers, 150);
    }, { passive: true });
  }

  /* ---------- 9. бриф: сборка текста и отправка в Telegram / MAX ---------
     Параметр ?text= (core.telegram.org/api/links) Telegram подставляет
     в поле ввода только для ссылок вида t.me/<username> - для ссылки
     по номеру телефона (t.me/+<phone>) он не работает, текст теряется.
     Номер меняется чаще username, поэтому для Telegram и MAX бриф
     одинаково копируется в буфер обмена, а чат открывается рядом:
     вставить - Cmd/Ctrl+V. */
  var form = document.getElementById('brief-form');

  if (form) {
    var sendTgBtn  = document.getElementById('brief-send-tg');
    var sendMaxBtn = document.getElementById('brief-send-max');

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

    if (sendTgBtn) {
      sendTgBtn.addEventListener('click', function () {
        copyText(buildBrief());
        showToast('Бриф скопирован. Отправьте его нам', 2200);
        setTimeout(function () {
          window.location.href = 'https://t.me/+79362430591';
        }, 2200);
      });
    }
    if (sendMaxBtn) {
      sendMaxBtn.addEventListener('click', function () {
        copyText(buildBrief());
        showToast('Бриф скопирован. Отправьте его нам', 2200);
        // переход с задержкой, чтобы плашку успели прочитать - текущая
        // вкладка, не window.open: с задержкой он попадает под блокировку
        // всплывающих окон в части браузеров
        setTimeout(function () {
          window.location.href = 'https://max.ru/u/f9LHodD0cOJbqw_KXwoUQr9tVkbRtl4D8BnzQSeBSvZsP31yvSotc_RxgAs';
        }, 2200);
      });
    }
  }

})();
