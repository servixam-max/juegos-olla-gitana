// Shadow fix verification: player standing on an N2 scaffold must have its shadow at the platform top.
const R = {};
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.start(1);   // N2
qa.step(1/30, 10);
R.sondaPlatform = qa.sonda(2.6, 1.6, 34);   // scaffold platform at z=34 x=2.6 h=1.8 top=1.8
qa.teleport(2.6, 1.9, 34);
qa.step(1/30, 30);
R.onScaffold = { pos: { ...qa.state().pos }, grounded: qa.diag().grounded };
R.sondaUnder = qa.sonda(qa.state().pos.x, qa.state().pos.y - 0.2, qa.state().pos.z);
// groundUnder must now resolve the platform top (1.8) rather than the floor (0) — this is what the shadow uses
R.errors = qa.data.errors.slice();
return R;
