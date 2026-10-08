/**
 * Audio, Vibration & Speech Synthesis utilities for Glazy Ready to Claim notifications.
 * Works 100% offline using standard Web Audio, Web Speech, and Vibration APIs.
 */

class AudioAlertHelper {
  constructor() {
    this.audioCtx = null;
  }

  getAudioContext() {
    if (!this.audioCtx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Play clean 3-note celebration chime (D5 -> A5 -> D6)
   */
  playReadyChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const notes = [587.33, 880.0, 1174.66]; // D5, A5, D6
      const start = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start + idx * 0.15);

        gain.gain.setValueAtTime(0, start + idx * 0.15);
        gain.gain.linearRampToValueAtTime(0.3, start + idx * 0.15 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + idx * 0.15 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start + idx * 0.15);
        osc.stop(start + idx * 0.15 + 0.55);
      });
    } catch (e) {
      console.warn("Audio playback not allowed yet:", e);
    }
  }

  /**
   * Play simple store ding (E5 bell chime)
   */
  playDing() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(659.25, now); // E5

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.9);
    } catch (e) {
      console.warn("Ding playback error:", e);
    }
  }

  /**
   * Mobile device haptic vibration
   */
  vibrate() {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([250, 100, 250, 100, 400]);
      }
    } catch (_e) {}
  }

  /**
   * Text-to-Speech announcement via Web Speech API
   */
  speakQueueAnnouncement(queueNumber, repeatCount = 1) {
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel(); // clear previous queue

      const text = `Order ${queueNumber.replace("-", " ")} is ready for pickup.`;

      for (let i = 0; i < repeatCount; i++) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn("TTS Error:", e);
    }
  }
}

export const alertHelper = new AudioAlertHelper();
