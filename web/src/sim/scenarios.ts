import type { Detection, Observation } from '../brain/types.js';
export interface SimObject {
  cls: string;
  x: number;
  y: number;
}
export interface Scenario {
  id: string;
  name: string;
  place: string;
  hint: string;
  objects: SimObject[];
}
export const SCENARIOS: Scenario[] = [
  {
    id: 'sala',
    name: 'Sala de estar',
    place: 'living_room',
    hint: 'Sofá, uma cadeira e uma porta lateral.',
    objects: [
      { cls: 'couch', x: -1.8, y: 3 },
      { cls: 'chair', x: 1.6, y: 3 },
      { cls: 'door', x: 3.5, y: 1 },
      { cls: 'table', x: 0.3, y: 4 },
    ],
  },
  {
    id: 'quarto',
    name: 'Quarto',
    place: 'bedroom',
    hint: 'Cama, armário e janela.',
    objects: [
      { cls: 'bed', x: 0, y: 3.5 },
      { cls: 'cabinet', x: 3.5, y: 3 },
      { cls: 'window', x: -3, y: 0.8 },
    ],
  },
  {
    id: 'aula',
    name: 'Sala de aula',
    place: 'classroom',
    hint: 'Cadeiras, quadro e porta.',
    objects: [
      { cls: 'chair', x: -1, y: 3 },
      { cls: 'chair', x: 1, y: 3.5 },
      { cls: 'whiteboard', x: 0, y: 6 },
      { cls: 'door', x: 3, y: 0.3 },
    ],
  },
  {
    id: 'restaurante',
    name: 'Restaurante',
    place: 'restaurant',
    hint: 'Mesas, cadeiras e uma pessoa.',
    objects: [
      { cls: 'table', x: -1.5, y: 3 },
      { cls: 'chair', x: 1.5, y: 3 },
      { cls: 'person', x: 3, y: 2 },
      { cls: 'counter', x: 0, y: 5 },
    ],
  },
  {
    id: 'corredor',
    name: 'Corredor',
    place: 'corridor',
    hint: 'Duas portas em lados diferentes.',
    objects: [
      { cls: 'door', x: 2, y: 3 },
      { cls: 'door', x: -2, y: 4 },
      { cls: 'person', x: 0, y: 6 },
    ],
  },
  {
    id: 'banheiro',
    name: 'Banheiro',
    place: 'bathroom',
    hint: 'Pia, vaso sanitário e porta.',
    objects: [
      { cls: 'sink', x: 2, y: 2 },
      { cls: 'toilet', x: -1, y: 3 },
      { cls: 'door', x: -3, y: 0.5 },
    ],
  },
];
export function scenarioFrame(
  scenario: Scenario,
  time: number,
  frameId: number,
  yaw = 0,
  seed = 1,
  withDepth = true,
): Observation {
  // Mix independent frame/scene seeds before xorshift32; nearby seeds must not create correlated dropouts.
  let state = (Math.imul(seed, 0x9e3779b9) ^ Math.imul(frameId + 1, 0x85ebca6b)) >>> 0;
  const random = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const detections: Detection[] = scenario.objects.flatMap((object) => {
    if (random() < 0.12) return [];
    const bearing = (Math.atan2(object.x, object.y) * 180) / Math.PI - yaw;
    // Simulator sees 360 degrees for text exploration. This is explicitly not camera coverage.
    const range = Math.hypot(object.x, object.y);
    return [
      {
        cls: object.cls,
        score: 0.9,
        bearing: bearing + (random() - 0.5) * 2,
        ...(withDepth
          ? {
              depth: {
                meters: range * (1 + (random() - 0.5) * 0.12),
                sigma: range * 0.12,
                source: 'simulation' as const,
                frameId,
              },
            }
          : {}),
      },
    ];
  });
  return {
    frameId,
    capturedAtMs: time,
    detections,
    pose: { x: 0, y: 0, yaw },
    yawRate: 0,
    scene: {
      category: scenario.place,
      accepted: true,
      source: 'simulation',
      frameId,
      capturedAtMs: time,
    },
  };
}
