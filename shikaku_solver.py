#!/usr/bin/env python3
"""
Shikaku Puzzle Solver
=====================
Shikaku is a puzzle where you divide a rectangular grid into non-overlapping
rectangles such that each rectangle contains exactly one number, and that
number equals the area of the rectangle.

Usage:
    python shikaku_solver.py

You can modify the PUZZLE variable to solve different puzzles.
A 0 represents an empty cell; any positive number is a clue.
"""

import sys


def solve_shikaku(grid):
    """Solve a Shikaku puzzle given a 2D grid of integers."""
    rows = len(grid)
    cols = len(grid[0])
    total_area = rows * cols

    # Collect all clues: (row, col, value)
    clues = []
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] > 0:
                clues.append((r, c, grid[r][c]))

    # Validate: sum of clues must equal grid area
    clue_sum = sum(v for _, _, v in clues)
    if clue_sum != total_area:
        print(f"  ⚠ Invalid puzzle: clue sum ({clue_sum}) ≠ grid area ({total_area})")
        return None, clues

    # Track which cells are covered: -1 = uncovered, otherwise rectangle id
    covered = [[-1] * cols for _ in range(rows)]

    # Build a set of clue positions for fast lookup
    clue_positions = set((r, c) for r, c, _ in clues)

    # Sort clues by number of possible rectangles (most constrained first → MRV heuristic)
    # First, precompute rectangles for each clue
    def get_rectangles(cr, cc, area):
        """Return all valid (r1, c1, r2, c2) rectangles containing (cr,cc) with given area."""
        rects = []
        for h in range(1, area + 1):
            if area % h == 0:
                w = area // h
                for r1 in range(cr - h + 1, cr + 1):
                    for c1 in range(cc - w + 1, cc + 1):
                        r2 = r1 + h - 1
                        c2 = c1 + w - 1
                        if 0 <= r1 and r2 < rows and 0 <= c1 and c2 < cols:
                            rects.append((r1, c1, r2, c2))
        return rects

    all_rects = []
    for cr, cc, val in clues:
        all_rects.append(get_rectangles(cr, cc, val))

    # Sort by number of possible rectangles (MRV)
    order = sorted(range(len(clues)), key=lambda i: len(all_rects[i]))
    clues = [clues[i] for i in order]
    all_rects = [all_rects[i] for i in order]

    def rect_is_free(r1, c1, r2, c2):
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                if covered[r][c] != -1:
                    return False
        return True

    def count_other_clues_in_rect(r1, c1, r2, c2, clue_idx):
        """Check that the rectangle contains no other clues."""
        for i, (ocr, occ, _) in enumerate(clues):
            if i == clue_idx:
                continue
            if r1 <= ocr <= r2 and c1 <= occ <= c2:
                return True
        return False

    def place(r1, c1, r2, c2, idx):
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                covered[r][c] = idx

    def unplace(r1, c1, r2, c2):
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                covered[r][c] = -1

    def has_isolated_uncovered(idx):
        """Quick check: is any uncovered cell unreachable by remaining clues?"""
        # Check if any uncovered cell is surrounded by covered cells and no remaining
        # clue can reach it. This is a lightweight heuristic, not exhaustive.
        remaining = set(range(idx + 1, len(clues)))
        for r in range(rows):
            for c in range(cols):
                if covered[r][c] == -1:
                    # Can any remaining clue's rectangle reach this cell?
                    reachable = False
                    for ri in remaining:
                        cr, cc, val = clues[ri]
                        for rect in all_rects[ri]:
                            r1, c1, r2, c2 = rect
                            if r1 <= r <= r2 and c1 <= c <= c2:
                                reachable = True
                                break
                        if reachable:
                            break
                    if not reachable:
                        return True
        return False

    solution = [None] * len(clues)

    def backtrack(idx):
        if idx == len(clues):
            for r in range(rows):
                for c in range(cols):
                    if covered[r][c] == -1:
                        return False
            return True

        cr, cc, val = clues[idx]
        if covered[cr][cc] != -1:
            return False

        for rect in all_rects[idx]:
            r1, c1, r2, c2 = rect
            if rect_is_free(r1, c1, r2, c2) and not count_other_clues_in_rect(r1, c1, r2, c2, idx):
                place(r1, c1, r2, c2, idx)
                solution[idx] = rect
                if backtrack(idx + 1):
                    return True
                unplace(r1, c1, r2, c2)
                solution[idx] = None

        return False

    if backtrack(0):
        return solution, clues
    else:
        return None, clues


def print_solution(grid, solution, clues):
    """Print the solved puzzle with labeled rectangles."""
    rows = len(grid)
    cols = len(grid[0])

    # Create a label grid
    label = [[-1] * cols for _ in range(rows)]
    for idx, rect in enumerate(solution):
        r1, c1, r2, c2 = rect
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                label[r][c] = idx

    # Use letters/symbols for rectangle IDs
    symbols = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

    print("\n┌" + "───┬" * (cols - 1) + "───┐")
    for r in range(rows):
        row_str = "│"
        for c in range(cols):
            val = grid[r][c]
            sym = symbols[label[r][c] % len(symbols)] if label[r][c] >= 0 else '?'
            if val > 0:
                row_str += f" {sym}{val:<1}│" if val < 10 else f"{sym}{val:>2}│"
            else:
                row_str += f" {sym} │"
        print(row_str)
        if r < rows - 1:
            # Print row separator, merging borders for same-rectangle cells
            sep = "├"
            for c in range(cols):
                if r + 1 < rows and label[r][c] == label[r + 1][c]:
                    sep += "   "
                else:
                    sep += "───"
                if c < cols - 1:
                    sep += "┼"
                else:
                    sep += "┤"
            print(sep)
    print("└" + "───┴" * (cols - 1) + "───┘")

    print("\nRectangle details:")
    for idx, (rect, (cr, cc, val)) in enumerate(zip(solution, clues)):
        r1, c1, r2, c2 = rect
        sym = symbols[idx % len(symbols)]
        h = r2 - r1 + 1
        w = c2 - c1 + 1
        print(f"  [{sym}] Clue {val} at ({cr},{cc}) → rect ({r1},{c1})-({r2},{c2}) = {h}×{w} = {h*w}")


