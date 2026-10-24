import { CAPTURE_DIRECTIONS } from '../brain/snapshot-speech.js';
import { OnlineTiming, type DeliveryChannel } from './online-timing.js';
import { VisualMemory } from '../brain/visual-memory.js';
import type { Question, Utterance } from '../brain/types.js';
import { CONFIG } from '../config.js';
import { bearingFromX, sectorOf } from '../brain/geometry.js';
import { el, text } from '../ui/render.js';
import { AnalysisError, gatewayStatus, LunaClient, type GatewayStatus } from './luna-client.js';
import { SnapshotCamera } from './snapshot-camera.js';
import { AutoAnalysis } from './auto-analysis.js';
import { compareViews } from './view-change.js';
import { SnapshotView } from './snapshot-view.js';
import { ContinuousPerception } from '../perception/continuous.js';
import { YoloxAdapter } from '../perception/yolox-adapter.js';
import type { LocalPerceptionAdapter } from '../perception/frame.js';

interface Hooks {
  message(value: string): void;
  present(value: Utterance): void;
  cancelSpeech(): void;
  ended(): void;
  canAnalyze(): boolean;
  announce(message: string): void;
}
export type OnlineStopReason =
  | 'user'
  | 'camera-ended'
  | 'start-failed'
  | 'background'
  | 'pagehide'
  | 'data-cleared'
  | 'mode-switch';
