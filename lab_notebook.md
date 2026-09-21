# Lab Notebook

## 2026-09-21 — Fix: gamma/delta labels moved outside their own wedges

### Summary

Fixed a label-placement defect in the gamma/delta angle readouts added earlier
today. Todd rendered the built file and measured real `getBBox` clearances:
theta and beta (the pre-existing labels) cleared every rope by 48.9px and
20.1px respectively; gamma and delta — the two labels added in this session —
sat directly on top of a rope (0px clearance) at beta=44. Root cause: the
placement instruction put each label at its own arc's *midpoint angle*, which
is a point *inside the wedge the label measures*. Both wedges are too narrow
for a ~66px label across the reachable domain, so the label always crossed one
of the two bounding rays. Fixed by moving both labels outside their wedges —
beside the arc rather than inside it — at fixed pixel offsets from the pulley,
the same technique the existing theta/beta value labels already use. All 80
tests still pass; the build is byte-reproducible (identical SHA-256 across two
runs, 48263 bytes).

### Decisions made and why

**Verified the task's own wedge-width figures rather than trusting them, per
its own instruction.** The task stated delta's wedge is "13°–23° wide" across
the range. Recomputing from the actual formulas (`delta = 45 - beta/2`, beta in
[44°,77°]) gives delta ∈ [6.5°, 23°], not [13°, 23°] — the lower bound was off
by a factor of two. Gamma's stated range (13°–46°) checked out exactly. This
doesn't change the fix (the wedge is still too narrow either way — if anything
the corrected figure is narrower, reinforcing the point), but the task asked
explicitly to verify rather than trust its numbers, so the discrepancy is
recorded here rather than silently absorbed.

**Placement uses a fixed pixel offset from the pulley, not an angle that
tracks the wedge.** This mirrors how theta's and beta's own value labels are
already placed (`pulley.x - 78, pulley.y - 46` and `pulley.x + 92, pulley.y +
58` — constants, not functions of the swept angle). A fixed offset is simpler
to reason about and, since the free area up-and-right of the pulley never
contains any rope at any reachable beta, doesn't need to track anything.

