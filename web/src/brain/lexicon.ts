export interface Lexeme {
  name: string;
  plural: string;
  gender: 'm' | 'f';
  importance: number;
  dynamic?: boolean;
  aliases: string[];
}
const entry = (
  name: string,
  plural: string,
  gender: 'm' | 'f',
  importance = 0.5,
  aliases: string[] = [],
  dynamic = false,
): Lexeme => ({ name, plural, gender, importance, aliases, dynamic });
export const LEX: Record<string, Lexeme> = {
  person: entry('pessoa', 'pessoas', 'f', 0.95, ['alguém'], true),
  door: entry('porta', 'portas', 'f', 1),
  chair: entry('cadeira', 'cadeiras', 'f', 0.85),
  table: entry('mesa', 'mesas', 'f', 0.8, ['escrivaninha', 'carteira']),
  desk: entry('escrivaninha', 'escrivaninhas', 'f', 0.8),
  couch: entry('sofá', 'sofás', 'm', 0.8),
  bed: entry('cama', 'camas', 'f', 0.85),
  toilet: entry('vaso sanitário', 'vasos sanitários', 'm', 0.85, ['vaso', 'privada']),
  sink: entry('pia', 'pias', 'f', 0.8),
  window: entry('janela', 'janelas', 'f', 0.75),
  stairs: entry('escada', 'escadas', 'f', 0.9),
  whiteboard: entry('quadro', 'quadros', 'm', 0.75, ['lousa']),
  cabinet: entry('armário', 'armários', 'm', 0.7),
  counter: entry('balcão', 'balcões', 'm', 0.8),
  elevator: entry('elevador', 'elevadores', 'm', 0.9),
  column: entry('coluna', 'colunas', 'f', 0.7),
  wall: entry('parede', 'paredes', 'f', 0.7),
  ramp: entry('rampa', 'rampas', 'f', 0.8),
  refrigerator: entry('geladeira', 'geladeiras', 'f', 0.7),
  oven: entry('forno', 'fornos', 'm', 0.6),
  microwave: entry('micro-ondas', 'micro-ondas', 'm', 0.5),
  tv: entry('televisão', 'televisões', 'f', 0.6, ['tv']),
  laptop: entry('notebook', 'notebooks', 'm', 0.5, ['computador']),
  keyboard: entry('teclado', 'teclados', 'm'),
  mouse: entry('mouse', 'mouses', 'm'),
  book: entry('livro', 'livros', 'm', 0.4),
  clock: entry('relógio', 'relógios', 'm', 0.4),
  bottle: entry('garrafa', 'garrafas', 'f', 0.4),
  cup: entry('xícara', 'xícaras', 'f', 0.4),
  bowl: entry('tigela', 'tigelas', 'f', 0.4),
  glass: entry('copo', 'copos', 'm', 0.4),
  backpack: entry('mochila', 'mochilas', 'f', 0.5),
  handbag: entry('bolsa', 'bolsas', 'f', 0.5),
  suitcase: entry('mala', 'malas', 'f', 0.6),
  umbrella: entry('guarda-chuva', 'guarda-chuvas', 'm'),
  bench: entry('banco', 'bancos', 'm', 0.75),
  bicycle: entry('bicicleta', 'bicicletas', 'f', 0.65),
  car: entry('carro', 'carros', 'm', 0.65),
  motorcycle: entry('moto', 'motos', 'f', 0.65),
  bus: entry('ônibus', 'ônibus', 'm', 0.6),
  train: entry('trem', 'trens', 'm', 0.6),
  truck: entry('caminhão', 'caminhões', 'm', 0.6),
  dog: entry('cachorro', 'cachorros', 'm', 0.75, ['cão'], true),
  cat: entry('gato', 'gatos', 'm', 0.65, [], true),
  bird: entry('pássaro', 'pássaros', 'm', 0.4, [], true),
  pottedPlant: entry('planta', 'plantas', 'f', 0.4),
  remote: entry('controle remoto', 'controles remotos', 'm', 0.4),
  phone: entry('celular', 'celulares', 'm', 0.5, ['telefone']),
  vase: entry('vaso decorativo', 'vasos decorativos', 'm', 0.4),
  scissors: entry('tesoura', 'tesouras', 'f', 0.5),
  toothbrush: entry('escova de dentes', 'escovas de dentes', 'f', 0.4),
  hairDryer: entry('secador', 'secadores', 'm', 0.4),
  knife: entry('faca', 'facas', 'f', 0.6),
  fork: entry('garfo', 'garfos', 'm', 0.4),
  spoon: entry('colher', 'colheres', 'f', 0.4),
  banana: entry('banana', 'bananas', 'f', 0.3),
  apple: entry('maçã', 'maçãs', 'f', 0.3),
  orange: entry('laranja', 'laranjas', 'f', 0.3),
  pizza: entry('pizza', 'pizzas', 'f', 0.3),
  teddyBear: entry('urso de pelúcia', 'ursos de pelúcia', 'm', 0.3),
  sportsBall: entry('bola', 'bolas', 'f', 0.4),
};
export function normalize(text: string): string {
  return text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
export function findClass(name: string): string | undefined {
  const target = normalize(name);
  return Object.keys(LEX).find((key) =>
    [key, LEX[key].name, LEX[key].plural, ...LEX[key].aliases].some((x) => normalize(x) === target),
  );
}
