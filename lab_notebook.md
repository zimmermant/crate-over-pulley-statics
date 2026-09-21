# Lab Notebook

## 2026-09-21 — Initial build

### Summary

Completed an interactive statics visualization: a crate hanging from a cable over a frictionless pulley, held by a support rope anchored to the ground. The app has four panels — a scene showing the physical setup with draggable controls, a free-body diagram of forces on the pulley, a force triangle closing the three tensions, and an equations panel showing algebraic verification. The app implements a complete constraint solver in which only two independent variables (crate weight W and anchor tilt beta) are stored; every angle, tension, and geometric constraint is recomputed on every read, making disagreement between panels structurally impossible. The entire application compiles to a single 33 KB HTML file with no external dependencies.

### Decisions made and why

**Storage and recomputation architecture.** Only W and beta are stored. The scene, FBD, triangle, and equations all recompute theta, T_AB, T_BC, T_BD, and the geometric constraints on read. This architecture makes it literally impossible for two panels to disagree: they cannot cache inconsistent copies of a computed quantity. The tradeoff is that every state change triggers four recomputations, but the domain is small enough that this is imperceptible.

**The physics and its two key consequences.** An ideal frictionless pulley changes only the direction of a rope, never its tension. Both segments of the cable hanging from the pulley therefore carry the crate's weight W. The support rope must cancel the resultant of these two equal pulls. The resultant of two equal-magnitude vectors lies along the angle bisector between them, so the support rope — which opposes this resultant — lies along the same bisector reversed. This gives:

    theta = 45° + beta/2
    T_BD = 2W·cos(45° − beta/2)

where beta is the ground anchor's angle below horizontal and theta is the support rope's angle above the negative x-axis. Two consequences follow that students almost never predict without the visualization:

- **theta does not depend on W at all.** Change the weight from 100 N to 600 N; the support rope's angle does not move by a single degree. This defies intuition because students expect a heavier load to "pull the support rope down."
- **theta advances at exactly half beta's rate.** Drag the ground anchor through a 20° change; the support rope rotates only 10°. The bisector relationship is geometric, not dynamic.

At the classic 5-12-13 right triangle (beta = 67.38°), these formulas yield theta = 78.69° and T_BD = 1.9612 W, a textbook reference case.

**Two setters for the detent.** The detent exists at beta = 67.38° to help students discover the 5-12-13 case. A naive single setter would snap or not snap; we needed snapping under the pointer (for discoverability) but not under keyboard steps (so the keyboard can escape once the user has found the detent). The tolerance is ±1.5°. A whole-degree keyboard step from the detent lands at 0.62° away, inside the tolerance, so a setter that snaps all the time could never leave the well. The solution: `setBeta` (pointer-driven, snaps) and `setBetaExact` (keyboard-driven, does not snap). This two-setter approach is hidden from the UI; the keyboard routes to `setBetaExact`, the pointer routes to `setBeta`.

**No FBD clipping; why the sibling app needed it.** The ball-on-ramp statics app (the sibling) clips the FBD vectors because the normal force can grow very large — larger than the visible panel — if the ramp angle approaches 90°. Here, T_BD = 2W·cos(45° − beta/2). For beta in [40°, 75°] (our constraint range), 45° − beta/2 stays in [7.5°, 25°], so cos(45° − beta/2) stays in [0.9914, 0.9962]. Thus T_BD is bounded between 1.98 W and 1.99 W, a 0.8% range. Even at the extremes, T_BD never exceeds 2W, which always fits the panel. No clipping needed.

**Force triangle labels the vertical leg T_AB, not W.** The force triangle is the equilibrium diagram of forces *on the pulley*, not on the crate. The crate experiences W downward and the rope's tension T_AB upward; the pulley experiences the rope tensions from both legs (T_AB and T_BC, both numerically equal to W) pulling down and inward, and the support rope (T_BD) pulling up and outward. The triangle closes these three forces on the pulley. The vertical leg of the triangle is T_AB, the magnitude of the force the rope exerts on the pulley, not W. Numerically they are equal, but conceptually they are different, and the diagram is clearer for labeling what it actually shows.

### Problems encountered and how they were resolved

**Tests that could not fail.** Early test coverage shipped with several tests that were true for nearly any implementation, rendering them useless as mutation detectors:
- A snap tolerance test that did not pin the tolerance value itself; the test passed at 0°, 45°, 360°, or any tolerance.
- A weight-independence assertion (`theta must not depend on W`) that is a mathematical truth for the formula theta = 45 + beta/2, so it passes regardless of whether the code actually uses that formula or implements something else.
- A notification contract that described when messages should fire but had zero test coverage for two of the three setters (the weight setter and the exact-beta setter).
- A mutation proof for rounding `round(beta)` vs. `floor(beta)` that was tested only on a fixture set where all beta values had fractional parts below 0.5, so both would round down and the test could never distinguish them.

