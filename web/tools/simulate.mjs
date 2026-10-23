import { Brain } from '../dist/brain/brain.js';
import { SCENARIOS, scenarioFrame } from '../dist/sim/scenarios.js';
const selected = process.argv[2] ? SCENARIOS.filter((s) => s.id === process.argv[2]) : SCENARIOS;
if (!selected.length) {
  console.error('Cena desconhecida.');
  process.exit(1);
}
for (const scene of selected) {
  const brain = new Brain();
  const transcript = [];
  for (let t = 0, id = 0; t <= 16000; t += 200, id++) {
    brain.ingest(scenarioFrame(scene, t, id), t);
    if (t === 8000) brain.ask('ahead');
    if (t === 12000) brain.ask('find', 'porta');
    const utterance = brain.next(t);
    if (utterance) {
      transcript.push({ timeMs: t, kind: utterance.kind, text: utterance.text });
      brain.start(utterance.id, t);
      brain.confirm(utterance.id, t + 1);
    }
  }
  console.log(JSON.stringify({ scene: scene.id, source: 'simulation', transcript }));
}
