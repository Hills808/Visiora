import { CONFIG } from './config.js';
import { RecognitionTrace } from './diagnostics.js';
import { Brain } from './brain/brain.js';
import { LEX } from './brain/lexicon.js';
import { CAPTURE_DIRECTIONS } from './brain/snapshot-speech.js';
import type { Question, Utterance } from './brain/types.js';
import { Speaker } from './output/speaker.js';
import { Camera, type VisionResult } from './vision/camera.js';
import { OnlineSession, type OnlineStopReason } from './vision/online-session.js';
import { browserMotionHost, MotionInput } from './vision/motion-input.js';
import type { SceneStatus } from './vision/scene-model.js';
import type { SceneAnalysis } from './vision/scene.js';
import {
  DEFAULTS,
  clearData,
  history as readHistory,
  loadPreferences,
  recordHistory,
  savePreferences,
  type Preferences,
} from './storage.js';
import { SCENARIOS, scenarioFrame } from './sim/scenarios.js';
import { el, renderFacts, renderHistory, renderRadar, show, text } from './ui/render.js';

type Mode = 'idle' | 'loading' | 'camera' | 'luna' | 'demo';
let mode: Mode = 'idle';
let preferences: Preferences = { ...DEFAULTS };
let brain = new Brain();
const speaker = new Speaker();
const recognitionTrace = new RecognitionTrace();
let muted = false;
let voiceUnavailable = false;
let onlineNotice: string | null = null;
let generation = 0;
let frame = 0;
let demoYaw = 0;
let turningUntil = 0;
let sessionStarted = 0;
let longNotified = false;
let initialTextPending = true;
let lastRenderKey = '';
let sceneState: SceneStatus['state'] | 'idle' = 'idle';
let sceneMessage = '';
let sceneReason = '';
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let localDownloadWorker: Worker | null = null;
let localDownloadUrl: string | null = null;
let diagnosticUrl: string | null = null;
const metrics = {
  frames: 0,
  speechCompleted: 0,
  localLatencyMs: [] as number[],
  localResponseLatencyMs: [] as number[],
  localProvider: null as 'webgpu' | 'wasm' | null,
  sceneLatencyMs: [] as number[],
  sceneResponseLatencyMs: [] as number[],
  sceneSamples: 0,
  sceneAbstentions: 0,
  sceneRejectedFrames: 0,
  errors: 0,
};

function notice(message: string): void {
  text('toast', message);
  show('toast', true);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => show('toast', false), CONFIG.ui.toastMs);
}
function report(error: unknown): void {
  metrics.errors++;
  const message = error instanceof Error ? error.message : String(error);
  notice(message);
  console.error(JSON.stringify({ event: 'visiora_error', message }));
}
try {
  preferences = loadPreferences(localStorage);
} catch (error) {
  report(error);
}

