import { CONFIG } from '../config.js';
import { TrackMemory, type Track } from '../brain/track-memory.js';
import { compareViews } from '../vision/view-change.js';
import { LocalPipeline } from './local-pipeline.js';
import type { FrameAccess, LocalPerceptionAdapter } from './frame.js';

export type LocalFactory = (
  signal: AbortSignal,
  status: (message: string) => void,
) => Promise<LocalPerceptionAdapter>;
export type ContinuousState =
  | 'disabled'
  | 'waiting'
  | 'loading'
  | 'active'
  | 'simulated'
  | 'error'
  | 'stopped';

/** Independent observer: no speech, Luna facts or paid request triggers. */
export class ContinuousPerception {
  private memory = new TrackMemory(CONFIG.continuous);
  private pipeline: LocalPipeline | null = null;
  private adapter: (LocalPerceptionAdapter & { diagnostics?: () => object }) | null = null;
  private initialization: AbortController | null = null;
  private epoch = 0;
  private generation = 0;
  private running = false;
  private enabled = false;
  private state: ContinuousState = 'disabled';
  private statusMessage = '';
  private signature: readonly number[] = [];
  private dispatchRevision = 0;
  private rotationUntil = -Infinity;
  private lastResultAt: number | null = null;
  private lastAdapterDiagnostic: object = {};
  constructor(
    private factory: LocalFactory,
    private now: () => number = () => performance.now(),
    private unavailable: () => void = () => undefined,
  ) {}
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.release();
    this.memory.invalidateView();
    this.lastResultAt = null;
    if (!enabled) this.state = 'disabled';
    else if (this.running) this.initialize();
    else this.state = 'waiting';
  }
  start(generation: number): void {
    this.release();
    this.running = true;
    this.generation = generation;
    this.memory.reset(generation);
    this.signature = [];
    this.rotationUntil = -Infinity;
    this.lastResultAt = null;
    this.lastAdapterDiagnostic = {};
    this.pipeline = null;
    if (this.enabled) this.initialize();
    else this.state = 'disabled';
  }
  private initialize(): void {
    this.pipeline = null;
    const epoch = this.epoch;
    const controller = new AbortController();
    this.initialization = controller;
    this.state = 'loading';
    this.statusMessage = 'Preparando os modelos locais em paralelo.';
    void this.factory(controller.signal, (message) => {
      if (this.epoch === epoch && !controller.signal.aborted) this.statusMessage = message;
    }).then(
      (adapter) => {
        if (epoch !== this.epoch || controller.signal.aborted || !this.running || !this.enabled) {
          adapter.dispose();
          return;
        }
        this.initialization = null;
        this.adapter = adapter;
        this.state = adapter.source.simulated ? 'simulated' : 'active';
        this.statusMessage = 'Observando localmente; referências experimentais, sem fala local.';
        this.pipeline = new LocalPipeline(
          this.generation,
          adapter,
          (result) => {
            if (this.memory.accept(result, this.now(), this.dispatchRevision))
              this.lastResultAt = result.stamp.capturedAtMs;
          },
          () => {
            this.state = 'error';
            this.statusMessage =
              'Percepção local indisponível. Confira também o estado da análise Luna.';
            this.memory.invalidateView();
            this.unavailable();
          },
          this.now,
        );
      },
      (error: unknown) => {
        if (epoch !== this.epoch || controller.signal.aborted) return;
        this.initialization = null;
        this.state = 'error';
        this.statusMessage =
          'Não foi possível preparar a percepção local. Desative e ative para tentar novamente.';
        console.warn(
          JSON.stringify({
            event: 'continuous_initialization_failed',
            name: error instanceof Error ? error.name : 'unknown',
          }),
        );
        this.unavailable();
      },
    );
  }
  offer(frame: FrameAccess, signature: readonly number[]): void {
    if (!this.running || !this.enabled || frame.stamp.sessionGeneration !== this.generation) return;
    if (!this.signature.length) this.signature = signature.slice();
    else if (compareViews(this.signature, signature).broad) {
      this.memory.invalidateView();
      this.lastResultAt = null;
      this.signature = signature.slice();
    }
    if (this.now() < this.rotationUntil || !this.pipeline) return;
    if (!this.pipeline.busy) this.dispatchRevision = this.memory.viewRevision;
    this.pipeline.offer(frame);
  }
  rotated(): void {
    if (!this.running || !this.enabled) return;
    const now = this.now();
    if (now >= this.rotationUntil) this.memory.invalidateView();
    this.lastResultAt = null;
    this.rotationUntil = now + CONFIG.motion.settleMs;
  }
  snapshot(): Track[] {
    return this.running && this.enabled ? this.memory.snapshot(this.now()) : [];
  }
  get enabledNow(): boolean {
    return this.enabled;
  }
  get feedback(): string {
    if (this.state === 'disabled')
      return 'Desligada. Ative em Ajustes para avaliar objetos locais junto com o Luna.';
    if (this.state === 'waiting') return 'Ativada nesta página; aguarda uma sessão Luna.';
    if (this.state === 'loading' || this.state === 'error') return this.statusMessage;
    if (this.state === 'stopped') return 'Sessão local encerrada.';
    if (this.now() < this.rotationUntil)
      return 'Posições locais retiradas; aguardando o fim do giro detectado.';
    if (this.lastResultAt === null || this.now() - this.lastResultAt > CONFIG.continuous.maxAgeMs)
      return 'Sem observação local recente. Isso não indica ausência de objetos.';
    return this.statusMessage;
  }
  diagnostics(): object {
    return {
      ...(this.pipeline?.diagnostics() ?? { accepted: 0, inFlight: 0, pendingFrames: 0 }),
      state: this.state,
      enabled: this.enabled,
      outputGate: 'observation-only-no-local-speech-or-paid-triggers',
      detector: this.adapter?.diagnostics?.() ?? this.lastAdapterDiagnostic,
      memory: this.memory.diagnostics(this.now()),
      lastResultAgeMs:
        this.lastResultAt === null ? null : Math.max(0, this.now() - this.lastResultAt),
    };
  }
  private release(): void {
    this.epoch++;
    this.initialization?.abort();
    this.initialization = null;
    this.lastAdapterDiagnostic = this.adapter?.diagnostics?.() ?? this.lastAdapterDiagnostic;
    this.pipeline?.stop();
    this.adapter = null;
  }
  stop(): void {
    this.release();
    this.running = false;
    this.memory.invalidateView();
    this.state = this.enabled ? 'stopped' : 'disabled';
  }
}
