// ─── Game State ────────────────────────────────────────────────────

const COLORS = [
  '#e94560', '#4ecdc4', '#f7dc6f', '#a29bfe', '#fd79a8',
  '#00b894', '#6c5ce7', '#fdcb6e', '#e17055', '#74b9ff',
  '#55efc4', '#fab1a0', '#81ecec', '#dfe6e9', '#b2bec3',
  '#636e72', '#d63031', '#0984e3', '#e84393', '#00cec9',
  '#2d3436', '#ffeaa7', '#ff7675', '#a4b0be', '#f5cd79',
];

let gridSize = 5;
let grid = [];
let playerRects = [];
let undoStack = [];
let dragStart = null;
let dragEnd = null;
let isDragging = false;
let timerStart = null;
let timerInterval = null;
let solved = false;
let editMode = false;
let solving = false;
let activeEditInput = null;
let dragMoved = false;
let nextColorIdx = 0;
let hasClues = false;

const gridEl = document.getElementById('grid');
const gridContainer = document.getElementById('grid-container');
const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const sizeLabel = document.getElementById('size-label');
const sizeLabelEdit = document.getElementById('size-label-edit');
const selectionOverlay = document.getElementById('selection-overlay');
const selectionArea = document.getElementById('selection-area');
const controlsPlay = document.getElementById('controls-play');
const controlsPlayActions = document.getElementById('controls-play-actions');
const controlsEdit = document.getElementById('controls-edit');

// ─── Rendering ─────────────────────────────────────────────────────

let cellPool = [];
let poolRows = 0;
let poolCols = 0;

function getCellSize() {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'), 10);
}