function configure(): void {
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.classList.toggle('large', preferences.largeText);
  speaker.rate = preferences.rate;
  speaker.select(preferences.voiceURI);
  brain.configure({
    verbosity: preferences.verbosity,
    auto: preferences.output === 'voice' && !muted && !voiceUnavailable,
  });
  camera.economy = preferences.economy;
  text('speed', `${String(preferences.rate).replace('.', ',')}×`);
  el('speed').setAttribute('aria-label', `Velocidade da voz: ${preferences.rate} vezes`);
  text(
    'narration-note',
    preferences.output === 'reader'
      ? 'Seu leitor de tela controla a fala. O Luna publica descrições automáticas; no modo local, use os botões para perguntar.'
      : 'O Visiora fica em silêncio quando nada relevante muda. Você pode pedir outra descrição quando quiser.',
  );
}
function setMode(next: Mode): void {
  mode = next;
  motion.setRunning(next === 'luna' && !document.hidden);
  renderMotion();
  show('capture-state', next === 'luna');
  const active = next === 'demo' || next === 'camera' || next === 'luna';
  el<HTMLSelectElement>('perception-provider').disabled = runningMode(next);
  text(
    'processing-badge',
    next === 'luna'
      ? online.simulated
        ? 'Análise simulada'
        : 'Luna · análise online'
      : 'Processamento local',
  );
  const running = next !== 'idle';
  text(
    'start',
    next === 'loading' ? 'Cancelar início' : running ? 'Parar ambientação' : 'Iniciar ambientação',
  );
  text('demo', next === 'demo' ? 'Encerrar demonstração' : 'Experimentar demonstração');
  text(
    'source-badge',
    next === 'demo'
      ? 'Demonstração simulada'
      : next === 'luna'
        ? online.simulated
          ? 'Simulador de integração'
          : 'Luna · análise por capturas'
        : next === 'camera'
          ? 'Câmera local'
          : next === 'loading'
            ? 'Preparando…'
            : 'Câmera desligada',
  );
  el('source-badge').classList.toggle('demo', next === 'demo');
  text(
    'environment-source',
    next === 'demo'
      ? 'Cena simulada'
      : next === 'luna'
        ? 'Análise de imagem · direção aproximada'
        : next === 'camera'
          ? 'Câmera · sem distância'
          : 'Sem sessão ativa',
  );
  show('camera', next === 'camera' || next === 'luna');
  show('camera-empty', next === 'idle' || next === 'loading');
  show('demo-map', next === 'demo');
  show('demo-options', next === 'demo');
  document
    .querySelectorAll<HTMLButtonElement>('[data-ask], #search-open')
    .forEach((button) => (button.disabled = !active));
  el('status-dot').classList.toggle('live', active);
  if (next === 'idle') text('speech-state', 'Em pausa');
  else if (active)
    text('speech-state', preferences.output === 'reader' ? 'Sob demanda' : 'Aguardando');
  if (next === 'idle' || next === 'loading') {
    sceneState = 'idle';
    sceneReason = '';
  }
  renderScene();
}
function renderScene(): void {
  if (mode === 'camera' && sceneState === 'error')
    el<HTMLDetailsElement>('environment-details').open = true;
  if (mode === 'luna') {
    text(
      'scene-source',
      online.simulated ? 'Simulador · não mede reconhecimento' : 'Luna · capturas automáticas',
    );
    text(
      'scene-place',
      online.place
        ? `Na captura analisada, o ambiente parecia ${online.place}`
        : 'Aguardando a primeira análise do lugar',
    );
    text(
      'scene-note',
      'Acompanhamento por capturas automáticas, com atraso. Pode errar; não mede distância nem garante segurança.',
    );
    show('scene-retry', false);
    return;
  }
  const running = mode === 'camera' || mode === 'demo';
  text(
    'scene-source',
    mode === 'demo'
      ? 'Classificação simulada'
      : mode === 'camera'
        ? 'Análise da imagem inteira'
        : 'Sem sessão ativa',
  );
  text('scene-place', running ? brain.scene.describe(performance.now()) : 'Que lugar é este?');
  const note =
    mode === 'demo'
      ? 'O lugar é fornecido pelo simulador. Isso não mede o reconhecimento da câmera.'
      : mode !== 'camera'
        ? 'Inicie a câmera para analisar o ambiente pela imagem inteira.'
        : sceneState === 'loading' || sceneState === 'error'
          ? sceneMessage
          : brain.scene.current(performance.now())
            ? 'Resultado de imagens recentes. O reconhecimento ainda pode errar.'
            : sceneReason === 'poor-image'
              ? 'A imagem está sem detalhes suficientes para reconhecer o ambiente.'
              : sceneReason
                ? 'Ainda não há evidência suficiente. Experimente enquadrar mais do ambiente.'
                : 'Mantenha o aparelho estável por alguns instantes para analisar a cena.';
  text('scene-note', note);
  show('scene-retry', mode === 'camera' && sceneState === 'error');
}
function remember(utterance: Utterance): void {
  try {
    recordHistory(
      localStorage,
      {
        text: utterance.text,
        time: new Date().toISOString(),
        source: mode === 'demo' ? 'demo' : 'camera',
      },
      preferences,
    );
  } catch (error) {
    report(error);
  }
}
function present(utterance: Utterance): void {
  if (mode === 'luna') {
    presentOnline(utterance);
    return;
  }
  recognitionTrace.recordDescription(utterance);
  text('caption-age', recognitionTrace.label(performance.now()));
  text('caption', utterance.text);
  if (preferences.output === 'reader' || muted || voiceUnavailable) {
    text('screen-reader', '');
    if (preferences.output === 'reader') {
      const activeGeneration = generation;
      requestAnimationFrame(() => {
        if (generation === activeGeneration && preferences.output === 'reader' && mode !== 'idle')
          text('screen-reader', utterance.text);
      });
    }
    brain.displayText(utterance.id); // Publishing aria-live cannot confirm what a screen reader has actually spoken.
    text('speech-state', 'Descrição em texto');
    if (preferences.output === 'reader') remember(utterance);
    return;
  }
  speaker.speak(
    utterance,
    {
      start: () => {
        const accepted = brain.start(utterance.id, performance.now());
        if (accepted) {
          document.body.classList.add('is-speaking');
          text('speech-state', 'Falando');
        }
        return accepted;
      },
      end: () => {
        document.body.classList.remove('is-speaking');
        text('speech-state', 'Em silêncio');
        if (brain.confirm(utterance.id, performance.now())) {
          metrics.speechCompleted++;
          remember(utterance);
        }
      },
      drop: () => {
        brain.drop(utterance.id);
        document.body.classList.remove('is-speaking');
      },
      error: (message) => {
        voiceUnavailable = true;
        configure();
        report(new Error(message));
        text('speech-state', 'Voz indisponível');
      },
    },
    performance.now(),
  );
}
function resetBrain(): void {
  speaker.cancel();
  recognitionTrace.clear();
  text('caption-age', '');
  brain = new Brain();
  frame = 0;
  lastRenderKey = '';
  sessionStarted = performance.now();
  longNotified = false;
  initialTextPending = true;
  configure();
}
function stop(
  message = 'Ambientação parada. A câmera está desligada.',
  reason: OnlineStopReason = 'user',
): void {
  recognitionTrace.clear();
  text('caption-age', '');
  generation++;
  onlineNotice = null;
  camera.stop();
  online.stop(reason);
  speaker.cancel();
  brain = new Brain();
  configure();
  setMode('idle');
  text('status', message);
  text('caption', 'Sessão encerrada. Inicie novamente quando quiser.');
  text('preview-title', 'Um novo ponto de vista');
  text('preview-hint', 'Inicie a câmera ou explore uma cena de demonstração.');
  renderFacts([], false);
  text('screen-reader', '');
}
function receive(result: VisionResult): void {
  if (mode !== 'camera') return;
  metrics.frames++;
  metrics.localLatencyMs.push(Math.round(result.latencyMs));
  metrics.localResponseLatencyMs.push(Math.round(performance.now() - result.capturedAtMs));
  metrics.localProvider = result.provider ?? null;
  if (metrics.localLatencyMs.length > CONFIG.ui.diagnosticSamples) metrics.localLatencyMs.shift();
  if (metrics.localResponseLatencyMs.length > CONFIG.ui.diagnosticSamples)
    metrics.localResponseLatencyMs.shift();
  const accepted = brain.ingest(
    {
      frameId: result.frameId,
      capturedAtMs: result.capturedAtMs,
      detections: result.detections,
      pose: { x: 0, y: 0, yaw: 0 },
      yawRate: 0,
      moving: result.moving,
    },
    performance.now(),
  );
  if (accepted) recognitionTrace.recordObjects(result);
  text(
    'status',
    result.moving
      ? 'Mudança na imagem. Aguardando a câmera estabilizar…'
      : `Câmera ativa · visão local na ${result.provider === 'webgpu' ? 'GPU' : 'CPU'} · distância desconhecida`,
  );
}
function receiveScene(result: SceneAnalysis): void {
  if (mode !== 'camera') return;
  metrics.sceneSamples++;
  if (!result.accepted) metrics.sceneAbstentions++;
  metrics.sceneLatencyMs.push(Math.round(result.latencyMs));
  metrics.sceneResponseLatencyMs.push(Math.round(performance.now() - result.capturedAtMs));
  if (metrics.sceneLatencyMs.length > CONFIG.ui.diagnosticSamples) metrics.sceneLatencyMs.shift();
  if (metrics.sceneResponseLatencyMs.length > CONFIG.ui.diagnosticSamples)
    metrics.sceneResponseLatencyMs.shift();
  sceneReason = result.reason;
  if (!brain.ingestScene(result, performance.now())) {
    metrics.sceneRejectedFrames++;
    sceneReason = 'stale';
  } else recognitionTrace.recordScene(result);
  renderScene();
}
const camera = new Camera(
  el<HTMLVideoElement>('camera'),
  receive,
  (message) => {
    stop(message);
    report(new Error(message));
  },
  (status) => {
    sceneState = status.state;
    sceneMessage = status.message;
    if (status.state === 'error') {
      metrics.errors++;
      brain.scene.clear();
      if (brain.active?.sceneCategory) speaker.cancel();
    }
    renderScene();
  },
  receiveScene,
);
configure();