Each was caught during the mutation-testing phase and strengthened: the snap tolerance is now pinned to 1.5°, the weight independence is tested by sweeping both W and beta and asserting theta never changes, the notification contract is tested on all three setters, and the rounding proof uses fixtures with fractional parts above 0.5.

**A test ported from the sibling app.** The ball-on-ramp app has a top-level variable `px` (pixel scale). One of its tests asserted `fbd.js declares a top-level px`. That test was copied into this project's test suite and promptly failed, because this app does not have that variable. The test was rewritten to be self-contained: instead of inspecting the source, it now computes a pixel scale from the FBD's actual dimensions and asserts that the rendered vectors use it consistently.

**Pointer-capture ordering bug in both scene.js and fbd.js.** The original code set a drag flag to true, then called `setPointerCapture`, then started the drag. If `setPointerCapture` failed (which it shouldn't, but defensive code matters), the flag was latched true but capture was never established. On the next `pointermove` without a button held, the drag proceeded with no capture, allowing a throw to leave the flag stuck true and subsequent bare pointer moves to drag the handle invisibly. The fix: wrap the flag-setting, capture, and drag-start in a try block; only set the flag if the try succeeds. Both `scene.js` and `fbd.js` were fixed. **Important note for follow-up work:** The sibling app `ball_on_ramp_statics` has the exact same ordering bug in its own `scene.js` and `fbd.js`, and it has not been fixed. It should be.

**Label collisions caught only by rendering in a real browser.** Two issues emerged during manual browser inspection:
- In the FBD, the two rope-tension labels (T_AB and T_BC) were positioned by offset from the arrow midpoints, both offset rightward. The two arrowheads come within 5.2 pixels of each other vertically, so the labels overlapped by ~47 pixels. Fixed by measuring the real `getBBox` of each label and repositioning them to avoid overlap while remaining visually near their arrows.
- In the force triangle, labels were pushed away from the centroid to avoid sitting on the triangle itself. For a thin triangle (this one reaches 7.6:1 aspect ratio), pushing away from the centroid is not perpendicular to any leg. The labels ended up sitting directly on the legs instead of beside them. Fixed by computing each label's position perpendicular to the leg nearest it, using real `getBBox` boxes measured in the browser.

Both fixes required iterative measurement and repositioning in a live browser environment. No test can reach this code path because there is no DOM in the Node test environment.

**Notes panel message delivery broken after first render.** The notes panel determines what message to display by checking branches in order: "Is the user at the detent?" → "Did the weight change?" → "Did beta change?" The original branch order was:
1. If something changed, show that change.
2. Else if something was true before and is still true, say it again.

This coverage was broken: after the first render, case 1 (something changed) would never be true for any state change, because the panel held `prev` from the earlier state. The detent message — which exists specifically to celebrate when the student *lands* on the detent — never fired after the first interaction. Fixed by restructuring the branches to check precedence (detent > weight change > beta change) and checking "is this the first time we've entered this state?" rather than "did this change?" The detent test was tightened from a 0.15° tolerance to exact matching, because earlier runs had claimed a 5-12-13 ratio at beta = 67.3°, which does not actually have that ratio.

### Open questions / next steps

**No automated test instantiates any renderer.** `createScene`, `createFbd`, `createTriangle`, and `createEquations` are never called in the test suite. There is no DOM in the Node test environment, so `getBBox`, `textContent`, pointer events, keyboard events, and drag behavior cannot be tested automatically. The pure geometry beneath each renderer (the coordinate transforms, the vector sums, the triangle closure) is tested thoroughly. But the rendering layer — labels, layout, visual feedback, state coherence across a live drag — is covered only by manual browser inspection. This gap is structural and inherent to the testing approach. Every task in this plan that touched a renderer therefore included manual browser verification, and that verification is the only evidence covering that layer.

**Publishing is out of scope.** The spec describes pushing a stripped copy to a public GitHub repository. This is a side effect outside this worktree and requires Todd's explicit go-ahead. The build is complete and reproducible; publishing happens separately.

**Follow-up: fix the ball_on_ramp_statics pointer-capture bug.** The sibling app has the same ordering defect in `scene.js` and `fbd.js` as was fixed here. It should be fixed there as well.
