/* =========================================================
   비밀번호 생성기
   - crypto.getRandomValues 기반 (모듈로 편향 제거)
   - 무작위 문자 모드 / 패스프레이즈 모드
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 상수 ---------- */
  var CHARSET = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    number: '0123456789'
  };

  // 시각적으로 혼동되는 문자
  var AMBIGUOUS = '0O1Il|';

  // 패스프레이즈용 영단어 (128개 = 단어당 7비트)
  var WORDS = [
    'able', 'acid', 'aged', 'also', 'arch', 'army', 'atom', 'aunt',
    'axis', 'baby', 'back', 'bake', 'bald', 'band', 'bank', 'barn',
    'base', 'bath', 'bead', 'beam', 'bean', 'bear', 'beat', 'bell',
    'belt', 'bend', 'best', 'bike', 'bird', 'blue', 'boat', 'bold',
    'bolt', 'bone', 'book', 'boot', 'born', 'boss', 'both', 'bowl',
    'brave', 'bread', 'brick', 'brush', 'cake', 'calm', 'camp', 'cane',
    'card', 'care', 'cart', 'case', 'cave', 'cell', 'chain', 'chair',
    'chalk', 'charm', 'chess', 'chief', 'city', 'claw', 'clay', 'cliff',
    'climb', 'clock', 'cloud', 'coal', 'coast', 'coin', 'cold', 'cook',
    'cool', 'copy', 'coral', 'corn', 'crane', 'cream', 'crisp', 'crown',
    'cube', 'curve', 'dance', 'dawn', 'deer', 'dense', 'desk', 'diver',
    'dock', 'dome', 'door', 'draft', 'dream', 'drift', 'drum', 'dune',
    'dusk', 'eagle', 'earth', 'east', 'echo', 'edge', 'fern', 'field',
    'flame', 'flint', 'flock', 'flour', 'foam', 'forest', 'fox', 'frame',
    'frost', 'giant', 'glass', 'globe', 'glow', 'grain', 'grape', 'grass',
    'grove', 'hail', 'harbor', 'hawk', 'hazel', 'heart', 'hill', 'honey'
  ];

  var LEVELS = [
    { min: 0, name: '취약', level: 1 },
    { min: 40, name: '보통', level: 2 },
    { min: 60, name: '안전', level: 3 },
    { min: 80, name: '매우 안전', level: 4 }
  ];

  /* ---------- DOM ---------- */
  var $ = function (id) { return document.getElementById(id); };

  var ui = {
    result: $('result'),
    copy: $('copy'),
    regen: $('regen'),
    strengthText: $('strength-text'),
    strengthBits: $('strength-bits'),
    gauge: $('gauge'),
    notice: $('notice'),
    length: $('length'),
    lengthValue: $('length-value'),
    words: $('words'),
    wordsValue: $('words-value'),
    must: $('must'),
    symbols: $('symbols'),
    noAmbiguous: $('no-ambiguous'),
    advToggle: $('adv-toggle'),
    advPanel: $('adv-panel'),
    toast: $('toast'),
    types: {
      upper: $('t-upper'),
      lower: $('t-lower'),
      number: $('t-number'),
      symbol: $('t-symbol')
    }
  };

  /* ---------- 난수 ---------- */
  var UINT32 = 4294967296;

  function randomInt(max) {
    var limit = Math.floor(UINT32 / max) * max;
    var buf = new Uint32Array(1);
    var v;
    do {
      crypto.getRandomValues(buf);
      v = buf[0];
    } while (v >= limit);
    return v % max;
  }

  function pick(list) { return list[randomInt(list.length)]; }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randomInt(i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ---------- 옵션 ---------- */
  function checked(name) {
    return document.querySelector('input[name="' + name + '"]:checked');
  }

  function readOptions() {
    var sep = checked('sep');
    var pos = checked('pos');
    return {
      mode: checked('mode').value,
      length: parseInt(ui.length.value, 10),
      wordCount: parseInt(ui.words.value, 10),
      separator: sep ? sep.value : '-',
      must: ui.must.value.trim(),
      position: pos ? pos.value : 'start',
      noAmbiguous: ui.noAmbiguous.checked,
      symbols: ui.symbols.value,
      use: {
        upper: ui.types.upper.checked,
        lower: ui.types.lower.checked,
        number: ui.types.number.checked,
        symbol: ui.types.symbol.checked
      }
    };
  }

  function strip(chars, on) {
    if (!on) { return chars; }
    return chars.split('').filter(function (c) {
      return AMBIGUOUS.indexOf(c) === -1;
    }).join('');
  }

  // 특수기호 풀: 중복/공백/영숫자 제거
  function symbolPool(raw, noAmbiguous) {
    var seen = {};
    var out = '';
    raw.split('').forEach(function (c) {
      if (/[\sA-Za-z0-9]/.test(c) || seen[c]) { return; }
      seen[c] = true;
      out += c;
    });
    return strip(out, noAmbiguous);
  }

  // 선택된 문자 종류별 풀 목록
  function pools(opts) {
    var list = [];
    ['upper', 'lower', 'number'].forEach(function (k) {
      if (!opts.use[k]) { return; }
      var s = strip(CHARSET[k], opts.noAmbiguous);
      if (s) { list.push(s); }
    });
    if (opts.use.symbol) {
      var sym = symbolPool(opts.symbols, opts.noAmbiguous);
      if (sym) { list.push(sym); }
    }
    return list;
  }

  /* ---------- 필수 단어 삽입 ---------- */
  function insertMust(parts, must, position) {
    if (!must) { return parts; }
    if (position === 'start') { parts.unshift(must); }
    else if (position === 'end') { parts.push(must); }
    else { parts.splice(randomInt(parts.length + 1), 0, must); }
    return parts;
  }

  /* ---------- 생성 ---------- */
  function generateRandom(opts, list) {
    var randomLen = Math.max(0, opts.length - opts.must.length);
    var chars = [];
    var i;

    // 선택한 종류가 최소 1자씩 포함되도록 먼저 채운다
    for (i = 0; i < list.length && i < randomLen; i++) {
      chars.push(pick(list[i]));
    }

    var all = list.join('');
    for (i = chars.length; i < randomLen; i++) {
      chars.push(pick(all));
    }

    shuffle(chars);

    if (!opts.must) { return chars.join(''); }
    if (opts.position === 'start') { return opts.must + chars.join(''); }
    if (opts.position === 'end') { return chars.join('') + opts.must; }
    var at = randomInt(chars.length + 1);
    return chars.slice(0, at).join('') + opts.must + chars.slice(at).join('');
  }

  function generatePassphrase(opts) {
    var pool = WORDS.slice();
    var chosen = [];
    for (var i = 0; i < opts.wordCount; i++) {
      var idx = randomInt(pool.length);
      chosen.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return insertMust(chosen, opts.must, opts.position).join(opts.separator);
  }

  /* ---------- 강도 ---------- */
  function entropyOf(opts, list) {
    if (opts.mode === 'passphrase') {
      return opts.wordCount * (Math.log(WORDS.length) / Math.LN2);
    }
    var size = list.join('').length;
    if (!size) { return 0; }
    var randomLen = Math.max(0, opts.length - opts.must.length);
    return randomLen * (Math.log(size) / Math.LN2);
  }

  function levelOf(bits) {
    var found = LEVELS[0];
    LEVELS.forEach(function (l) { if (bits >= l.min) { found = l; } });
    return found;
  }

  /* ---------- 렌더링 ---------- */
  function setResult(text, empty) {
    ui.result.textContent = text;
    ui.result.classList.toggle('is-empty', !!empty);
  }

  function setNotice(message) {
    ui.notice.hidden = !message;
    ui.notice.textContent = message || '';
  }

  function setStrength(bits, disabled) {
    if (disabled) {
      ui.gauge.removeAttribute('data-level');
      ui.strengthText.textContent = '—';
      ui.strengthBits.textContent = '';
      return;
    }
    var lv = levelOf(bits);
    ui.gauge.setAttribute('data-level', String(lv.level));
    ui.strengthText.textContent = lv.name;
    ui.strengthBits.textContent = '약 ' + Math.round(bits) + '비트';
  }

  function syncSlider(input) {
    var min = Number(input.min);
    var pct = (Number(input.value) - min) / (Number(input.max) - min) * 100;
    input.style.setProperty('--fill', pct + '%');
  }

  function syncMode(mode) {
    document.querySelectorAll('[data-mode]').forEach(function (node) {
      node.hidden = node.getAttribute('data-mode') !== mode;
    });
  }

  /* ---------- 메인 ---------- */
  function update(regenerate) {
    var opts = readOptions();
    var list = pools(opts);

    syncMode(opts.mode);
    ui.lengthValue.textContent = opts.length;
    ui.wordsValue.textContent = opts.wordCount;
    syncSlider(ui.length);
    syncSlider(ui.words);

    var notice = '';

    if (opts.mode === 'random') {
      if (!list.length) {
        setResult('포함할 문자를 한 가지 이상 선택해 주세요', true);
        setStrength(0, true);
        setNotice(opts.use.symbol
          ? '특수기호 목록이 비어 있습니다. 문자 종류를 선택하거나 기호를 입력해 주세요.'
          : '');
        ui.copy.disabled = true;
        return;
      }
      if (opts.use.symbol && !symbolPool(opts.symbols, opts.noAmbiguous)) {
        notice = '특수기호 목록이 비어 있어 특수기호 없이 생성합니다.';
      }
      if (opts.must.length >= opts.length) {
        notice = '필수 단어가 설정한 길이보다 길어 무작위 문자가 추가되지 않습니다.';
      }
    } else if (opts.noAmbiguous) {
      notice = '헷갈리는 문자 제외는 무작위 문자 모드에만 적용됩니다.';
    }

    ui.copy.disabled = false;
    setNotice(notice);
    setStrength(entropyOf(opts, list), false);

    if (regenerate !== false) {
      setResult(opts.mode === 'passphrase'
        ? generatePassphrase(opts)
        : generateRandom(opts, list), false);
    }
  }

  /* ---------- 토스트 ---------- */
  var toastTimer = null;

  function toast(message, isError) {
    ui.toast.textContent = message;
    ui.toast.classList.toggle('is-error', !!isError);
    ui.toast.classList.add('is-visible');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () {
      ui.toast.classList.remove('is-visible');
      toastTimer = null;
    }, 2000);
  }

  /* ---------- 복사 ---------- */
  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function flashCopied() {
    ui.copy.classList.add('is-done');
    setTimeout(function () { ui.copy.classList.remove('is-done'); }, 1200);
  }

  function copyResult() {
    var text = ui.result.textContent;
    if (!text || ui.result.classList.contains('is-empty')) { return; }

    function fallback() {
      if (legacyCopy(text)) {
        flashCopied();
        toast('복사되었습니다');
      } else {
        toast('복사에 실패했습니다. 직접 선택해 복사해 주세요', true);
      }
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        flashCopied();
        toast('복사되었습니다');
      }).catch(fallback);
      return;
    }
    fallback();
  }

  /* ---------- 이벤트 ---------- */
  ui.copy.addEventListener('click', copyResult);

  ui.regen.addEventListener('click', function () {
    ui.regen.classList.remove('is-spin');
    void ui.regen.offsetWidth; // 애니메이션 재시작
    ui.regen.classList.add('is-spin');
    update(true);
  });

  ui.advToggle.addEventListener('click', function () {
    var open = ui.advToggle.getAttribute('aria-expanded') === 'true';
    ui.advToggle.setAttribute('aria-expanded', String(!open));
    ui.advPanel.classList.toggle('is-open', !open);
  });

  // 슬라이더는 드래그 중 게이지만 갱신하고, 값이 확정되면 다시 생성
  [ui.length, ui.words].forEach(function (slider) {
    slider.addEventListener('input', function () {
      syncSlider(slider);
      update(false);
    });
    slider.addEventListener('change', function () { update(true); });
  });

  // 텍스트 입력은 타이핑 중 재생성하지 않고 강도만 갱신
  [ui.must, ui.symbols].forEach(function (input) {
    input.addEventListener('input', function () { update(false); });
    input.addEventListener('change', function () { update(true); });
  });

  document.querySelectorAll(
    'input[name="mode"], input[name="sep"], input[name="pos"], .pills input[type="checkbox"], #no-ambiguous'
  ).forEach(function (input) {
    input.addEventListener('change', function () { update(true); });
  });

  /* ---------- 시작 ---------- */
  syncMode('random');
  update(true);
})();