// Keep the cloud authorization beside the action only when it is relevant.
function syncAnalysisControls(): void {
  const cloud = el<HTMLSelectElement>('perception-provider').value === 'luna';
  const label = el<HTMLInputElement>('cloud-consent').closest('label');
  if (label) label.hidden = !cloud;
  show('luna-config', cloud);
  show('local-observer-settings', cloud);
  show('local-observer-panel', cloud);
}
el('perception-provider').addEventListener('change', syncAnalysisControls);
syncAnalysisControls();

function runningMode(next: Mode): boolean {
  return next !== 'idle';
}
const online = new OnlineSession(el<HTMLVideoElement>('camera'), {
  verbosity: () => preferences.verbosity,
  message: (value) => {
    text('status', value);
  },
  present,
  cancelSpeech: () => speaker.cancel(),
  ended: () => stop('Sessão Luna encerrada. Nenhuma nova imagem será enviada.', 'camera-ended'),
  canAnalyze: () =>
    !muted &&
    (preferences.output === 'reader' || !voiceUnavailable) &&
    !speaker.speaking &&
    !document.querySelector('dialog[open]'),
  announce: (message) => {
    onlineNotice =
      message.trim().split(/\s+/).length <= CONFIG.speech.maxWords
        ? message
        : 'O acompanhamento foi pausado por uma falha na análise. Pare e inicie novamente após verificar o problema.';
  },
});
const motion = new MotionInput(browserMotionHost(), () => online.observeCameraRotation());
let localRenderKey = '';
function renderContinuous(): void {
  text('local-observer-state', online.localStatus);
  text('local-observer-status', online.localStatus);
  const tracks = online.localTracks;
  const key = JSON.stringify(
    tracks.map((track) => [
      track.id,
      track.state,
      track.sector,
      Math.floor((performance.now() - track.lastObservedAt) / 1000),
    ]),
  );
  text(
    'local-observer-count',
    String(tracks.filter((track) => track.state === 'confirmed').length),
  );
  if (key === localRenderKey) return;
  localRenderKey = key;
  const rows = tracks.map((track) => {
    const row = document.createElement('p');
    const name = LEX[track.label]?.name ?? track.label;
    const age = Math.max(0, Math.floor((performance.now() - track.lastObservedAt) / 1000));
    const state =
      track.state === 'confirmed'
        ? 'associação confirmada em quadros distintos'
        : track.state === 'occluded'
          ? 'não confirmado nesta imagem; posição retirada'
          : 'candidato, aguardando novos quadros';
    row.textContent = `${name} — ${track.sector ? CAPTURE_DIRECTIONS[track.sector] + ' — ' : ''}${state} — observado há ${age} s.`;
    return row;
  });
  if (!rows.length) {
    const row = document.createElement('p');
    row.textContent =
      'Sem referências locais recentes. Isso não garante ausência de objetos ou caminho livre.';
    rows.push(row);
  }
  el('local-tracks').replaceChildren(...rows);
}
function renderMotion(): void {
  const button = el<HTMLButtonElement>('motion-toggle');
  button.textContent = motion.enabled ? 'Desativar leitura de giros' : 'Ativar leitura de giros';
  button.setAttribute('aria-pressed', String(motion.enabled));
  button.disabled = motion.requesting;
  if (el('motion-status').textContent !== motion.status) text('motion-status', motion.status);
}
void online.refresh();
function presentOnline(utterance: Utterance): void {
  text('caption', utterance.text);
  text('caption-age', 'Descrição de uma captura; não é uma visão contínua.');
  renderScene();
  if (preferences.output === 'reader' || muted || voiceUnavailable) {
    if (online.canStart(utterance.id, 'text')) {
      if (preferences.output === 'reader') text('screen-reader', utterance.text);
      const completed = online.showText(utterance.id);
      text('speech-state', 'Descrição em texto');
      if (completed && preferences.output === 'reader') remember(utterance);
    }
    return;
  }
  speaker.speak(
    utterance,
    {
      start: () => {
        const accepted = online.canStart(utterance.id) && !document.querySelector('dialog[open]');
        if (accepted) text('speech-state', 'Falando');
        return accepted;
      },
      end: () => {
        if (online.complete(utterance.id)) {
          metrics.speechCompleted++;
          remember(utterance);
        }
        text('speech-state', 'Em silêncio');
      },
      drop: () => {
        online.interrupted(utterance.id);
        text('speech-state', 'Descrição interrompida; aguardando atualização da vista');
      },
      error: (message) => {
        online.interrupted(utterance.id);
        voiceUnavailable = true;
        configure();
        notice(message);
      },
    },
    performance.now(),
  );
}

