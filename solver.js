// ─── Shikaku Solver Module ─────────────────────────────────────────
// Exports: getRectangles, solveShikaku, solveShikakuAsync,
//          diagnosePuzzle, generatePuzzle, parseCustomGrid, shuffle

// ─── Utilities ─────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRectangles(cr, cc, area, rows, cols) {
  const rects = [];
  for (let h = 1; h <= area; h++) {
    if (area % h !== 0) continue;
    const w = area / h;
    for (let r1 = cr - h + 1; r1 <= cr; r1++) {
      for (let c1 = cc - w + 1; c1 <= cc; c1++) {
        const r2 = r1 + h - 1;
        const c2 = c1 + w - 1;
        if (r1 >= 0 && r2 < rows && c1 >= 0 && c2 < cols)
          rects.push([r1, c1, r2, c2]);
      }
    }
  }
  return rects;
}

// ─── Synchronous Solver ────────────────────────────────────────────
// Used by self-tests and small grids. Includes dynamic MRV,
// pre-filtering, and dead-cell detection.

function solveShikaku(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const totalArea = rows * cols;

  const clues = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c] > 0) clues.push([r, c, grid[r][c]]);

  const clueSum = clues.reduce((s, cl) => s + cl[2], 0);
  if (clueSum !== totalArea) return null;

  // Pre-filter: for each clue, compute valid rects excluding those containing other clues
  const allRects = clues.map(([cr, cc, val], idx) => {
    const rects = getRectangles(cr, cc, val, rows, cols);
    return rects.filter(([r1, c1, r2, c2]) => {
      for (let i = 0; i < clues.length; i++) {
        if (i === idx) continue;
        const [ocr, occ] = clues[i];
        if (ocr >= r1 && ocr <= r2 && occ >= c1 && occ <= c2) return false;
      }
      return true;
    });
  });

  const covered = Array.from({ length: rows }, () => new Int8Array(cols).fill(-1));
  const placed = new Uint8Array(clues.length); // 0 = unplaced, 1 = placed
  const solution = new Array(clues.length).fill(null);

  function rectIsFree(r1, c1, r2, c2) {
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        if (covered[r][c] !== -1) return false;
    return true;
  }

  function place(r1, c1, r2, c2, idx) {
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        covered[r][c] = idx;
  }

  function unplace(r1, c1, r2, c2) {
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        covered[r][c] = -1;
  }

  // Count valid (free) rects for a clue
  function countValid(idx) {
    let count = 0;
    for (const [r1, c1, r2, c2] of allRects[idx]) {
      if (rectIsFree(r1, c1, r2, c2)) count++;
    }
    return count;
  }

  // Pick the unplaced clue with fewest remaining valid rects (dynamic MRV)
  function pickNextClue() {
    let bestIdx = -1;
    let bestCount = Infinity;
    for (let i = 0; i < clues.length; i++) {
      if (placed[i]) continue;
      const count = countValid(i);
      if (count < bestCount) {
        bestCount = count;
        bestIdx = i;
      }
    }
    return { idx: bestIdx, count: bestCount };
  }

  // Forward check: verify all unplaced clues have >= 1 valid rect
  // Also check for dead cells (uncovered cells unreachable by any unplaced clue)
  function forwardCheck() {
    // Build reachability bitmap for unplaced clues
    const reachable = Array.from({ length: rows }, () => new Uint8Array(cols));

    for (let i = 0; i < clues.length; i++) {
      if (placed[i]) continue;
      const [cr, cc] = clues[i];
      if (covered[cr][cc] !== -1) return false; // clue cell already taken
      let hasValid = false;
      for (const [r1, c1, r2, c2] of allRects[i]) {
        if (rectIsFree(r1, c1, r2, c2)) {
          hasValid = true;
          for (let r = r1; r <= r2; r++)
            for (let c = c1; c <= c2; c++)
              reachable[r][c] = 1;
        }
      }
      if (!hasValid) return false;
    }

    // Check for dead cells: uncovered cells that no unplaced clue can reach
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (covered[r][c] === -1 && !reachable[r][c]) return false;

    return true;
  }

  let placedCount = 0;

  function backtrack() {
    if (placedCount === clues.length) {
      // Verify all cells covered
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (covered[r][c] === -1) return false;
      return true;
    }

    const { idx, count } = pickNextClue();
    if (idx === -1 || count === 0) return false;

    const [cr, cc] = clues[idx];
    if (covered[cr][cc] !== -1) return false;

    for (const rect of allRects[idx]) {
      const [r1, c1, r2, c2] = rect;
      if (!rectIsFree(r1, c1, r2, c2)) continue;

      place(r1, c1, r2, c2, idx);
      placed[idx] = 1;
      solution[idx] = rect;
      placedCount++;

      if (forwardCheck() && backtrack()) return true;

      unplace(r1, c1, r2, c2);
      placed[idx] = 0;
      solution[idx] = null;
      placedCount--;
    }
    return false;
  }

  if (backtrack()) {
    const result = [];
    for (let i = 0; i < clues.length; i++) {
      result.push({ clue: clues[i], rect: solution[i] });
    }
    return result;
  }
  return null;
}

