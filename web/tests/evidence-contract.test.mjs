import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validEvidence,
  evidenceIssue,
  prepareEvidence,
  EVIDENCE_ISSUES,
} from '../dist/perception/evidence.js';
import { responseEvidence } from '../server/provider.mjs';
import { failureCode, GatewayError } from '../server/budget.mjs';

const fixture = () => ({
  scene: { label: 'escritório', support: ['a'] },
  observations: [
    {
      id: 'a',
      kind: 'object',
      article: 'uma',
      label: 'cadeira',
      uncertain: false,
      box: { x: 0.1, y: 0.2, width: 0.2, height: 0.5 },
    },
    {
      id: 'b',
      kind: 'person',
      article: 'uma',
      label: 'pessoa',
      uncertain: false,
      box: { x: 0.6, y: 0.1, width: 0.3, height: 0.8 },
    },
  ],
  relations: [{ subject: 'a', object: 'b', description: 'ao lado' }],
  limitations: ['pouca luz'],
});
const output = (value) => ({
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
});

test('CA-L1/L4: provider accepts equivalent Unicode/space, auxiliary punctuation and bijective opaque IDs without changing boxes', (t) => {
  const raw = fixture();
  raw.scene.label = ' escrito\u0301rio ';
  raw.observations[0].id = 'A';
  raw.observations[1].id = 'a';
  raw.observations[0].label = '  cadeira\t ';
  raw.scene.support = ['A'];
  raw.relations[0] = { subject: 'A', object: 'a', description: 'ao lado.' };
  raw.limitations = ['Pouca luz.'];
  const original = structuredClone(raw);
  const logs = [];
  t.mock.method(console, 'info', (line) => logs.push(line));
  assert.equal(validEvidence(raw), false);
  const prepared = prepareEvidence(raw);
  assert.equal(prepared.ok, true);
  assert.equal(validEvidence(prepared.evidence), true);
  assert.deepEqual(raw, original);
  assert.deepEqual(
    prepared.evidence.observations.map((row) => row.id),
    ['o1', 'o2'],
  );
  assert.deepEqual(prepared.evidence.scene.support, ['o1']);
  assert.deepEqual(prepared.evidence.relations[0], {
    subject: 'o1',
    object: 'o2',
    description: 'ao lado',
  });
  assert.equal(prepared.evidence.scene.label, 'escritório');
  assert.deepEqual(
    prepared.evidence.observations.map((row) => row.box),
    raw.observations.map((row) => row.box),
  );
  assert.deepEqual(responseEvidence(output(raw)), prepared.evidence);
  assert.doesNotMatch(logs.join(''), /cadeira|escritório|pessoa|box|subject|support/);
});

test('CA-P6/L1: impossible geometry, unsupported references, duplicates and wrong types remain rejected with safe reasons', () => {
  for (const [change, reason] of [
    [(v) => (v.observations[0].box.width = 0), 'box-empty'],
    [(v) => (v.observations[0].box.x = 0.9), 'box-bounds'],
    [(v) => (v.observations[0].box.width = '0.2'), 'box-format'],
    [(v) => (v.scene.support = []), 'scene-support-empty'],
    [(v) => (v.scene.support = ['missing']), 'scene-support-reference'],
    [(v) => (v.relations[0].object = 'missing'), 'relation-reference'],
    [(v) => (v.relations[0].object = 'a'), 'relation-self'],
    [(v) => (v.observations[1].id = 'a'), 'duplicate-id'],
    [(v) => (v.observations[0].kind = ['person']), 'enum-type'],
    [(v) => (v.observations[0].article = ['uma']), 'enum-type'],
    [(v) => (v.observations[0].depth = 2), 'observation-format'],
    [(v) => (v.observations[0].label = '<script>private</script>'), 'label-format'],
    [(v) => (v.observations[0].label = 'cadeira.'), 'label-format'],
  ]) {
    const value = fixture();
    change(value);
    assert.equal(evidenceIssue(value), reason);
    assert.deepEqual(prepareEvidence(value), { ok: false, reason });
    assert.throws(
      () => responseEvidence(output(value)),
      (error) => error.status === 422 && error.message === `invalid-evidence-${reason}`,
    );
    assert.equal(
      failureCode(new GatewayError(422, `invalid-evidence-${reason}`)),
      `invalid-evidence-${reason}`,
    );
  }
});

test('CA-L1: canonical ID remapping never repairs a dangling reference by colliding with its new name', () => {
  for (const field of ['scene', 'relation']) {
    const value = fixture();
    value.observations[0].id = 'Object_1';
    value.scene.support = ['Object_1'];
    value.relations[0].subject = 'Object_1';
    if (field === 'scene') value.scene.support = ['o1'];
    else value.relations[0].object = 'o1';
    assert.deepEqual(prepareEvidence(value), {
      ok: false,
      reason: field === 'scene' ? 'scene-support-reference' : 'relation-reference',
    });
  }
});

test('CA-L1/F6: already valid responses and literal OCR labels are not rewritten or reduced', () => {
  const value = fixture();
  value.observations.push({
    id: 'ocr',
    kind: 'text',
    label: 'Saída',
    article: 'uma',
    uncertain: true,
    box: null,
  });
  const result = prepareEvidence(value);
  assert.equal(result.ok, true);
  assert.deepEqual(result.evidence, value);
  assert.deepEqual(result.adjustments, []);
  value.observations[2].label = ' Saída ';
  assert.deepEqual(prepareEvidence(value), { ok: false, reason: 'label-format' });
  for (const reason of EVIDENCE_ISSUES) assert.match(reason, /^[a-z-]+$/);
});

test('CA-L1: questions and ellipses cannot be normalized into assertive relations or limitations', () => {
  for (const punctuation of ['?', '!', '...', ':', ';']) {
    const relation = fixture();
    relation.relations[0].description += punctuation;
    assert.deepEqual(prepareEvidence(relation), { ok: false, reason: 'relation-format' });
    const limitation = fixture();
    limitation.limitations[0] += punctuation;
    assert.deepEqual(prepareEvidence(limitation), { ok: false, reason: 'limitations-format' });
  }
});

test('CA-L1: structured schema constrains positive sizes, canonical IDs and nonempty scene support', async () => {
  const schema = JSON.parse(await readFile('schemas/visual-evidence-v1.json', 'utf8'));
  const item = schema.properties.observations.items.properties;
  assert.equal(new RegExp(item.id.pattern).test('Object_1'), false);
  assert.equal(new RegExp(item.id.pattern).test('o1'), true);
  assert.equal(item.box.anyOf[0].properties.width.exclusiveMinimum, 0);
  assert.equal(item.box.anyOf[0].properties.height.exclusiveMinimum, 0);
  assert.equal(schema.properties.scene.anyOf[0].properties.support.minItems, 1);
});