async function startCamera(): Promise<void> {
  if (mode !== 'idle') {
    stop();
    return;
  }
  resetBrain();
  setMode('loading');
  const attempt = ++generation;
  try {
    if (el<HTMLSelectElement>('perception-provider').value === 'luna') {
      await online.start();
      if (attempt !== generation) return;
      setMode('luna');
      text('caption', 'Preparando a primeira análise por captura.');
      text('status', 'Acompanhamento automático: analisa no início e quando o enquadramento muda.');
      initialTextPending = false;
      if (!speaker.voices().length && preferences.output === 'voice') {
        voiceUnavailable = true;
        configure();
        text(
          'speech-state',
          'Voz local pt-BR indisponível. Abra Ajustes; a análise automática aguarda uma saída disponível.',
        );
      }
      return;
    }
    await camera.start((message) => {
      if (attempt === generation) {
        text('status', message);
        text('preview-title', 'Preparando sua ambientação');
        text('preview-hint', message);
      }
    });
    if (attempt !== generation) return;
    sessionStarted = performance.now();
    setMode('camera');
    text('caption', 'Pronto. Olhando ao redor.');
    text('status', 'Câmera ativa. Mantenha o aparelho estável.');
    if (!speaker.voices().length && preferences.output === 'voice') {
      voiceUnavailable = true;
      configure();
      notice(
        'Não encontrei uma voz local pt-BR. As descrições continuam em texto. Escolha o leitor de tela nos Ajustes.',
      );
    }
  } catch (error) {
    if (attempt !== generation) return;
    stop('Não foi possível iniciar a câmera. Você pode tentar novamente.', 'start-failed');
    const name = error instanceof DOMException ? error.name : '';
    report(
      name === 'NotAllowedError'
        ? new Error(
            'A câmera não foi autorizada. Permita o acesso nas configurações do navegador ou experimente a demonstração.',
          )
        : name === 'NotFoundError'
          ? new Error(
              'Nenhuma câmera foi encontrada. Conecte uma câmera ou explore a demonstração.',
            )
          : error,
    );
  }
}
function startDemo(): void {
  if (mode === 'demo') {
    stop();
    return;
  }
  stop('Ambientação parada. A câmera está desligada.', 'mode-switch');
  resetBrain();
  demoYaw = 0;
  setMode('demo');
  text('caption', 'Esta é uma cena simulada. A câmera não está sendo usada.');
  text('status', 'Demonstração · referências e distâncias simuladas');
  if (!speaker.voices().length && preferences.output === 'voice') {
    voiceUnavailable = true;
    configure();
    notice(
      'A demonstração funciona em texto. Para ouvir, escolha uma voz local ou seu leitor de tela nos Ajustes.',
    );
  }
}
function ask(question: Question, arg = ''): void {
  if (mode === 'luna') {
    void online.ask(question, arg);
    return;
  }
  if (mode === 'demo' || mode === 'camera') {
    brain.ask(question, arg);
    tick();
  }
}
function tick(): void {
  renderMotion();
  renderContinuous();
  if (mode === 'luna') {
    if (
      onlineNotice &&
      online.ready &&
      !speaker.speaking &&
      !muted &&
      !document.querySelector('dialog[open]')
    ) {
      const message = onlineNotice;
      onlineNotice = null;
      if (preferences.output === 'voice' && !voiceUnavailable) {
        const now = performance.now();
        speaker.speak(
          {
            id: 'automatic-paused',
            kind: 'answer',
            priority: 1,
            facts: [],
            createdAt: now,
            expiresAt: now + CONFIG.speech.answerTtlMs,
            text: message,
          },
          {
            start: () => online.ready,
            end: () => text('speech-state', online.feedbackState),
            drop: () => undefined,
            error: (message) => {
              voiceUnavailable = true;
              configure();
              notice(message);
            },
          },
          now,
        );
      } else if (preferences.output === 'reader') {
        text('screen-reader', message);
      } else {
        notice(message);
      }
    }
    online.tick();
    text('capture-state', online.feedbackState);
    renderScene();
    if (online.capturedAt !== null)
      text(
        'caption-age',
        `Captura de há ${Math.max(1, Math.floor((performance.now() - online.capturedAt) / 1000))} segundos. Pode ter mudado.`,
      );
    return;
  }
  if (mode !== 'camera' && mode !== 'demo') return;
  const now = performance.now();
  if (mode === 'demo') {
    const scenario =
      SCENARIOS.find((item) => item.id === el<HTMLSelectElement>('scenario').value) ?? SCENARIOS[0];
    const observation = scenarioFrame(scenario, now, ++frame, demoYaw);
    observation.yawRate = now < turningUntil ? CONFIG.ui.demoTurnRate : 0;
    brain.ingest(observation, now);
  }
  if (brain.isRotating && speaker.speaking) {
    speaker.cancel();
    text('speech-state', 'Aguardando estabilidade');
  }
  if (initialTextPending && now - sessionStarted >= CONFIG.speech.briefingMs) {
    initialTextPending = false;
    if (!brain.options.auto) brain.ask('describe');
  }
  const candidate = document.querySelector('dialog[open]') ? null : brain.next(now);
  if (candidate) present(candidate);
  renderScene();
  const facts = brain.facts(now);
  text('caption-age', recognitionTrace.label(now));
  const key = JSON.stringify(
    facts.map((f) => [f.id, f.cls, f.sector, f.visible, Math.floor(f.age / 1000)]),
  );
  if (key !== lastRenderKey) {
    renderFacts(facts, mode === 'demo');
    if (mode === 'demo') renderRadar(facts);
    lastRenderKey = key;
  }
  if (!longNotified && now - sessionStarted > CONFIG.ui.maxSessionMs) {
    longNotified = true;
    notice(
      'Você está usando a câmera há algum tempo. Considere uma pausa para poupar bateria e processamento.',
    );
  }
}
setInterval(tick, CONFIG.ui.tickMs);

