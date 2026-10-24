import { parseResult, type AnalysisResult, type CaptureStamp } from '../perception/evidence.js';
import { CONFIG } from '../config.js';
export interface GatewayStatus {
  ready: boolean;
  provider: 'luna' | 'fake';
  csrfToken: string;
  message: string;
}
export async function gatewayStatus(): Promise<GatewayStatus> {
  try {
    const response = await fetch('/api/vision/status', {
      cache: 'no-store',
      signal: AbortSignal.timeout(CONFIG.online.statusTimeoutMs),
    });
    if (!response.ok) throw new Error('Gateway indisponível');
    const data = (await response.json()) as GatewayStatus;
    if (
      typeof data.ready !== 'boolean' ||
      !['luna', 'fake'].includes(data.provider) ||
      !/^[a-f0-9]{64}$/.test(data.csrfToken) ||
      typeof data.message !== 'string'
    )
      throw new Error('Status inválido');
    return data;
  } catch {
    return {
      ready: false,
      provider: 'luna',
      csrfToken: '',
      message: 'Luna aguarda configuração do servidor. O modo local continua disponível.',
    };
  }
}
export class AnalysisError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
    readonly code: string,
  ) {
    super(message);
  }
}
export class LunaClient {
  private active: AbortController | null = null;
  private epoch = 0;
  get busy(): boolean {
    return this.active !== null;
  }
  cancel(): void {
    this.epoch++;
    this.active?.abort();
    this.active = null;
  }
  async analyze(
    image: Blob,
    stamp: CaptureStamp,
    status: GatewayStatus,
    consent: boolean,
  ): Promise<AnalysisResult | null> {
    if (this.busy) throw new Error('Aguarde a análise em andamento.');
    if (!status.ready || (status.provider === 'luna' && !consent))
      throw new Error('Ative o consentimento e configure o servidor antes de analisar.');
    const epoch = ++this.epoch;
    const controller = new AbortController();
    this.active = controller;
    const timer = setTimeout(() => controller.abort(), CONFIG.online.clientTimeoutMs);
    try {
      const body = new FormData();
      body.set('metadata', JSON.stringify(stamp));
      body.set('image', image, 'frame.jpg');
      const response = await fetch('/api/vision/analyze', {
        method: 'POST',
        body,
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'X-Visiora-CSRF': status.csrfToken,
          'X-Visiora-Consent': consent ? 'cloud-v3-continuity' : 'none',
        },
      });
      if (epoch !== this.epoch) return null;
      if (!response.ok) {
        const messages: Record<number, string> = {
          401: 'A API recusou a credencial ou o acesso ao modelo.',
          403: 'Envio não autorizado. Confirme o consentimento e recarregue a página.',
          409: 'Já existe uma análise em andamento ou este pedido já foi recebido.',
          429: 'Limite de consultas ou orçamento atingido.',
          502: 'Não foi possível confirmar o modelo da resposta. A descrição foi bloqueada; confira o registro do servidor.',
          503: 'Luna não configurado, sem conexão ou temporariamente indisponível.',
          504: 'O serviço demorou demais para responder.',
          422: 'Não foi possível concluir a análise da imagem.',
        };
        // The edge may return HTML for its own 503 errors. Never display raw error bodies.
        const failure = (await response.json().catch(() => null)) as { error?: unknown } | null;
        const raw = failure?.error;
        const code = typeof raw === 'string' &&
          /^(provider-[a-z-]+|provider-http-5\d{2}|model-unconfirmed|not-configured|ledger|model-audit|pricing|budget|rate|busy|csrf|origin|auth|consent|internal)$/.test(raw)
          ? raw : response.status === 503 && failure === null
            ? 'gateway-unavailable' : `http-${response.status}`;
        const transient =
          (response.status === 503 &&
            (['provider-network', 'provider-unavailable', 'gateway-unavailable'].includes(code) ||
              /^provider-http-5\d{2}$/.test(code))) ||
          (response.status === 504 && code === 'provider-timeout');
        const explanation = code === 'provider-network'
          ? 'O servidor não conseguiu acessar a OpenAI.'
          : /^provider-http-5\d{2}$/.test(code)
            ? `O provedor retornou HTTP ${code.slice(-3)}.`
            : code === 'not-configured'
              ? 'A configuração da Luna no servidor está indisponível.'
              : messages[response.status] ?? 'Não foi possível concluir a análise.';
        throw new AnalysisError(
          `${explanation} (código: ${code})`,
          transient,
          code,
        );
      }
      return parseResult(await response.json(), stamp);
    } catch (error) {
      if (epoch !== this.epoch) return null;
      if (controller.signal.aborted)
        throw new AnalysisError(
          'A análise demorou demais. Uma cobrança já iniciada pode permanecer.',
          true,
          'client-timeout',
        );
      if (error instanceof TypeError)
        throw new AnalysisError('A conexão com o serviço falhou.', true, 'client-network');
      throw error;
    } finally {
      clearTimeout(timer);
      if (epoch === this.epoch) this.active = null;
    }
  }
}
