/* 도장이 마스코트: 낙관(도장) 캐릭터. 플랫 컬러 인라인 SVG만 사용 */
(function () {
  'use strict';
  var RED = '#D93F30', DK = '#A8281D', INK = '#2A1B18', GOLD = '#FFC02E';
  var MOODS = ['happy', 'cheer', 'sad', 'think', 'sleep', 'wow'];

  // 열린 눈(흰자+눈동자+하이라이트)
  function eye(cx, cy, rx, ry, pr) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#fff"/>' +
      '<circle cx="' + cx + '" cy="' + (cy + 1) + '" r="' + pr + '" fill="' + INK + '"/>' +
      '<circle cx="' + (cx + pr * 0.35) + '" cy="' + (cy - pr * 0.25) + '" r="' + (pr * 0.36) + '" fill="#fff"/>';
  }
  function stroke(d, w, c) {
    return '<path d="' + d + '" fill="none" stroke="' + (c || INK) + '" stroke-width="' + (w || 2.6) + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function arm(cx, cy, rot) {
    return '<rect x="' + (cx - 5) + '" y="' + (cy - 9) + '" width="10" height="18" rx="5" fill="' + DK + '" transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"/>';
  }

  function build(mood) {
    var arms = arm(11, 62, 8) + arm(89, 62, -8);
    var eyes = eye(36, 50, 7.5, 9, 4.6) + eye(64, 50, 7.5, 9, 4.6);
    var brows = '', mouth = '', extra = '';
    switch (mood) {
      case 'cheer':
        arms = arm(10, 38, -25) + arm(90, 38, 25);
        eyes = stroke('M29 53 Q36 43 43 53', 3.2) + stroke('M57 53 Q64 43 71 53', 3.2);
        mouth = '<path d="M39 63 Q50 63 61 63 Q59 78 50 78 Q41 78 39 63 Z" fill="' + INK + '"/>' +
          '<path d="M44 73 Q50 69 56 73 Q54 77 50 77 Q46 77 44 73 Z" fill="#FF8A7A"/>';
        break;
      case 'sad':
        brows = stroke('M28 38 L43 42', 2.6) + stroke('M72 38 L57 42', 2.6);
        eyes = eye(36, 52, 7, 8.5, 4.4) + eye(64, 52, 7, 8.5, 4.4);
        mouth = stroke('M42 73 Q50 66 58 73', 2.8);
        extra = '<path d="M72 56 Q78 66 72 69 Q66 66 72 56 Z" fill="#6BB6FF"/>';
        break;
      case 'think':
        brows = stroke('M28 40 L43 40', 2.6) + stroke('M57 34 L72 38', 2.6);
        mouth = stroke('M44 71 L54 70', 2.8);
        extra = '<text x="86" y="26" font-family="sans-serif" font-size="22" font-weight="900" text-anchor="middle" fill="' + GOLD + '">?</text>';
        break;
      case 'sleep':
        eyes = stroke('M29 52 Q36 57 43 52', 3) + stroke('M57 52 Q64 57 71 52', 3);
        mouth = '<ellipse cx="50" cy="70" rx="3" ry="2.4" fill="' + INK + '"/>';
        extra = '<text x="80" y="20" font-family="sans-serif" font-size="12" font-weight="800" fill="#9AA0A6">z</text>' +
          '<text x="89" y="10" font-family="sans-serif" font-size="8" font-weight="800" fill="#9AA0A6">z</text>';
        break;
      case 'wow':
        eyes = eye(36, 50, 8.5, 10.5, 4.8) + eye(64, 50, 8.5, 10.5, 4.8);
        mouth = '<ellipse cx="50" cy="72" rx="5" ry="6" fill="' + INK + '"/>';
        extra = stroke('M88 14 L88 22', 2.4, GOLD) + stroke('M83 18 L93 18', 2.4, GOLD) +
          stroke('M10 12 L10 18', 2.4, GOLD) + stroke('M7 15 L13 15', 2.4, GOLD);
        break;
      default: // happy
        mouth = stroke('M41 68 Q50 77 59 68', 3);
    }
    var cheeks = '<ellipse cx="25" cy="64" rx="5.5" ry="3.6" fill="#FF8A7A"/><ellipse cx="75" cy="64" rx="5.5" ry="3.6" fill="#FF8A7A"/>';
    if (mood === 'cheer') cheeks = cheeks.replace(/cy="64"/g, 'cy="62"');
    return '<rect x="38" y="5" width="24" height="22" rx="8" fill="' + DK + '"/>' +
      '<rect x="14" y="26" width="72" height="68" rx="20" fill="' + DK + '"/>' +
      arms +
      '<rect x="14" y="20" width="72" height="68" rx="20" fill="' + RED + '"/>' +
      '<rect x="19.5" y="25.5" width="61" height="57" rx="15" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.6"/>' +
      '<rect x="38" y="5" width="24" height="18" rx="8" fill="' + DK + '"/>' +
      cheeks + eyes + brows + mouth + extra;
  }

  function svg(mood, size, opt) {
    try {
      if (MOODS.indexOf(mood) < 0) mood = 'happy';
      var s = (size > 0 && size < 2000) ? +size : 96;
      var a = (opt && opt.label) ? 'role="img" aria-label="도장이"' : 'aria-hidden="true"';
      var cls = (opt && typeof opt.class === 'string') ? ' class="' + opt.class.replace(/[^\w\- ]/g, '') + '"' : '';
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + s + '" height="' + s + '" ' + a + cls + '>' + build(mood) + '</svg>';
    } catch (e) { return ''; }
  }
  function mount(el, mood, size, opt) {
    try { if (el) el.innerHTML = svg(mood, size, opt); } catch (e) {}
  }
  window.MASCOT = { svg: svg, mount: mount, moods: MOODS, reducedSafe: true };
})();