// ─── Async Solver ──────────────────────────────────────────────────
// Chunked iterative backtracking with UI yielding.
// Same optimizations as sync solver (dynamic MRV, pre-filtering,
// forward checking, dead-cell detection).

function solveShikakuAsync(grid, onProgress) {
  return new Promise((resolve) => {
    const rows = grid.length;
    const cols = grid[0].length;
    const totalArea = rows * cols;

    const clues = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (grid[r][c] > 0) clues.push([r, c, grid[r][c]]);

    const clueSum = clues.reduce((s, cl) => s + cl[2], 0);
    if (clueSum !== totalArea) { resolve(null); return; }

    // Pre-filter: remove rects containing other clues
    const allRects = clues.map(([cr, cc, val], idx) => {
      const rects = getRectangles(cr, cc, val, rows, cols);
      return rects.filter(([r1, c1, r2, c2]) => {
        for (let i = 0; i < clues.length; i++) {
          if (i === idx) continue;
          const [ocr, occ] = clues[i];
          if (ocr >= r1 && ocr <= r2 && occ >= c1 && occ <= c2) return false;
        }
        return true;
      });
    });

    const total = clues.length;
    const covered = Array.from({ length: rows }, () => new Int8Array(cols).fill(-1));
    const placed = new Uint8Array(total);
    const solution = new Array(total).fill(null);
    let placedCount = 0;
    let maxDepth = 0;

    function rectIsFree(r1, c1, r2, c2) {
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++)
          if (covered[r][c] !== -1) return false;
      return true;
    }

    function place(r1, c1, r2, c2, idx) {
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++)
          covered[r][c] = idx;
    }

    function unplace(r1, c1, r2, c2) {
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++)
          covered[r][c] = -1;
    }

    function countValid(idx) {
      let count = 0;
      for (const [r1, c1, r2, c2] of allRects[idx]) {
        if (rectIsFree(r1, c1, r2, c2)) count++;
      }
      return count;
    }

    function pickNextClue() {
      let bestIdx = -1;
      let bestCount = Infinity;
      for (let i = 0; i < total; i++) {
        if (placed[i]) continue;
        const count = countValid(i);
        if (count < bestCount) {
          bestCount = count;
          bestIdx = i;
        }
      }
      return { idx: bestIdx, count: bestCount };
    }

    function forwardCheck() {
      const reachable = Array.from({ length: rows }, () => new Uint8Array(cols));
      for (let i = 0; i < total; i++) {
        if (placed[i]) continue;
        const [cr, cc] = clues[i];
        if (covered[cr][cc] !== -1) return false;
        let hasValid = false;
        for (const [r1, c1, r2, c2] of allRects[i]) {
          if (rectIsFree(r1, c1, r2, c2)) {
            hasValid = true;
            for (let r = r1; r <= r2; r++)
              for (let c = c1; c <= c2; c++)
                reachable[r][c] = 1;
          }
        }
        if (!hasValid) return false;
      }
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (covered[r][c] === -1 && !reachable[r][c]) return false;
      return true;
    }

    // Iterative backtracking with explicit stack and chunked yielding
    // Each stack frame: { clueIdx, rects (valid rects for this clue), rectPos (next rect to try) }
    const CHUNK_SIZE = 5000;
    const stack = [];
    let initialized = false;

    function pushNextClue() {
      const { idx, count } = pickNextClue();
      if (idx === -1 || count === 0) return false;
      const [cr, cc] = clues[idx];
      if (covered[cr][cc] !== -1) return false;
      // Collect valid rects for this clue in current state
      const validRects = allRects[idx].filter(([r1, c1, r2, c2]) => rectIsFree(r1, c1, r2, c2));
      stack.push({ clueIdx: idx, rects: validRects, rectPos: 0 });
      return true;
    }

    function runChunk() {
      let iterations = 0;

      if (!initialized) {
        initialized = true;
        if (!pushNextClue()) {
          resolve(null);
          return;
        }
      }

      while (stack.length > 0) {
        if (iterations++ >= CHUNK_SIZE) {
          if (onProgress) onProgress(maxDepth, total);
          setTimeout(runChunk, 0);
          return;
        }

        const frame = stack[stack.length - 1];

        // Try next rect for this frame's clue
        if (frame.rectPos < frame.rects.length) {
          const [r1, c1, r2, c2] = frame.rects[frame.rectPos];
          frame.rectPos++;

          if (!rectIsFree(r1, c1, r2, c2)) continue;

          place(r1, c1, r2, c2, frame.clueIdx);
          placed[frame.clueIdx] = 1;
          solution[frame.clueIdx] = [r1, c1, r2, c2];
          placedCount++;
          if (placedCount > maxDepth) maxDepth = placedCount;

          // Check if solved
          if (placedCount === total) {
            let allCovered = true;
            for (let r = 0; r < rows && allCovered; r++)
              for (let c = 0; c < cols && allCovered; c++)
                if (covered[r][c] === -1) allCovered = false;
            if (allCovered) {
              const result = [];
              for (let i = 0; i < total; i++)
                result.push({ clue: clues[i], rect: solution[i] });
              resolve(result);
              return;
            }
            // All clues placed but not all cells covered — undo and try next
            unplace(r1, c1, r2, c2);
            placed[frame.clueIdx] = 0;
            solution[frame.clueIdx] = null;
            placedCount--;
            continue;
          }

          // Forward check
          if (forwardCheck()) {
            // Push next clue
            if (pushNextClue()) {
              continue;
            }
          }

          // Failed — undo this placement and try next rect
          unplace(r1, c1, r2, c2);
          placed[frame.clueIdx] = 0;
          solution[frame.clueIdx] = null;
          placedCount--;
        } else {
          // Exhausted all rects for this clue — backtrack
          stack.pop();
          // Undo the placement from the parent frame that led us here
          if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            const prevRectPos = parent.rectPos - 1;
            if (prevRectPos >= 0 && prevRectPos < parent.rects.length) {
              const [r1, c1, r2, c2] = parent.rects[prevRectPos];
              if (covered[r1]?.[c1] === parent.clueIdx) {
                unplace(r1, c1, r2, c2);
                placed[parent.clueIdx] = 0;
                solution[parent.clueIdx] = null;
                placedCount--;
              }
            }
          }
        }
      }

      // Stack empty — no solution
      resolve(null);
    }

    setTimeout(runChunk, 0);
  });
}

