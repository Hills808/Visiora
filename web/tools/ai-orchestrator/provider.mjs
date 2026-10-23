import { LIMITS } from './config.mjs';

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tasks'],
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'kind', 'complexity', 'risk', 'instructions'],
        properties: {
          title: { type: 'string' },
          kind: {
            type: 'string',
            enum: [
              'triage',
              'simple_code',
              'implementation',
              'architecture',
              'tests',
              'documentation',
              'audit',
            ],
          },
          complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          instructions: { type: 'string' },
        },
      },
    },
  },
};

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['approved', 'findings'],
  properties: {
    approved: { type: 'boolean' },
    findings: { type: 'array', items: { type: 'string' } },
  },
};

export class OpenAIProvider {
  constructor({ apiKey, fetchImpl = fetch }) {
    if (!apiKey) throw new Error('OPENAI_API_KEY ausente.');
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async respond({ model, instructions, input, maxOutputTokens, schemaName, signal }) {
    const schema =
      schemaName === 'plan' ? PLAN_SCHEMA : schemaName === 'review' ? REVIEW_SCHEMA : null;
    const payload = {
      model: model.id,
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      reasoning: {
        effort: model.id === 'gpt-6-luna' ? 'low' : model.id === 'gpt-6-astra' ? 'high' : 'medium',
      },
      store: false,
      service_tier: 'default',
      ...(schema
        ? { text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } } }
        : {}),
    };
    const response = await this.fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > LIMITS.maxResponseBytes)
      throw new Error('Resposta da API excedeu o limite.');
    if (!response.ok) throw new Error(`API HTTP ${response.status}.`);
    const data = JSON.parse(raw);
    if (data.model !== model.id)
      throw new Error(`Modelo respondente divergente: ${data.model || 'ausente'}.`);
    if (data.status !== 'completed')
      throw new Error(`Resposta não concluída: ${data.status || 'ausente'}.`);
    const text =
      data.output_text ||
      data.output
        ?.flatMap((item) => item.content || [])
        .filter((item) => item.type === 'output_text')
        .map((item) => item.text)
        .join('');
    if (!text) throw new Error('Resposta sem texto.');
    return { text, usage: data.usage, model: data.model };
  }
}
