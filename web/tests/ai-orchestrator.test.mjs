import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { orchestrate } from '../tools/ai-orchestrator/engine.mjs';
import { OpenAIProvider } from '../tools/ai-orchestrator/provider.mjs';
import { MODELS } from '../tools/ai-orchestrator/config.mjs';
import {
  reviewRoute,
  routeTask,
  usageCost,
  validatePlan,
} from '../tools/ai-orchestrator/router.mjs';

class FakeProvider {
  constructor(plan, review = { approved: true, findings: [] }) {
    this.plan = plan;
    this.review = review;
    this.calls = [];
  }
  async respond(call) {
    this.calls.push(call);
    const text =
      call.schemaName === 'plan'
        ? JSON.stringify(this.plan)
        : call.schemaName === 'review'
          ? JSON.stringify(this.review)
          : `Entrega de ${call.model.id}`;
    return { model: call.model.id, text, usage: { input_tokens: 100, output_tokens: 50 } };
  }
}

const task = (kind, complexity = 'low', risk = 'low') => ({
  title: kind,
  kind,
  complexity,
  risk,
  instructions: 'Produza uma proposta.',
});

test('roteia por complexidade e risco, sem criar revisor para tarefa simples', () => {
  assert.equal(routeTask(task('documentation')).model.id, 'gpt-6-luna');
  assert.equal(routeTask(task('implementation', 'medium')).model.id, 'gpt-6.1-sol');
  assert.equal(routeTask(task('architecture', 'high', 'high')).model.id, 'gpt-6-astra');
  assert.equal(reviewRoute([task('documentation')]), null);
  assert.equal(reviewRoute([task('audit', 'high', 'high')]).model.id, 'gpt-6-astra');
});

test('valida limite e formato do plano', () => {
  assert.throws(() => validatePlan({ tasks: [] }), /quantidade/i);
  assert.throws(() => validatePlan({ tasks: [task('unsupported')] }), /inválida/i);
  assert.throws(() => validatePlan({ tasks: Array(5).fill(task('tests')) }), /quantidade/i);
});

test('executa planejamento, especialistas e revisão com modelos distintos', async () => {
  const provider = new FakeProvider({
    tasks: [task('tests'), task('implementation', 'medium', 'medium')],
  });
  const result = await orchestrate({ request: 'Implemente API e testes', budgetUsd: 1, provider });
  assert.deepEqual(
    provider.calls.map((call) => call.model.id),
    ['gpt-6-luna', 'gpt-6-luna', 'gpt-6.1-sol', 'gpt-6.1-sol'],
  );
  assert.equal(result.review.approved, true);
  assert.equal(result.calls.length, 4);
  assert.ok(result.estimatedUsd > 0);
});

test('interrompe antes de gastar acima da reserva e após revisão reprovada não repete', async () => {
  const provider = new FakeProvider(
    { tasks: [task('architecture', 'high', 'high')] },
    { approved: false, findings: ['Falta evidência.'] },
  );
  await assert.rejects(
    orchestrate({ request: 'Arquitetura crítica', budgetUsd: 0.00001, provider }),
    /Orçamento/,
  );
  assert.equal(provider.calls.length, 0);
  const result = await orchestrate({ request: 'Arquitetura crítica', budgetUsd: 1, provider });
  assert.equal(result.review.approved, false);
  assert.equal(provider.calls.length, 3);
});

test('falha fechada quando uso de tokens ou modelo informado divergem', async () => {
  assert.throws(() => usageCost(MODELS.luna, {}), /Uso de tokens/);
  const provider = new OpenAIProvider({
    apiKey: 'fake',
    fetchImpl: async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          model: 'outro',
          status: 'completed',
          output_text: 'texto',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
    }),
  });
  await assert.rejects(
    provider.respond({ model: MODELS.luna, instructions: 'x', input: 'y', maxOutputTokens: 16 }),
    /divergente/,
  );
  const altered = new FakeProvider({ tasks: [task('tests')] });
  altered.respond = async () => ({
    model: 'outro',
    text: '{}',
    usage: { input_tokens: 1, output_tokens: 1 },
  });
  await assert.rejects(
    orchestrate({ request: 'testar', budgetUsd: 1, provider: altered }),
    /divergente/,
  );
});

test('CLI exige autorização explícita mesmo com chave no ambiente', () => {
  const result = spawnSync(
    process.execPath,
    ['tools/ai-orchestrator/cli.mjs', 'run', '--budget-usd', '1', 'teste'],
    { encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: 'fake' } },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--allow-paid-api/);
});
