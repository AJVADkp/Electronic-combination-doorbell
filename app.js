/**
 * ELECTRONIC COMBINATION DOORBELL - CONTROLLER
 * Sequential FSM: B1 -> B2 -> B3 -> UNLOCK (Bell HIGH, Red Light & Chime)
 * Orange & White Industrial Hardware Edition
 */

(function () {
  'use strict';

  // FSM State Constants
  const STATE = {
    IDLE: 0,   // 2'b00: Waiting for initial button B1. Bell OFF.
    S1: 1,     // 2'b01: B1 validated; waiting for B2.
    S2: 2,     // 2'b10: B1 and B2 validated; waiting for B3.
    UNLOCK: 3  // 2'b11: Correct sequence! Bell HIGH, Red Light & Chime active.
  };

  const STATE_INFO = {
    [STATE.IDLE]: { name: 'IDLE', q1: 0, q0: 0, badgeClass: 'state-idle' },
    [STATE.S1]: { name: 'S1', q1: 0, q0: 1, badgeClass: 'state-s1' },
    [STATE.S2]: { name: 'S2', q1: 1, q0: 0, badgeClass: 'state-s2' },
    [STATE.UNLOCK]: { name: 'UNLOCK', q1: 1, q0: 1, badgeClass: 'state-unlock' }
  };

  // State Variables
  let currentState = STATE.IDLE;
  let nextState = STATE.IDLE;
  let bellActive = false;
  let clockCycle = 0;
  let unlockTimer = null;

  // Sound Variables
  let audioContext = null;
  let soundEnabled = true;
  const masterVolume = 0.75;
  const ringDurationMs = 2500;

  // DOM Elements
  const dom = {
    redLightBox: document.getElementById('redLightBox'),
    ambientRedGlow: document.getElementById('ambientRedGlow'),
    redLed: document.getElementById('redLed'),
    bellOutputState: document.getElementById('bellOutputState'),
    speakerGrille: document.getElementById('speakerGrille'),
    securityStatusChip: document.getElementById('securityStatusChip'),
    securityStatusLabel: document.getElementById('securityStatusLabel'),
    valQ1: document.getElementById('valQ1'),
    valQ0: document.getElementById('valQ0'),
    currentStateBadge: document.getElementById('currentStateBadge'),
    lcdClock: document.getElementById('lcdClock'),
    lcdMessage: document.getElementById('lcdMessage'),
    progStep1: document.getElementById('progStep1'),
    progStep2: document.getElementById('progStep2'),
    progStep3: document.getElementById('progStep3'),
    btnB1: document.getElementById('btnB1'),
    btnB2: document.getElementById('btnB2'),
    btnB3: document.getElementById('btnB3'),
    hwResetBtn: document.getElementById('hwResetBtn'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    soundStatusText: document.getElementById('soundStatusText')
  };

  // =========================================================================
  // WEB AUDIO API - SOUND SYNTHESIZER
  // =========================================================================
  function initAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }

  // Tactile Mechanical Click Sound on button push
  function playClickSound(freq = 620, duration = 0.04) {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioContext) return;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + duration);

      gain.gain.setValueAtTime(masterVolume * 0.28, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + duration);
    } catch (e) {
      console.warn('Audio click error:', e);
    }
  }

  // Low buzz on wrong sequence
  function playErrorBuzz() {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioContext) return;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioContext.currentTime);
      osc.frequency.linearRampToValueAtTime(80, audioContext.currentTime + 0.18);

      gain.gain.setValueAtTime(masterVolume * 0.22, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.18);
    } catch (e) {
      console.warn('Audio error buzz:', e);
    }
  }

  // Full Rich Doorbell Chime (Ding-Dong)
  function playDoorbellChime() {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioContext) return;

      const now = audioContext.currentTime;
      // Note 1: High "Ding" (~880Hz / A5)
      createHarmonicTone(880, now, 1.2, 0.7);
      // Note 2: Warm "Dong" (~659.25Hz / E5) after 320ms
      createHarmonicTone(659.25, now + 0.32, 1.8, 0.85);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  function createHarmonicTone(freq, startTime, decayTime, ampScale) {
    const harmonics = [
      { ratio: 1.0, gain: 0.75 },
      { ratio: 2.0, gain: 0.25 },
      { ratio: 2.76, gain: 0.12 }
    ];

    harmonics.forEach(h => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * h.ratio, startTime);

      const targetGain = masterVolume * ampScale * h.gain;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(targetGain, startTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decayTime);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(startTime);
      osc.stop(startTime + decayTime);
    });
  }

  // =========================================================================
  // FSM CORE LOGIC
  // =========================================================================
  function handleButtonPress(btnNumber) {
    // If bell is currently ringing, ignore button inputs until complete
    if (currentState === STATE.UNLOCK && bellActive) {
      return;
    }

    clockCycle++;
    initAudioContext();
    playClickSound();

    const b1 = (btnNumber === 1);
    const b2 = (btnNumber === 2);
    const b3 = (btnNumber === 3);

    animateButtonPush(btnNumber);

    switch (currentState) {
      case STATE.IDLE:
        if (b1) {
          nextState = STATE.S1;
          commitStateTransition('advance', 1);
        } else {
          // B2 or B3 pressed first: does NOT advance, remains in IDLE
          nextState = STATE.IDLE;
          playErrorBuzz();
          flashButtonError(btnNumber);
          commitStateTransition('stay_idle', btnNumber);
        }
        break;

      case STATE.S1:
        if (b2) {
          nextState = STATE.S2;
          commitStateTransition('advance', 2);
        } else {
          // Pressed B1 or B3: sequence broken, reset to IDLE
          nextState = STATE.IDLE;
          playErrorBuzz();
          flashButtonError(btnNumber);
          commitStateTransition('reset_idle', btnNumber);
        }
        break;

      case STATE.S2:
        if (b3) {
          nextState = STATE.UNLOCK;
          commitStateTransition('unlock', 3);
        } else {
          // Pressed B1 or B2: sequence broken, reset to IDLE
          nextState = STATE.IDLE;
          playErrorBuzz();
          flashButtonError(btnNumber);
          commitStateTransition('reset_idle', btnNumber);
        }
        break;

      case STATE.UNLOCK:
        nextState = STATE.IDLE;
        commitStateTransition('auto_idle', 0);
        break;

      default:
        nextState = STATE.IDLE;
        commitStateTransition('auto_idle', 0);
    }
  }

  function commitStateTransition(type, btnNum) {
    currentState = nextState;

    if (currentState === STATE.UNLOCK) {
      activateBellOutput();
      setLcdMessage('SEQUENCE ACCEPTED! Doorbell is ringing!', 'success');
      setSecurityStatus('RINGING', true);
    } else if (type === 'advance') {
      if (currentState === STATE.S1) {
        setLcdMessage('Button 1 (B1) Validated. Next: Press Button 2 (B2).');
      } else if (currentState === STATE.S2) {
        setLcdMessage('Button 2 (B2) Validated. Next: Press Button 3 (B3) to ring.');
      }
      setSecurityStatus('ARMED', false);
    } else if (type === 'stay_idle') {
      setLcdMessage(`Sequence must start with B1. You pressed B${btnNum}. Press B1.`, 'warn');
      setSecurityStatus('STANDBY', false);
    } else if (type === 'reset_idle') {
      setLcdMessage(`Wrong button (B${btnNum})! Sequence broken. Resetting to IDLE. Press B1.`, 'warn');
      setSecurityStatus('STANDBY', false);
    } else {
      setLcdMessage('Please enter access sequence: Press Button 1 (B1).');
      setSecurityStatus('STANDBY', false);
    }

    updateStateDisplay();
  }

  // Hardware Reset (rst = 1)
  function handleReset() {
    initAudioContext();
    playClickSound(420, 0.05);

    clockCycle++;
    if (unlockTimer) {
      clearTimeout(unlockTimer);
      unlockTimer = null;
    }

    currentState = STATE.IDLE;
    nextState = STATE.IDLE;
    deactivateBellOutput();

    setLcdMessage('System Reset. Waiting for sequence: Press Button 1 (B1).');
    setSecurityStatus('STANDBY', false);
    updateStateDisplay();
  }

  // =========================================================================
  // BELL & RED LIGHT ACTIVATION
  // =========================================================================
  function activateBellOutput() {
    bellActive = true;

    // Dome Red LED & Room Glow Active
    dom.redLightBox.classList.add('ringing');
    dom.ambientRedGlow.classList.add('active');
    dom.speakerGrille.classList.add('ringing');
    dom.bellOutputState.textContent = 'HIGH · 5.0V (ACTIVE RING)';
    dom.bellOutputState.style.color = '#ef4444';

    // Play Doorbell Chime
    playDoorbellChime();

    // After ring duration, return automatically to IDLE
    if (unlockTimer) clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      deactivateBellOutput();
      currentState = STATE.IDLE;
      nextState = STATE.IDLE;
      clockCycle++;

      setLcdMessage('Doorbell chime complete. Ready for new sequence: Press B1.');
      setSecurityStatus('STANDBY', false);
      updateStateDisplay();
      unlockTimer = null;
    }, ringDurationMs);
  }

  function deactivateBellOutput() {
    bellActive = false;
    dom.redLightBox.classList.remove('ringing');
    dom.ambientRedGlow.classList.remove('active');
    dom.speakerGrille.classList.remove('ringing');
    dom.bellOutputState.textContent = 'OFF (LOW · 0V)';
    dom.bellOutputState.style.color = '';
  }

  // =========================================================================
  // UI UPDATERS
  // =========================================================================
  function updateStateDisplay() {
    const info = STATE_INFO[currentState];

    // Digital Register Plate
    dom.valQ1.textContent = info.q1;
    dom.valQ0.textContent = info.q0;
    dom.currentStateBadge.textContent = info.name;
    dom.currentStateBadge.className = `state-pill ${info.badgeClass}`;
    dom.lcdClock.textContent = `CLK: ${clockCycle}`;

    // Stepper Indicators
    dom.progStep1.className = 'progress-step step-1';
    dom.progStep2.className = 'progress-step step-2';
    dom.progStep3.className = 'progress-step step-3';

    if (currentState === STATE.IDLE) {
      dom.progStep1.classList.add('active');
    } else if (currentState === STATE.S1) {
      dom.progStep1.classList.add('completed');
      dom.progStep2.classList.add('active');
    } else if (currentState === STATE.S2) {
      dom.progStep1.classList.add('completed');
      dom.progStep2.classList.add('completed');
      dom.progStep3.classList.add('active');
    } else if (currentState === STATE.UNLOCK) {
      dom.progStep1.classList.add('completed');
      dom.progStep2.classList.add('completed');
      dom.progStep3.classList.add('completed');
    }
  }

  function setLcdMessage(text, type = '') {
    dom.lcdMessage.textContent = text;
    dom.lcdMessage.className = `lcd-message ${type}`;
  }

  function setSecurityStatus(statusText, isRinging) {
    dom.securityStatusLabel.textContent = statusText;
    if (isRinging) {
      dom.securityStatusChip.classList.add('ringing');
    } else {
      dom.securityStatusChip.classList.remove('ringing');
    }
  }

  function animateButtonPush(btnNum) {
    const btn = document.getElementById(`btnB${btnNum}`);
    if (btn) {
      btn.classList.add('pressed');
      setTimeout(() => {
        btn.classList.remove('pressed');
      }, 140);
    }
  }

  function flashButtonError(btnNum) {
    const btn = document.getElementById(`btnB${btnNum}`);
    if (btn) {
      btn.classList.add('error-press');
      setTimeout(() => {
        btn.classList.remove('error-press');
      }, 400);
    }
  }

  // =========================================================================
  // EVENT LISTENERS & INITIALIZATION
  // =========================================================================
  function initEventListeners() {
    // 3 Sequential Hardware Buttons
    dom.btnB1.addEventListener('click', () => handleButtonPress(1));
    dom.btnB2.addEventListener('click', () => handleButtonPress(2));
    dom.btnB3.addEventListener('click', () => handleButtonPress(3));

    // Reset Button
    dom.hwResetBtn.addEventListener('click', () => handleReset());

    // Sound Toggle Button
    dom.soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      dom.soundStatusText.textContent = soundEnabled ? 'SOUND ON' : 'SOUND MUTED';
      dom.soundToggleBtn.style.opacity = soundEnabled ? '1' : '0.6';
      if (soundEnabled) initAudioContext();
    });

    // Keyboard Shortcuts (1 -> B1, 2 -> B2, 3 -> B3, R -> Reset)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === '1') handleButtonPress(1);
      else if (e.key === '2') handleButtonPress(2);
      else if (e.key === '3') handleButtonPress(3);
      else if (e.key === 'r' || e.key === 'R') handleReset();
    });

    // Unlock Web Audio context on first click
    const resumeAudio = () => {
      initAudioContext();
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('keydown', resumeAudio);
  }

  // Start initialization
  function init() {
    updateStateDisplay();
    initEventListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
