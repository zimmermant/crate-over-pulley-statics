import { createState } from './state.js';
import { createScene } from './scene.js';
import { createFbd } from './fbd.js';
import { createTriangle } from './triangle.js';
import { createEquations } from './equations.js';
import { createMessages } from './messages.js';

const state = createState();

const els = {
  scene: document.getElementById('scene-svg'),
  fbd: document.getElementById('fbd-svg'),
  triangle: document.getElementById('triangle-svg'),
  equations: document.getElementById('equations'),
  messages: document.getElementById('messages'),
  wRange: document.getElementById('w-range'),
  wNumber: document.getElementById('w-number')
};

const panels = [];
panels.push(createScene(els.scene, {
  setBeta: deg => state.setBeta(deg),
  setBetaExact: deg => state.setBetaExact(deg)
}));
panels.push(createFbd(els.fbd, {
  setWeight: n => state.setWeight(n)
}));
panels.push(createTriangle(els.triangle));
panels.push(createEquations(els.equations));
panels.push(createMessages(els.messages));

function renderAll(s) {
  for (const p of panels) p.render(s);
  els.wRange.value = s.W.toFixed(0);
  // Do not fight the user while they are typing an exact weight into the box.
  if (document.activeElement !== els.wNumber) els.wNumber.value = s.W.toFixed(0);
}

els.wRange.addEventListener('input', e => state.setWeight(Number(e.target.value)));
els.wNumber.addEventListener('input', e => state.setWeight(Number(e.target.value)));

state.subscribe(renderAll);
renderAll(state.getState());

export { state, els, panels, renderAll };
