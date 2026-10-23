import { CONFIG } from '../config.js';
import type { MetricDepth, Sector } from './types.js';
export const SECTORS: Sector[] = [
  'front',
  'frontRight',
  'right',
  'backRight',
  'back',
  'backLeft',
  'left',
  'frontLeft',
];
export const DIRECTIONS: Record<Sector, string> = {
  front: 'À sua frente',
  frontRight: 'À sua frente, à direita',
  right: 'À sua direita',
  backRight: 'Atrás de você, à direita',
  back: 'Atrás de você',
  backLeft: 'Atrás de você, à esquerda',
  left: 'À sua esquerda',
  frontLeft: 'À sua frente, à esquerda',
};
export function normAngle(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}
export function sectorOf(bearing: number): Sector {
  return SECTORS[Math.round(((normAngle(bearing) + 360) % 360) / 45) % CONFIG.space.sectors];
}
export function bearingFromX(x: number, fov = CONFIG.space.fov): number {
  return (Math.atan((2 * x - 1) * Math.tan((fov * Math.PI) / 360)) * 180) / Math.PI;
}
export function angularDistance(a: number, b: number): number {
  return Math.abs(normAngle(a - b));
}
export function validDepth(depth: MetricDepth | undefined, frameId: number): depth is MetricDepth {
  return (
    !!depth &&
    (depth.source === 'metric' || depth.source === 'simulation') &&
    depth.frameId === frameId &&
    Number.isFinite(depth.meters) &&
    depth.meters >= CONFIG.space.minDepthM &&
    depth.meters <= CONFIG.space.maxDepthM &&
    Number.isFinite(depth.sigma) &&
    depth.sigma >= 0 &&
    depth.sigma <= depth.meters * 0.5
  );
}
export function quantizeSteps(meters: number, stepLength: number): number {
  const steps = meters / stepLength;
  if (steps <= 8) return Math.max(1, Math.round(steps));
  return [10, 15, 20].reduce((a, b) => (Math.abs(b - steps) < Math.abs(a - steps) ? b : a));
}