function renderGrid() {
  const rows = grid.length;
  const cols = grid[0].length;
  const cellSize = getComputedStyle(document.documentElement).getPropertyValue('--cell-size').trim();

  gridEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize})`;
  gridEl.style.gridTemplateRows = `repeat(${rows}, ${cellSize})`;

  if (poolRows !== rows || poolCols !== cols) {
    cellPool = [];
    const fragment = document.createDocumentFragment();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.dataset.r = r;
        cell.dataset.c = c;
        cellPool.push(cell);
        fragment.appendChild(cell);
      }
    }
    gridEl.replaceChildren(fragment);
    poolRows = rows;
    poolCols = cols;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cellPool[r * cols + c];
      const val = grid[r][c];
      if (editMode) {
        cell.className = 'cell editable' + (val > 0 ? ' clue' : '');
      } else {
        cell.className = 'cell' + (val > 0 ? ' clue' : ' empty');
      }
      cell.textContent = val > 0 ? val : '';
    }
  }

  renderOverlays();
}

function renderOverlays() {
  gridContainer.querySelectorAll('.rect-overlay').forEach(el => el.remove());

  const cellSize = getCellSize();
  const gap = 1;
  const border = 1;

  for (let i = 0; i < playerRects.length; i++) {
    const { r1, c1, r2, c2, color } = playerRects[i];
    const overlay = document.createElement('div');
    overlay.className = 'rect-overlay';

    const x = border + c1 * (cellSize + gap);
    const y = border + r1 * (cellSize + gap);
    const w = (c2 - c1 + 1) * (cellSize + gap) - gap;
    const h = (r2 - r1 + 1) * (cellSize + gap) - gap;

    overlay.style.left = x + 'px';
    overlay.style.top = y + 'px';
    overlay.style.width = w + 'px';
    overlay.style.height = h + 'px';
    overlay.style.borderColor = color;
    overlay.style.background = color + '18';

    const valid = isRectValid(r1, c1, r2, c2, i);
    if (!valid) overlay.classList.add('invalid');

    gridContainer.appendChild(overlay);
  }
}

function isRectValid(r1, c1, r2, c2, selfIdx) {
  const area = (r2 - r1 + 1) * (c2 - c1 + 1);
  let clueCount = 0;
  let clueVal = 0;

  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (grid[r][c] > 0) {
        clueCount++;
        clueVal = grid[r][c];
      }
    }
  }

  if (clueCount !== 1 || clueVal !== area) return false;

  for (let i = 0; i < playerRects.length; i++) {
    if (i === selfIdx) continue;
    const o = playerRects[i];
    if (r1 <= o.r2 && r2 >= o.r1 && c1 <= o.c2 && c2 >= o.c1) return false;
  }

  return true;
}

function updateSelectionHighlight() {
  if (!isDragging || !dragStart || !dragEnd) {
    selectionOverlay.style.display = 'none';
    return;
  }

  const cellSize = getCellSize();
  const gap = 1;
  const border = 1;

  const r1 = Math.min(dragStart.r, dragEnd.r);
  const r2 = Math.max(dragStart.r, dragEnd.r);
  const c1 = Math.min(dragStart.c, dragEnd.c);
  const c2 = Math.max(dragStart.c, dragEnd.c);

  const x = border + c1 * (cellSize + gap);
  const y = border + r1 * (cellSize + gap);
  const w = (c2 - c1 + 1) * (cellSize + gap) - gap;
  const h = (r2 - r1 + 1) * (cellSize + gap) - gap;

  selectionOverlay.style.left = x + 'px';
  selectionOverlay.style.top = y + 'px';
  selectionOverlay.style.width = w + 'px';
  selectionOverlay.style.height = h + 'px';
  const color = COLORS[nextColorIdx % COLORS.length];
  selectionOverlay.style.borderColor = color;
  selectionOverlay.style.background = color + '18';
  selectionOverlay.style.display = 'block';

  const area = (r2 - r1 + 1) * (c2 - c1 + 1);
  selectionArea.textContent = area;

  // Position label at the cursor corner of the selection
  selectionArea.style.color = color;
  selectionArea.style.top = dragEnd.r >= dragStart.r ? '' : '4px';
  selectionArea.style.bottom = dragEnd.r >= dragStart.r ? '4px' : '';
  selectionArea.style.left = dragEnd.c <= dragStart.c ? '6px' : '';
  selectionArea.style.right = dragEnd.c <= dragStart.c ? '' : '6px';
}

function checkWin() {
  if (solved) return;

  const rows = grid.length;
  const cols = grid[0].length;
  const covered = Array.from({ length: rows }, () => new Uint8Array(cols));

  for (let i = 0; i < playerRects.length; i++) {
    const { r1, c1, r2, c2 } = playerRects[i];
    if (!isRectValid(r1, c1, r2, c2, i)) return;

    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        covered[r][c] = 1;
  }

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!covered[r][c]) return;

  solved = true;
  clearInterval(timerInterval);
  statusEl.textContent = 'Solved! Well done!';
  statusEl.className = 'status win';
  updateButtons();
}

// ─── Input Handling ────────────────────────────────────────────────

function getCellFromEvent(e) {
  const touch = e.touches ? e.touches[0] : e;
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (el && el.classList.contains('cell')) {
    return { r: +el.dataset.r, c: +el.dataset.c };
  }
  return null;
}

function onPointerDown(e) {
  if (solved || editMode) return;
  e.preventDefault();
  const cell = getCellFromEvent(e);
  if (!cell) return;

  isDragging = true;
  dragStart = cell;
  dragEnd = cell;
  dragMoved = false;

  if (!timerStart) {
    timerStart = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
  }

  updateSelectionHighlight();
}

function onPointerMove(e) {
  if (!isDragging) return;
  e.preventDefault();
  const cell = getCellFromEvent(e);
  if (cell) {
    if (cell.r !== dragStart.r || cell.c !== dragStart.c) dragMoved = true;
    dragEnd = cell;
    updateSelectionHighlight();
  }
}

function onPointerUp(e) {
  if (!isDragging) return;
  isDragging = false;

  if (!dragStart || !dragEnd) {
    updateSelectionHighlight();
    return;
  }

  const r1 = Math.min(dragStart.r, dragEnd.r);
  const r2 = Math.max(dragStart.r, dragEnd.r);
  const c1 = Math.min(dragStart.c, dragEnd.c);
  const c2 = Math.max(dragStart.c, dragEnd.c);

  // Single cell: remove rect if one exists, otherwise create 1x1 rect
  if (r1 === r2 && c1 === c2 && !dragMoved) {
    for (let i = playerRects.length - 1; i >= 0; i--) {
      const o = playerRects[i];
      if (r1 >= o.r1 && r1 <= o.r2 && c1 >= o.c1 && c1 <= o.c2) {
        undoStack.push([...playerRects.map(r => ({ ...r }))]);
        playerRects.splice(i, 1);
        renderOverlays();
        updateStatus();
        updateSelectionHighlight();
        return;
      }
    }
    // No rect here — fall through to create a 1x1 rect
  }

  // Remove any overlapping rects
  undoStack.push([...playerRects.map(r => ({ ...r }))]);
  playerRects = playerRects.filter(o => {
    return !(r1 <= o.r2 && r2 >= o.r1 && c1 <= o.c2 && c2 >= o.c1);
  });

  const color = COLORS[nextColorIdx % COLORS.length];
  nextColorIdx++;
  playerRects.push({ r1, c1, r2, c2, color });

  renderOverlays();
  updateSelectionHighlight();
  updateStatus();
  checkWin();
}

function updateStatus() {
  if (solved) return;
  const rows = grid.length;
  const cols = grid[0].length;
  const totalCells = rows * cols;

  let coveredCount = 0;
  const covered = Array.from({ length: rows }, () => new Uint8Array(cols));
  for (const { r1, c1, r2, c2 } of playerRects) {
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        if (!covered[r][c]) { covered[r][c] = 1; coveredCount++; }
  }

  const invalidCount = playerRects.filter((_, i) =>
    !isRectValid(playerRects[i].r1, playerRects[i].c1, playerRects[i].r2, playerRects[i].c2, i)
  ).length;

  if (playerRects.length === 0) {
    statusEl.textContent = 'Drag to draw rectangles. Each must contain exactly one number equal to its area.';
    statusEl.className = 'status';
  } else if (invalidCount > 0) {
    statusEl.textContent = `${playerRects.length} rectangles drawn, ${invalidCount} invalid. ${coveredCount}/${totalCells} cells covered.`;
    statusEl.className = 'status error';
  } else {
    statusEl.textContent = `${playerRects.length} rectangles drawn. ${coveredCount}/${totalCells} cells covered.`;
    statusEl.className = 'status';
  }
  updateButtons();
}

function updateTimer() {
  if (!timerStart) { timerEl.textContent = '0:00'; return; }
  const elapsed = Math.floor((Date.now() - timerStart) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Modal ────────────────────────────────────────────────────────

const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalTextarea = document.getElementById('modal-textarea');
const modalError = document.getElementById('modal-error');
const modalOk = document.getElementById('btn-modal-ok');
let modalMode = 'import'; // 'import' or 'export'

function openModal(mode) {
  modalMode = mode;
  modalError.textContent = '';
  if (mode === 'export') {
    modalTitle.textContent = 'Export Puzzle';
    modalDesc.textContent = 'Copy the puzzle text below to share it.';
    modalOk.textContent = 'Copy';
    modalTextarea.value = gridToText();
    modalTextarea.readOnly = true;
  } else {
    modalTitle.textContent = 'Import Puzzle';
    modalDesc.innerHTML = 'Enter numbers separated by spaces, one row per line. Use <strong>0</strong> for empty cells. All rows must have the same length.';
    modalOk.textContent = 'Load';
    modalTextarea.value = '';
    modalTextarea.readOnly = false;
  }
  modalOverlay.classList.add('visible');
  modalTextarea.focus();
  if (mode === 'export') modalTextarea.select();
}

function closeModal() {
  modalOverlay.classList.remove('visible');
}

function gridToText() {
  return grid.map(row => row.join(' ')).join('\n');
}

function handleModalOk() {
  if (modalMode === 'export') {
    navigator.clipboard.writeText(modalTextarea.value).then(() => {
      modalError.style.color = '#4ecdc4';
      modalError.textContent = 'Copied to clipboard!';
      setTimeout(closeModal, 600);
    }, () => {
      modalTextarea.select();
      modalError.style.color = '';
      modalError.textContent = 'Copy failed — select and copy manually.';
    });
    return;
  }
  // Import
  const parsed = parseCustomGrid(modalTextarea.value);
  if (parsed.error) {
    modalError.style.color = '';
    modalError.textContent = parsed.error;
    return;
  }
  closeModal();
  grid = parsed.grid;
  gridSize = Math.max(grid.length, grid[0].length);
  syncSizeLabels();
  statusEl.textContent = 'Puzzle imported. Click cells to edit, or press Done to play.';
  statusEl.className = 'status';
  renderGrid();
}

document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
modalOk.addEventListener('click', handleModalOk);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// ─── Controls ──────────────────────────────────────────────────────

document.getElementById('btn-new').addEventListener('click', () => newPuzzle());
document.getElementById('btn-new-no1s').addEventListener('click', () => newPuzzle({ minArea: 2 }));
document.getElementById('btn-edit').addEventListener('click', enterEditMode);
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-reset').addEventListener('click', resetRects);
document.getElementById('btn-solve').addEventListener('click', autoSolve);
document.getElementById('btn-smaller').addEventListener('click', () => changeSize(-1));
document.getElementById('btn-larger').addEventListener('click', () => changeSize(1));
document.getElementById('btn-smaller-edit').addEventListener('click', () => changeSize(-1));
document.getElementById('btn-larger-edit').addEventListener('click', () => changeSize(1));
document.getElementById('btn-clear').addEventListener('click', clearBoard);
document.getElementById('btn-import').addEventListener('click', () => openModal('import'));
document.getElementById('btn-export').addEventListener('click', () => openModal('export'));
document.getElementById('btn-done-edit').addEventListener('click', exitEditMode);

function syncSizeLabels() {
  const text = `${gridSize}\u00d7${gridSize}`;
  sizeLabel.textContent = text;
  sizeLabelEdit.textContent = text;
}

function setMode(mode) {
  editMode = (mode === 'edit');
  controlsPlay.classList.toggle('hidden', editMode);
  controlsPlayActions.classList.toggle('hidden', editMode);
  controlsEdit.classList.toggle('hidden', !editMode);
  timerEl.classList.toggle('hidden', editMode);
  updateButtons();
}

function updateButtons() {
  // Play mode buttons
  document.getElementById('btn-undo').disabled = undoStack.length === 0 || solved || solving;
  document.getElementById('btn-reset').disabled = playerRects.length === 0 || solved || solving;
  document.getElementById('btn-solve').disabled = solving || solved || !hasClues;
  document.getElementById('btn-new').disabled = solving;
  document.getElementById('btn-new-no1s').disabled = solving;
  document.getElementById('btn-edit').disabled = solving;
  document.getElementById('btn-smaller').disabled = solving || gridSize <= 3;
  document.getElementById('btn-larger').disabled = solving || gridSize >= 25;
  // Edit mode buttons
  document.getElementById('btn-smaller-edit').disabled = gridSize <= 3;
  document.getElementById('btn-larger-edit').disabled = gridSize >= 25;
}

function newPuzzle(opts) {
  if (editMode) exitEditMode();
  grid = generatePuzzle(gridSize, gridSize, opts);
  playerRects = [];
  undoStack = [];
  nextColorIdx = 0;
  solved = false;
  hasClues = true;
  timerStart = null;
  clearInterval(timerInterval);
  timerEl.textContent = '0:00';
  statusEl.textContent = 'Drag to draw rectangles. Each must contain exactly one number equal to its area.';
  statusEl.className = 'status';
  renderGrid();
  updateButtons();
}

function undo() {
  if (undoStack.length === 0 || solved) return;
  playerRects = undoStack.pop();
  renderOverlays();
  updateStatus();
}

function resetRects() {
  if (playerRects.length === 0 || solved) return;
  undoStack.push([...playerRects.map(r => ({ ...r }))]);
  playerRects = [];
  renderOverlays();
  updateStatus();
}

async function autoSolve() {
  if (solving) return;
  solving = true;
  updateButtons();
  const solveStart = Date.now();
  statusEl.textContent = 'Solving...';
  statusEl.className = 'status';

  const dots = ['Solving.', 'Solving..', 'Solving...'];
  let dotIdx = 0;
  const animInterval = setInterval(() => {
    const elapsed = ((Date.now() - solveStart) / 1000).toFixed(0);
    statusEl.textContent = `${dots[dotIdx++ % 3]} (${elapsed}s)`;
  }, 400);

  const result = await solveShikakuAsync(grid, () => {});

  clearInterval(animInterval);
  solving = false;
  updateButtons();
  const elapsed = ((Date.now() - solveStart) / 1000).toFixed(1);

  if (!result) {
    const reasons = diagnosePuzzle(grid);
    statusEl.textContent = `No solution found (${elapsed}s): ${reasons[0]}`;
    statusEl.className = 'status error';
    console.warn('Puzzle diagnosis:', reasons);
    return;
  }

  undoStack.push([...playerRects.map(r => ({ ...r }))]);
  playerRects = result.map(({ rect }, i) => ({
    r1: rect[0], c1: rect[1], r2: rect[2], c2: rect[3],
    color: COLORS[i % COLORS.length],
  }));

  renderOverlays();

  solved = true;
  clearInterval(timerInterval);
  if (!timerStart) timerStart = Date.now();
  updateTimer();
  statusEl.textContent = `Solved by computer in ${elapsed}s!`;
  statusEl.className = 'status win';
}

function changeSize(delta) {
  gridSize = Math.max(3, Math.min(25, gridSize + delta));
  syncSizeLabels();
  if (editMode) {
    // Resize the grid, preserving existing clues that fit
    const oldGrid = grid;
    grid = Array.from({ length: gridSize }, (_, r) =>
      Array.from({ length: gridSize }, (_, c) =>
        (r < oldGrid.length && c < oldGrid[0].length) ? oldGrid[r][c] : 0
      )
    );
    renderGrid();
  } else {
    // In play mode, reset to empty grid
    grid = Array.from({ length: gridSize }, () => new Array(gridSize).fill(0));
    playerRects = [];
    undoStack = [];
    nextColorIdx = 0;
    solved = false;
    hasClues = false;
    timerStart = null;
    clearInterval(timerInterval);
    timerEl.textContent = '0:00';
    statusEl.textContent = 'Choose a puzzle type or press Edit to create your own.';
    statusEl.className = 'status';
    renderGrid();
  }
  updateButtons();
}

// ─── Edit Mode ─────────────────────────────────────────────────────

function enterEditMode() {
  if (solving || editMode) return;
  editMode = true;
  playerRects = [];
  undoStack = [];
  nextColorIdx = 0;
  solved = false;
  timerStart = null;
  clearInterval(timerInterval);
  statusEl.textContent = 'Click cells to set clue numbers. Press Done when finished.';
  statusEl.className = 'status';
  setMode('edit');
  renderGrid();
}

function exitEditMode() {
  if (!editMode) return;
  commitEditInput();
  editMode = false;
  const rows = grid.length;
  const cols = grid[0].length;
  let clueSum = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      clueSum += grid[r][c];
  const area = rows * cols;
  hasClues = clueSum > 0;
  if (clueSum === 0) {
    statusEl.textContent = 'No clues on the board. Generate a puzzle or press Edit.';
    statusEl.className = 'status';
  } else if (clueSum !== area) {
    statusEl.textContent = `Clue sum (${clueSum}) \u2260 grid area (${area}). Puzzle may not be solvable.`;
    statusEl.className = 'status error';
  } else {
    statusEl.textContent = 'Puzzle ready. Draw rectangles to solve, or press Solve.';
    statusEl.className = 'status';
  }
  setMode('play');
  renderGrid();
}

function clearBoard() {
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[0].length; c++)
      grid[r][c] = 0;
  statusEl.textContent = 'Board cleared. Click cells to set clue numbers.';
  statusEl.className = 'status';
  renderGrid();
}

function commitEditInput() {
  if (!activeEditInput) return;
  const input = activeEditInput;
  activeEditInput = null;
  const r = +input.dataset.r;
  const c = +input.dataset.c;
  const val = parseInt(input.value, 10);
  grid[r][c] = (isNaN(val) || val < 0) ? 0 : val;
  renderGrid();
}

function onEditCellClick(e) {
  if (!editMode) return;
  const el = e.target.closest('.cell');
  if (!el || el.querySelector('.cell-input')) return;

  commitEditInput();

  const r = +el.dataset.r;
  const c = +el.dataset.c;

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'cell-input';
  input.value = grid[r][c] > 0 ? grid[r][c] : '';
  input.min = '0';
  input.dataset.r = r;
  input.dataset.c = c;

  el.textContent = '';
  el.appendChild(input);
  activeEditInput = input;

  input.focus();
  input.select();

  input.addEventListener('blur', commitEditInput);
  input.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') input.blur();
    if (evt.key === 'Escape') { activeEditInput = null; renderGrid(); }
  });

  e.stopPropagation();
}

gridEl.addEventListener('click', onEditCellClick);

// ─── Keyboard Shortcuts ────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (modalOverlay.classList.contains('visible')) {
      closeModal();
    } else if (activeEditInput) {
      activeEditInput = null;
      renderGrid();
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  }
});

// ─── Event Listeners ───────────────────────────────────────────────

gridEl.addEventListener('mousedown', onPointerDown);
document.addEventListener('mousemove', onPointerMove);
document.addEventListener('mouseup', onPointerUp);
gridEl.addEventListener('touchstart', onPointerDown, { passive: false });
document.addEventListener('touchmove', onPointerMove, { passive: false });
document.addEventListener('touchend', onPointerUp);
gridEl.addEventListener('contextmenu', e => e.preventDefault());

// ─── Init ──────────────────────────────────────────────────────────

newPuzzle();