// ─── Puzzle Diagnostics ────────────────────────────────────────────

function diagnosePuzzle(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const totalArea = rows * cols;
  const reasons = [];

  const clues = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c] > 0) clues.push([r, c, grid[r][c]]);

  if (clues.length === 0) {
    reasons.push('The grid has no clues at all.');
    return reasons;
  }

  const clueSum = clues.reduce((s, cl) => s + cl[2], 0);
  if (clueSum !== totalArea) {
    reasons.push(`Clue sum (${clueSum}) does not equal grid area (${totalArea}).`);
    return reasons;
  }

  // Check each clue for obvious issues
  for (const [cr, cc, val] of clues) {
    if (val > totalArea) {
      reasons.push(`Clue ${val} at (${cr + 1},${cc + 1}) exceeds the grid area (${totalArea}).`);
      continue;
    }

    const rects = getRectangles(cr, cc, val, rows, cols);
    if (rects.length === 0) {
      reasons.push(`Clue ${val} at (${cr + 1},${cc + 1}) has no possible rectangle that fits on the grid.`);
      continue;
    }

    const validRects = rects.filter(([r1, c1, r2, c2]) => {
      for (const [ocr, occ] of clues) {
        if (ocr === cr && occ === cc) continue;
        if (ocr >= r1 && ocr <= r2 && occ >= c1 && occ <= c2) return false;
      }
      return true;
    });

    if (validRects.length === 0) {
      reasons.push(`Clue ${val} at (${cr + 1},${cc + 1}): every possible rectangle contains another clue.`);
    }
  }

  // Check for cells unreachable by any clue
  const reachable = Array.from({ length: rows }, () => new Uint8Array(cols));
  for (const [cr, cc, val] of clues) {
    const rects = getRectangles(cr, cc, val, rows, cols);
    for (const [r1, c1, r2, c2] of rects) {
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++)
          reachable[r][c] = 1;
    }
  }
  const unreachableCells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!reachable[r][c]) unreachableCells.push(`(${r + 1},${c + 1})`);

  if (unreachableCells.length > 0) {
    const shown = unreachableCells.length <= 5
      ? unreachableCells.join(', ')
      : unreachableCells.slice(0, 5).join(', ') + ` and ${unreachableCells.length - 5} more`;
    reasons.push(`${unreachableCells.length} cell(s) cannot be reached by any clue's rectangle: ${shown}.`);
  }

  // Check for adjacent clues that are both 1
  for (let i = 0; i < clues.length; i++) {
    for (let j = i + 1; j < clues.length; j++) {
      const [r1, c1, v1] = clues[i];
      const [r2, c2, v2] = clues[j];
      if (v1 === 1 && v2 === 1 && Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
        reasons.push(`Two adjacent clues of 1 at (${r1 + 1},${c1 + 1}) and (${r2 + 1},${c2 + 1}) — both need a 1×1 rectangle, leaving the other's cell uncoverable.`);
      }
    }
  }

  if (reasons.length === 0) {
    reasons.push('No obvious structural issue found; the puzzle is valid but the backtracking search found no solution (conflicting constraints).');
  }

  return reasons;
}

