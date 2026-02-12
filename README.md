# Shikakukata — Shikaku Puzzle Solver & Game

A [Shikaku](https://en.wikipedia.org/wiki/Shikaku) puzzle solver and interactive game. No build step, no dependencies — open `index.html` directly or serve via GitHub Pages.

## Project Structure

| File | Purpose |
|------|---------|
| `index.html` | Game UI — grid, input handling, controls, self-tests |
| `solver.js` | Solver engine — backtracking solver, generator, diagnostics, parser |
| `style.css` | All styles (`--cell-size` CSS custom property) |
| `algorithm.html` | How the solver algorithm works |
| `shikaku_solver.py` | Standalone command-line solver in Python |

## Running Tests

220 self-tests run on page load and output to the browser console:

```
Shikaku tests: all 220 passed
```

Headless via Deno:

```sh
cat solver.js > /tmp/test.js
sed -n '/^\/\/ ─── Self-Tests/,/^})();$/p' index.html >> /tmp/test.js
deno run /tmp/test.js
```

Coverage: solving (5x5–7x7 with validation), edge cases (1x1, 2x2, non-square grids, all-1s, single-clue, multi-solution, unsolvable), generator (dimensions, clue sums, solvability for sizes 3–15), no-1s generator (no 1-clues, solvability), `getRectangles` correctness, custom parser (valid/invalid inputs, trailing separators), diagnostics (bad sums, no clues, blocked clues, unreachable cells, impossible rects).

## Dev Notes

### Architecture

- **`solver.js`** — pure logic, no DOM. Exports: `solveShikaku`, `solveShikakuAsync`, `generatePuzzle`, `diagnosePuzzle`, `parseCustomGrid`, `getRectangles`, `shuffle`.
- **`index.html`** — DOM interaction, event listeners, game state. Loads `solver.js` via `<script>`.
- **`style.css`** — `--cell-size` custom property read by JS for overlay positioning.

### Solver

Constraint-satisfaction backtracking with:

1. **Pre-filtering** — rectangles containing other clues removed upfront
2. **Dynamic MRV** — most constrained clue (fewest valid rects) chosen at each step
3. **Forward checking** — verifies all unplaced clues still have valid options
4. **Dead-cell detection** — prunes when uncovered cells become unreachable

The async solver uses an explicit stack and yields every 5,000 iterations via `setTimeout(0)`.

Performance: 15x15 ~2ms, 25x25 ~10ms typical. See `algorithm.html` for details.

### Generator

Greedy partitioning with randomized rectangle selection, preferring medium-sized rects. The **No 1s** mode (`minArea: 2`) uses an isolation check — before placing a rect, it verifies no neighboring cell would be left without an empty neighbor (which would force a 1x1). Falls back to retry (up to 20 attempts) on rare dead-ends. 25x25 no-1s generation takes ~1ms.

### Accessibility

- `Escape` closes modal / cancels edit input
- `Ctrl/Cmd+Z` undoes last rectangle action
- ARIA: `role="dialog"` on modal, `role="grid"` on grid, `aria-label` on icon buttons
- Focus managed: modal focuses textarea on open, returns focus on close
