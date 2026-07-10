// Sonido de subida de nivel estilo MU Online, sintetizado con Web Audio API
// (el original tiene copyright): arpegio ascendente tipo arpa + acorde final
// brillante con vibrato + colchón grave cálido.
let ctx;

export function playLevelUp() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // arpegio ascendente (do mayor, dos octavas)
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.07;
      [[1, 'triangle', 0.22], [2, 'sine', 0.07]].forEach(([mult, type, vol]) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = f * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.55);
      });
    });

    // acorde final brillante con shimmer (vibrato suave)
    const tEnd = t0 + notes.length * 0.07 + 0.03;
    [1046.5, 1318.5, 1567.98].forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const vib = ctx.createOscillator();
      vib.frequency.value = 6;
      const vibGain = ctx.createGain();
      vibGain.gain.value = 5;
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, tEnd);
      g.gain.linearRampToValueAtTime(0.13, tEnd + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, tEnd + 1.4);
      osc.connect(g);
      g.connect(master);
      osc.start(tEnd);
      osc.stop(tEnd + 1.5);
      vib.start(tEnd);
      vib.stop(tEnd + 1.5);
    });

    // colchón grave cálido
    const low = ctx.createOscillator();
    low.type = 'sine';
    low.frequency.value = 130.81;
    const lowGain = ctx.createGain();
    lowGain.gain.setValueAtTime(0, t0);
    lowGain.gain.linearRampToValueAtTime(0.14, t0 + 0.3);
    lowGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);
    low.connect(lowGain);
    lowGain.connect(master);
    low.start(t0);
    low.stop(t0 + 1.9);
  } catch {
    // sin audio disponible: el efecto visual alcanza
  }
}
