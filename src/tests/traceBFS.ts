import { createDefaultConfig, generateDungeon } from '../core/dungeonGenerator';
import { isTransitableCell } from '../core/walls';
import { get4Neighbors } from '../core/geometry';

const cfg = createDefaultConfig({
  seed: 'prop_seed_158380',
  roomCountMin: 8,
  roomCountMax: 14,
  mapType: 'dungeon',
});
const m = generateDungeon(cfg);
const entranceRoom = m.rooms[0];

const visitedCells = new Set<string>();
const cellQ = [entranceRoom.center];
visitedCells.add(`${entranceRoom.center.x},${entranceRoom.center.y}`);

while (cellQ.length > 0) {
  const cur = cellQ.shift()!;
  const neighbors = get4Neighbors(cur, m.config.width, m.config.height);

  for (const nb of neighbors) {
    const np = nb.point;
    const k = `${np.x},${np.y}`;
    if (visitedCells.has(k)) continue;

    const nextType = m.grid[np.y][np.x];
    if (!isTransitableCell(nextType)) continue;

    let edgeId = '';
    if (nb.dir === 'N') edgeId = `H:${cur.x}:${cur.y}`;
    else if (nb.dir === 'S') edgeId = `H:${cur.x}:${cur.y + 1}`;
    else if (nb.dir === 'W') edgeId = `V:${cur.x}:${cur.y}`;
    else if (nb.dir === 'E') edgeId = `V:${cur.x + 1}:${cur.y}`;

    const wall = m.wallSegments[edgeId];
    if (wall && !wall.hasOpening) {
      continue;
    }

    visitedCells.add(k);
    cellQ.push(np);
  }
}

console.log('Total visited cells:', visitedCells.size);
console.log('Is cellA {36, 26} visited?', visitedCells.has('36,26'));
console.log('Is cellB {36, 27} visited?', visitedCells.has('36,27'));

// If cellA is visited, what are cellA neighbors?
const neighborsA = get4Neighbors({ x: 36, y: 26 }, m.config.width, m.config.height);
neighborsA.forEach(n => {
  const edgeId = n.dir === 'N' ? `H:36:26` : n.dir === 'S' ? `H:36:27` : n.dir === 'W' ? `V:36:26` : `V:37:26`;
  const wall = m.wallSegments[edgeId];
  console.log(`neighbor (${n.point.x}, ${n.point.y}): grid=${m.grid[n.point.y]?.[n.point.x]}, wall=${edgeId}, hasOpening=${wall?.hasOpening}, visited=${visitedCells.has(`${n.point.x},${n.point.y}`)}`);
});