function navigate(page: string): void {
  if (!['ambient', 'environment', 'history', 'help'].includes(page)) return;
  document
    .querySelectorAll<HTMLElement>('.view')
    .forEach((view) => (view.hidden = view.id !== `page-${page}`));
  document.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((button) => {
    const current = button.dataset.page === page;
    button.classList.toggle('active', current);
    if (current) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  text(
    'page-label',
    (
      {
        ambient: 'Ambientação',
        environment: 'Meu ambiente',
        history: 'Histórico',
        help: 'Ajuda e limites',
      } as Record<string, string>
    )[page],
  );
  if (page === 'history')
    try {
      renderHistory(readHistory(localStorage), preferences.keepHistory);
    } catch (error) {
      report(error);
    }
  window.history.replaceState(null, '', `#${page}`);
  el('main').focus({ preventScroll: true });
}
function populateVoices(): void {
  const select = el<HTMLSelectElement>('voice');
  select.replaceChildren();
  const voices = speaker.voices();
  for (const voice of voices) {
    const option = document.createElement('option');
    option.value = voice.voiceURI;
    option.textContent = voice.name;
    select.append(option);
  }
  if (!voices.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Nenhuma voz local pt-BR encontrada';
    select.append(option);
  } else {
    voiceUnavailable = false;
    speaker.select(preferences.voiceURI);
    select.value = speaker.voice?.voiceURI ?? '';
    configure();
  }
}
function openSettings(): void {
  speaker.cancel();
  const values: Record<string, string> = {
    output: preferences.output,
    rate: String(preferences.rate),
    verbosity: preferences.verbosity,
    theme: preferences.theme,
  };
  for (const [id, value] of Object.entries(values)) el<HTMLSelectElement>(id).value = value;
  for (const [id, value] of Object.entries({
    'large-text': preferences.largeText,
    economy: preferences.economy,
    'keep-history': preferences.keepHistory,
  }))
    el<HTMLInputElement>(id).checked = value;
  populateVoices();
  el<HTMLDialogElement>('settings').showModal();
}
el('settings-open').addEventListener('click', openSettings);
el('local-observer').addEventListener('change', () => {
  online.setLocalEnabled(el<HTMLInputElement>('local-observer').checked);
  renderContinuous();
});
el('motion-toggle').addEventListener('click', () => {
  if (motion.enabled) motion.disable();
  else {
    const permission = motion.enable();
    renderMotion();
    void permission.then(renderMotion);
  }
  renderMotion();
});
el('history-enable').addEventListener('click', openSettings);
el<HTMLFormElement>('settings-form').addEventListener('submit', (event) => {
  if ((event as SubmitEvent).submitter?.getAttribute('value') !== 'save') return;
  preferences = {
    output: el<HTMLSelectElement>('output').value as Preferences['output'],
    rate: Number(el<HTMLSelectElement>('rate').value),
    verbosity: el<HTMLSelectElement>('verbosity').value as Preferences['verbosity'],
    theme: el<HTMLSelectElement>('theme').value as Preferences['theme'],
    largeText: el<HTMLInputElement>('large-text').checked,
    economy: el<HTMLInputElement>('economy').checked,
    keepHistory: el<HTMLInputElement>('keep-history').checked,
    voiceURI: el<HTMLSelectElement>('voice').value,
  };
  speaker.cancel();
  configure();
  try {
    savePreferences(localStorage, preferences);
    notice('Ajustes salvos neste aparelho.');
  } catch (error) {
    report(error);
  }
  if (!el('page-history').hidden)
    try {
      renderHistory(readHistory(localStorage), preferences.keepHistory);
    } catch (error) {
      report(error);
    }
});
el('test-voice').addEventListener('click', () => {
  speaker.select(el<HTMLSelectElement>('voice').value);
  speaker.rate = Number(el<HTMLSelectElement>('rate').value);
  const now = performance.now();
  speaker.speak(
    {
      id: 'voice-test',
      text: 'Esta é a voz local do Visiora. Você escolhe quando ouvir.',
      kind: 'answer',
      priority: 1,
      facts: [],
      createdAt: now,
      expiresAt: now + CONFIG.speech.answerTtlMs,
    },
    {
      start: () => true,
      end: () => text('voice-note', 'A reprodução terminou. Você conseguiu ouvir?'),
      drop: () => text('voice-note', 'Teste de voz interrompido.'),
      error: (message) => text('voice-note', message),
    },
    now,
  );
});
el('start').addEventListener('click', () => void startCamera());
el('scene-retry').addEventListener('click', () => camera.retryScenes());
el('demo').addEventListener('click', startDemo);
el('scenario').addEventListener('change', () => {
  if (mode === 'demo') {
    stop();
    startDemo();
  }
});
el('demo-turn').addEventListener('click', () => {
  demoYaw += 45;
  turningUntil = performance.now() + CONFIG.ui.demoTurnMs;
  tick();
  notice('Giro simulado de 45 graus. A fala aguarda a cena estabilizar.');
});
el('mute').addEventListener('click', () => {
  muted = !muted;
  speaker.cancel();
  configure();
  el('mute').setAttribute('aria-pressed', String(muted));
  text('mute', muted ? 'Retomar voz' : 'Pausar voz');
  text(
    'speech-state',
    muted
      ? mode === 'luna'
        ? 'Voz e acompanhamento automático pausados'
        : 'Voz pausada'
      : 'Aguardando',
  );
});
el('speed').addEventListener('click', () => {
  const rates = [0.8, 1, 1.2, 1.5];
  preferences.rate = rates[(rates.indexOf(preferences.rate) + 1) % rates.length];
  configure();
  try {
    savePreferences(localStorage, preferences);
  } catch (error) {
    report(error);
  }
});
document
  .querySelectorAll<HTMLButtonElement>('[data-ask]')
  .forEach((button) => button.addEventListener('click', () => ask(button.dataset.ask as Question)));
document
  .querySelectorAll<HTMLButtonElement>('[data-page], [data-go]')
  .forEach((button) =>
    button.addEventListener('click', () =>
      navigate(button.dataset.page ?? button.dataset.go ?? 'ambient'),
    ),
  );
el('search-open').addEventListener('click', () =>
  el<HTMLDialogElement>('search-dialog').showModal(),
);
el<HTMLFormElement>('search-form').addEventListener('submit', (event) => {
  if ((event as SubmitEvent).submitter?.getAttribute('value') === 'search')
    ask('find', el<HTMLInputElement>('search-input').value);
});
el('clear-open').addEventListener('click', () => el<HTMLDialogElement>('clear-dialog').showModal());
el('clear-cancel').addEventListener('click', () => el<HTMLDialogElement>('clear-dialog').close());
el('clear-confirm').addEventListener('click', async () => {
  stop('Ambientação parada. A câmera está desligada.', 'data-cleared');
  motion.disable();
  online.setLocalEnabled(false);
  el<HTMLInputElement>('local-observer').checked = false;
  try {
    await clearData(localStorage);
    preferences = { ...DEFAULTS };
    muted = false;
    configure();
    renderHistory([], false);
    el<HTMLDialogElement>('clear-dialog').close();
    el<HTMLDialogElement>('settings').close();
    notice('Os dados do Visiora neste navegador foram apagados.');
  } catch (error) {
    report(error);
  }
});
el('export-diagnostics').addEventListener('click', () => {
  const payload = {
    version: CONFIG.version,
    date: new Date().toISOString(),
    source: mode,
    counterScopes: {
      frames: 'local-mode, page-lifetime',
      speechCompleted: 'all-modes, page-lifetime',
      errors: 'all-modes, page-lifetime',
      onlineContinuity: 'current-or-last-Luna-session',
    },
    frames: metrics.frames,
    speechCompleted: metrics.speechCompleted,
    errors: metrics.errors,
    rejectedFrames: brain.world.rejectedFrames,
    inferenceLatencyMs: metrics.localLatencyMs,
    localResponseLatencyMs: metrics.localResponseLatencyMs,
    localProvider: metrics.localProvider,
    sceneInferenceLatencyMs: metrics.sceneLatencyMs,
    sceneResponseLatencyMs: metrics.sceneResponseLatencyMs,
    sceneSamples: metrics.sceneSamples,
    sceneAbstentions: metrics.sceneAbstentions,
    sceneRejectedFrames: metrics.sceneRejectedFrames,
    recognitionProvenance: recognitionTrace.snapshot(),
    onlineContinuity: online.diagnostics(),
    cameraRotation: motion.diagnostics(),
  };
  if (diagnosticUrl) URL.revokeObjectURL(diagnosticUrl);
  diagnosticUrl = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = diagnosticUrl;
  link.download = 'visiora-diagnostico.json';
  link.click();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
    stop();
    return;
  }
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    document.querySelector('dialog[open]') ||
    (event.target instanceof Element &&
      event.target.closest('input, select, textarea, button, a, summary, [contenteditable]'))
  )
    return;
  const key = event.key.toLowerCase();
  if (key === ' ') {
    event.preventDefault();
    void startCamera();
  }
  if (key === 'escape') stop();
  if (key === 'f') ask('ahead');
  if (key === 'd') ask('describe');
  if (key === 'r') ask('repeat');
  if (key === 'p' && (mode === 'demo' || mode === 'camera' || mode === 'luna'))
    el<HTMLDialogElement>('search-dialog').showModal();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode !== 'idle')
    stop('Sessão parada porque a página ficou em segundo plano.', 'background');
});
window.addEventListener('pagehide', () => {
  motion.setRunning(false);
  camera.stop();
  online.stop('pagehide');
  localDownloadWorker?.terminate();
  if (localDownloadUrl) URL.revokeObjectURL(localDownloadUrl);
  if (diagnosticUrl) URL.revokeObjectURL(diagnosticUrl);
});
if (typeof speechSynthesis !== 'undefined')
  speechSynthesis.addEventListener('voiceschanged', populateVoices);
