import { VisualMemory } from '../../dist/brain/visual-memory.js';

export function item(label, { bearing = 0, uncertain = false, kind = 'object' } = {}) {
  const x = (Math.tan((bearing * Math.PI) / 180) / Math.tan((35 * Math.PI) / 180) + 1) / 2;
  return {
    id: 'item',
    label,
    kind,
    article: 'uma',
    uncertain,
    box: { x: x - 0.025, y: 0.2, width: 0.05, height: 0.5 },
  };
}
export function snapshot(frame, observations, { at = frame * 4500, scene = 'escritório' } = {}) {
  return {
    schemaVersion: 1,
    source: 'fake',
    stamp: {
      requestId: `memory-${frame}`,
      sessionGeneration: 1,
      frameId: frame,
      capturedAtMs: at,
      width: 640,
      height: 480,
      intent: 'describe',
      term: '',
    },
    evidence: {
      scene: scene && observations.length ? { label: scene, support: ['i0'] } : null,
      observations: observations.map((value, i) => ({ ...value, id: `i${i}` })),
      relations: [],
      limitations: [],
    },
  };
}
export function deliver(memory, result, options = {}) {
  const now = result.stamp.capturedAtMs + 500;
  if (!memory.accept(result, now, 1)) throw new Error('Invalid fixture chronology');
  const utterance = memory.utterance(
    now,
    false,
    true,
    options.newView ?? false,
    false,
    options.verbosity ?? 'balanced',
  );
  if (utterance && options.complete !== false) memory.complete(utterance.id, now + 100);
  return utterance;
}
export function memoryTranscripts() {
  const cases = [];
  function scenario(id, frames) {
    const memory = new VisualMemory(),
      transcript = [];
    for (const [i, frame] of frames.entries()) {
      const utterance = deliver(
        memory,
        snapshot(i + 1, frame.items, {
          scene: frame.scene ?? 'escritório',
          at: frame.at ?? (i + 1) * 4500,
        }),
        frame,
      );
      transcript.push({ frame: i + 1, text: utterance?.text ?? null });
    }
    cases.push({ id, source: 'simulation', transcript });
  }
  const chair = item('cadeira'),
    person = item('pessoa', { kind: 'person', bearing: -30 });
  scenario('novidade-antes-de-ausencia', [
    { items: [chair, person] },
    { items: [chair, item('mesa', { bearing: 30 })] },
    { items: [chair, item('mesa', { bearing: 30 })] },
  ]);
  scenario('omissao-pontual-e-caixa-ausente', [
    { items: [chair, person] },
    { items: [chair] },
    { items: [chair, person] },
    { items: [chair, { ...person, box: null }] },
    { items: [chair, person] },
  ]);
  scenario(
    'rotulo-qualificado-na-mesma-caixa',
    ['cadeira', 'cadeira gamer', 'cadeira de escritório', 'cadeira'].map((label) => ({
      items: [item(label)],
    })),
  );
  scenario('ausencia-confirmada', [
    { items: [chair, person] },
    { items: [chair] },
    { items: [chair] },
    { items: [chair] },
    { items: [chair, person] },
  ]);
  scenario(
    'oscilacao-de-setor',
    [22.4, 22.6, 23, 22, 29].map((bearing) => ({ items: [item('cadeira', { bearing })] })),
  );
  scenario(
    'oscilacao-de-lugar',
    ['escritório', 'biblioteca', 'escritório', 'biblioteca', 'biblioteca'].map((scene) => ({
      items: [chair],
      scene,
    })),
  );
  scenario(
    'incerteza-nao-vira-novidade',
    [false, true, false, true, false].map((uncertain) => ({
      items: [item('cadeira', { uncertain })],
    })),
  );
  scenario('nova-vista-mesmo-nome', [
    { items: [chair] },
    { items: [chair], newView: true },
    { items: [chair] },
  ]);
  scenario('incerteza-e-fatos-separados', [
    { items: [item('cama', { uncertain: true }), chair, item('pessoa', { kind: 'person' })] },
  ]);
  return cases;
}
