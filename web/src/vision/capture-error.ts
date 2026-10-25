export type CaptureFailure =
  | 'capture-canceled'
  | 'capture-timeout'
  | 'capture-stale'
  | 'capture-busy'
  | 'capture-empty'
  | 'capture-size'
  | 'capture-unavailable';
const messages: Record<CaptureFailure, string> = {
  'capture-canceled': 'A captura foi cancelada.',
  'capture-timeout': 'A preparação da imagem demorou demais; nenhuma imagem foi enviada.',
  'capture-stale': 'A imagem ficou antiga antes do envio; nenhuma imagem foi enviada.',
  'capture-busy': 'Já existe uma imagem sendo preparada.',
  'capture-empty': 'A câmera não conseguiu preparar esta imagem.',
  'capture-size': 'A imagem ficou grande demais para enviar.',
  'capture-unavailable': 'Não foi possível preparar a imagem da câmera.',
};
/** Fixed local error vocabulary: never include pixel data, browser exceptions or provider text. */
export class CaptureError extends Error {
  readonly transient: boolean;
  constructor(readonly code: CaptureFailure) {
    super(messages[code]);
    this.name = 'CaptureError';
    this.transient = ['capture-timeout', 'capture-stale', 'capture-empty'].includes(code);
  }
}
