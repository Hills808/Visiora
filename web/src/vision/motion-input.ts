import { CONFIG } from '../config.js';
import { CameraRotationGuard } from './camera-rotation.js';

type Rate = { alpha: number | null; beta: number | null; gamma: number | null } | null;
type Reading = { rotationRate: Rate };
export interface MotionHost {
  secure: boolean;
  supported: boolean;
  requestPermission?: () => Promise<string>;
  listen(listener: (event: Reading) => void): void;
  unlisten(listener: (event: Reading) => void): void;
}
export function browserMotionHost(): MotionHost {
  const sensor = window.DeviceMotionEvent as
    | (typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> })
    | undefined;
  return {
    secure: window.isSecureContext,
    supported: Boolean(sensor),
    ...(sensor?.requestPermission ? { requestPermission: () => sensor.requestPermission!() } : {}),
    listen: (listener) => window.addEventListener('devicemotion', listener),
    unlisten: (listener) => window.removeEventListener('devicemotion', listener),
  };
}

/** Opt-in local sensor input. Permission is requested directly in the button gesture. */
export class MotionInput {
  private guard = new CameraRotationGuard(CONFIG.cameraRotation);
  private permitted = false;
  private running = false;
  private listening = false;
  private generation = 0;
  private lastReading: number | null = null;
  private permissionState: 'off' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error' =
    'off';
  constructor(
    private readonly host: MotionHost,
    private readonly rotated: () => void,
    private readonly now: () => number = () => performance.now(),
  ) {}
  get enabled(): boolean {
    return this.permitted;
  }
  get requesting(): boolean {
    return this.permissionState === 'requesting';
  }
  get status(): string {
    if (this.permissionState === 'unsupported')
      return 'Leitura de giros indisponível neste navegador ou sem HTTPS.';
    if (this.permissionState === 'denied')
      return 'Permissão negada. O Luna continua usando somente mudanças na imagem.';
    if (this.permissionState === 'error')
      return 'Não foi possível acessar o sensor. Você pode tentar novamente.';
    if (this.requesting) return 'Aguardando permissão para ler giros do aparelho.';
    if (!this.enabled) return 'Desligada. Pode exigir permissão do navegador.';
    if (!this.listening)
      return 'Autorizada nesta página; aguarda uma sessão Luna em primeiro plano.';
    if (this.lastReading === null || this.now() - this.lastReading > CONFIG.cameraRotation.staleMs)
      return 'Ativada, sem leitura recente do sensor. O Luna usa as mudanças na imagem.';
    return 'Recebendo leituras de giro. Não detecta caminhada nem garante posições atuais.';
  }
  async enable(): Promise<void> {
    const generation = ++this.generation;
    if (!this.host.secure || !this.host.supported) {
      this.permissionState = 'unsupported';
      return;
    }
    this.permissionState = 'requesting';
    try {
      // Do not await anything before this call: Safari requires the user's transient activation.
      const permission = this.host.requestPermission
        ? await this.host.requestPermission()
        : 'granted';
      if (generation !== this.generation) return;
      this.permitted = permission === 'granted';
      this.permissionState = this.permitted ? 'granted' : 'denied';
      this.sync();
    } catch (error) {
      if (generation !== this.generation) return;
      this.permissionState = 'error';
      this.permitted = false;
      this.sync();
      console.warn(
        JSON.stringify({
          event: 'motion_permission_failed',
          name: error instanceof Error ? error.name : 'unknown',
        }),
      );
    }
  }
  disable(): void {
    this.generation++;
    this.permitted = false;
    this.permissionState = 'off';
    this.sync();
  }
  setRunning(running: boolean): void {
    this.running = running;
    this.sync();
  }
  private readonly read = (event: Reading): void => {
    if (!this.listening) return;
    const at = this.now();
    const rate = event.rotationRate;
    if (
      rate &&
      [rate.alpha, rate.beta, rate.gamma].every(
        (value) => typeof value === 'number' && Number.isFinite(value),
      )
    )
      this.lastReading = at;
    else this.lastReading = null;
    if (this.guard.observe(rate, at)) this.rotated();
  };
  private sync(): void {
    const active = this.permitted && this.running;
    if (active === this.listening) return;
    this.listening = active;
    this.guard.reset();
    this.lastReading = null;
    if (active) this.host.listen(this.read);
    else this.host.unlisten(this.read);
  }
  diagnostics(): object {
    return {
      enabled: this.enabled,
      listening: this.listening,
      permission: this.permissionState,
      recentReading:
        this.listening &&
        this.lastReading !== null &&
        this.now() - this.lastReading <= CONFIG.cameraRotation.staleMs,
    };
  }
}