populateVoices();
if (location.hash) navigate(location.hash.slice(1));

el('local-download').addEventListener('click', () => {
  const button = el<HTMLButtonElement>('local-download');
  button.disabled = true;
  text(
    'download-state',
    'Preparando o pacote completo neste aparelho. O primeiro download inclui os modelos.',
  );
  const worker = new Worker(new URL('./download-worker.js', import.meta.url), { type: 'module' });
  localDownloadWorker = worker;
  let milestone = 0;
  const finish = (): void => {
    worker.terminate();
    if (localDownloadWorker === worker) localDownloadWorker = null;
    button.disabled = false;
  };
  worker.onerror = (event) => {
    text('download-state', 'O pacote não ficou pronto. Tente novamente.');
    report(new Error(event.message || 'Falha ao preparar o pacote local.'));
    finish();
  };
  worker.onmessage = (
    event: MessageEvent<{
      type: string;
      done?: number;
      total?: number;
      buffer?: ArrayBuffer;
      message?: string;
    }>,
  ): void => {
    if (localDownloadWorker !== worker) return;
    const data = event.data;
    if (data.type === 'progress' && data.done && data.total) {
      const progress = Math.floor((data.done / data.total) * 4);
      if (progress > milestone) {
        milestone = progress;
        text(
          'download-state',
          progress === 4
            ? 'Arquivos recebidos. Preparando o ZIP para baixar.'
            : `Baixando arquivos do pacote: ${progress * 25}%.`,
        );
      }
    } else if (data.type === 'ready' && data.buffer) {
      if (localDownloadUrl) URL.revokeObjectURL(localDownloadUrl);
      localDownloadUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = localDownloadUrl;
      link.download = 'visiora-local.zip';
      link.click();
      text(
        'download-state',
        'Download iniciado. Extraia o ZIP e siga o LEIA-ME. É necessário ter Node.js 24 ou superior instalado.',
      );
      finish();
    } else if (data.type === 'error') {
      text('download-state', data.message || 'Não consegui preparar o pacote.');
      finish();
    }
  };
  worker.postMessage({ type: 'download' });
});

