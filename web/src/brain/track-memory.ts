import { CONFIG } from '../config.js';
import { plainLabel } from '../perception/evidence.js';
import type {
  FrameStamp,
  LocalObservation,
  LocalResult,
  LocalSource,
} from '../perception/frame.js';
import { angularDistance, bearingFromX, sectorOf, SECTORS } from './geometry.js';
import type { Sector } from './types.js';

export interface TrackMemoryOptions {
  minHits: number;
  minIou: number;
  maxGapMs: number;
  maxAgeMs: number;
  retentionMs: number;
  maxTracks: number;
  sectorHysteresisDegrees?: number;
}
export interface Track extends LocalObservation {
  id: string;
  state: 'candidate' | 'confirmed' | 'occluded';
  source: LocalSource;
  stamp: FrameStamp;
  viewRevision: number;
  firstObservedAt: number;
  lastObservedAt: number;
  consecutiveHits: number;
  misses: number;
  /** Camera-relative only, omitted while occluded. Never a position in the world. */
  sector?: Sector;
}
type Box = LocalObservation['box'];
function overlap(a: Box, b: Box): number {
  const area =
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return area / (a.width * a.height + b.width * b.height - area);
}
function validObservation(item: LocalObservation): boolean {
  const box = item?.box;
  return Boolean(
    item &&
      plainLabel(item.label) &&
      Number.isFinite(item.score) &&
      item.score >= 0 &&
      item.score <= 1 &&
      typeof item.verified === 'boolean' &&
      box &&
      [box.x, box.y, box.width, box.height].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
      box.width > 0 &&
      box.height > 0 &&
      box.x + box.width <= 1 &&
      box.y + box.height <= 1,
  );
}
function copy(track: Track): Track {
  return {
    ...track,
    box: { ...track.box },
    source: { ...track.source },
    stamp: { ...track.stamp },
  };
}
function observed(item: LocalObservation): LocalObservation {
  return { label: item.label, score: item.score, verified: item.verified, box: { ...item.box } };
}

