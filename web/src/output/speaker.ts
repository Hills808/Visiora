import type { Utterance } from '../brain/types.js';
export interface SpeechHooks {
  start(): boolean;
  end(): void;
  drop(): void;
  error(message: string): void;
}
export class Speaker {
  private token = 0;
  private hooks: SpeechHooks | null = null;
  private activeId: string | null = null;
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  constructor(
    private synth: SpeechSynthesis | null = typeof speechSynthesis !== 'undefined'
      ? speechSynthesis
      : null,
  ) {}
  voices(): SpeechSynthesisVoice[] {
    return (
      this.synth
        ?.getVoices()
        .filter((voice) => voice.localService && /^pt[-_]BR$/i.test(voice.lang)) ?? []
    );
  }
  select(uri: string): void {
    this.voice = this.voices().find((v) => v.voiceURI === uri) ?? this.voices()[0] ?? null;
  }
  get speaking(): boolean {
    return this.activeId !== null;
  }
  speak(utterance: Utterance, hooks: SpeechHooks, now: number): void {
    this.cancel();
    if (!this.synth || !this.voice) {
      hooks.drop();
      hooks.error(
        'Nenhuma voz local pt-BR disponível. Use o modo leitor de tela nas configurações.',
      );
      return;
    }
    if (now >= utterance.expiresAt) {
      hooks.drop();
      return;
    }
    const generation = ++this.token;
    this.activeId = utterance.id;
    this.hooks = hooks;
    const speech = new SpeechSynthesisUtterance(utterance.text);
    speech.lang = 'pt-BR';
    speech.voice = this.voice;
    speech.rate = this.rate;
    speech.onstart = (): void => {
      if (generation === this.token && !hooks.start()) this.cancel();
    };
    speech.onend = (): void => {
      if (generation !== this.token) return;
      this.activeId = null;
      this.hooks = null;
      hooks.end();
    };
    speech.onerror = (event): void => {
      if (generation !== this.token) return;
      this.activeId = null;
      this.hooks = null;
      hooks.drop();
      hooks.error(`A voz foi interrompida (${event.error}).`);
    };
    this.synth.speak(speech);
  }
  cancel(): void {
    this.token++;
    const hooks = this.hooks;
    this.hooks = null;
    this.activeId = null;
    this.synth?.cancel();
    hooks?.drop();
  }
}