let registration: ServiceWorkerRegistration | undefined;
async function registerOffline(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    text('offline-state', 'Este navegador não oferece instalação offline. Use a versão local.');
    return;
  }
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { type: 'classic' });
    await navigator.serviceWorker.ready;
  } catch (error) {
    console.error(JSON.stringify({ event: 'offline_unavailable', message: String(error) }));
    text(
      'offline-state',
      'A instalação offline não ficou disponível. A versão local pode ser baixada.',
    );
  }
}
void registerOffline();
el('offline').addEventListener('click', async () => {
  if (!registration?.active) {
    notice(
      'A instalação offline ainda não está disponível. Tente novamente ou baixe a versão local.',
    );
    return;
  }
  text('offline-state', 'Baixando o aplicativo e o modelo para este aparelho…');
  el<HTMLButtonElement>('offline').disabled = true;
  registration.active.postMessage({ type: 'PREPARE_OFFLINE' });
});
if ('serviceWorker' in navigator)
  navigator.serviceWorker.addEventListener('message', (event) => {
    el<HTMLButtonElement>('offline').disabled = false;
    if (event.data.type === 'OFFLINE_READY')
      text(
        'offline-state',
        'Arquivos preparados neste aparelho. A voz local e a câmera ainda dependem das permissões do navegador.',
      );
    if (event.data.type === 'OFFLINE_ERROR') {
      text('offline-state', 'O download não terminou. Verifique a conexão e tente novamente.');
      report(new Error('Não foi possível preparar todos os arquivos offline.'));
    }
  });
