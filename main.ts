// minified entry
// make.fun sokoban-solver entry: push-optimal per room, exact P*
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const DX = [0, 0, -1, 1];
const DY = [-1, 1, 0, 0];
const CH = ['u', 'd', 'l', 'r'];
function S(tx: string): string {
const rs = tx.split('\n').filter((r) => r.length > 0);
const w = Math.max(...rs.map((r) => r.length));
const h = rs.length;
const n = w * h;
const wall = new Uint8Array(n).fill(1);
const goal = new Uint8Array(n);
const box = new Uint8Array(n);
let start = -1;
rs.forEach((row, y) => {
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
const R: number[][] = [];
for (let i = 0; i < n; i++) {
if (wall[i] || comp[i] >= 0 || Math.floor(i / w) === hallRow) continue;
const id = R.length;
const C: number[] = [];
const st = [i];
comp[i] = id;
while (st.length) {
const c = st.pop()!;
C.push(c);
const cx = c % w;
const cy = (c - cx) / w;
for (let d = 0; d < 4; d++) {
const nx = cx + DX[d];
const ny = cy + DY[d];
if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
const j = ny * w + nx;
if (wall[j] || comp[j] >= 0 || Math.floor(j / w) === hallRow) continue;
comp[j] = id;
st.push(j);
}
}
R.push(C);
}
const B = new Uint8Array(box);
const allBoxes: number[] = [];
for (let i = 0; i < n; i++) if (B[i]) allBoxes.push(i);
/** C reachable from `from` with the given box set blocked */
const rg = (from: number, blocked: Uint8Array): Uint8Array => {
const sv = new Uint8Array(n);
if (blocked[from] || wall[from]) return sv;
const st = [from];
sv[from] = 1;
while (st.length) {
const c = st.pop()!;
const cx = c % w;
const cy = (c - cx) / w;
for (let d = 0; d < 4; d++) {
const nx = cx + DX[d];
const ny = cy + DY[d];
if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
const j = ny * w + nx;
if (sv[j] || wall[j] || blocked[j]) continue;
sv[j] = 1;
st.push(j);
}
}
return sv;
};
/** BFS walking path from `from` to `to` avoiding W and B; returns letters */
const wk = (from: number, to: number, blocked: Uint8Array): string => {
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
for (const C of R) {
const rb = C.filter((c) => B[c]);
const rG = new Set(C.filter((c) => goal[c]));
if (rb.length === 0) continue;
const sb = new Uint8Array(B);
for (const c of rb) sb[c] = 0;
const bf = (b: number[]): Uint8Array => {
const m = new Uint8Array(sb);
for (const c of b) m[c] = 1;
return m;
};
type Node = { b: number[]; p: number; moves: string };
const ko = (b: number[], reg: Uint8Array): string => {
let m = 0;
for (let i = 0; i < n; i++) if (reg[i]) { m = i; break; }
return b.join(',') + '|' + m;
};
const sn: Node = { b: rb.slice().sort((a, c) => a - c), p: pos, moves: '' };
const sv = new Set<string>([ko(sn.b, rg(sn.p, bf(sn.b)))]);
const q: Node[] = [sn];
let gn: Node | null = null;
for (let qi = 0; qi < q.length && qi < 400000 && gn === null; qi++) {
const node = q[qi];
if (node.b.every((c) => rG.has(c))) { gn = node; break; }
const bn = bf(node.b);
const reg = rg(node.p, bn);
for (let bi = 0; bi < node.b.length; bi++) {
const bc = node.b[bi];
const bx = bc % w;
const by = (bc - bx) / w;
for (let d = 0; d < 4; d++) {
const nx = bx + DX[d];
const ny = by + DY[d];
if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
const ah = ny * w + nx;
if (wall[ah] || bn[ah]) continue;
const bh = bc - DY[d] * w - DX[d];
if (wall[bh] || bn[bh] || !reg[bh]) continue;
const pt = wk(node.p, bh, bn);
if (node.p !== bh && pt === '') continue;
const nb = node.b.slice();
nb[bi] = ah;
nb.sort((a, c) => a - c);
const key = ko(nb, rg(bc, bf(nb)));
if (sv.has(key)) continue;
sv.add(key);
q.push({ b: nb, p: bc, moves: node.moves + pt + CH[d] });
}
}
}
if (!gn) continue;
for (const ch of gn.moves) moves += ch;
for (const c of gn.b) { B[c] = 1; }
for (const c of rb) if (!gn.b.includes(c)) B[c] = 0;
pos = gn.p;
}
return moves;
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
const moves = S(readFileSync(join(I, id, 'level.txt'), 'utf8'));
mkdirSync(join(O, id), { recursive: true });
writeFileSync(join(O, id, 'solution.txt'), `${moves}\n`);
}