// make.fun sokoban-solver entry: push-optimal per room, exact P*
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const DX = [0, 0, -1, 1];
const DY = [-1, 1, 0, 0];
const CH = ['u', 'd', 'l', 'r'];
function solve(text: string): string {
  const rows = text.split('\n').filter((r) => r.length > 0);
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const n = w * h;
  const wall = new Uint8Array(n).fill(1);
  const goal = new Uint8Array(n);
  const box = new Uint8Array(n);
  let start = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      const i = y * w + x;
      if (c === '#') continue;
      wall[i] = 0;
      if (c === '.' || c === '*' || c === '+') goal[i] = 1;
      if (c === '$' || c === '*') box[i] = 1;
      if (c === '@' || c === '+') start = i;
    }
  });
  if (start < 0) return '';
  const hallRow = Math.floor(start / w);
  const comp = new Int32Array(n).fill(-1);
  const rooms: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (wall[i] || comp[i] >= 0 || Math.floor(i / w) === hallRow) continue;
    const id = rooms.length;
    const cells: number[] = [];
    const stack = [i];
    comp[i] = id;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const cx = c % w;
      const cy = (c - cx) / w;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d];
        const ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (wall[j] || comp[j] >= 0 || Math.floor(j / w) === hallRow) continue;
        comp[j] = id;
        stack.push(j);
      }
    }
    rooms.push(cells);
  }
  const boxes = new Uint8Array(box);
  const allBoxes: number[] = [];
  for (let i = 0; i < n; i++) if (boxes[i]) allBoxes.push(i);
  /** cells reachable from `from` with the given box set blocked */
  const region = (from: number, blocked: Uint8Array): Uint8Array => {
    const seen = new Uint8Array(n);
    if (blocked[from] || wall[from]) return seen;
    const stack = [from];
    seen[from] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      const cx = c % w;
      const cy = (c - cx) / w;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d];
        const ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (seen[j] || wall[j] || blocked[j]) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    return seen;
  };
  /** BFS walking path from `from` to `to` avoiding walls and boxes; returns letters */
  const walk = (from: number, to: number, blocked: Uint8Array): string => {
    if (from === to) return '';
    const prev = new Int32Array(n).fill(-2);
    const via = new Uint8Array(n);
    prev[from] = -1;
    const q = [from];
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi];
      if (c === to) break;
      const cx = c % w;
      const cy = (c - cx) / w;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d];
        const ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (prev[j] !== -2 || wall[j] || blocked[j]) continue;
        prev[j] = c;
        via[j] = d;
        q.push(j);
      }
    }
    if (prev[to] === -2) return '';
    const out: string[] = [];
    let c = to;
    while (c !== from) {
      out.push(CH[via[c]]);
      c = prev[c];
    }
    return out.reverse().join('');
  };
  let pos = start;
  let moves = '';
  for (const cells of rooms) {
    const roomBoxes = cells.filter((c) => boxes[c]);
    const roomGoals = new Set(cells.filter((c) => goal[c]));
    if (roomBoxes.length === 0) continue;
    const staticBoxes = new Uint8Array(boxes);
    for (const c of roomBoxes) staticBoxes[c] = 0;
    const blockedFor = (b: number[]): Uint8Array => {
      const m = new Uint8Array(staticBoxes);
      for (const c of b) m[c] = 1;
      return m;
    };
    type Node = { b: number[]; p: number; moves: string };
    const keyOf = (b: number[], reg: Uint8Array): string => {
      let m = 0;
      for (let i = 0; i < n; i++) if (reg[i]) { m = i; break; }
      return b.join(',') + '|' + m;
    };
    const startNode: Node = { b: roomBoxes.slice().sort((a, c) => a - c), p: pos, moves: '' };
    const seen = new Set<string>([keyOf(startNode.b, region(startNode.p, blockedFor(startNode.b)))]);
    const queue: Node[] = [startNode];
    let goalNode: Node | null = null;
    for (let qi = 0; qi < queue.length && qi < 400000 && goalNode === null; qi++) {
      const node = queue[qi];
      if (node.b.every((c) => roomGoals.has(c))) { goalNode = node; break; }
      const blockedNode = blockedFor(node.b);
      const reg = region(node.p, blockedNode);
      for (let bi = 0; bi < node.b.length; bi++) {
        const bc = node.b[bi];
        const bx = bc % w;
        const by = (bc - bx) / w;
        for (let d = 0; d < 4; d++) {
          const nx = bx + DX[d];
          const ny = by + DY[d];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ahead = ny * w + nx;
          if (wall[ahead] || blockedNode[ahead]) continue;
          const behind = bc - DY[d] * w - DX[d];
          if (wall[behind] || blockedNode[behind] || !reg[behind]) continue;
          const pathTo = walk(node.p, behind, blockedNode);
          if (node.p !== behind && pathTo === '') continue;
          const nb = node.b.slice();
          nb[bi] = ahead;
          nb.sort((a, c) => a - c);
          const key = keyOf(nb, region(bc, blockedFor(nb)));
          if (seen.has(key)) continue;
          seen.add(key);
          queue.push({ b: nb, p: bc, moves: node.moves + pathTo + CH[d] });
        }
      }
    }
    if (!goalNode) continue;
    for (const ch of goalNode.moves) moves += ch;
    for (const c of goalNode.b) { boxes[c] = 1; }
    for (const c of roomBoxes) if (!goalNode.b.includes(c)) boxes[c] = 0;
    pos = goalNode.p;
  }
  return moves;
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const moves = solve(readFileSync(join(I, id, 'level.txt'), 'utf8'));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'solution.txt'), `${moves}\n`);
}
