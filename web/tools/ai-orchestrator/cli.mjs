#!/usr/bin/env node
import { orchestrate } from './engine.mjs';
import { OpenAIProvider } from './provider.mjs';
import { LIMITS, MODELS } from './config.mjs';
import { reserveCost, routeTask } from './router.mjs';

function parseArgs(args) {
  const [mode, ...rest] = args;
  if (mode !== 'preview' && mode !== 'run')
    throw new Error(
      'Uso: node tools/ai-orchestrator/cli.mjs preview "pedido" | run --allow-paid-api --budget-usd VALOR "pedido"',
    );
  let budgetUsd;
  let allowPaidApi = false;
  const requestParts = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--budget-usd') {
      budgetUsd = Number(rest[++i]);
    } else if (rest[i] === '--allow-paid-api') {
      allowPaidApi = true;
    } else if (rest[i].startsWith('--')) {
      throw new Error(`Opção desconhecida: ${rest[i]}`);
    } else requestParts.push(rest[i]);
  }
  const request = requestParts.join(' ').trim();
  if (!request || request.length > LIMITS.maxRequestChars)
    throw new Error('Pedido vazio ou longo demais.');
  if (mode === 'run' && (!(budgetUsd > 0) || !Number.isFinite(budgetUsd)))
    throw new Error('O modo run exige --budget-usd com valor positivo.');
  if (mode === 'run' && !allowPaidApi)
    throw new Error('O modo run exige --allow-paid-api para autorizar chamadas pagas.');
  if (mode === 'preview' && (budgetUsd !== undefined || allowPaidApi))
    throw new Error('A prévia não aceita opções de chamadas pagas.');
  return { mode, request, budgetUsd };
}

async function main() {
  const { mode, request, budgetUsd } = parseArgs(process.argv.slice(2));
  if (mode === 'preview') {
    const task = { kind: 'implementation', complexity: 'medium', risk: 'medium' };
    const route = routeTask(task);
    console.log(
      JSON.stringify(
        {
          mode: 'prévia estática',
          note: 'A classificação real exige run e consome API. Prévia assume uma tarefa de implementação média.',
          model: route.model.id,
          maxSingleWorkerReservationUsd: reserveCost(
            route.model,
            request,
            LIMITS.workerOutputTokens,
          ),
          prices: MODELS,
        },
        null,
        2,
      ),
    );
    return;
  }
  const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.timeoutMs);
  try {
    const result = await orchestrate({ request, budgetUsd, provider, signal: controller.signal });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    clearTimeout(timer);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
