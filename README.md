# A crate over a pulley

An interactive statics problem. A crate hangs from a cable that runs up over a
pulley suspended by a support rope from a fixed ceiling, and down to a ground
anchor. Set the crate's weight and slide the ground anchor; the pulley swings
naturally as the anchor moves, and every tension and angle resolves.

**Open `dist/crate_over_pulley.html` in any browser.** One file, no build step to
view it, no network access required.

## The physics

A frictionless pulley redirects a rope without changing its tension, so both
segments of the cable carry the crate's weight W. The resultant of two equal
pulls lies along the bisector of the angle between them, so the support rope —
which cancels that resultant — lies along the same bisector reversed:

    theta = 45 deg + beta/2
    T_BD  = 2 W cos(45 deg - beta/2)

where beta is the tilt of the rope to the ground anchor below horizontal and
theta is the support rope's angle above the negative x-axis.

Two things follow that students rarely predict:

- **theta does not depend on W.** Load the crate with anything; the support rope
  does not budge.
- **theta moves at half beta's rate.** Slide the anchor through 20 degrees and the
  support rope turns 10.

The app snaps to four Pythagorean-triple geometries: the 3-4-5, 5-12-13, 7-24-25,
and 8-15-17 cases. Dragging the anchor near any snap point locks onto it exactly.
The classic 5-12-13 triple (beta = 67.38 deg) is the textbook reference case:
it gives theta = 78.69 deg and T_BD = 1.9612 W.

## Development

This project needs Node 22 or later. If plain `node` on your machine resolves
to something older (or to nothing), point `NODE` at your own Node 22+ binary
first:

    export NODE=node                # or the full path to your Node 22+ binary
    $NODE --test test/*.test.js     # run the tests
    $NODE build.js                  # rebuild dist/

Note the test command globs the files. `node --test test/` is broken in this
toolchain and reports a misleading `# pass 0 / # fail 1`.

`src/` holds nine ES modules that `build.js` inlines into the single file in
`dist/`. Because everything lands in one shared scope, top-level names must be
globally unique — the build fails loudly on a duplicate.
