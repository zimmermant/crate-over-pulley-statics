import { DEG } from './physics.js';
import { COLORS } from './svg.js';

// Every term is computed from the UNROUNDED state and rounded only here, at the
// moment of display. Rounding the forces first makes the two horizontal terms
// disagree in the last digit, right beside a printed "= 0".
export function terms(s) {
  return {
    tba: s.TBA.toFixed(1),
    tbc: s.TBC.toFixed(1),
    tbd: s.TBD.toFixed(1),
    beta: s.beta.toFixed(1),
    theta: s.theta.toFixed(1),
    // The two equation lines print these -- at 1 dp, cos/sin of the rounded
    // angle disagrees with the prose's unrounded-then-rounded fxLeft/fxRight
    // by up to ~1 N. 2 dp keeps the printed arithmetic close enough (worst
    // case ~0.02 N) that multiplying the numbers on screen actually closes.
    beta2: s.beta.toFixed(2),
    theta2: s.theta.toFixed(2),
    fxLeft:  (s.TBC * Math.cos(s.beta * DEG)).toFixed(1),
    fxRight: (s.TBD * Math.cos(s.theta * DEG)).toFixed(1),
    fyUp:    (s.TBD * Math.sin(s.theta * DEG)).toFixed(1),
    // The far segment's vertical pull, computed from the unrounded state --
    // NOT derived by subtracting two already-rounded display strings, which
    // is arithmetic on rounded values and can be off by up to 0.1 N.
    fyFar:   (s.TBC * Math.sin(s.beta * DEG)).toFixed(1),
    fyDown:  (s.TBA + s.TBC * Math.sin(s.beta * DEG)).toFixed(1)
  };
}

export function createEquations(node) {
  function render(s) {
    const t = terms(s);
    const o = COLORS.t1, b = COLORS.t2, g = COLORS.w;
    // Every value is a number formatted by toFixed, so there is nothing to escape.
    node.innerHTML =
      `<div>&Sigma;F<sub>x</sub>: <span style="color:${b}">${t.tbc}&middot;cos&nbsp;${t.beta2}&deg;</span>` +
      ` &minus; <span style="color:${o}">${t.tbd}&middot;cos&nbsp;${t.theta2}&deg;</span> = 0</div>` +
      `<div>&Sigma;F<sub>y</sub>: <span style="color:${o}">${t.tbd}&middot;sin&nbsp;${t.theta2}&deg;</span>` +
      ` &minus; <span style="color:${g}">${t.tba}</span>` +
      ` &minus; <span style="color:${b}">${t.tbc}&middot;sin&nbsp;${t.beta2}&deg;</span> = 0</div>` +
      `<div style="font-size:12px;color:#9aa1ab;font-family:system-ui;line-height:1.5;margin-top:6px">` +
      `Both horizontal terms equal ${t.fxLeft} N. The upward pull of ${t.fyUp} N carries the ` +
      `crate&rsquo;s ${t.tba} N plus the ${t.fyFar} N the far ` +
      `segment adds. Both sums are exactly zero for the underlying numbers &mdash; that is what fixes ` +
      `T<sub>BD</sub> and &theta;. The angles above are rounded for display, so multiplying the printed ` +
      `numbers only closes to within about a tenth of a newton.</div>`;
  }
  return { render };
}
