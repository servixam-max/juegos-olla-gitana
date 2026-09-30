// Probe: groundUnder semantics with the exact call-site argument shapes.
const M = await import('/src/engine/physics.js');
const R = {};
const w = new M.World();
w.add(new M.Box({ x: 0, y: -0.3, z: 0, w: 13, h: 0.6, d: 40, tag: 'pulido' }));   // floor top=0
w.add(new M.Box({ x: 0, y: 2.9, z: 10, w: 3, h: 0.6, d: 3, tag: 'platform' }));    // platform top=3.2

// (a) main.js inPuddle() casino shape: minY:-50, maxY:0   -> expects the polished floor
R.casinoCall = w.groundUnder({ minX: -0.3, maxX: 0.3, minZ: 5, maxZ: 5.6, minY: -50, maxY: 0 });
// (b) player.js shadow shape over the floor: minY:-50, maxY:0
R.shadowCallFloor = w.groundUnder({ minX: -0.3, maxX: 0.3, minZ: 5, maxZ: 5.6, minY: -50, maxY: 0 });
// (c) player.js shadow shape while standing on the platform (feet y=3.2)
R.shadowCallPlatform = w.groundUnder({ minX: -0.3, maxX: 0.3, minZ: 10, maxZ: 10.6, minY: -50, maxY: 0 });
// (d) bot gapAhead shape: minY:-50, maxY:0.1  -> expects the floor (so gapAhead should be false)
R.gapAheadCall = w.groundUnder({ minX: -0.25, maxX: 0.25, minZ: 1.3, maxZ: 2.1, minY: -50, maxY: 0.1 });
// (e) bot "safe" shape: minY:-50, maxY: p.y+0.3
R.safeCall = w.groundUnder({ minX: -0.4, maxX: 0.4, minZ: -0.4, maxZ: 0.4, minY: -50, maxY: 0.4 });
// (f) proper shape (foot y as minY)
R.properCall = w.groundUnder({ minX: -0.3, maxX: 0.3, minZ: 5, maxZ: 5.6, minY: 0, maxY: 1.25 });
R.properCallPlatform = w.groundUnder({ minX: -0.3, maxX: 0.3, minZ: 10, maxZ: 10.6, minY: 3.2, maxY: 4.45 });
// (g) overlap still fine
R.overlapFloor = w.overlap({ minX: -0.2, maxX: 0.2, minY: -0.2, maxY: 0.2, minZ: 5, maxZ: 5.5 });
const simp = (o) => (o && typeof o === 'object' && o.box ? { tag: o.box.tag, top: o.top } : (o && o.tag ? o.tag : o));
for (const k of Object.keys(R)) R[k] = simp(R[k]);
return R;
