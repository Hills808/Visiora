import { CONFIG } from '../config.js';

export type DeliveryChannel = 'voice' | 'text';
type Sample = { milliseconds: number; simulated: boolean; channel?: DeliveryChannel };

/** Local callback timings, never acoustic measurements; no content or external identifiers. */
export class OnlineTiming {
  private response: Sample[] = [];
  private preparationStart: Sample[] = [];
  private captureStart: Sample[] = [];
  private completion: Sample[] = [];
  private withdrawals = { view: 0, expiration: 0, cancellation: 0 };
  constructor(private readonly limit = CONFIG.ui.diagnosticSamples) {}
  private add(
    samples: Sample[],
    milliseconds: number,
    simulated: boolean,
    channel?: DeliveryChannel,
  ): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
    samples.push({ milliseconds, simulated, ...(channel ? { channel } : {}) });
    if (samples.length > this.limit) samples.splice(0, samples.length - this.limit);
  }
  responded(capturedAt: number, now: number, simulated: boolean): void {
    this.add(this.response, now - capturedAt, simulated);
  }
  started(
    capturedAt: number,
    preparedAt: number,
    now: number,
    channel: DeliveryChannel,
    simulated: boolean,
    repeat: boolean,
  ): void {
    if (repeat) return;
    this.add(this.preparationStart, now - preparedAt, simulated, channel);
    this.add(this.captureStart, now - capturedAt, simulated, channel);
  }
  completed(
    startedAt: number,
    now: number,
    channel: DeliveryChannel,
    simulated: boolean,
    repeat: boolean,
  ): void {
    if (!repeat) this.add(this.completion, now - startedAt, simulated, channel);
  }
  withdrew(reason: keyof OnlineTiming['withdrawals']): void {
    this.withdrawals[reason]++;
  }
  private summary(samples: Sample[]): object[] {
    const groups: object[] = [];
    for (const simulated of [false, true]) {
      for (const channel of [undefined, 'voice', 'text'] as const) {
        const values = samples
          .filter((sample) => sample.simulated === simulated && sample.channel === channel)
          .map((sample) => sample.milliseconds)
          .sort((a, b) => a - b);
        if (!values.length) continue;
        const percentile = (fraction: number): number =>
          values[Math.ceil(values.length * fraction) - 1]!;
        groups.push({
          simulated,
          ...(channel ? { channel } : {}),
          count: values.length,
          p50Ms: percentile(0.5),
          p95Ms: percentile(0.95),
        });
      }
    }
    return groups;
  }
  diagnostics(): object {
    return {
      basis:
        'Browser output callbacks; text availability is not audible voice; no acoustic measurement',
      simulatedBasis:
        'simulated=true identifies fake perception; voice callback simulation cannot be inferred from browser callbacks',
      limit: this.limit,
      summary: {
        captureToResponse: this.summary(this.response),
        preparationToStart: this.summary(this.preparationStart),
        captureToStart: this.summary(this.captureStart),
        startToCompletion: this.summary(this.completion),
      },
      captureToResponse: this.response.slice(),
      preparationToStart: this.preparationStart.slice(),
      captureToStart: this.captureStart.slice(),
      startToCompletion: this.completion.slice(),
      withdrawals: { ...this.withdrawals },
    };
  }
}
