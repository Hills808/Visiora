import { VisualMemory } from '../brain/visual-memory.js';
import type { Question, Utterance } from '../brain/types.js';
import { CONFIG } from '../config.js';
import { bearingFromX, DIRECTIONS, sectorOf } from '../brain/geometry.js';
import { el, text } from '../ui/render.js';
import { AnalysisError, gatewayStatus, LunaClient, type GatewayStatus } from './luna-client.js';
import { SnapshotCamera } from './snapshot-camera.js';
import { AutoAnalysis } from './auto-analysis.js';
import { compareViews } from './view-change.js';
import { SnapshotView } from './snapshot-view.js';
import { LocalPipeline } from '../perception/local-pipeline.js';
import type { LocalPerceptionAdapter } from '../perception/frame.js';

interface Hooks {
  message(value: string): void;
  present(value: Utterance): void;
  cancelSpeech(): void;
  ended(): void;
  canAnalyze(): boolean;
  announce(message: string): void;
}
export class OnlineSession {
  private client = new LunaClient();
  private memory = new VisualMemory();
  private camera: SnapshotCamera;
  private local: LocalPipeline | null = null;
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
  private analyzedView: readonly number[] = [];
  private resultView: SnapshotView | null = null;
  private pendingView: SnapshotView | null = null;
  private referencesVisible = false;
  diagnostics(): object {
    return {
      deliveryPolicy: CONFIG.online.deliveryPolicyRevision,
      ...this.counts,
      lastError: this.lastError,
      running: this.running,
      pending: this.pending,
      paused: this.automatic.isPaused,
      recovering: this.automatic.recovering,
      capture: this.camera.hub.diagnostics(),
      local: this.local?.diagnostics() ?? { state: 'disabled', reason: 'model-not-selected' },
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
  } | null = null;
  constructor(
    video: HTMLVideoElement,
    private hooks: Hooks,
    private localFactory?: () => LocalPerceptionAdapter,
  ) {
    this.camera = new SnapshotCamera(
      video,
      () => undefined, // Pixel motion is not measured body rotation; it must not starve analysis.
      () => this.hooks.ended(),
    );
    this.camera.hub.subscribe((frame) => {
      this.observeViews();
      this.withdrawDirections();
      this.local?.offer(frame);
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
    this.lastError = null;
    this.analyzedView = [];
    this.resultView = null;
    this.pendingView = null;
    this.referencesVisible = false;
    this.automatic.reset();
    try {
      this.local?.stop();
      this.local = this.localFactory
        ? new LocalPipeline(
            generation,
            this.localFactory(),
            () => {
              // H1 checks transport. No local facts feed speech before the H2/H3 quality gate.
            },
            () => {
              this.hooks.message(
                'Acompanhamento local indisponível. A análise por capturas continua.',
              );
              this.hooks.announce(
                'Acompanhamento local indisponível. A análise por capturas continua.',
              );
            },
          )
        : null;
      await this.camera.start(generation);
    } catch (error) {
      this.stop();
      throw error;
    }
  }
  stop(): void {
    this.generation++;
    this.running = false;
    this.pending = false;
    this.current = null;
    this.waiting = null;
    this.client.cancel();
    this.local?.stop();
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
          ? DIRECTIONS[sectorOf(bearingFromX(item.box.x + item.box.width / 2))]
          : 'sem posição estimada';
        row.textContent = `${label}${item.uncertain ? ' (incerto)' : ''} — ${direction} na imagem — captura analisada, pode ter mudado`;
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
        this.pending || !this.hooks.canAnalyze(),
      )
    )
      void this.ask('describe', '', true);
  }
  get ready(): boolean {
    return this.running && this.camera.ready;
  }
  get feedbackState(): string {
    return this.automatic.recovering
      ? 'Aguardando nova captura'
      : this.automatic.isPaused
        ? 'Acompanhamento pausado'
        : 'Acompanhamento ativo';
  }
  async ask(question: Question, term = '', automatic = false): Promise<void> {
    if (!this.running) return;
    if (this.pending) {
      this.hooks.message('Aguarde a análise em andamento.');
      return;
    }
    if (!this.camera.ready) {
      this.hooks.message('Aguardando o primeiro quadro recente da câmera.');
      return;
    }
    this.hooks.cancelSpeech();
    this.current = null;
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
      view.observe(this.camera.signature);
      if (!this.memory.accept(result, performance.now(), generation)) {
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
        this.automatic.invalidate();
        this.clearReferences();
      } else this.render();
      this.present(false, automatic, newView);
      this.hooks.message(
        changedView
          ? 'O enquadramento mudou durante a análise. Mantive apenas o contexto da captura; a próxima análise usará uma imagem recente.'
          : 'Acompanhamento ativo. Captura analisada; aguardando mudança relevante para o próximo envio.',
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
    };
    this.displayedAt = this.memory.pendingCapturedAt;
    this.hooks.present(utterance);
  }
  canStart(id: string): boolean {
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
      value.started = true;
      value.startedAtMs ??= performance.now();
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
        this.counts.delivered++;
        this.automatic.delivered();
        this.lastError = null;
      }
      this.current = null;
      return completed;
    }
    return false;
  }
  showText(id: string): boolean {
    if (this.canStart(id)) {
      return this.complete(id);
    }
    return false;
  }
  private observeViews(): void {
    this.pendingView?.observe(this.camera.signature);
    if (this.resultView?.observe(this.camera.signature)) {
      this.memory.forgetDirections();
      this.clearReferences();
    }
  }
  private withdrawDirections(): void {
    const value = this.current;
    const now = performance.now();
    if (
      value?.startedAtMs !== null &&
      value?.startedAtMs !== undefined &&
      now - value.startedAtMs > CONFIG.speech.maxOnlineSpeechMs
    ) {
      this.current = null;
      this.waiting = null;
      this.automatic.pause();
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
    this.waiting = { repeat: false, automatic: true, newView: false };
    this.counts.obsolete++;
    this.automatic.invalidate();
    this.clearReferences();
    this.hooks.cancelSpeech();
  }
}
