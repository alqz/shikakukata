# Shikakukata — Shikaku Puzzle Solver & Game

A [Shikaku](https://en.wikipedia.org/wiki/Shikaku) puzzle solver and interactive game.

## Project Structure

| File | Purpose |
|------|---------|
| `index.html` | Game UI — grid rendering, input handling, controls |
| `solver.js` | Solver engine — backtracking solver, puzzle generator, diagnostics, parser |
| `style.css` | All styles, with `--cell-size` CSS custom property |
| `algorithm.html` | Explanation of how the solver algorithm works |
| `shikaku_solver.py` | Command-line solver in Python (standalone) |

The browser game is fully static — no build step, no dependencies. Open `index.html` directly or serve via GitHub Pages.

## Running Tests

Self-tests run automatically on page load and output to the browser console. Open `index.html` in a browser and check the console for:

```
Shikaku tests: all N passed
```

To run tests headlessly via Deno:

```sh
cat solver.js > /tmp/test.js
# append test code (extract from the <script> block in index.html)
deno run --allow-read /tmp/test.js
```

The test suite covers:
- Solving known 5x5, 6x6, 7x7 puzzles with solution validation
- Edge cases: 1x1, 2x2, bad clue sums, unsolvable grids
- Generator: correct dimensions and clue sums for sizes 3–15
- Generated puzzles are solvable (sizes 3–7, multiple trials each)
- Custom puzzle parser: valid input, uneven rows, empty input, non-numbers, trailing separators
- Diagnostics: bad clue sum, no clues, blocked clues, unreachable cells, impossible rectangles

## Dev Notes

### Architecture

The game is split into three files for separation of concerns:

- **`solver.js`** contains all pure logic (no DOM access). Functions: `solveShikaku`, `solveShikakuAsync`, `generatePuzzle`, `diagnosePuzzle`, `parseCustomGrid`, `getRectangles`, `shuffle`.
- **`index.html`** handles all DOM interaction, event listeners, and game state. It loads `solver.js` via a `<script>` tag.
- **`style.css`** defines all styles. The `--cell-size` custom property is read by JS to compute overlay positions, keeping the magic number in one place.

### Solver Algorithm

The solver uses constraint-satisfaction backtracking with these optimizations:

1. **Pre-filtering** — rectangles containing other clues are removed before search begins
2. **Dynamic MRV** — at each step, the most constrained clue (fewest valid rectangles remaining) is chosen next
3. **Forward checking** — after each placement, verifies all remaining clues still have valid options
4. **Dead-cell detection** — prunes branches where uncovered cells become unreachable by any remaining clue

The async solver (`solveShikakuAsync`) uses an explicit stack and yields to the event loop every 5,000 iterations so the UI stays responsive during long solves.

Performance: 15x15 ~2ms, 25x25 ~10ms typical.

See `algorithm.html` for a full explanation with diagrams.

### Accessibility

- `Escape` closes the modal and cancels edit input
- `Ctrl/Cmd+Z` undoes the last rectangle action
- ARIA attributes on modal (`role="dialog"`), grid (`role="grid"`), and icon-only buttons (`aria-label`)
- Focus is managed: modal focuses its textarea on open, returns focus to the trigger button on close