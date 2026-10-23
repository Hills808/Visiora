import { loadConfig } from './server/config.mjs';

try {
  const config = loadConfig();
  if (config.provider !== 'luna' || !config.ready || config.daily !== 2000000)
    throw new Error('Luna não está configurado com o teto autorizado de US$ 2 por dia.');
  console.log('Configuração Luna pronta. O registro de orçamento será usado neste notebook.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Configuração Luna inválida.');
  process.exitCode = 1;
}