def print_visual_grid(grid, solution, clues):
    """Print a clean visual representation showing rectangle boundaries."""
    rows = len(grid)
    cols = len(grid[0])

    label = [[-1] * cols for _ in range(rows)]
    for idx, rect in enumerate(solution):
        r1, c1, r2, c2 = rect
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                label[r][c] = idx

    # Build a character grid with borders
    # Each cell is 4 chars wide, 2 chars tall
    W = 4  # cell width
    out_rows = rows * 2 + 1
    out_cols = cols * W + 1
    out = [[' '] * out_cols for _ in range(out_rows)]

    for r in range(rows):
        for c in range(cols):
            # Cell content position
            cy = r * 2 + 1
            cx = c * W + 1

            # Write cell value
            val = grid[r][c]
            cell_str = f"{val:^{W-1}}" if val > 0 else " " * (W - 1)
            for i, ch in enumerate(cell_str):
                out[cy][cx + i] = ch

            # Top border
            if r == 0 or label[r][c] != label[r - 1][c]:
                for i in range(W - 1):
                    out[cy - 1][cx + i] = '─'

            # Left border
            if c == 0 or label[r][c] != label[r][c - 1]:
                out[cy][cx - 1] = '│'

            # Right border (rightmost column)
            if c == cols - 1:
                out[cy][cx + W - 1] = '│'

            # Bottom border (bottom row)
            if r == rows - 1:
                for i in range(W - 1):
                    out[cy + 1][cx + i] = '─'

    # Corners / intersections
    for r in range(rows + 1):
        for c in range(cols + 1):
            y = r * 2
            x = c * W
            out[y][x] = '+'

    print("\nVisual solution (borders show rectangles):\n")
    for row in out:
        print(''.join(row))


# ──────────────────────────────────────────────
# Example Puzzles
# ──────────────────────────────────────────────

# 5×5: sum of clues must = 25
PUZZLE_5x5 = [
    [0, 6, 0, 0, 4],
    [0, 0, 0, 0, 0],
    [0, 0, 5, 0, 0],
    [4, 0, 0, 0, 0],
    [0, 0, 0, 6, 0],
]

# 6×6: sum of clues must = 36
PUZZLE_6x6 = [
    [6, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0],
    [0, 0, 0, 0, 6, 0],
    [0, 0, 0, 6, 0, 0],
    [6, 0, 0, 0, 0, 0],
]

# 7×7 puzzle (sum = 49) — constructed from a known partition
PUZZLE_7x7 = [
    [6, 0, 0, 0, 0, 0, 8],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 6, 0, 0, 4, 0],
    [0, 0, 0, 4, 0, 0, 0],
    [9, 0, 0, 0, 0, 0, 3],
    [0, 0, 0, 0, 6, 0, 0],
    [0, 0, 0, 3, 0, 0, 0],
]


def main():
    print("=" * 50)
    print("         SHIKAKU PUZZLE SOLVER")
    print("=" * 50)

    puzzles = [
        ("5×5 Puzzle", PUZZLE_5x5),
        ("6×6 Puzzle", PUZZLE_6x6),
        ("7×7 Puzzle", PUZZLE_7x7),
    ]

    for name, puzzle in puzzles:
        print(f"\n{'─' * 50}")
        print(f"Solving {name}...")
        print(f"{'─' * 50}")

        print("\nInput grid:")
        for row in puzzle:
            print("  ", " ".join(f"{v:2}" if v > 0 else " ." for v in row))

        solution, clues = solve_shikaku(puzzle)

        if solution:
            print(f"\n✓ Solved!")
            print_visual_grid(puzzle, solution, clues)
            print_solution(puzzle, solution, clues)
        else:
            print("\n✗ No solution found.")

    # Interactive mode: enter your own puzzle
    print(f"\n{'─' * 50}")
    print("Enter your own puzzle (or press Enter to skip):")
    print("Format: rows cols, then the grid row by row (0 for empty)")
    print(f"{'─' * 50}")

    try:
        line = input("\nGrid dimensions (rows cols): ").strip()
        if not line:
            return
        r, c = map(int, line.split())
        grid = []
        print(f"Enter {r} rows of {c} numbers:")
        for i in range(r):
            row = list(map(int, input(f"  Row {i+1}: ").split()))
            if len(row) != c:
                print(f"Expected {c} numbers, got {len(row)}")
                return
            grid.append(row)

        print("\nSolving...")
        solution, clues = solve_shikaku(grid)
        if solution:
            print("✓ Solved!")
            print_visual_grid(grid, solution, clues)
            print_solution(grid, solution, clues)
        else:
            print("✗ No solution found.")
    except (EOFError, KeyboardInterrupt):
        pass


if __name__ == "__main__":
    main()