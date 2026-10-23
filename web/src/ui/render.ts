import { CONFIG } from '../config.js';
import { DIRECTIONS } from '../brain/geometry.js';
import { LEX } from '../brain/lexicon.js';
import { distancePhrase } from '../brain/realizer.js';
import type { Fact } from '../brain/types.js';
import type { HistoryItem } from '../storage.js';
export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento ausente: ${id}`);
  return node as T;
}
export function text(id: string, value: string): void {
  const node = el(id);
  if (node.textContent !== value) node.textContent = value;
}
export function show(id: string, visible: boolean): void {
  el(id).hidden = !visible;
}
export function renderFacts(facts: Fact[], demo: boolean): void {
  const visible = facts.filter((f) => f.visible);
  text('reference-count', String(visible.length));
  text('nav-count', String(visible.length));
  const container = el('references');
  container.replaceChildren();
  if (!visible.length) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent =
      'Ainda não há referências reconhecidas. Isso não significa que o espaço esteja vazio ou livre.';
    container.append(note);
  }
  for (const fact of visible.slice(0, 5)) {
    const item = document.createElement('div');
    item.className = 'reference-item';
    const dot = document.createElement('i');
    dot.className = 'reference-point';
    dot.ariaHidden = 'true';
    const name = document.createElement('strong');
    name.textContent = LEX[fact.cls].name;
    const direction = document.createElement('span');
    direction.textContent = DIRECTIONS[fact.sector];
    item.append(dot, name, direction);
    container.append(item);
  }
  const list = el('environment-list');
  list.replaceChildren();
  if (!facts.length) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent = 'Nenhuma referência nesta sessão.';
    list.append(note);
  }
  for (const fact of facts) {
    const row = document.createElement('article');
    row.className = 'environment-row';
    const body = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = LEX[fact.cls].name;
    const detail = document.createElement('p');
    detail.textContent = `${DIRECTIONS[fact.sector]} · ${distancePhrase(fact.range, CONFIG.space.stepLength) || 'distância desconhecida'}`;
    body.append(heading, detail);
    const age = document.createElement('span');
    age.className = fact.visible ? 'chip' : 'memory';
    age.textContent = fact.visible
      ? demo
        ? 'Simulado'
        : 'Visto agora'
      : `Visto há ${Math.round(fact.age / 1000)} s; pode ter mudado`;
    row.append(body, age);
    list.append(row);
  }
}
export function renderHistory(items: HistoryItem[], enabled: boolean): void {
  const list = el('history-list');
  list.replaceChildren();
  if (!items.length) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.style.padding = '24px 0';
    note.textContent = enabled
      ? 'As próximas descrições serão guardadas aqui.'
      : 'Você ainda não ativou o histórico. Nada foi guardado.';
    list.append(note);
  }
  for (const item of [...items].reverse()) {
    const row = document.createElement('article');
    row.className = 'history-row';
    const caption = document.createElement('p');
    caption.textContent = item.text;
    const meta = document.createElement('small');
    meta.textContent = `${new Date(item.time).toLocaleString('pt-BR')} · ${item.source === 'demo' ? 'Demonstração simulada' : 'Câmera'}`;
    row.append(meta, caption);
    list.append(row);
  }
}
export function renderRadar(facts: Fact[]): void {
  const svg = document.getElementById('radar')!;
  svg.replaceChildren();
  const ns = 'http://www.w3.org/2000/svg';
  const append = (
    tag: string,
    attributes: Record<string, string | number>,
    label?: string,
  ): void => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (label) node.textContent = label;
    svg.append(node);
  };
  for (const r of [48, 90, 133])
    append('circle', {
      cx: 250,
      cy: 145,
      r,
      fill: 'none',
      stroke: '#9aae8c',
      'stroke-width': 0.8,
      opacity: 0.6,
    });
  append('path', {
    d: 'M250 12v266M117 145h266',
    stroke: '#9aae8c',
    'stroke-width': 0.7,
    'stroke-dasharray': '3 5',
  });
  append('path', {
    d: 'M250 145 226 210 274 210Z',
    transform: 'rotate(180 250 145)',
    fill: '#c7dea9',
    opacity: 0.5,
  });
  for (const fact of facts.filter((f) => f.visible)) {
    const radius = 55 + Math.min(7, fact.range ?? 4) * 10;
    const x = 250 + Math.sin((fact.bearing * Math.PI) / 180) * radius;
    const y = 145 - Math.cos((fact.bearing * Math.PI) / 180) * radius;
    append('circle', { cx: x, cy: y, r: 6, fill: '#345d32', stroke: '#f8fcef', 'stroke-width': 3 });
    append(
      'text',
      { x: x + 11, y: y + 4, fill: '#26442c', 'font-size': 11, 'font-family': 'Segoe UI, Arial' },
      LEX[fact.cls].name,
    );
  }
  append('circle', {
    cx: 250,
    cy: 145,
    r: 13,
    fill: '#183b35',
    stroke: '#f1f8e7',
    'stroke-width': 3,
  });
  append('path', {
    d: 'm245 147 5-7 5 7',
    fill: 'none',
    stroke: '#e3f3bd',
    'stroke-width': 2,
    'stroke-linecap': 'round',
  });
  append(
    'text',
    {
      x: 250,
      y: 174,
      'text-anchor': 'middle',
      fill: '#26442c',
      'font-size': 11,
      'font-family': 'Segoe UI, Arial',
    },
    'Você',
  );
}
