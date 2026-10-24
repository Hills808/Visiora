export interface CameraRotationGuardOptions {
  minRateDegPerSecond: number;
  confirmations: number;
  maxGapMs: number;
}

export interface CameraRotationRate {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}

/** Device rotation only, not body pose or walking. W3C rotationRate uses deg/s.
 * https://www.w3.org/TR/orientation-event/#rotationrate
 * A confirmation needs two distinct, adjacent above-threshold samples in the window.
 * Sustained rotation keeps confirming so captures taken during it also lose positions.
 * Missing axes are not silently replaced with zero; no raw readings are retained.
 */
export class CameraRotationGuard {
  private confirmations = 0;
  private previousAboveAt: number | null = null;
  constructor(private readonly options: CameraRotationGuardOptions) {
    if (
      !Number.isFinite(options.minRateDegPerSecond) ||
      options.minRateDegPerSecond <= 0 ||
      !Number.isFinite(options.maxGapMs) ||
      options.maxGapMs <= 0 ||
      !Number.isInteger(options.confirmations) ||
      options.confirmations < 2
    )
      throw new RangeError(
        'Camera rotation threshold and confirmation window must be positive finite values.',
      );
  }
  reset(): void {
    this.previousAboveAt = null;
    this.confirmations = 0;
  }
  observe(rate: CameraRotationRate | null, sampledAtMs: number): boolean {
    if (
      !Number.isFinite(sampledAtMs) ||
      sampledAtMs < 0 ||
      !rate ||
      rate.alpha === null ||
      rate.beta === null ||
      rate.gamma === null ||
      !Number.isFinite(rate.alpha) ||
      !Number.isFinite(rate.beta) ||
      !Number.isFinite(rate.gamma)
    ) {
      this.reset();
      return false;
    }
    const magnitude = Math.hypot(rate.alpha, rate.beta, rate.gamma);
    if (!Number.isFinite(magnitude) || magnitude < this.options.minRateDegPerSecond) {
      this.reset();
      return false;
    }
    const previous = this.previousAboveAt;
    if (previous !== null && sampledAtMs <= previous) {
      this.reset();
      return false;
    }
    this.confirmations =
      previous !== null && sampledAtMs - previous <= this.options.maxGapMs
        ? Math.min(this.options.confirmations, this.confirmations + 1)
        : 1;
    this.previousAboveAt = sampledAtMs;
    return this.confirmations >= this.options.confirmations;
  }
}