**Built a numeric harness (not committed, same approach as the previous
session's) to find and verify the offsets, rather than eyeballing them.** The
harness (`scratchpad/harness.mjs` under this session's temp directory) imports
the real `pulleyAt`, `anchorC`, `interiorAngles`, `slopeGlyph` etc. from
src/physics.js and src/scene.js — no DOM needed, since none of those are
DOM-touching — and for a grid of (angle, radius, anchor) candidates measures,
via segment-to-rectangle and rectangle-to-rectangle distance (exact, not
sampled), the worst-case clearance of each candidate gamma/delta label against
all three rope segments and against every other label the scene draws
(theta, beta, T_AB, T_BC, T_BD, W, the point labels A/B/C/D, and — at the four
Pythagorean-triple detents — the slope-glyph's three integer labels). Swept
beta from 44° to 77° in 0.5°/0.2° steps (two passes, finer on the final check)
at W = 100/350/600 (finer W grid on the final check), plus the four detents
exactly. Text boxes are the proxy the task specified: 7.3px/char width at the
13px font (scaled for the glyph's 12px digits), 15px height, anchor-relative
(baseline-left for `start`, baseline-right for `end`, centered for `middle`).

Searched radius 55–150px at 1–2° angle steps on the open side (roughly
-30°..130°, standard math-angle convention, 0=right/90=up from the pulley).
Margins grow roughly linearly with radius; picked radius 75px for both labels
(close to the original, merely-mis-angled offsets of 68px/86px, so the visual
distance from the pulley is barely changed — only the angle is) as a balance
between staying visually near the arcs and keeping real margin against the
proxy's own uncertainty (no actual font metrics). Final choice: gamma at
angle -2° (just above horizontal, on the open side away from the BC-rope
wedge), delta at angle 63° (well up and to the right, on the open side away
from the BD-rope wedge), both anchor `start` (text grows away from the pulley,
never back across a rope).

**Did not add leader lines.** The task offered them as optional if the
association between arc and displaced label wasn't clear. At 75px out and
comfortably inside the open quadrant, gamma and delta read unambiguously as
"the annotation near that arc" without one; skipped to keep the diff minimal,
per "only the two text placements change."

### Problems encountered and how they were resolved

**None requiring a design change.** The first parameter grid the harness
tried (radius up to 150px) already found solutions with huge margins (100+px);
the only real decision was choosing a smaller, more visually conservative
radius from the many that worked, which just needed a second, narrower sweep
(55–90px) to map out the margin-vs-radius tradeoff before picking 75px.

### Open questions / next steps

**This is a proxy, not a browser measurement.** Worst-case clearances the
harness measured for the final placement (gamma at angle -2°/radius 75,
delta at angle 63°/radius 75, both from the pulley):

- gamma vs. every rope: worst 47.3px (vs. BC rope, at beta=44, W=100)
- gamma vs. every other label: worst 40.4px (vs. the beta value label, at beta=44, W=100)
- delta vs. every rope: worst 40.9px (vs. BD rope, at beta=77, W=100)
- delta vs. every other label: worst 40.1px (vs. the "B" point label, at beta≈44.2, W=100)
- gamma vs. delta (mutual): worst 54.4px

All comfortably above the 15px (rope) / 12px (label) thresholds, with roughly
2.5-3x margin — deliberately larger than the ~20px margin the existing beta
label has, to absorb error in the character-width/height proxy, since real
glyphs (θβγδ, the degree sign) were not measured. Todd said he would confirm
with real `getBBox` measurements in a browser; that check is still open.
**Recommend re-running the same beta=44°/low-beta sweep in a real browser
first**, since that's where every worst-case above clustered.

## 2026-09-21 — Two more angle readouts at B: gamma and delta

### Summary

Added two angle readouts at the pulley B, on top of the existing theta/beta: gamma
(the interior angle between rope BA, straight down, and rope BC, beta below
horizontal — always `90 - beta`) and delta (the angle rope BD makes with vertical —
always `90 - theta`, hence `45 - beta/2`). Both are exposed as a pure function
`interiorAngles(s)` in `src/scene.js`, drawn as two more arcs at B plus a short
dashed vertical reference line for delta, and covered by three new tests in
`test/scene.test.js`. All 80 tests pass; the build is byte-reproducible (identical
SHA-256 across two runs, 46960 bytes).

### Decisions made and why

**Delta is exactly gamma/2, always — that's the point of the readout.** `gamma =
90 - beta`, `delta = 90 - theta = 90 - (45 + beta/2) = 45 - beta/2 = gamma/2`
identically, not just numerically close. This is the same halving fact the README
already states in words ("theta moves at half beta's rate") made visible as two
numbers side by side. The new test pins the ratio to 1e-12 and a second test ties
`2*cos(delta)` directly to `solve().TBD / W`, so the displayed angle and the force
formula in equations.js can never quietly drift apart.

**Letter choice (gamma/delta).** The task invited an objection to using gamma/delta
alongside the existing theta/beta. I don't see one: theta-beta-gamma-delta is the
ordinary sequence a physics student already expects, and the four glyphs (θ β γ δ)
are visually distinct enough not to be confused at a glance. Proceeded without
raising an objection.

**New arcs use a muted "annotation ink" color, not a new rope color.** Added
`COLORS.annot = '#9aa3af'` to `src/svg.js` — a gray distinct from t1/t2/w/ink — so
gamma's and delta's arcs and delta's reference line read as measurement overlay,
not as a fourth rope. `arc()` itself was untouched; the two new arcs are additional
calls to the same helper (radius 38 for delta, 46 for gamma — smaller than the
existing theta=55 and beta=75 arcs, per spec, keeping all four visually distinct).
Existing theta/beta arcs, their exact radii and sweep flags, were not touched.

**Label offsets were pushed further out than the spec's starting point, based on a
numeric (not visual) collision check.** The task suggested starting each label at
`arc radius + 20` and adjusting if needed. Since I have no browser in this
environment, I wrote a throwaway Node script (not committed) that reproduces each
label's approximate SVG bounding box — position from the real `pulleyAt`/`anchorC`
geometry, width estimated from character count at a few different width-factors to
bracket font-metric uncertainty — and swept the whole beta range at 0.05-0.1 degree
steps. At the spec's default offsets, gamma's label grazed the fixed-position beta
VALUE label by a few pixels right at beta's low end (44°), and delta's label
grazed the fixed-position theta VALUE label the same way. Both are real, if narrow,
collisions in the proxy model, not an artifact of one width-factor choice — they
persisted across width-factors 0.55–0.70. Pushing the offsets out (delta: arc
radius + 30, gamma: arc radius + 40) cleared both with margin across the entire
swept range and every other label/rope pair checked (T_AB, T_BC, T_BD, W, A, B, C,
D, the crate rope). Arc radii themselves (38, 46) were left exactly as specified —
only the label offsets, which the spec explicitly allowed adjusting, were changed.

**This numeric check is not a substitute for actually looking at the app.** The
bounding-box proxy has no real font metrics, no halo-stroke geometry, and doesn't
know how the browser actually shrinks/kerns "θ = 67.4°" vs "γ = 46.0°". It is
useful for catching a gross, unambiguous overlap (which it did, at the spec's
default offsets) and confirming the fix has real margin, not for guaranteeing the
rendered result looks right. **The rendered appearance and any label crowding
around B are unverified** — this environment has no browser to check them in.

### Problems encountered and how they were resolved

**Spec's default label offsets (+20) produced a narrow but real overlap at the
low end of beta.** Found by the numeric sweep described above, not by visual
inspection. Resolved by increasing the offsets (see above) rather than by
weakening the check or shipping the collision.

### Open questions / next steps

The rendered scene at B — now carrying four arcs, four angle labels, three tension
labels, four point labels, the crate rope, and (at four specific beta values) the
slope-triangle glyph — has not been visually inspected. Recommend opening
`dist/crate_over_pulley.html` in a real browser and dragging beta across its full
range, paying particular attention to beta near 44° (where the numeric check found
the narrowest margins) and to the four detent betas where the slope glyph also
appears near B's neighborhood.

## 2026-09-21 — Cleanup: four snap points and implicit ceiling geometry

### Summary

Completed downstream cleanup following Task A (four Pythagorean-triple detents, expanded range) and Task B (fixed ceiling, swinging pulley). The main work was updating messages to name each triple dynamically, fixing the template's stale viewBox, and documenting the physics improvements. All tests pass; the build is byte-reproducible.

### Decisions made and why

**The ceiling change is genuine physics, not cosmetic.** The original prototype pinned the pulley in place and rotated the anchor around it — a nice simplification for a first draft, but backwards. A real pulley hanging from a fixed-length rope on a fixed ceiling genuinely swings when the ground anchor moves. The revised geometry is more faithful to the physics and more interesting for students: they see that the pulley's position is determined by the geometry itself, not by an external knob.

**The geometry is now implicit.** In the old design, beta was an independent parameter that drove everything else. Now the geometry closes on itself: the pulley's position depends on theta, theta depends on beta (from the force balance), and beta depends on where the pulley is (from the rope lengths). A pointer drag therefore solves for beta rather than setting it directly. The solver uses bisection on the monotonic relationship between ground position and beta, with a tolerance of 2.8e-14 degrees — essentially exact. Each round-trip Cx → beta → Cx reproduces the input to machine precision.

**The constants were re-derived by geometric sweep, not adjusted by eye.** The new viewBox is 720 × 680. The ceiling is at y = 44, the anchor D at x = 140, the rope length 230, the ground at y = 635, and the crate 88 × 78 hanging 250 units below the pulley. Beta ranges [44°, 77°]. The pulley swings 63.8 pixels horizontally and 16.8 pixels vertically. The worst-case rope-to-crate clearance is 13.7 pixels. Every dimension was justified by measurement, not guessed.

**The four Pythagorean triples are oriented short-leg-across, long-leg-down.** This orientation matches how the classic figure reads: "5 across for every 12 down, 13 along the rope." The alternative (long-leg-across, short-leg-down) would place the anchor far off-screen at the reachable angles, so this reading is also the only one that fits the constrained domain.

**The snap tolerance stayed at 1.5°.** The four detents are at least 5.45° apart (the closest pair) and at least 3.26° from the beta rails. At 1.5° tolerance, each snap window neither overlaps with another nor blocks a rail. The snap windows span 27–38 pixels of ground travel. The geometry guarantees at most one triple can be within SNAP_TOL at any time, so the "nearest triple" search cannot collide; the nearest-selection logic is defensive rather than load-bearing.

**The glyph's position at 0.70 along the rope is load-bearing.** Before any code was written, the rope slope glyph's position was measured at several fractions along the rope to check for collisions with the T_BC label. At 0.50 and 0.60 it collided at every detent; at 0.70 it cleared by at least 20 pixels. This was caught by measuring the mockup, unlike two earlier label collisions in this project which were only discovered by rendering a live version.

**A mutation proof requested for Task A turned out to be vacuous.** The implementer was asked to prove that snapBeta selects the nearest triple, and correctly reported that the proof was vacuous: the geometry guarantees at most one triple is in range, so "nearest" and "first in range" are indistinguishable. The lesson: a proof that something "chooses the nearest X" cannot fail when the preconditions already force uniqueness. The nearest-selection stayed in the code because it matters if more triples are added later, but it's documented as defensive.

### Problems encountered and how they were resolved

**Test failure on stale viewBox.** The scene's SVG viewBox was unchanged from the initial build despite the scene's contents growing taller. The test caught this immediately; the fix was a one-character edit: `620` → `680`.

**No hardcoded integers in messages.** The original message contained "5 across for every 12 down, 13 along its length" as literal strings. This made adding three more triples awkward. The solution was to import `tripleAt` from physics.js and use it both to detect the detent and to fill the message's integers dynamically. Each triple now produces a message with its own numbers. The 5-12-13 case gets an additional note that it is the original textbook problem.

### Open questions / next steps

None. The app is feature-complete and the test suite is at 74 tests, all passing. The build is byte-reproducible.

## 2026-09-21 — Initial build

### Summary

Completed an interactive statics visualization: a crate hanging from a cable over a frictionless pulley, held by a support rope anchored to the ground. The app has five panels — a scene showing the physical setup with draggable controls, a free-body diagram of forces on the pulley, a force triangle closing the three tensions, an equations panel showing algebraic verification, and a notes panel with situational messages. The app implements a complete constraint solver in which only two independent variables (crate weight W and anchor tilt beta) are stored; every angle, tension, and geometric constraint is recomputed on every read, so no panel can cache a stored value that disagrees with another panel's. The entire application compiles to a single 33 KB HTML file with no external dependencies.

### Decisions made and why

**Storage and recomputation architecture.** Only W and beta are stored. The scene, FBD, triangle, and equations all recompute theta, T_AB, T_BC, T_BD, and the geometric constraints on read. This shared-snapshot architecture prevents panels from holding different *values* for the same quantity: they cannot cache inconsistent copies of a computed number. It does not, on its own, guarantee the *printed* numbers agree — display-time rounding can still make one panel's own arithmetic fail to close by a visible amount even though every panel reads the same underlying value. That gap (not a values-disagreement, a rounding-of-display one) is exactly what the equations-panel fix during final review addressed: the equation lines printed angles at 1 dp, so multiplying the printed numbers by hand landed up to ~1 N off the prose's own figure for the same quantity, computed from the unrounded state. The tradeoff of the recompute-on-read approach is that every state change triggers four recomputations, but the domain is small enough that this is imperceptible.

**The physics and its two key consequences.** An ideal frictionless pulley changes only the direction of a rope, never its tension. Both segments of the cable hanging from the pulley therefore carry the crate's weight W. The support rope must cancel the resultant of these two equal pulls. The resultant of two equal-magnitude vectors lies along the angle bisector between them, so the support rope — which opposes this resultant — lies along the same bisector reversed. This gives:

    theta = 45° + beta/2
    T_BD = 2W·cos(45° − beta/2)

where beta is the ground anchor's angle below horizontal and theta is the support rope's angle above the negative x-axis. Two consequences follow that students almost never predict without the visualization:

- **theta does not depend on W at all.** Change the weight from 100 N to 600 N; the support rope's angle does not move by a single degree. This defies intuition because students expect a heavier load to "pull the support rope down."
- **theta advances at exactly half beta's rate.** Drag the ground anchor through a 20° change; the support rope rotates only 10°. The bisector relationship is geometric, not dynamic.

At the classic 5-12-13 right triangle (beta = 67.38°), these formulas yield theta = 78.69° and T_BD = 1.9612 W, a textbook reference case.

**Two setters for the detent.** The detent exists at beta = 67.38° to help students discover the 5-12-13 case. A naive single setter would snap or not snap; we needed snapping under the pointer (for discoverability) but not under keyboard steps (so the keyboard can escape once the user has found the detent). The tolerance is ±1.5°. A whole-degree keyboard step from the detent lands at 0.62° away, inside the tolerance, so a setter that snaps all the time could never leave the well. The solution: `setBeta` (pointer-driven, snaps) and `setBetaExact` (keyboard-driven, does not snap). This two-setter approach is hidden from the UI; the keyboard routes to `setBetaExact`, the pointer routes to `setBeta`.

**No FBD clipping; why the sibling app needed it.** The ball-on-ramp statics app (the sibling) clips the FBD vectors because the normal force can grow very large — larger than the visible panel — if the ramp angle approaches 90°. Here, T_BD = 2W·cos(45° − beta/2). For beta in [40°, 75°] (our constraint range), 45° − beta/2 ranges from 25° down to 7.5°, so cos(45° − beta/2) ranges from 0.9914 down to 0.9063. Thus T_BD/W ranges from 1.983 down to 1.813 — a 9.4% variation. Even at the extremes, T_BD never exceeds 2W, which always fits the panel. No clipping needed.

**Force triangle labels the vertical leg T_AB, not W.** The force triangle is the equilibrium diagram of forces *on the pulley*, not on the crate. The crate experiences W downward and the rope's tension T_AB upward; the pulley experiences the rope tensions from both legs (T_AB and T_BC, both numerically equal to W) pulling down and inward, and the support rope (T_BD) pulling up and outward. The triangle closes these three forces on the pulley. The vertical leg of the triangle is T_AB, the magnitude of the force the rope exerts on the pulley, not W. Numerically they are equal, but conceptually they are different, and the diagram is clearer for labeling what it actually shows.

### Problems encountered and how they were resolved

**Tests that could not fail.** Early test coverage shipped with several tests that were true for nearly any implementation, rendering them useless as mutation detectors:
- A snap tolerance test that did not pin the tolerance value itself; the test passed for tolerances anywhere from 1.0° to 1.999°, failing only at 0.999° and at 2.0°.
- A weight-independence assertion (`theta must not depend on W`) that is a mathematical truth for the formula theta = 45 + beta/2, so it passes regardless of whether the code actually uses that formula or implements something else.
- A notification contract that described when messages should fire but had zero test coverage for two of the three setters (`setBeta` and `setBetaExact`).
- A mutation proof for rounding `round(beta)` vs. `floor(beta)` that was tested only on a fixture set where all beta values had fractional parts below 0.5, so both would round down and the test could never distinguish them.

Each was caught during the mutation-testing phase and strengthened: the snap tolerance is now pinned to 1.5°, the weight independence is tested by sweeping both W and beta and asserting theta never changes, the notification contract is tested on all three setters, and the rounding proof uses fixtures with fractional parts above 0.5.

**A test ported from the sibling app.** The sibling app's build test asserted a fact about that app's source (`fbd.js` declares a top-level `px`). When copied here, the test promptly failed because this app doesn't have that structure. The test was rewritten to be self-contained: it now builds two synthetic module sources inline — one with a top-level `px`, one with an indented `px` inside a function — and asserts that `scanForDuplicates` (the build system's column-0 anchored duplicate detector) registers the first and does not collide on the second.

**Pointer-capture ordering bug in both scene.js and fbd.js.** The original code set a drag flag to true, then called `setPointerCapture`, then started the drag. If `setPointerCapture` failed (which it shouldn't, but defensive code matters), the flag was latched true but capture was never established. On the next `pointermove` without a button held, the drag proceeded with no capture, allowing a throw to leave the flag stuck true and subsequent bare pointer moves to drag the handle invisibly. The fix: only the `setPointerCapture` call is in a try block; the catch returns immediately; the drag flag is set only after, on the success path. This ensures a failed capture never leaves the drag flag stuck. Both `scene.js` and `fbd.js` were fixed. **Important note for follow-up work:** The sibling app `ball_on_ramp_statics` has the exact same ordering bug in its own `scene.js` and `fbd.js`, and it has not been fixed. It should be.

**Label collisions caught only by rendering in a real browser.** Two issues emerged during manual browser inspection:
- In the FBD, the two rope-tension labels (T_AB and T_BC) were positioned by offset from the arrow midpoints, both offset rightward. The two arrowheads come within 5.2 pixels of each other vertically, so the labels overlapped by ~47 pixels. Fixed by changing T_AB's offset to go leftward and anchoring the text at its end rather than its start, so the label sits to the left of its arrow instead of the right.
- In the force triangle, labels were pushed away from the centroid to avoid sitting on the triangle itself. For a thin triangle (this one reaches 7.6:1 aspect ratio), pushing away from the centroid is not perpendicular to any leg. The labels ended up sitting directly on the legs instead of beside them. Fixed by computing each label's position perpendicular to the leg nearest it, then flipping the perpendicular to point away from the centroid.

These fixes were discovered and verified by rendering in a live browser and measuring positions. The actual code changes were simple geometry, not instrumented with `getBBox` calls. No test can reach this code path because there is no DOM in the Node test environment. This illustrates a crucial lesson: the label-collision and dead-branch defects were invisible to a green test suite. The suite was not yet at its final 57: it stood at 37 tests when the FBD label-overlap bug was present, 43 when the force-triangle label-overlap bug was present, and 52 when the notes-panel dead-branch bug was present (each count taken at the commit immediately before that bug's fix). Every one of those runs was fully green. The manual browser verification pass — the only way to render and measure — found defects that automated testing could not reach.

**Notes panel message delivery broken after first render.** The original branch structure tried to prioritize messages like this:
1. If weight changed, show the weight message.
2. Else if beta changed, show the beta message.
3. Else show a stateful message based on where we are.

Every state change alters exactly one field, and the state object only notifies on a real change. So after the first render either "weight changed" or "beta changed" is true, meaning branch 1 or branch 2 always fired. Branch 3 — the whole stateful group, containing the detent announcement, both limit messages and the standing explanation — could therefore only ever be reached when `prev` was null, on the very first render of the session. Four of the five message types were dead from the student's first interaction onward. Fixed by restructuring to: if weight changed, show weight message; else if beta changed, show the beta message which may be the detent announcement if we landed exactly there, or the half-rate message with a rail clause if at a limit, or just the half-rate message; else (first render only) show state-based messages. The detent test was tightened from a 0.15° tolerance to exact matching, because earlier runs had claimed a 5-12-13 ratio at beta = 67.3°, which does not actually have that ratio.

### Open questions / next steps

**No automated test instantiates any renderer.** `createScene`, `createFbd`, `createTriangle`, `createEquations`, and `createMessages` are never called in the test suite. There is no DOM in the Node test environment, so `getBBox`, `textContent`, pointer events, keyboard events, and drag behavior cannot be tested automatically. The pure geometry beneath each renderer (the coordinate transforms, the vector sums, the triangle closure) is tested thoroughly. But the rendering layer — labels, layout, visual feedback, state coherence across a live drag — is covered only by manual browser inspection. This gap is structural and inherent to the testing approach. Every task in this plan that touched a renderer therefore included manual browser verification, and that verification is the only evidence covering that layer.

**Publishing is out of scope.** The spec describes pushing a stripped copy to a public GitHub repository. This is a side effect outside this worktree and requires Todd's explicit go-ahead. The build is complete and reproducible; publishing happens separately.

**Follow-up: fix the ball_on_ramp_statics pointer-capture bug.** The sibling app has the same ordering defect in `scene.js` and `fbd.js` as was fixed here. It should be fixed there as well.
