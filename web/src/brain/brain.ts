import { CONFIG } from '../config.js';
import { angularDistance } from './geometry.js';
import { findClass, LEX } from './lexicon.js';
import { describeGroup, oldMemory, words } from './realizer.js';
import { SceneEstimator } from './scene.js';
import type {
  BrainOptions,
  Fact,
  Observation,
  Question,
  Utterance,
  SceneEvidence,
} from './types.js';
import { World } from './world.js';
interface Said {
  range?: number;
  t: number;
}
export class Brain {
  readonly world = new World();
  readonly scene = new SceneEstimator();
  options: BrainOptions = {
    stepLength: CONFIG.space.stepLength,
    verbosity: 'balanced',
    alerts: false,
    auto: true,
  };
  private spoken = new Map<string, Said>();
  private alerted = new Map<string, Said>();
  private pending: Utterance | null = null;
  private started = false;
  private initialEntities = new Set<string>();
  private request: { question: Question; arg: string } | null = null;
  private pendingRequest: { question: Question; arg: string } | null = null;
  private firstAt: number | null = null;
  private stableSince: number | null = null;
  private rotating = false;
  private briefingDone = false;
  private lastEnd = -Infinity;
  private lastAnswer = '';
  private lastSpokenScene: string | null = null;
  private sequence = 0;
  private currentTime = 0;
  acceptedFrames = 0;
  configure(options: Partial<BrainOptions>): void {
    Object.assign(this.options, options);
  }
  ingest(frame: Observation, now: number): boolean {
    if (!this.world.ingest(frame, now)) return false;
    this.acceptedFrames++;
    this.currentTime = now;
    if (this.firstAt === null) this.firstAt = now;
    this.rotating = Math.abs(frame.yawRate) > CONFIG.motion.maxYawRate || frame.moving === true;
    if (this.rotating) this.stableSince = null;
    else if (this.stableSince === null) this.stableSince = now;
    if (this.rotating) this.scene.clear();
    else this.scene.update(frame.scene, now);
    return true;
  }
  get isRotating(): boolean {
    return this.rotating;
  }
  ingestScene(evidence: SceneEvidence, now: number): boolean {
    if (
      this.rotating ||
      this.stableSince === null ||
      evidence.capturedAtMs < this.stableSince ||
      now - evidence.capturedAtMs > CONFIG.capture.maxFrameAgeMs ||
      evidence.capturedAtMs > now + CONFIG.capture.futureToleranceMs
    )
      return false;
    this.currentTime = now;
    return this.scene.update(evidence, now);
  }
  get active(): Utterance | null {
    return this.pending;
  }
  get saidCount(): number {
    return this.spoken.size;
  }
  facts(now = this.currentTime): Fact[] {
    return this.world.snapshot(now).filter((f) => f.confirmed);
  }
  ask(question: Question, arg = ''): void {
    this.request = { question, arg };
  }
  private material(f: Fact, memory: Map<string, Said>): boolean {
    const prior = memory.get(f.id);
    return (
      !prior ||
      (f.range !== undefined &&
        prior.range !== undefined &&
        f.range <= prior.range * CONFIG.world.approachRatio)
    );
  }
  private order(facts: Fact[]): Fact[] {
    return [...facts].sort(
      (a, b) =>
        LEX[b.cls].importance - LEX[a.cls].importance ||
        (a.range ?? Infinity) - (b.range ?? Infinity),
    );
  }
  private make(text: string, facts: Fact[], kind: Utterance['kind'], now: number): Utterance {
    this.started = false;
    const priority = { alert: 0, answer: 1, briefing: 2, novelty: 3 }[kind];
    this.pending = {
      id: `utterance-${++this.sequence}`,
      text,
      facts,
      kind,
      priority,
      createdAt: now,
      expiresAt: now + (kind === 'answer' ? CONFIG.speech.answerTtlMs : CONFIG.speech.ttlMs),
      ...((kind === 'briefing' ||
        (kind === 'answer' && text.startsWith(this.scene.describe(now)))) &&
      this.scene.current(now)
        ? { sceneCategory: this.scene.current(now)! }
        : {}),
    };
    if (this.pending.sceneCategory && this.scene.stamp) {
      this.pending.sceneFrameId = this.scene.stamp.frameId;
      this.pending.sceneCapturedAtMs = this.scene.stamp.capturedAtMs;
    }
    return this.pending;
  }
  private panorama(now: number, limit: number): { text: string; facts: Fact[] } {
    const visible = this.order(this.facts(now).filter((f) => f.visible));
    const sections: string[] = [this.scene.describe(now)];
    const selected: Fact[] = [];
    const sectors = [...new Set(visible.map((f) => f.sector))];
    for (const sector of sectors.slice(0, limit)) {
      const group = describeGroup(
        visible.filter((f) => f.sector === sector),
        this.options.stepLength,
      );
      if (words([...sections, group.text].join(' ')) <= CONFIG.speech.briefingWords) {
        sections.push(group.text);
        selected.push(...group.facts);
      }
    }
    if (!selected.length) sections.push('Ainda não reconheci referências suficientes.');
    return { text: sections.join(' '), facts: selected };
  }
  private answer(now: number, question: Question, arg: string): { text: string; facts: Fact[] } {
    const facts = this.order(this.facts(now));
    switch (question) {
      case 'describe':
        return this.panorama(now, this.options.verbosity === 'essential' ? 1 : 2);
      case 'where':
        return { text: this.scene.describe(now), facts: [] };
      case 'repeat':
        return { text: this.lastAnswer || 'Ainda não há uma descrição para repetir.', facts: [] };
      case 'find': {
        const cls = findClass(arg);
        if (!cls)
          return {
            text: 'Não conheço esse nome. Tente cadeira, mesa, pessoa ou porta.',
            facts: [],
          };
        const fact =
          facts.find((f) => f.cls === cls && f.visible) ?? facts.find((f) => f.cls === cls);
        if (!fact)
          return {
            text: `Ainda não vi ${LEX[cls].gender === 'f' ? 'uma' : 'um'} ${LEX[cls].name} nesta sessão.`,
            facts: [],
          };
        return !fact.visible || fact.age > CONFIG.world.oldMs
          ? oldMemory(fact, this.options.stepLength)
          : describeGroup([fact], this.options.stepLength);
      }
      case 'ahead': {
        const front = facts.filter(
          (f) => f.visible && angularDistance(f.bearing, 0) <= CONFIG.space.frontDegrees,
        );
        return front.length
          ? describeGroup(front, this.options.stepLength)
          : {
              text: 'Não identifiquei objetos à frente, mas não dá para garantir que o caminho esteja livre.',
              facts: [],
            };
      }
    }
  }
  next(now: number): Utterance | null {
    this.currentTime = now;
    if (this.pending && !this.started && now >= this.pending.expiresAt) this.drop(this.pending.id);
    if (
      this.rotating ||
      this.stableSince === null ||
      now - this.stableSince < CONFIG.motion.settleMs
    )
      return null;
    if (now - this.lastEnd < CONFIG.speech.minGapMs) return null;
    const visible = this.order(this.facts(now).filter((f) => f.visible));
    const alert = this.options.alerts
      ? visible.find(
          (f) =>
            f.range !== undefined &&
            angularDistance(f.bearing, 0) <= CONFIG.space.frontDegrees &&
            (f.range <= CONFIG.space.alertM || (f.cls === 'person' && f.approaching)) &&
            this.material(f, this.alerted),
        )
      : undefined;
    if (alert && (!this.pending || this.pending.priority > 0)) {
      if (this.pending) this.drop(this.pending.id);
      const rendered = describeGroup([alert], this.options.stepLength);
      return this.make(`Alerta experimental. ${rendered.text}`, rendered.facts, 'alert', now);
    }
    if (this.pending) return null;
    if (this.request) {
      const { question, arg } = this.request;
      this.request = null;
      const answer = this.answer(now, question, arg);
      const utterance = this.make(answer.text, answer.facts, 'answer', now);
      this.pendingRequest = { question, arg };
      return utterance;
    }
    if (!this.options.auto || this.firstAt === null || now - this.lastEnd < CONFIG.speech.gapMs)
      return null;
    if (!this.briefingDone) {
      if (now - this.firstAt < CONFIG.speech.briefingMs) return null;
      const panorama = this.panorama(now, 2);
      return this.make(panorama.text, panorama.facts, 'briefing', now);
    }
    const room = this.scene.current(now);
    if (room && room !== this.lastSpokenScene) {
      const utterance = this.make(this.scene.describe(now), [], 'novelty', now);
      utterance.sceneCategory = room;
      if (this.scene.stamp) {
        utterance.sceneFrameId = this.scene.stamp.frameId;
        utterance.sceneCapturedAtMs = this.scene.stamp.capturedAtMs;
      }
      return utterance;
    }
    const fresh = visible.filter(
      (f) =>
        (!this.initialEntities.has(f.id) || this.spoken.has(f.id)) && this.material(f, this.spoken),
    );
    if (!fresh.length) return null;
    if (this.options.verbosity === 'essential' && LEX[fresh[0].cls].importance < 0.7) return null;
    const rendered = describeGroup(fresh, this.options.stepLength);
    return this.make(rendered.text, rendered.facts, 'novelty', now);
  }
  confirm(id: string, now: number): boolean {
    if (!this.pending || this.pending.id !== id || !this.started || this.rotating) return false;
    const utterance = this.pending;
    for (const fact of utterance.facts) {
      this.spoken.set(fact.id, { range: fact.range, t: now });
      if (utterance.kind === 'alert') this.alerted.set(fact.id, { range: fact.range, t: now });
    }
    if (utterance.kind === 'briefing') {
      this.briefingDone = true;
      this.facts(now).forEach((f) => this.initialEntities.add(f.id));
    }
    this.lastEnd = now;
    this.lastAnswer = utterance.text;
    if (utterance.sceneCategory) this.lastSpokenScene = utterance.sceneCategory;
    this.pending = null;
    this.pendingRequest = null;
    return true;
  }
  start(id: string, now: number): boolean {
    if (!this.pending || this.pending.id !== id || now >= this.pending.expiresAt || this.rotating)
      return false;
    if (this.stableSince === null || now - this.stableSince < CONFIG.motion.settleMs) return false;
    const current = this.facts(now);
    // A queued sentence cannot describe a vanished object or its former direction as current.
    if (
      this.pending.facts.some(
        (fact) =>
          fact.visible &&
          !current.some(
            (latest) => latest.id === fact.id && latest.visible && latest.sector === fact.sector,
          ),
      )
    )
      return false;
    if (this.pending.sceneCategory && this.scene.current(now) !== this.pending.sceneCategory)
      return false;
    this.started = true;
    return true;
  }
  displayText(id: string): boolean {
    if (this.pending?.id !== id) return false;
    this.lastAnswer = this.pending.text;
    this.pending = null;
    this.pendingRequest = null;
    this.started = false;
    return true; // Text is available to repeat, but no entity is marked as spoken.
  }
  drop(id: string): boolean {
    if (this.pending?.id !== id) return false;
    if (this.started) this.lastEnd = this.currentTime;
    if (this.pendingRequest && !this.request) this.request = this.pendingRequest;
    this.pendingRequest = null;
    this.started = false;
    this.pending = null;
    return true;
  }
}
