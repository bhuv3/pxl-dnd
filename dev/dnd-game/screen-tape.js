// Test helper (parity page only): lets a second drawing of the same frame see the same random numbers as the first
// (a few effects take random numbers while they draw). record() logs what every generator returns until replay().
const RngTape = (() => {
  const make = Random.makeRng;
  let mode = 'live', used = [];

  // A generator that logs in 'record' mode and repeats its log in 'replay' mode.
  Random.makeRng = seed => {
    const real = make(seed), w = { buf: [], pos: 0, tracked: false };
    return () => {
      if (mode === 'replay' && w.pos < w.buf.length) return w.buf[w.pos++];
      const v = real();
      if (mode === 'record') { if (!w.tracked) { w.tracked = true; used.push(w); } w.buf.push(v); }
      return v;
    };
  };

  return {
    record() { used.forEach(w => { w.buf.length = 0; w.tracked = false; }); used = []; mode = 'record'; },
    replay() { used.forEach(w => { w.pos = 0; }); mode = 'replay'; },
    live() { mode = 'live'; },
  };
})();