// ─── Puzzle Generator ──────────────────────────────────────────────

function generatePuzzle(rows, cols) {
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const used = Array.from({ length: rows }, () => new Uint8Array(cols));
  const rects = [];

  function findFirstEmpty() {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (!used[r][c]) return [r, c];
    return null;
  }

  function canPlace(r1, c1, r2, c2) {
    if (r2 >= rows || c2 >= cols) return false;
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        if (used[r][c]) return false;
    return true;
  }

  function markUsed(r1, c1, r2, c2) {
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        used[r][c] = 1;
  }

  const maxDim = Math.min(8, Math.max(rows, cols));

  while (true) {
    const cell = findFirstEmpty();
    if (!cell) break;
    const [r, c] = cell;

    const candidates = [];
    for (let h = 1; h <= Math.min(rows - r, maxDim); h++) {
      for (let w = 1; w <= Math.min(cols - c, maxDim); w++) {
        const area = h * w;
        if (area > 0 && area <= Math.min(rows * cols, rows + cols) && canPlace(r, c, r + h - 1, c + w - 1)) {
          candidates.push([r, c, r + h - 1, c + w - 1]);
        }
      }
    }

    if (candidates.length === 0) {
      if (!used[r][c]) {
        used[r][c] = 1;
        rects.push([r, c, r, c]);
      }
      continue;
    }

    shuffle(candidates);
    const weighted = candidates.filter(([r1, c1, r2, c2]) => {
      const a = (r2 - r1 + 1) * (c2 - c1 + 1);
      return a >= 2 && a <= Math.max(6, Math.floor(rows * cols / 4));
    });

    const chosen = (weighted.length > 0 ? weighted : candidates)[0];
    markUsed(...chosen);
    rects.push(chosen);
  }

  for (const [r1, c1, r2, c2] of rects) {
    const area = (r2 - r1 + 1) * (c2 - c1 + 1);
    const cells = [];
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        cells.push([r, c]);
    const [cr, cc] = cells[Math.floor(Math.random() * cells.length)];
    grid[cr][cc] = area;
  }

  return grid;
}

// ─── Custom Puzzle Parser ──────────────────────────────────────────

function parseCustomGrid(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return { error: 'No input provided.' };

  const rows = [];
  for (const line of lines) {
    const nums = line.split(/[\s,]+/).filter(s => s.length > 0).map(Number);
    if (nums.length === 0) continue;
    if (nums.some(isNaN)) return { error: `Invalid number in row: "${line}"` };
    if (nums.some(n => n < 0)) return { error: 'Negative numbers are not allowed.' };
    rows.push(nums);
  }

  if (rows.length === 0) return { error: 'No input provided.' };
  const cols = rows[0].length;
  if (cols === 0) return { error: 'Empty row.' };
  if (cols > 25 || rows.length > 25) return { error: 'Maximum size is 25\u00d725.' };

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].length !== cols) {
      return { error: `Row ${i + 1} has ${rows[i].length} values, expected ${cols}.` };
    }
  }

  const clueSum = rows.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
  const area = rows.length * cols;
  if (clueSum !== area) {
    return { error: `Clue sum (${clueSum}) must equal grid area (${area} = ${rows.length}\u00d7${cols}).` };
  }

  return { grid: rows };
}
