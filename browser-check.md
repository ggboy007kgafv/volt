
## Mid-scroll verification

At approximately 34% page scroll, the hero frame counter reads `074 / 151` and the live page reports `Product film ready`. The viewport shows supplied green liquid motion at the edge of the sticky stage, confirming the exact sequence is advancing and the text UI remains stable while the copy has faded away as intended.

## Later-scroll verification

At approximately 68% page scroll, the live frame counter reads `148 / 151` and the page still reports `Product film ready`. The inspected viewport is a dark green atmospheric frame, so the supplied sequence may end on an outro plate rather than holding the can at the absolute end. The exact frame order remains wired faithfully; a product-settle hold can be added only if the intended end state requires it.

## End-state verification

At the exact end of the scrollable page, the frame counter reads `151 / 151` and the supplied sequence has reached its final frame. The sticky hero has released into the continuation section, whose “POWER, IN MOTION.” resolution remains visible. The exact frame order is therefore correctly mapped across the full scroll range.

## Additional sticky-state check

At scroll position 890 in the live browser, the progress label reads `088 / 151`; the supplied frame is still in the liquid reveal phase. This confirms the frame counter is tied to scroll progress and that the late centered can should be checked further down the sticky section rather than at this position.

## Mid-late state

At scroll position 1250 the live page reports `123 / 151`, so the exact frame index continues to advance through the later product region. The preview screenshot still appears mostly atmospheric, which warrants a DOM paint-order check before the final checkpoint even though the asset URLs and frame counter are working.

## Root cause confirmed

The DOM check at scroll position 1250 shows the sticky stage and canvas bounds at `top: -1250`, meaning the sticky stage has released and is scrolling away instead of staying fixed. The cause is the added `.volt-hero { overflow: hidden; }`, which creates an overflow ancestor that disables the intended sticky behavior. The fix is to use `overflow-x: clip` instead, preserving horizontal containment without creating a scroll container.

## Parent overflow confirmation

After changing the hero section to `overflow-x: clip`, the stage still remained at `top: -1250`. The ancestor inspection shows `.volt-page` has computed `overflow: hidden auto` because its `overflow-x: hidden` declaration forces the other axis to become an auto overflow container. That parent is the remaining sticky blocker; it must also use `overflow-x: clip`.

## Sticky fix verified

After changing both overflow declarations to `overflow-x: clip`, the live DOM reports the stage and canvas at `top: 0` and `bottom: 1100` while the page is scrolled to 1250. The progress label reads `123 / 151`, and the browser screenshot visibly shows the exact supplied centered Volt can wrapped in liquid. Sticky scrolling and frame playback are now working together.
