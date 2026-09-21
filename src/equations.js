import { DEG } from './physics.js';
import { COLORS } from './svg.js';

// Every term is computed from the UNROUNDED state and rounded only here, at the
// moment of display. Rounding the forces first makes the two horizontal terms
// disagree in the last digit, right beside a printed "= 0".
export function terms(s) {
  return {
    tab: s.TAB.toFixed(1),
    tbc: s.TBC.toFixed(1),
    tbd: s.TBD.toFixed(1),
    beta: s.beta.toFixed(1),
    theta: s.theta.toFixed(1),
    fxLeft:  (s.TBC * Math.cos(s.beta * DEG)).toFixed(1),
    fxRight: (s.TBD * Math.cos(s.theta * DEG)).toFixed(1),
    fyUp:    (s.TBD * Math.sin(s.theta * DEG)).toFixed(1),
    fyDown:  (s.TAB + s.TBC * Math.sin(s.beta * DEG)).toFixed(1)
  };
}

export function createEquations(node) {
  function render(s) {
    const t = terms(s);
    const o = COLORS.t1, b = COLORS.t2, g = COLORS.w;
    // Every value is a number formatted by toFixed, so there is nothing to escape.
    node.innerHTML =
      `<div>&Sigma;F<sub>x</sub>: <span style="color:${b}">${t.tbc}&middot;cos&nbsp;${t.beta}&deg;</span>` +
      ` &minus; <span style="color:${o}">${t.tbd}&middot;cos&nbsp;${t.theta}&deg;</span> = 0</div>` +
      `<div>&Sigma;F<sub>y</sub>: <span style="color:${o}">${t.tbd}&middot;sin&nbsp;${t.theta}&deg;</span>` +
      ` &minus; <span style="color:${g}">${t.tab}</span>` +
      ` &minus; <span style="color:${b}">${t.tbc}&middot;sin&nbsp;${t.beta}&deg;</span> = 0</div>` +
      `<div style="font-size:12px;color:#9aa1ab;font-family:system-ui;line-height:1.5;margin-top:6px">` +
      `Both horizontal terms equal ${t.fxLeft} N. The upward pull of ${t.fyUp} N carries the ` +
      `crate&rsquo;s ${t.tab} N plus the ${(Number(t.fyDown) - Number(t.tab)).toFixed(1)} N the far ` +
      `segment adds. The sums are exactly zero &mdash; that is what fixes T_BD and &theta;.</div>`;
  }
  return { render };
}
