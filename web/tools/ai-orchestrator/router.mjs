import { LIMITS, MODELS } from './config.mjs';

const KINDS = new Set([
  'triage',
  'simple_code',
  'implementation',
  'architecture',
  'tests',
  'documentation',
  'audit',
]);
const LEVELS = new Set(['low', 'medium', 'high']);

export function validatePlan(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.tasks))
    throw new Error('Plano sem tarefas.');
  if (value.tasks.length < 1 || value.tasks.length > LIMITS.maxTasks)
    throw new Error('Quantidade de tarefas fora do limite.');
  for (const task of value.tasks) {
    if (
      !task ||
      typeof task !== 'object' ||
      !KINDS.has(task.kind) ||
      !LEVELS.has(task.complexity) ||
      !LEVELS.has(task.risk) ||
      typeof task.title !== 'string' ||
      !task.title.trim() ||
      typeof task.instructions !== 'string' ||
      !task.instructions.trim() ||
      task.instructions.length > LIMITS.maxTaskChars
    )
      throw new Error('Tarefa inválida no plano.');
  }
  return value.tasks;
}

export function routeTask(task) {
  if (task.risk === 'high' && (task.kind === 'audit' || task.kind === 'architecture'))
    return { model: MODELS.astra, reason: 'Decisão técnica crítica.' };
  if (task.complexity === 'high' && task.kind === 'architecture')
    return { model: MODELS.astra, reason: 'Arquitetura complexa.' };
  if (task.risk === 'high' || task.complexity === 'high' || task.kind === 'implementation')
    return { model: MODELS.sol, reason: 'Implementação ou risco acima do básico.' };
  if (task.kind === 'audit' && task.risk === 'medium')
    return { model: MODELS.sol, reason: 'Auditoria com risco moderado.' };
  return { model: MODELS.luna, reason: 'Tarefa delimitada e de baixo risco.' };
}

export function reviewRoute(tasks) {
  const highestRisk = tasks.some((task) => task.risk === 'high');
  if (highestRisk) return { model: MODELS.astra, reason: 'Revisão de alto risco.' };
  if (tasks.length > 1 || tasks.some((task) => task.risk === 'medium'))
    return { model: MODELS.sol, reason: 'Revisão de integração ou risco moderado.' };
  return null;
}

export function usageCost(model, usage) {
  if (
    !usage ||
    !Number.isSafeInteger(usage.input_tokens) ||
    !Number.isSafeInteger(usage.output_tokens) ||
    usage.input_tokens < 0 ||
    usage.output_tokens < 0
  )
    throw new Error('Uso de tokens ausente ou inválido.');
  // Cobrar todo input como não cacheado é conservador; não inclui taxas extras.
  return (
    (usage.input_tokens * model.inputPerMillion + usage.output_tokens * model.outputPerMillion) /
    1_000_000
  );
}

export function reserveCost(model, input, maxOutputTokens) {
  const inputUpperBound = Buffer.byteLength(input, 'utf8') + LIMITS.inputOverheadTokens;
  return (
    (inputUpperBound * model.inputPerMillion + maxOutputTokens * model.outputPerMillion) / 1_000_000
  );
}
