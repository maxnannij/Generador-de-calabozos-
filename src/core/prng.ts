/**
 * @license
 * SPDX-License-Identifier: MIT
 * Deterministic PRNG implementation (Mulberry32)
 */

export class PRNG {
  private state: number;
  private readonly initialSeed: string;

  constructor(seed: string | number) {
    this.initialSeed = String(seed);
    this.state = PRNG.hashSeed(this.initialSeed);
  }

  public getSeed(): string {
    return this.initialSeed;
  }

  /**
   * Hashes a string or numeric seed into a 32-bit unsigned integer
   */
  public static hashSeed(seedStr: string): number {
    let hash = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
      hash = Math.imul(hash ^ seedStr.charCodeAt(i), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^ (hash >>> 16)) >>> 0;
  }

  /**
   * Returns a float in [0, 1)
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a float in [min, max)
   */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Returns an integer in [min, max] inclusive
   */
  public int(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /**
   * Returns true with the given probability (0 to 1)
   */
  public boolean(chance: number = 0.5): boolean {
    return this.next() < chance;
  }

  /**
   * Picks a random element from an array
   */
  public choice<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    const idx = Math.floor(this.next() * array.length);
    return array[idx];
  }

  /**
   * Shuffles an array in place using Fisher-Yates
   */
  public shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Creates a deterministic derived PRNG stream for a specific subsystem
   */
  public fork(subsystemName: string): PRNG {
    return new PRNG(`${this.initialSeed}:${subsystemName}`);
  }
}
