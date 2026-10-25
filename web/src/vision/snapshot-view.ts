import { compareViews } from './view-change.js';

/** Once a capture loses its view, matching pixels later cannot restore its old positions. */
export class SnapshotView {
  private usable = true;
  constructor(readonly signature: readonly number[]) {}
  get valid(): boolean {
    return this.usable;
  }
  invalidate(): boolean {
    if (!this.usable) return false;
    this.usable = false;
    return true;
  }
  observe(signature: readonly number[]): boolean {
    if (!this.usable || !compareViews(this.signature, signature).broad) return false;
    return this.invalidate();
  }
}
