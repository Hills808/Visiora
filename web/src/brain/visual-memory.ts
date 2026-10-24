import { CONFIG } from '../config.js';
import { bearingFromX } from './geometry.js';
import { snapshotSpeech, type SnapshotPhrase } from './snapshot-speech.js';
import type { AnalysisResult } from '../perception/evidence.js';
import {
  SnapshotDiscourse,
  snapshotGroups,
  snapshotItem,
  normalizeVisual as normalize,
  type SnapshotDelivery,
} from './snapshot-discourse.js';
import type { Utterance } from './types.js';
/** On-demand snapshots, deliberately separate from the live World and its closed local lexicon. */
export class VisualMemory {
  private result: AnalysisResult | null = null;
  private last: { result: AnalysisResult; text: string; maxWords: number } | null = null;
  private serial = 0;
  private discourse = new SnapshotDiscourse();
  private acceptedRequests = new Set<string>();
  private directionsValid = false;
  private pending: {
    id: string;
    result: AnalysisResult;
    text: string;
    acknowledgment?: SnapshotDelivery;
    maxWords: number;
  } | null = null;
  invalidate(): void {
    this.result = null;
    this.pending = null;
    this.directionsValid = false;
    this.acceptedRequests.clear();
  }
  get pendingCapturedAt(): number | null {
    return this.pending?.result.stamp.capturedAtMs ?? null;
  }
  clear(): void {
    this.result = null;
    this.last = null;
    this.pending = null;
    this.discourse.clear();
    this.directionsValid = false;
    this.acceptedRequests.clear();
  }
  accept(result: AnalysisResult, now: number, generation: number): boolean {
    const sameFrame = result.stamp.frameId === this.result?.stamp.frameId;
    if (
      result.stamp.sessionGeneration !== generation ||
      now < result.stamp.capturedAtMs ||
      now - result.stamp.capturedAtMs > CONFIG.online.snapshotMaxAgeMs ||
      (this.result && result.stamp.frameId < this.result.stamp.frameId) ||
      (sameFrame &&
        (this.acceptedRequests.has(result.stamp.requestId) ||
          this.acceptedRequests.size >= CONFIG.online.snapshotRequestMemoryLimit ||
          result.stamp.capturedAtMs !== this.result!.stamp.capturedAtMs ||
          result.stamp.width !== this.result!.stamp.width ||
          result.stamp.height !== this.result!.stamp.height))
    )
      return false;
    // Another question may reuse this frame; never renew its age or accept a replayed result.
    if (!sameFrame) this.acceptedRequests.clear();
    this.acceptedRequests.add(result.stamp.requestId);
    this.result = result;
    if (!sameFrame) this.directionsValid = true;
    this.discourse.observe(result);
    return true;
  }
  get snapshot(): AnalysisResult | null {
    return this.result;
  }
  forgetDirections(): void {
    this.directionsValid = false;
    this.discourse.forgetDirections();
    this.pending = null;
  }
  private body(result: AnalysisResult, prefixWords: number): string {
    const { evidence: e, stamp: s } = result;
    if (s.intent === 'where')
      return e.scene
        ? `O ambiente parecia ${e.scene.label}.`
        : 'Não identifiquei o lugar nesta captura.';
    let items = e.observations.filter((i) => i.kind !== 'text' && i.box);
    if (s.intent === 'find')
      items = items.filter((i) =>
        normalize(i.kind === 'person' ? 'pessoa' : i.label).includes(normalize(s.term)),
      );
    if (s.intent === 'ahead')
      items = items.filter(
        (i) => Math.abs(bearingFromX(i.box!.x + i.box!.width / 2)) <= CONFIG.space.frontDegrees,
      );
    const prefix =
      s.intent === 'describe'
        ? e.scene
          ? `O ambiente parecia ${e.scene.label}. `
          : 'Não identifiquei o lugar nesta captura. '
        : '';
    const sentences: SnapshotPhrase[] = [];
    const budget =
      (s.intent === 'describe' ? CONFIG.speech.briefingWords : CONFIG.speech.maxWords) -
      prefixWords;
    for (const group of snapshotGroups(result, items)) {
      const sentence = snapshotItem(group);
      const candidate = (prefix + snapshotSpeech([...sentences, sentence])).trim();
      if (sentences.length >= CONFIG.speech.maxItems || candidate.split(/\s+/).length > budget)
        continue;
      sentences.push(sentence);
    }
    return (
      prefix +
      (snapshotSpeech(sentences) ||
        'Não reconheci referências com direção. Não garanto caminho livre.')
    );
  }
  utterance(
    now: number,
    repeat = false,
    automatic = false,
    newView = false,
    contextOnly = false,
  ): Utterance | null {
    const result = repeat ? this.last?.result : this.result;
    if (!result) return null;
    const age = Math.max(0, now - result.stamp.capturedAtMs);
    if (!repeat && age > CONFIG.online.snapshotMaxAgeMs) return null;
    contextOnly = !repeat && (contextOnly || !this.directionsValid);
    const label = result.source === 'fake' ? 'Simulação de análise. ' : '';
    const seconds = Math.max(1, Math.ceil(age / 1000));
    const prefix = `${label}Na imagem capturada há ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}: `;
    const prefixWords = prefix.trim().split(/\s+/).length;
    const automaticResult =
      automatic && !repeat ? this.discourse.plan(result, prefixWords, newView, contextOnly) : null;
    if (contextOnly && !automatic && !repeat && !result.evidence.scene) return null;
    if (automatic && !repeat && !automaticResult) return null;
    const body = repeat
      ? this.last!.text
      : automaticResult
        ? automaticResult.text
        : contextOnly
          ? 'O ambiente parecia ' + result.evidence.scene!.label + '.'
          : this.body(result, prefixWords);
    const id = `visual-${++this.serial}`;
    let outputBody = body;
    const maxWords = repeat
      ? this.last!.maxWords
      : automatic
        ? automaticResult!.briefing
          ? CONFIG.speech.briefingWords
          : CONFIG.speech.maxWords
        : result.stamp.intent === 'describe'
          ? CONFIG.speech.briefingWords
          : CONFIG.speech.maxWords;
    if ((prefix + body).trim().split(/\s+/).length > maxWords)
      outputBody = 'Não obtive referências curtas para esta resposta.';
    const text = prefix + outputBody;
    this.pending = {
      id,
      result,
      text: outputBody,
      maxWords,
      acknowledgment: outputBody === body ? automaticResult?.acknowledgment : undefined,
    };
    return {
      id,
      kind: 'answer',
      priority: 1,
      facts: [],
      createdAt: now,
      expiresAt: now + CONFIG.speech.answerTtlMs,
      text,
    };
  }
  complete(id: string, at = this.pending?.result.stamp.capturedAtMs ?? 0): boolean {
    if (id !== this.pending?.id) return false;
    const pending = this.pending;
    this.pending = null;
    if (pending.acknowledgment && !this.discourse.complete(pending.acknowledgment, at))
      return false;
    this.last = { result: pending.result, text: pending.text, maxWords: pending.maxWords };
    return true;
  }
}
