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
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + (o.glide || o.dur));
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

  // 짧은 대역통과 노이즈 버스트 (종이/나무 질감)
  function noise(c, o) {
    var t0 = c.currentTime + (o.start || 0);
    var end = t0 + o.dur;
    var len = Math.max(1, Math.floor(c.sampleRate * o.dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    var filter = c.createBiquadFilter();
    var gain = c.createGain();
    src.buffer = buf;
    filter.type = 'bandpass';
    filter.frequency.value = o.freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.vol, t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.onended = function () {
      try { src.disconnect(); filter.disconnect(); gain.disconnect(); } catch (e) {}
    };
    src.start(t0);
    src.stop(end + 0.02);
  }

  function run(fn) {
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
      run(function (c) {
        [660, 880].forEach(function (f, i) {
          tone(c, { freq: f, start: i * 0.1, dur: 0.15, type: 'sine', vol: 0.15 });
          tone(c, { freq: f * 2, start: i * 0.1, dur: 0.12, type: 'triangle', vol: 0.03 });
        });
        // 아주 여린 E6 세 번째 음 (총 ~350ms)
        tone(c, { freq: 1319, start: 0.2, dur: 0.15, type: 'sine', vol: 0.04 });
      });
    },
    // 오답: 낮고 둔탁한 하강 2음 (220Hz -> 165Hz), 로우패스
    wrong: function () {
      run(function (c) {
        [220, 165].forEach(function (f, i) {
          tone(c, { freq: f, start: i * 0.13, dur: 0.17, type: 'triangle', vol: 0.15, lowpass: 900 });
        });
      });
    },
    // 도장: 나무/종이 질감의 낮은 '쿵' (110->70Hz, ~90ms) + 짧은 노이즈
    stamp: function () {
      run(function (c) {
        tone(c, { freq: 110, freqEnd: 70, glide: 0.09, start: 0, dur: 0.15, type: 'sine', vol: 0.2 });
        noise(c, { freq: 1200, start: 0, dur: 0.03, vol: 0.12 });
      });
    },
    // 콤보: 마일스톤별 상승 아르페지오 (n>=10 5음, n>=5 4음, 그 외 3음)
    combo: function (n) {
      run(function (c) {
        n = +n || 0;
        var C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5;
        var notes = n >= 10 ? [C5, E5, G5, C6, E6] : n >= 5 ? [C5, E5, G5, C6] : [C5, E5, G5];
        notes.forEach(function (f, i) {
          var last = i === notes.length - 1;
          tone(c, { freq: f, start: i * 0.07, dur: last ? 0.16 : 0.1, type: 'sine', vol: 0.14 });
          if (n >= 10 && i >= 3) {
            tone(c, { freq: f * 2, start: i * 0.07, dur: 0.1, type: 'triangle', vol: 0.03 });
          }
        });
      });
    },
    play: function (name, n) {
      try {
        if (name === 'correct') window.SFX.correct();
        else if (name === 'wrong') window.SFX.wrong();
        else if (name === 'stamp') window.SFX.stamp();
        else if (name === 'combo') window.SFX.combo(n);
      } catch (e) {}
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
