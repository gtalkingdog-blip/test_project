(function () {
  'use strict';

  /* ---------- 문자 집합 ---------- */
  var CHARSETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    number: '0123456789',
    symbol: '!@#$%^&*()-_=+[]{};:,.?/~'
  };

  // 시각적으로 혼동하기 쉬운 문자들
  var AMBIGUOUS = 'O0oIl1LS5Z2B8';

  // 패스프레이즈용 짧은 영단어 50개
  var WORDS = [
    'apple', 'beach', 'bird', 'blue', 'boat', 'book', 'bread', 'cake', 'cat', 'chair',
    'cloud', 'coin', 'cook', 'corn', 'desk', 'dog', 'door', 'duck', 'farm', 'fire',
    'fish', 'flag', 'frog', 'game', 'gold', 'green', 'hand', 'hat', 'house', 'ice',
    'king', 'lamp', 'leaf', 'lion', 'milk', 'moon', 'nest', 'nose', 'pen', 'pink',
    'rain', 'river', 'road', 'rock', 'salt', 'ship', 'snow', 'star', 'tree', 'wind'
  ];

  /* ---------- DOM ---------- */
  var el = {
    result: document.getElementById('result'),
    warning: document.getElementById('warning'),
    copyBtn: document.getElementById('copyBtn'),
    genBtn: document.getElementById('genBtn'),
    length: document.getElementById('length'),
    lengthValue: document.getElementById('lengthValue'),
    lengthHint: document.getElementById('lengthHint'),
    upper: document.getElementById('useUpper'),
    lower: document.getElementById('useLower'),
    number: document.getElementById('useNumber'),
    symbol: document.getElementById('useSymbol'),
    exclude: document.getElementById('excludeAmbiguous'),
    ambiguousList: document.getElementById('ambiguousList'),
    modeRandom: document.getElementById('modeRandom'),
    modePhrase: document.getElementById('modePhrase'),
    toast: document.getElementById('toast')
  };

  /* ---------- 난수 유틸 (모듈로 편향 제거) ---------- */
  var RANGE = 4294967296; // 2^32

  function randomInt(max) {
    if (max <= 0) { throw new Error('max must be positive'); }
    var limit = Math.floor(RANGE / max) * max;
    var buf = new Uint32Array(1);
    var value;
    do {
      crypto.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % max;
  }

  function pick(source) {
    return source[randomInt(source.length)];
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randomInt(i + 1);
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /* ---------- 옵션 읽기 ---------- */
  function readOptions() {
    return {
      length: parseInt(el.length.value, 10),
      mode: el.modePhrase.checked ? 'passphrase' : 'random',
      upper: el.upper.checked,
      lower: el.lower.checked,
      number: el.number.checked,
      symbol: el.symbol.checked,
      exclude: el.exclude.checked
    };
  }

  function filterAmbiguous(chars, exclude) {
    if (!exclude) { return chars; }
    return chars.split('').filter(function (c) {
      return AMBIGUOUS.indexOf(c) === -1;
    }).join('');
  }

  function activePools(opts) {
    var pools = [];
    ['upper', 'lower', 'number', 'symbol'].forEach(function (key) {
      if (!opts[key]) { return; }
      var chars = filterAmbiguous(CHARSETS[key], opts.exclude);
      if (chars.length > 0) { pools.push(chars); }
    });
    return pools;
  }

  /* ---------- 무작위 문자열 모드 ---------- */
  function generateRandom(opts) {
    var pools = activePools(opts);
    var chars = [];
    var i;

    // 선택한 유형이 최소 1자씩 반드시 포함되도록 먼저 채운다
    for (i = 0; i < pools.length; i++) {
      chars.push(pick(pools[i]));
    }

    var all = pools.join('');
    for (i = chars.length; i < opts.length; i++) {
      chars.push(pick(all));
    }

    return shuffle(chars).join('');
  }

  /* ---------- 패스프레이즈 모드 ---------- */
  // 길이 슬라이더 값을 단어 개수로 환산 (8~32자 -> 3~6단어)
  function wordCountFor(length) {
    if (length <= 13) { return 3; }
    if (length <= 19) { return 4; }
    if (length <= 25) { return 5; }
    return 6;
  }

  function styleWord(word, opts) {
    if (opts.upper && opts.lower) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    if (opts.upper) { return word.toUpperCase(); }
    return word;
  }

  function generatePassphrase(opts) {
    var count = wordCountFor(opts.length);
    var pool = WORDS.slice();
    var chosen = [];

    // 같은 단어가 중복되지 않도록 비복원 추출
    for (var i = 0; i < count; i++) {
      var index = randomInt(pool.length);
      chosen.push(styleWord(pool[index], opts));
      pool.splice(index, 1);
    }

    var separators = filterAmbiguous('-_!@#$%&*+=', opts.exclude);
    var separator = opts.symbol && separators.length > 0 ? pick(separators) : '-';
    var phrase = chosen.join(separator);

    if (opts.number) {
      var digits = filterAmbiguous(CHARSETS.number, opts.exclude);
      if (digits.length > 0) {
        phrase += separator + pick(digits) + pick(digits);
      }
    }

    return phrase;
  }

  /* ---------- 유효성 검사 ---------- */
  function validate(opts) {
    if (opts.mode === 'passphrase') {
      if (!opts.upper && !opts.lower) {
        return '단어 조합 모드는 대문자 또는 소문자 중 하나 이상을 선택해야 합니다.';
      }
      return null;
    }
    if (activePools(opts).length === 0) {
      return '포함할 문자를 한 가지 이상 선택해 주세요.';
    }
    return null;
  }

  /* ---------- 화면 갱신 ---------- */
  function setResult(text, isPlaceholder) {
    el.result.textContent = text;
    el.result.classList.toggle('is-placeholder', !!isPlaceholder);
  }

  function generate() {
    var opts = readOptions();
    var error = validate(opts);

    el.warning.hidden = !error;
    el.warning.textContent = error || '';
    el.genBtn.disabled = !!error;
    el.copyBtn.disabled = !!error;

    if (error) {
      setResult('설정을 확인해 주세요', true);
      return;
    }

    setResult(opts.mode === 'passphrase' ? generatePassphrase(opts) : generateRandom(opts), false);
  }

  function syncLabels() {
    var opts = readOptions();
    el.lengthValue.textContent = opts.length + '자';

    var isPhrase = opts.mode === 'passphrase';
    el.lengthHint.hidden = !isPhrase;
    if (isPhrase) {
      el.lengthHint.textContent =
        '단어 조합 모드에서는 길이에 맞춰 단어 ' + wordCountFor(opts.length) + '개를 사용합니다. ' +
        '단어 자체는 읽기 쉬우므로 헷갈리는 문자 제외 옵션은 숫자와 구분 기호에만 적용됩니다.';
    }
  }

  /* ---------- 토스트 ---------- */
  var toastTimer = null;

  function showToast(message, isError) {
    el.toast.textContent = message;
    el.toast.classList.toggle('is-error', !!isError);
    el.toast.classList.add('is-visible');

    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () {
      el.toast.classList.remove('is-visible');
      toastTimer = null;
    }, 2000);
  }

  /* ---------- 클립보드 복사 ---------- */
  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);

    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  function copyResult() {
    var text = el.result.textContent;
    if (!text || el.result.classList.contains('is-placeholder')) { return; }

    function fallback() {
      if (legacyCopy(text)) {
        showToast('복사되었습니다', false);
      } else {
        showToast('복사에 실패했습니다. 직접 선택해 복사해 주세요', true);
      }
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        showToast('복사되었습니다', false);
      }).catch(fallback);
      return;
    }

    fallback();
  }

  /* ---------- 초기화 ---------- */
  el.ambiguousList.textContent = AMBIGUOUS.split('').join(' ');

  el.genBtn.addEventListener('click', generate);
  el.copyBtn.addEventListener('click', copyResult);

  el.length.addEventListener('input', function () {
    syncLabels();
    generate();
  });

  [el.upper, el.lower, el.number, el.symbol, el.exclude, el.modeRandom, el.modePhrase]
    .forEach(function (input) {
      input.addEventListener('change', function () {
        syncLabels();
        generate();
      });
    });

  syncLabels();
  generate();
})();
