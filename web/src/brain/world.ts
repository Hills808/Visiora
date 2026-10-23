import { CONFIG } from '../config.js';
import { angularDistance, normAngle, sectorOf, validDepth } from './geometry.js';
import { LEX } from './lexicon.js';
import type { Entity, Fact, Observation, Pose } from './types.js';
export class World {
  private entities = new Map<string, Entity>();
  private previous = new Map<string, { range: number; t: number; approaching: boolean }>();
  private counter = 0;
  private lastFrame = -1;
  private lastTime = -Infinity;
  private pose: Pose = { x: 0, y: 0, yaw: 0 };
  rejectedFrames = 0;
  ingest(frame: Observation, now: number): boolean {
    if (
      !Number.isFinite(frame.capturedAtMs) ||
      frame.frameId <= this.lastFrame ||
      frame.capturedAtMs < this.lastTime ||
      now - frame.capturedAtMs > CONFIG.capture.maxFrameAgeMs ||
      frame.capturedAtMs - now > CONFIG.capture.futureToleranceMs
    ) {
      this.rejectedFrames++;
      return false;
    }
    this.lastFrame = frame.frameId;
    this.lastTime = frame.capturedAtMs;
    this.pose = frame.pose;
    const used = new Set<string>();
    for (const detection of frame.detections) {
      if (
        !LEX[detection.cls] ||
        !Number.isFinite(detection.bearing) ||
        detection.score < CONFIG.world.minScore ||
        !Number.isFinite(detection.score)
      )
        continue;
      const bearing = normAngle(detection.bearing + this.pose.yaw);
      const depth = validDepth(detection.depth, frame.frameId) ? detection.depth.meters : undefined;
      const candidates = [...this.entities.values()].filter(
        (e) =>
          e.cls === detection.cls &&
          !used.has(e.id) &&
          angularDistance(this.absoluteBearing(e), bearing) <= CONFIG.world.bearingGate &&
          (depth === undefined ||
            e.x === undefined ||
            Math.abs(this.range(e)! - depth) <=
              Math.max(CONFIG.world.rangeGate, depth * CONFIG.world.relativeRangeGate)),
      );
      candidates.sort(
        (a, b) =>
          angularDistance(this.absoluteBearing(a), bearing) -
          angularDistance(this.absoluteBearing(b), bearing),
      );
      let entity = candidates[0];
      if (!entity) {
        entity = {
          id: `entity-${++this.counter}`,
          cls: detection.cls,
          score: detection.score,
          bearing,
          firstSeen: frame.capturedAtMs,
          lastSeen: frame.capturedAtMs,
          lastFrameId: frame.frameId,
          hits: 0,
          misses: 0,
          visible: true,
        };
        this.entities.set(entity.id, entity);
      }
      const oldRange = this.range(entity);
      const dt = (frame.capturedAtMs - entity.lastSeen) / 1000;
      entity.bearing = bearing;
      entity.score = detection.score;
      entity.lastSeen = frame.capturedAtMs;
      entity.lastFrameId = frame.frameId;
      entity.hits++;
      entity.misses = 0;
      entity.visible = true;
      if (depth !== undefined) {
        entity.x = this.pose.x + Math.sin((bearing * Math.PI) / 180) * depth;
        entity.y = this.pose.y + Math.cos((bearing * Math.PI) / 180) * depth;
        const newRange = this.range(entity)!;
        this.previous.set(entity.id, {
          range: newRange,
          t: frame.capturedAtMs,
          approaching:
            oldRange !== undefined &&
            dt > 0 &&
            (oldRange - newRange) / dt + CONFIG.world.velocityEpsilon >= CONFIG.world.approachSpeed,
        });
      } else {
        delete entity.x;
        delete entity.y;
        this.previous.delete(entity.id);
      }
      used.add(entity.id);
    }
    for (const entity of this.entities.values()) {
      if (used.has(entity.id)) continue;
      const inFov =
        angularDistance(this.absoluteBearing(entity), this.pose.yaw) <= CONFIG.space.fov / 2;
      entity.visible = false;
      if (inFov) entity.misses++;
      const ttl = LEX[entity.cls].dynamic
        ? CONFIG.world.forgetDynamicMs
        : CONFIG.world.forgetStaticMs;
      if (now - entity.lastSeen > ttl || entity.misses > CONFIG.world.maxMisses) {
        this.entities.delete(entity.id);
        this.previous.delete(entity.id);
      }
    }
    return true;
  }
  private range(e: Entity): number | undefined {
    return e.x === undefined || e.y === undefined
      ? undefined
      : Math.hypot(e.x - this.pose.x, e.y - this.pose.y);
  }
  private absoluteBearing(e: Entity): number {
    return e.x === undefined || e.y === undefined
      ? e.bearing
      : (Math.atan2(e.x - this.pose.x, e.y - this.pose.y) * 180) / Math.PI;
  }
  snapshot(now: number): Fact[] {
    return [...this.entities.values()]
      .filter(
        (e) =>
          now - e.lastSeen <=
          (LEX[e.cls].dynamic ? CONFIG.world.forgetDynamicMs : CONFIG.world.forgetStaticMs),
      )
      .map((e) => {
        const bearing = normAngle(this.absoluteBearing(e) - this.pose.yaw);
        const age = Math.max(0, now - e.lastSeen);
        return {
          id: e.id,
          cls: e.cls,
          score: e.score,
          sector: sectorOf(bearing),
          bearing,
          range: age <= CONFIG.world.visibleMs ? this.range(e) : undefined,
          age,
          confirmed: e.hits >= CONFIG.world.hits,
          visible: e.visible && age <= CONFIG.world.visibleMs,
          approaching: !!this.previous.get(e.id)?.approaching && age <= CONFIG.world.visibleMs,
          frameId: e.lastFrameId,
          observedAtMs: e.lastSeen,
        };
      });
  }
  reset(): void {
    this.entities.clear();
    this.previous.clear();
    this.counter = 0;
    this.lastFrame = -1;
    this.lastTime = -Infinity;
    this.rejectedFrames = 0;
  }
}