/** Bounded image association, not identity, pose, prediction or permission to speak. */
export class TrackMemory {
  private options: TrackMemoryOptions;
  private generation = 0;
  private revision = 0;
  private nextId = 0;
  private lastFrameId = 0;
  private lastCapture = -Infinity;
  private tracks: Track[] = [];
  private suspended = new Set<Track>();
  private counts = this.emptyCounts();
  constructor(options: TrackMemoryOptions) {
    if (
      ![options.minHits, options.maxTracks].every((n) => Number.isSafeInteger(n) && n > 0) ||
      !Number.isFinite(options.minIou) ||
      options.minIou <= 0 ||
      options.minIou > 1 ||
      ![options.maxGapMs, options.maxAgeMs, options.retentionMs].every(
        (n) => Number.isFinite(n) && n > 0,
      ) ||
      options.maxAgeMs > CONFIG.capture.maxFrameAgeMs ||
      options.retentionMs < options.maxAgeMs ||
      (options.sectorHysteresisDegrees !== undefined &&
        (!Number.isFinite(options.sectorHysteresisDegrees) ||
          options.sectorHysteresisDegrees < 0 ||
          options.sectorHysteresisDegrees >= 180 / CONFIG.space.sectors))
    )
      throw new Error('Invalid local track memory options');
    this.options = { ...options };
  }
  private emptyCounts(): Record<string, number> {
    return {
      acceptedFrames: 0,
      rejectedFrames: 0,
      ambiguousObservations: 0,
      expiredTracks: 0,
      evictedTracks: 0,
      capacityDrops: 0,
      viewInvalidations: 0,
    };
  }
  get viewRevision(): number {
    return this.revision;
  }
  reset(generation: number): void {
    if (!Number.isSafeInteger(generation) || generation < 0)
      throw new Error('Invalid local session generation');
    this.generation = generation;
    this.revision++;
    this.lastFrameId = 0;
    this.lastCapture = -Infinity;
    this.tracks = [];
    this.suspended.clear();
    this.counts = this.emptyCounts();
  }
  setGeneration(generation: number): void {
    this.reset(generation);
  }
  invalidateView(): void {
    this.revision++;
    this.tracks = [];
    this.suspended.clear();
    this.counts.viewInvalidations++;
  }
  private prune(now: number): void {
    const retained = this.tracks.filter(
      (track) => now - track.lastObservedAt <= this.options.retentionMs,
    );
    this.counts.expiredTracks += this.tracks.length - retained.length;
    this.tracks = retained;
    this.suspended = new Set(retained.filter((track) => this.suspended.has(track)));
  }
  private sector(item: LocalObservation, previous?: Sector): Sector {
    const bearing = bearingFromX(item.box.x + item.box.width / 2);
    if (
      previous &&
      angularDistance(bearing, (SECTORS.indexOf(previous) * 360) / CONFIG.space.sectors) <=
        180 / CONFIG.space.sectors + (this.options.sectorHysteresisDegrees ?? 0)
    )
      return previous;
    return sectorOf(bearing);
  }
  accept(result: LocalResult, now: number, viewRevision: number): boolean {
    const stamp = result?.stamp;
    const source = result?.source;
    if (
      !Number.isFinite(now) ||
      !stamp ||
      result.schemaVersion !== 1 ||
      stamp.schemaVersion !== 1 ||
      viewRevision !== this.revision ||
      stamp.sessionGeneration !== this.generation ||
      !Number.isSafeInteger(stamp.frameId) ||
      stamp.frameId <= this.lastFrameId ||
      !Number.isFinite(stamp.capturedAtMs) ||
      stamp.capturedAtMs < 0 ||
      stamp.capturedAtMs <= this.lastCapture ||
      now - stamp.capturedAtMs > this.options.maxAgeMs ||
      stamp.capturedAtMs - now > CONFIG.capture.futureToleranceMs ||
      ![stamp.width, stamp.height].every((n) => Number.isSafeInteger(n) && n > 0) ||
      stamp.orientation !== 'browser-upright' ||
      stamp.mirrored !== false ||
      !source ||
      typeof source.id !== 'string' ||
      !source.id ||
      typeof source.revision !== 'string' ||
      !source.revision ||
      typeof source.simulated !== 'boolean' ||
      !Array.isArray(result.observations) ||
      result.observations.length > CONFIG.vision.maxDetections ||
      !result.observations.every(validObservation)
    ) {
      this.counts.rejectedFrames++;
      return false;
    }
    this.prune(now);
    // A different backend or geometry cannot contribute hits to an earlier association.
    this.tracks = this.tracks.filter(
      (track) =>
        track.source.id === source.id &&
        track.source.revision === source.revision &&
        track.source.simulated === source.simulated &&
        track.stamp.width === stamp.width &&
        track.stamp.height === stamp.height,
    );
    this.suspended = new Set(this.tracks.filter((track) => this.suspended.has(track)));
    this.lastFrameId = stamp.frameId;
    this.lastCapture = stamp.capturedAtMs;
    this.counts.acceptedFrames++;
    const observations = result.observations;
    const edges = observations.map((item) =>
      this.tracks.filter(
        (track) =>
          !this.suspended.has(track) &&
          track.label === item.label &&
          stamp.capturedAtMs - track.lastObservedAt <= this.options.maxGapMs &&
          now - track.lastObservedAt <= this.options.maxAgeMs &&
          overlap(track.box, item.box) >= this.options.minIou,
      ),
    );
    const degree = new Map<Track, number>();
    edges.flat().forEach((track) => degree.set(track, (degree.get(track) ?? 0) + 1));
    const matched = new Set<Track>();
    const fresh: LocalObservation[] = [];
    observations.forEach((item, index) => {
      const candidates = edges[index];
      if (candidates.length !== 1 || degree.get(candidates[0]) !== 1) {
        if (candidates.length) {
          this.counts.ambiguousObservations++;
          candidates.forEach((track) => this.suspended.add(track));
        } else fresh.push(item);
        return;
      }
      const track = candidates[0];
      const hits = track.misses === 0 ? track.consecutiveHits + 1 : 1;
      const sector = this.sector(item, track.sector);
      Object.assign(track, observed(item), {
        stamp: { ...stamp },
        source: { ...source },
        lastObservedAt: stamp.capturedAtMs,
        consecutiveHits: hits,
        misses: 0,
        state: hits >= this.options.minHits ? 'confirmed' : 'candidate',
        sector,
      });
      matched.add(track);
    });
    for (const track of this.tracks)
      if (!matched.has(track)) {
        track.state = 'occluded';
        track.misses++;
        track.consecutiveHits = 0;
        delete track.sector;
      }
    for (const item of fresh) {
      if (this.tracks.length >= this.options.maxTracks) {
        const oldest = this.tracks
          .filter((track) => track.state === 'occluded')
          .sort((a, b) => a.lastObservedAt - b.lastObservedAt)[0];
        if (!oldest) {
          this.counts.capacityDrops++;
          continue;
        }
        this.tracks.splice(this.tracks.indexOf(oldest), 1);
        this.suspended.delete(oldest);
        this.counts.evictedTracks++;
      }
      this.tracks.push({
        ...observed(item),
        id: `local-${++this.nextId}`,
        source: { ...source },
        stamp: { ...stamp },
        viewRevision: this.revision,
        firstObservedAt: stamp.capturedAtMs,
        lastObservedAt: stamp.capturedAtMs,
        consecutiveHits: 1,
        misses: 0,
        state: this.options.minHits === 1 ? 'confirmed' : 'candidate',
        sector: this.sector(item),
      });
    }
    return true;
  }
  snapshot(now: number): Track[] {
    if (!Number.isFinite(now)) return [];
    this.prune(now);
    return this.tracks
      .filter(
        (track) =>
          now - track.lastObservedAt <= this.options.maxAgeMs &&
          track.lastObservedAt - now <= CONFIG.capture.futureToleranceMs,
      )
      .map(copy);
  }
  diagnostics(now: number): Record<string, number> {
    const fresh = this.snapshot(now);
    return {
      ...this.counts,
      retainedTracks: this.tracks.length,
      freshTracks: fresh.length,
      candidateTracks: fresh.filter((track) => track.state === 'candidate').length,
      confirmedTracks: fresh.filter((track) => track.state === 'confirmed').length,
      occludedTracks: fresh.filter((track) => track.state === 'occluded').length,
      pendingFrames: 0,
    };
  }
}
