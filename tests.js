// ─── Self-Tests (run on load, output to console) ──────────────────

(function runTests() {
  let passed = 0, failed = 0;

  function assert(ok, msg) {
    if (ok) { passed++; }
    else { failed++; console.error('FAIL:', msg); }
  }

  function validateSolution(g, sol) {
    const rows = g.length, cols = g[0].length;
    const cov = Array.from({ length: rows }, () => new Int8Array(cols).fill(-1));
    for (let i = 0; i < sol.length; i++) {
      const { clue, rect } = sol[i];
      const [cr, cc, val] = clue;
      const [r1, c1, r2, c2] = rect;
      const area = (r2 - r1 + 1) * (c2 - c1 + 1);
      if (area !== val) return `rect ${i}: area ${area} != clue ${val}`;
      if (cr < r1 || cr > r2 || cc < c1 || cc > c2) return `rect ${i}: clue outside rect`;
      if (r1 < 0 || c1 < 0 || r2 >= rows || c2 >= cols) return `rect ${i}: out of bounds`;
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++) {
          if (g[r][c] > 0 && !(r === cr && c === cc)) return `rect ${i}: extra clue at (${r},${c})`;
          if (cov[r][c] !== -1) return `rect ${i}: overlaps rect ${cov[r][c]} at (${r},${c})`;
          cov[r][c] = i;
        }
    }
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (cov[r][c] === -1) return `cell (${r},${c}) uncovered`;
    return null;
  }

  // Test 1: Solve known 5x5
  const p5 = [[0,6,0,0,4],[0,0,0,0,0],[0,0,5,0,0],[4,0,0,0,0],[0,0,0,6,0]];
  const s5 = solveShikaku(p5);
  assert(s5 !== null, '5x5: should find solution');
  if (s5) assert(validateSolution(p5, s5) === null, '5x5: ' + validateSolution(p5, s5));

  // Test 2: Solve known 6x6
  const p6 = [[6,0,0,0,0,0],[0,0,0,0,0,6],[0,6,0,0,0,0],[0,0,0,0,6,0],[0,0,0,6,0,0],[6,0,0,0,0,0]];
  const s6 = solveShikaku(p6);
  assert(s6 !== null, '6x6: should find solution');
  if (s6) assert(validateSolution(p6, s6) === null, '6x6: ' + validateSolution(p6, s6));

  // Test 3: Solve known 7x7
  const p7 = [[6,0,0,0,0,0,8],[0,0,0,0,0,0,0],[0,0,6,0,0,4,0],[0,0,0,4,0,0,0],[9,0,0,0,0,0,3],[0,0,0,0,6,0,0],[0,0,0,3,0,0,0]];
  const s7 = solveShikaku(p7);
  assert(s7 !== null, '7x7: should find solution');
  if (s7) assert(validateSolution(p7, s7) === null, '7x7: ' + validateSolution(p7, s7));

  // Test 4: Trivial 1x1
  const s1 = solveShikaku([[1]]);
  assert(s1 !== null, '1x1: should find solution');

  // Test 5: Simple 2x2
  const s2 = solveShikaku([[4,0],[0,0]]);
  assert(s2 !== null && s2.length === 1, '2x2: should have 1 rect');

  // Test 6: Reject bad clue sum
  assert(solveShikaku([[3,0],[0,0]]) === null, 'bad sum: should return null');

  // Test 7: [[2,2],[0,0]] is actually solvable (two 2x1 rects side by side)
  const s2x2b = solveShikaku([[2,2],[0,0]]);
  assert(s2x2b !== null && s2x2b.length === 2, '2x2 two-clue: should have 2 rects');

  // Test 7b: Truly unsolvable — clue 3 in a 2x2 can't form a 1x3 or 3x1
  assert(solveShikaku([[3,0],[0,1]]) === null, 'unsolvable: should return null');

  // ── Non-square grids ──
  const ns1 = solveShikaku([[3,0,0]]);
  assert(ns1 !== null, '1x3: solvable');
  if (ns1) assert(validateSolution([[3,0,0]], ns1) === null, '1x3: valid');

  const ns2 = solveShikaku([[3],[0],[0]]);
  assert(ns2 !== null, '3x1: solvable');
  if (ns2) assert(validateSolution([[3],[0],[0]], ns2) === null, '3x1: valid');

  const ns3 = solveShikaku([[2,0,0],[0,0,4]]);
  assert(ns3 !== null, '2x3: solvable');
  if (ns3) assert(validateSolution([[2,0,0],[0,0,4]], ns3) === null, '2x3: valid');

  // ── All-1s grid (every cell is a clue) ──
  const all1 = [[1,1,1],[1,1,1],[1,1,1]];
  const s_all1 = solveShikaku(all1);
  assert(s_all1 !== null, 'all-1s 3x3: solvable');
  if (s_all1) assert(validateSolution(all1, s_all1) === null, 'all-1s 3x3: valid');
  if (s_all1) assert(s_all1.length === 9, 'all-1s 3x3: 9 rects');

  // ── Single clue covering entire grid ──
  const big = [[0,0,0,0],[0,0,0,0],[0,0,0,12]];
  const s_big = solveShikaku(big);
  assert(s_big !== null, 'single-clue 3x4: solvable');
  if (s_big) assert(validateSolution(big, s_big) === null, 'single-clue 3x4: valid');
  if (s_big) assert(s_big.length === 1, 'single-clue 3x4: 1 rect');

  // ── Multiple solutions (solver finds any valid one) ──
  const multi = [[8,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,8]];
  const s_multi = solveShikaku(multi);
  assert(s_multi !== null, 'multi-solution 4x4: finds one');
  if (s_multi) assert(validateSolution(multi, s_multi) === null, 'multi-solution 4x4: valid');

  // ── getRectangles correctness ──
  assert(getRectangles(0, 0, 1, 1, 1).length === 1, 'getRects: 1x1');
  assert(getRectangles(0, 0, 2, 2, 2).length === 2, 'getRects: clue 2 at corner of 2x2');
  assert(getRectangles(0, 0, 4, 2, 2).length === 1, 'getRects: clue 4 at corner of 2x2');
  assert(getRectangles(0, 0, 7, 10, 10).length === 2, 'getRects: prime 7 at corner');
  // Center has more positions than corner for same area
  assert(getRectangles(2, 2, 4, 5, 5).length > getRectangles(0, 0, 4, 5, 5).length, 'getRects: center > corner');

  // Test 8: Generator produces valid grids with correct clue sums
  for (const sz of [3, 4, 5, 6, 7, 8, 10, 15]) {
    for (let t = 0; t < 3; t++) {
      const g = generatePuzzle(sz, sz);
      assert(g.length === sz && g[0].length === sz, `gen ${sz}x${sz}: wrong dimensions`);
      let sum = 0;
      for (let r = 0; r < sz; r++) for (let c = 0; c < sz; c++) sum += g[r][c];
      assert(sum === sz * sz, `gen ${sz}x${sz} trial ${t}: clue sum ${sum} != ${sz * sz}`);
    }
  }

  // Test 9: Generated puzzles are solvable (test small sizes)
  for (const sz of [3, 4, 5, 6, 7]) {
    for (let t = 0; t < 3; t++) {
      const g = generatePuzzle(sz, sz);
      const sol = solveShikaku(g);
      assert(sol !== null, `gen ${sz}x${sz} trial ${t}: should be solvable`);
      if (sol) {
        const err = validateSolution(g, sol);
        assert(err === null, `gen ${sz}x${sz} trial ${t}: ${err}`);
      }
    }
  }

  // ── No-1s generator ──
  for (const sz of [3, 4, 5, 6, 7, 8, 10]) {
    for (let t = 0; t < 3; t++) {
      const g = generatePuzzle(sz, sz, { minArea: 2 });
      assert(g.length === sz && g[0].length === sz, `no1s gen ${sz}x${sz}: wrong dimensions`);
      let sum = 0;
      let hasOne = false;
      for (let r = 0; r < sz; r++)
        for (let c = 0; c < sz; c++) {
          sum += g[r][c];
          if (g[r][c] === 1) hasOne = true;
        }
      assert(sum === sz * sz, `no1s gen ${sz}x${sz} trial ${t}: clue sum ${sum} != ${sz * sz}`);
      assert(!hasOne, `no1s gen ${sz}x${sz} trial ${t}: should have no 1-clues`);
    }
  }

  // No-1s generated puzzles are solvable
  for (const sz of [3, 4, 5, 6, 7]) {
    for (let t = 0; t < 3; t++) {
      const g = generatePuzzle(sz, sz, { minArea: 2 });
      const sol = solveShikaku(g);
      assert(sol !== null, `no1s gen ${sz}x${sz} trial ${t}: should be solvable`);
      if (sol) {
        const err = validateSolution(g, sol);
        assert(err === null, `no1s gen ${sz}x${sz} trial ${t}: ${err}`);
      }
    }
  }

  // Test 10: Custom puzzle parser
  const r1 = parseCustomGrid('0 6 0\n0 0 0\n3 0 0');
  assert(r1.grid && r1.grid.length === 3, 'parser: valid 3x3');

  const r2 = parseCustomGrid('1 2\n3');
  assert(r2.error, 'parser: reject uneven rows');

  const r3 = parseCustomGrid('');
  assert(r3.error, 'parser: reject empty');

  const r4 = parseCustomGrid('1 a\n0 0');
  assert(r4.error, 'parser: reject non-numbers');

  // Test: trailing commas/spaces should not add ghost columns
  const r5 = parseCustomGrid('4, 0,\n0, 0,');
  assert(r5.grid && r5.grid[0].length === 2, 'parser: trailing comma ignored');

  const r6 = parseCustomGrid('4 0 \n0 0 ');
  assert(r6.grid && r6.grid[0].length === 2, 'parser: trailing space ignored');

  // ── Diagnostics tests ──

  // Test 11: bad clue sum
  const d1 = diagnosePuzzle([[3,0],[0,0]]);
  assert(d1.some(r => r.includes('Clue sum')), 'diag: detect bad clue sum');

  // Test 12: clue sum too large
  const d2 = diagnosePuzzle([[9,0],[0,0]]);
  assert(d2.some(r => r.includes('Clue sum')), 'diag: detect oversized clue sum');

  // Test 13: no clues at all
  const d_none = diagnosePuzzle([[0,0],[0,0]]);
  assert(d_none.some(r => r.includes('no clues')), 'diag: detect no clues');

  // Test 15: valid solvable puzzle — should say "no obvious structural issue"
  const d6 = diagnosePuzzle([[4,0],[0,0]]);
  assert(d6.some(r => r.includes('No obvious')), 'diag: valid puzzle reports no structural issue');

  // Test 16: clue that can't form any rectangle on grid
  const d_nofit = diagnosePuzzle([[3,0],[0,1]]);
  assert(d_nofit.some(r => r.includes('no possible rectangle')), 'diag: detect clue with no fitting rect');

  // Test 17: clue blocked by other clues
  // [[1,2,1,0,1]]: clue 2 at (0,1) — its only rects (1x2) each contain another clue
  const d_blocked = diagnosePuzzle([[1,2,1,0,1]]);
  assert(d_blocked.some(r => r.includes('every possible rectangle contains another clue')),
    'diag: detect clue blocked by neighbors');

  // Test 18: unreachable cells
  const d_reach = diagnosePuzzle([[4,0,0],[0,0,0],[0,0,5]]);
  assert(d_reach.some(r => r.includes('no possible rectangle') || r.includes('cannot be reached')),
    'diag: detect unreachable cells or impossible rect');

  // Test 19: diagnosePuzzle returns array
  assert(Array.isArray(d1), 'diag: returns array');
  assert(d1.length >= 1, 'diag: returns at least one reason');

  // Test 20: all reasons are strings
  for (const reasons of [d1, d_none, d6, d_nofit]) {
    assert(reasons.every(r => typeof r === 'string'), 'diag: all reasons are strings');
  }

  if (failed === 0) {
    console.log(`%cShikaku tests: all ${passed} passed`, 'color: #4ecdc4; font-weight: bold');
  } else {
    console.warn(`Shikaku tests: ${passed} passed, ${failed} FAILED`);
  }
})();
