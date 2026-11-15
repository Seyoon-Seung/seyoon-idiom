/* 효과음 모듈: WebAudio 합성만 사용 (에셋/네트워크 없음) */
(function () {
  'use strict';
  var KEY = 'idiom_sfx_muted_v1';
  var ctx = null;
  var muted = false;

  // 저장된 음소거 설정 읽기 (실패해도 기본값 유지)
  try { muted = window.localStorage.getItem(KEY) === '1'; } catch (e) {}

  // AudioContext를 지연 생성하고, 중단 상태면 재개
  function getCtx() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended' && ctx.resume) {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
      return ctx;
    } catch (e) { return null; }
  }

  // 한 음 재생: 클릭 방지를 위해 0.0001에서 램프 업, 지수 감쇠 후 정리
  function tone(c, o) {
    var t0 = c.currentTime + o.start;
    var end = t0 + o.dur;
    var osc = c.createOscillator();
    var gain = c.createGain();
    var out = gain;
    var filter = null;
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    if (o.lowpass) {
      filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = o.lowpass;
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(c.destination);
    osc.onended = function () {
      try { osc.disconnect(); gain.disconnect(); if (filter) filter.disconnect(); } catch (e) {}
    };
    osc.start(t0);
    osc.stop(end + 0.02);
  }

  function play(fn) {
    try {
      if (muted) return;
      var c = getCtx();
      if (!c) return;
      fn(c);
    } catch (e) {}
  }

  // 첫 사용자 제스처에서 오디오 잠금 해제 (iOS/Chrome)
  function unlock() { try { getCtx(); } catch (e) {} }
  try {
    var once = function () {
      unlock();
      window.removeEventListener('pointerdown', once, true);
      window.removeEventListener('keydown', once, true);
    };
    window.addEventListener('pointerdown', once, true);
    window.addEventListener('keydown', once, true);
  } catch (e) {}

  window.SFX = {
    // 정답: 상승 2음 차임 (660Hz -> 880Hz) + 부드러운 배음
    correct: function () {
      play(function (c) {
        [660, 880].forEach(function (f, i) {
          tone(c, { freq: f, start: i * 0.1, dur: 0.15, type: 'sine', vol: 0.15 });
          tone(c, { freq: f * 2, start: i * 0.1, dur: 0.12, type: 'triangle', vol: 0.03 });
        });
      });
    },
    // 오답: 낮고 둔탁한 하강 2음 (220Hz -> 165Hz), 로우패스
    wrong: function () {
      play(function (c) {
        [220, 165].forEach(function (f, i) {
          tone(c, { freq: f, start: i * 0.13, dur: 0.17, type: 'triangle', vol: 0.15, lowpass: 900 });
        });
      });
    },
    setMuted: function (m) {
      try {
        muted = !!m;
        try { window.localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) {}
        window.dispatchEvent(new CustomEvent('sfxmutechange', { detail: { muted: muted } }));
      } catch (e) {}
    },
    isMuted: function () { return muted; },
    unlock: unlock
  };
})();
