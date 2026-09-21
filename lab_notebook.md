# Lab Notebook

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