export class OnlineSession {
  private timing = new OnlineTiming();
  private cameraRotationInvalidations = 0;
  private unusableResponses = 0;
  private sceneNoticeAnnounced = false;
  private client = new LunaClient();
  private memory = new VisualMemory();
  private camera: SnapshotCamera;
  private continuous: ContinuousPerception;
  private status: GatewayStatus | null = null;
  private generation = 0;
  private running = false;
  private pending = false;
  private automatic = new AutoAnalysis();
  private displayedAt: number | null = null;
  private waiting: { repeat: boolean; automatic: boolean; newView: boolean } | null = null;
  private counts = {
    dispatched: 0,
    accepted: 0,
    obsolete: 0,
    silent: 0,
    delivered: 0,
    recoveries: 0,
  };
  private lastError: string | null = null;
  private sessionEnd: { reason: OnlineStopReason; pendingAtStop: boolean } | null = null;
  private analyzedView: readonly number[] = [];
  private resultView: SnapshotView | null = null;
  private pendingView: SnapshotView | null = null;
  private referencesVisible = false;
  diagnostics(): object {
    return {
      deliveryPolicy: CONFIG.online.deliveryPolicyRevision,
      ...this.counts,
      timing: this.timing.diagnostics(),
      cameraRotationInvalidations: this.cameraRotationInvalidations,
      unusableResponses: this.unusableResponses,
      lastError: this.lastError,
      sessionEnd: this.sessionEnd,
      running: this.running,
      pending: this.pending,
      paused: this.automatic.isPaused,
      recovering: this.automatic.recovering,
      capture: this.camera.hub.diagnostics(),
      local: this.continuous.diagnostics(),
    };
  }
  private current: {
    id: string;
    repeat: boolean;
    capturedAtMs: number;
    generation: number;
    view: SnapshotView | null;
    contextOnly: boolean;
    expiresAt: number;
    started: boolean;
    startedAtMs: number | null;
    preparedAtMs: number;
    channel: DeliveryChannel;
    automatic: boolean;
  } | null = null;
  constructor(
    video: HTMLVideoElement,
    private hooks: Hooks,
    localFactory?: () => LocalPerceptionAdapter,
  ) {
    this.continuous = new ContinuousPerception(
      localFactory
        ? async () => localFactory()
        : (signal, status) => YoloxAdapter.create(signal, status),
      () => performance.now(),
      () =>
        this.hooks.announce(
          'A percepção local não está disponível. Confira também o estado da análise Luna.',
        ),
    );
    if (localFactory) this.continuous.setEnabled(true);
    this.camera = new SnapshotCamera(
      video,
      () => undefined, // Pixel motion is not measured body rotation; it must not starve analysis.
      () => this.hooks.ended(),
    );
    this.camera.hub.subscribe((frame) => {
      this.observeViews();
      this.withdrawDirections();
      this.continuous.offer(frame, this.camera.signature);
    });
    el<HTMLInputElement>('cloud-consent').addEventListener('change', () => {
      if (
        !el<HTMLInputElement>('cloud-consent').checked &&
        this.running &&
        this.status?.provider === 'luna'
      )
        this.hooks.ended();
    });
  }
  async refresh(): Promise<void> {
    this.status = await gatewayStatus();
    text('luna-config', this.status.message);
  }
  get simulated(): boolean {
    return this.status?.provider === 'fake';
  }
  get place(): string {
    return this.memory.snapshot?.evidence.scene?.label ?? '';
  }
  setLocalEnabled(enabled: boolean): void {
    this.continuous.setEnabled(enabled);
  }
  get localEnabled(): boolean {
    return this.continuous.enabledNow;
  }
  get localStatus(): string {
    return this.continuous.feedback;
  }
  get localTracks() {
    return this.continuous.snapshot();
  }
  get capturedAt(): number | null {
    return this.displayedAt;
  }
  async start(): Promise<void> {
    const generation = this.generation;
    await this.refresh();
    if (generation !== this.generation) return;
    if (!this.status?.ready) throw new Error(this.status?.message);
    if (!this.simulated && !el<HTMLInputElement>('cloud-consent').checked)
      throw new Error('Autorize o envio das imagens à OpenAI antes de iniciar o modo Luna.');
    this.running = true;
    this.counts = {
      dispatched: 0,
      accepted: 0,
      obsolete: 0,
      silent: 0,
      delivered: 0,
      recoveries: 0,
    };
    this.timing = new OnlineTiming();
    this.cameraRotationInvalidations = 0;
    this.unusableResponses = 0;
    this.sceneNoticeAnnounced = false;
    this.lastError = null;
    this.sessionEnd = null;
    this.analyzedView = [];
    this.resultView = null;
    this.pendingView = null;
    this.referencesVisible = false;
    this.automatic.reset();
    try {
      this.continuous.start(generation);
      await this.camera.start(generation);
    } catch (error) {
      this.stop('start-failed');
      throw error;
    }
  }
  stop(reason: OnlineStopReason = 'user'): void {
    if (this.running || this.pending) this.sessionEnd = { reason, pendingAtStop: this.pending };
    if (this.current || this.pending || this.waiting) this.timing?.withdrew('cancellation');
    this.generation++;
    this.running = false;
    this.pending = false;
    this.current = null;
    this.waiting = null;
    this.client.cancel();
    this.continuous.stop();
    this.camera.stop();
    this.memory.clear();
    this.analyzedView = [];
    this.resultView = null;
    this.pendingView = null;
    this.referencesVisible = false;
    this.displayedAt = null;
    this.automatic.pause();
    el<HTMLInputElement>('cloud-consent').checked = false;
  }
  private clearReferences(
    message = 'O enquadramento mudou; as posições da captura anterior foram retiradas.',
  ): void {
    this.referencesVisible = false;
    text('reference-count', '0');
    text('nav-count', '0');
    for (const id of ['references', 'environment-list']) {
      const note = document.createElement('p');
      note.className = 'empty-note';
      note.textContent = message;
      el(id).replaceChildren(note);
    }
  }
  private render(): void {
    this.referencesVisible = true;
    const snapshot = this.memory.snapshot;
    const items = snapshot?.evidence.observations ?? [];
    text('reference-count', String(items.length));
    text('nav-count', String(items.length));
    for (const id of ['references', 'environment-list']) {
      const list = el(id);
      list.replaceChildren();
      for (const item of items) {
        const row = document.createElement('p');
        const label = item.kind === 'person' ? 'pessoa' : item.label;
        const direction = item.box
          ? CAPTURE_DIRECTIONS[sectorOf(bearingFromX(item.box.x + item.box.width / 2))]
          : 'sem posição estimada';
        row.textContent = `${label}${item.uncertain ? ' (incerto)' : ''} — ${direction} na captura passada — pode ter mudado`;
        list.append(row);
      }
      if (!items.length) {
        const note = document.createElement('p');
        note.textContent = 'A análise não identificou referências. Isso não garante caminho livre.';
        list.append(note);
      }
    }
  }
  tick(): void {
    this.observeViews();
    if (
      this.referencesVisible &&
      (!this.ready ||
        (this.memory.snapshot &&
          performance.now() - this.memory.snapshot.stamp.capturedAtMs >
            CONFIG.online.snapshotMaxAgeMs))
    )
      this.clearReferences('As posições da última captura expiraram; aguarde uma análise recente.');
    this.withdrawDirections();
    if (this.waiting && this.ready && this.hooks.canAnalyze()) {
      const waiting = this.waiting;
      this.waiting = null;
      this.present(waiting.repeat, waiting.automatic, waiting.newView);
      return;
    }
    if (
      this.running &&
      this.automatic.due(
        performance.now(),
        this.camera.signature,
        this.camera.ready,
        this.pending || Boolean(this.current) || !this.hooks.canAnalyze(),
      )
    )
      void this.ask('describe', '', true);
  }
  get ready(): boolean {
    return this.running && this.camera.ready;
  }
  get feedbackState(): string {
    if (!this.running) return 'Acompanhamento parado';
    if (this.automatic.isPaused) return 'Acompanhamento pausado';
    if (this.automatic.recovering) return 'Recuperando; aguardando nova captura';
    if (this.pending) return 'Analisando uma captura';
    if (this.current || this.waiting || !this.hooks.canAnalyze())
      return 'Aguardando saída da descrição';
    if (this.unusableResponses >= CONFIG.online.obsoleteNoticeAfter)
      return 'A cena mudou antes da análise; sem descrição recente';
    const snapshot = this.memory.snapshot;
    if (
      !this.resultView?.valid ||
      !snapshot ||
      performance.now() - snapshot.stamp.capturedAtMs > CONFIG.online.snapshotMaxAgeMs
    )
      return 'Sem descrição recente; aguardando captura';
    return 'Captura analisada; aguardando mudança relevante';
  }
  async ask(question: Question, term = '', automatic = false): Promise<void> {
    if (!this.running) return;
    if (automatic && (this.current || this.waiting || !this.hooks.canAnalyze())) return;
    if (this.pending) {
      this.hooks.message('Aguarde a análise em andamento.');
      return;
    }
    if (!this.camera.ready) {
      this.hooks.message('Aguardando o primeiro quadro recente da câmera.');
      return;
    }
    if (this.current) this.timing?.withdrew('cancellation');
    this.current = null;
    this.hooks.cancelSpeech();
    this.waiting = null;
    if (question === 'repeat') {
      this.present(true);
      return;
    }
    this.pending = true;
    const generation = this.generation;
    let dispatched = false;
    try {
      const signature = this.camera.signature.slice();
      const newView =
        this.resultView?.valid === false || compareViews(this.analyzedView, signature).broad;
      const view = new SnapshotView(signature);
      this.pendingView = view;
      const capture = await this.camera.capture();
      if (!this.running || generation !== this.generation) return;
      this.automatic.dispatched(performance.now(), signature);
      this.counts.dispatched++;
      dispatched = true;
      this.hooks.message('Analisando uma imagem. A câmera continua acompanhando as mudanças.');
      const result = await this.client.analyze(
        capture.image,
        {
          requestId: crypto.randomUUID(),
          sessionGeneration: generation,
          frameId: capture.frameId,
          capturedAtMs: capture.capturedAtMs,
          width: capture.width,
          height: capture.height,
          intent: question,
          term: question === 'find' ? term.trim() : '',
        },
        this.status!,
        el<HTMLInputElement>('cloud-consent').checked,
      );
      if (!result || generation !== this.generation || !this.running) return;
      this.timing?.responded(capture.capturedAtMs, performance.now(), this.simulated);
      view.observe(this.camera.signature);
      if (!this.memory.accept(result, performance.now(), generation)) {
        if (performance.now() - capture.capturedAtMs > CONFIG.online.snapshotMaxAgeMs)
          this.timing?.withdrew('expiration');
        throw new AnalysisError(
          'A resposta chegou tarde demais para descrever esta captura.',
          true,
          'response-expired',
        );
      }
      if (!view.valid) this.memory.forgetDirections();
      this.counts.accepted++;
      this.analyzedView = signature;
      this.resultView = view;
      this.automatic.succeeded();
      this.lastError = null;
      const changedView = !view.valid;
      if (changedView) {
        this.counts.obsolete++;
        this.timing?.withdrew('view');
        this.automatic.invalidate();
        this.clearReferences();
      } else {
        this.render();
      }
      if (changedView && automatic) this.noteUnusableResponse();
      else this.present(false, automatic, newView);
      this.hooks.message(
        changedView
          ? 'A cena mudou antes da análise; sem descrição recente. A próxima análise usará uma nova captura.'
          : 'Captura analisada; aguardando mudança relevante para o próximo envio.',
      );
    } catch (error) {
      if (!dispatched && !this.camera.ready) return;
      if (generation === this.generation && this.running) {
        this.lastError = error instanceof AnalysisError ? error.code : 'analysis-invalid';
        const recovering = this.automatic.failed(
          performance.now(),
          error instanceof AnalysisError && error.transient,
        );
        if (recovering) {
          this.counts.recoveries++;
          const seconds = CONFIG.online.recoveryDelayMs / 1000;
          this.hooks.message(
            `Falha temporária. Uma nova captura será tentada em ${seconds} segundos, dentro do orçamento. Se falhar novamente, o acompanhamento será pausado.`,
          );
          this.hooks.announce(
            `Falha temporária. Vou tentar uma nova captura em ${seconds} segundos.`,
          );
          return;
        }
        const message = `Acompanhamento automático pausado. ${error instanceof Error ? error.message : 'A análise falhou.'} Pare e inicie novamente após conferir o problema.`;
        this.hooks.message(message);
        this.hooks.announce(
          `Acompanhamento pausado. ${error instanceof Error ? error.message : 'A análise falhou.'}`,
        );
      }
    } finally {
      if (generation === this.generation) {
        this.pending = false;
        this.pendingView = null;
      }
    }
  }
  private present(repeat: boolean, automatic = false, newView = false): void {
    if (
      !this.ready ||
      (automatic && !this.hooks.canAnalyze()) ||
      document.querySelector('dialog[open]')
    ) {
      this.waiting = { repeat, automatic, newView };
      return;
    }
    // Automatic historical context must not occupy the output before a replacement capture.
    if (automatic && !repeat && this.resultView?.valid === false) {
      this.automatic.invalidate();
      return;
    }
    const now = performance.now(),
      contextOnly = !repeat && this.resultView?.valid === false,
      utterance = this.memory.utterance(now, repeat, automatic, newView, contextOnly);
    if (contextOnly) this.clearReferences();
    if (!utterance) {
      if (automatic) this.counts.silent++;
      if (
        automatic &&
        this.memory.snapshot &&
        now - this.memory.snapshot.stamp.capturedAtMs > CONFIG.online.snapshotMaxAgeMs
      ) {
        this.expiredDelivery(now);
      }
      if (!automatic) this.hooks.message('Ainda não há uma descrição concluída para repetir.');
      return;
    }
    this.current = {
      id: utterance.id,
      repeat,
      capturedAtMs: this.memory.pendingCapturedAt!,
      generation: this.generation,
      view: this.resultView,
      contextOnly,
      expiresAt: utterance.expiresAt,
      started: false,
      startedAtMs: null,
      preparedAtMs: now,
      channel: 'voice',
      automatic,
    };
    this.displayedAt = this.memory.pendingCapturedAt;
    this.hooks.present(utterance);
  }
  canStart(id: string, channel: DeliveryChannel = 'voice'): boolean {
    this.observeViews();
    this.withdrawDirections();
    const value = this.current;
    const accepted = Boolean(
      value &&
        value.id === id &&
        value.generation === this.generation &&
        this.running &&
        this.camera.ready &&
        performance.now() < value.expiresAt &&
        (value.repeat || performance.now() - value.capturedAtMs <= CONFIG.online.snapshotMaxAgeMs),
    );
    if (accepted && value) {
      if (!value.started) {
        const now = performance.now();
        this.timing?.started(
          value.capturedAtMs,
          value.preparedAtMs,
          now,
          channel,
          this.simulated,
          value.repeat,
        );
        value.startedAtMs = now;
        value.channel = channel;
      }
      value.started = true;
    }
    return accepted;
  }
  complete(id: string): boolean {
    this.observeViews();
    this.withdrawDirections();
    if (
      this.current?.id === id &&
      this.current.started &&
      this.running &&
      this.current.generation === this.generation
    ) {
      const completed = this.memory.complete(id, performance.now());
      if (completed) {
        if (this.current.startedAtMs !== null)
          this.timing?.completed(
            this.current.startedAtMs,
            performance.now(),
            this.current.channel,
            this.simulated,
            this.current.repeat,
          );
        if (!this.current.repeat && !this.current.contextOnly) {
          this.unusableResponses = 0;
          this.sceneNoticeAnnounced = false;
          this.automatic.delivered();
        }
        this.counts.delivered++;
        this.lastError = null;
      }
      this.current = null;
      return completed;
    }
    return false;
  }
  /** Output cancellation never acknowledges content; stale callbacks cannot retire a new delivery. */
  interrupted(id: string): void {
    if (this.current?.id !== id) return;
    this.current = null;
    this.waiting = null;
    this.timing?.withdrew('cancellation');
    this.automatic.invalidate();
  }
  showText(id: string): boolean {
    if (this.canStart(id, 'text')) {
      return this.complete(id);
    }
    return false;
  }
  /** Called only after an opted-in device rotation detector confirms rotation.
   * Retires captures, not the session: fresh captures still use the existing cadence/gates.
   */
  observeCameraRotation(): void {
    if (!this.running) return;
    this.continuous?.rotated();
    this.observeViews(true);
    this.withdrawDirections();
  }
  private observeViews(cameraRotation = false): void {
    const pendingChanged = cameraRotation
      ? this.pendingView?.invalidate()
      : this.pendingView?.observe(this.camera.signature);
    const resultChanged = cameraRotation
      ? this.resultView?.invalidate()
      : this.resultView?.observe(this.camera.signature);
    if (cameraRotation && (pendingChanged || resultChanged)) {
      this.cameraRotationInvalidations++;
      this.automatic.invalidate();
    }
    if (resultChanged) {
      this.memory.forgetDirections();
      this.automatic.invalidate();
      this.timing?.withdrew('view');
      this.clearReferences();
    }
  }
  private noteUnusableResponse(): void {
    this.unusableResponses++;
    if (this.unusableResponses >= CONFIG.online.obsoleteNoticeAfter && !this.sceneNoticeAnnounced) {
      this.sceneNoticeAnnounced = true;
      this.hooks.announce('A cena mudou antes da análise. Ainda não há descrição recente.');
    }
  }
  private expiredDelivery(now: number): void {
    this.timing?.withdrew('expiration');
    this.lastError = 'speech-expired';
    if (this.automatic.expiredSnapshot(now)) {
      this.counts.recoveries++;
      const seconds = CONFIG.online.recoveryDelayMs / 1000;
      const message = `A descrição não começou a tempo. Vou tentar uma captura recente em ${seconds} segundos, dentro do orçamento.`;
      this.hooks.message(message);
      this.hooks.announce(message);
    } else {
      const message =
        'A descrição não começou a tempo em duas capturas. O acompanhamento foi pausado.';
      this.hooks.message(message);
      this.hooks.announce(message);
    }
  }
  private withdrawDirections(): void {
    const value = this.current;
    const now = performance.now();
    if (value && !value.started && (value.repeat || value.contextOnly) && now >= value.expiresAt) {
      this.current = null;
      this.waiting = null;
      this.timing?.withdrew('expiration');
      this.hooks.cancelSpeech();
      return;
    }
    if (
      value &&
      !value.started &&
      !value.repeat &&
      !value.contextOnly &&
      value.view?.valid !== false &&
      (now >= value.expiresAt || now - value.capturedAtMs > CONFIG.online.snapshotMaxAgeMs)
    ) {
      this.current = null;
      this.waiting = null;
      this.counts.obsolete++;
      this.clearReferences();
      this.expiredDelivery(now);
      this.hooks.cancelSpeech();
      return;
    }
    if (
      value?.startedAtMs !== null &&
      value?.startedAtMs !== undefined &&
      now - value.startedAtMs > CONFIG.speech.maxOnlineSpeechMs
    ) {
      this.current = null;
      this.waiting = null;
      this.automatic.pause();
      this.timing?.withdrew('cancellation');
      this.lastError = 'speech-timeout';
      this.clearReferences();
      this.hooks.cancelSpeech();
      const message = 'A voz demorou demais para concluir. O acompanhamento foi pausado.';
      this.hooks.message(message);
      this.hooks.announce(message);
      return;
    }
    if (
      !value ||
      value.repeat ||
      value.contextOnly ||
      (value.view?.valid !== false &&
        this.ready &&
        (value.started || now - value.capturedAtMs <= CONFIG.online.snapshotMaxAgeMs))
    )
      return;
    this.current = null;
    this.waiting =
      value.view?.valid === false && value.automatic
        ? null
        : { repeat: false, automatic: value.automatic ?? true, newView: false };
    this.counts.obsolete++;
    this.automatic.invalidate();
    this.clearReferences();
    this.hooks.cancelSpeech();
  }
}
