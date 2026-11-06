"use client";

import { useEffect, useState } from "react";

/** Returns a smoothed 0–1 loudness value for the stream's audio track. */
export function useAudioLevel(stream: MediaStream | null, enabled = true) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!stream || !enabled || stream.getAudioTracks().length === 0) {
      setLevel(0);
      return;
    }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    let raf = 0;
    let smooth = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 60) return; // ~16fps is plenty for UI
      last = t;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      smooth = smooth * 0.6 + Math.min(1, rms * 4) * 0.4;
      setLevel(smooth < 0.02 ? 0 : smooth);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      src.disconnect();
      ctx.close().catch(() => {});
    };
  }, [stream, enabled]);

  return level;
}
