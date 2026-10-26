/**
 * @license
 * SPDX-License-Identifier: MIT
 * Graph structures, topological connections and Minimum Spanning Tree (MST)
 */

import { GraphEdge, Room } from './types';
import { PRNG } from './prng';
import { euclideanDistance } from './geometry';

interface DisjointSet {
  parent: Record<string, string>;
  rank: Record<string, number>;
}

function makeSet(elements: string[]): DisjointSet {
  const ds: DisjointSet = { parent: {}, rank: {} };
  for (const el of elements) {
    ds.parent[el] = el;
    ds.rank[el] = 0;
  }
  return ds;
}

function find(ds: DisjointSet, x: string): string {
  if (ds.parent[x] !== x) {
    ds.parent[x] = find(ds, ds.parent[x]);
  }
  return ds.parent[x];
}

function union(ds: DisjointSet, x: string, y: string): boolean {
  const rootX = find(ds, x);
  const rootY = find(ds, y);
  if (rootX === rootY) return false;

  if (ds.rank[rootX] < ds.rank[rootY]) {
    ds.parent[rootX] = rootY;
  } else if (ds.rank[rootX] > ds.rank[rootY]) {
    ds.parent[rootY] = rootX;
  } else {
    ds.parent[rootY] = rootX;
    ds.rank[rootX]++;
  }
  return true;
}

export function buildRoomGraph(
  rooms: Room[],
  allowLoops: boolean,
  prng: PRNG
): GraphEdge[] {
  if (rooms.length <= 1) return [];

  const roomIds = rooms.map((r) => r.id);
  const ds = makeSet(roomIds);

  // 1. Generate all candidate edges between room pairs with Euclidean distance
  const allCandidates: { from: string; to: string; distance: number }[] = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const dist = euclideanDistance(rooms[i].center, rooms[j].center);
      allCandidates.push({
        from: rooms[i].id,
        to: rooms[j].id,
        distance: dist,
      });
    }
  }

  // Sort candidates by distance (ascending)
  allCandidates.sort((a, b) => a.distance - b.distance);

  const selectedEdges: GraphEdge[] = [];
  const unusedEdges: { from: string; to: string; distance: number }[] = [];

  let edgeCounter = 1;

  // 2. Kruskal's MST to guarantee 100% full connectivity with minimal cost
  for (const candidate of allCandidates) {
    if (union(ds, candidate.from, candidate.to)) {
      selectedEdges.push({
        id: `edge_${edgeCounter++}`,
        fromRegion: candidate.from,
        toRegion: candidate.to,
        distance: candidate.distance,
        isValid: true,
      });
    } else {
      unusedEdges.push(candidate);
    }
  }

  // 3. Add loops / secondary tactical connections if permitted
  if (allowLoops && unusedEdges.length > 0) {
    // Add 20-30% of remaining closest candidate edges
    const loopCount = Math.min(
      Math.max(1, Math.floor(rooms.length * 0.25)),
      unusedEdges.length
    );
    for (let i = 0; i < loopCount; i++) {
      const cand = unusedEdges[i];
      // Avoid excessively distant loops
      if (cand.distance < Math.max(rooms[0].width, rooms[0].height) * 4 || prng.boolean(0.5)) {
        selectedEdges.push({
          id: `edge_${edgeCounter++}`,
          fromRegion: cand.from,
          toRegion: cand.to,
          distance: cand.distance,
          isValid: true,
        });
      }
    }
  }

  return selectedEdges;
}

/**
 * Validates topological connectivity of the room graph using BFS
 */
export function checkGraphReachability(
  startRoomId: string,
  allRoomIds: string[],
  edges: GraphEdge[]
): { isFullyConnected: boolean; reachable: Set<string>; isolated: string[] } {
  const adj = new Map<string, Set<string>>();
  for (const id of allRoomIds) {
    adj.set(id, new Set());
  }

  for (const edge of edges) {
    if (!edge.isValid) continue;
    adj.get(edge.fromRegion)?.add(edge.toRegion);
    adj.get(edge.toRegion)?.add(edge.fromRegion);
  }

  const visited = new Set<string>();
  const queue: string[] = [startRoomId];
  visited.add(startRoomId);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = adj.get(curr);
    if (!neighbors) continue;
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }

  const isolated = allRoomIds.filter((id) => !visited.has(id));
  return {
    isFullyConnected: isolated.length === 0,
    reachable: visited,
    isolated,
  };
}
