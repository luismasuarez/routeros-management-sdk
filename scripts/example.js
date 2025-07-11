import chalk from 'chalk';
import * as readline from 'readline';
import { config } from 'dotenv'; // 👈
import { RouterOSClient } from '../dist/index.js';

config(); // 👈 Cargar .env

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.blue('RouterOS > ')
});

let connectionData = {
  host: process.env.ROUTEROS_HOST || '127.0.0.1',
  username: process.env.ROUTEROS_USERNAME || 'admin',
  password: process.env.ROUTEROS_PASSWORD || ''
};

const handleConnection = async () => {
  const { host, username, password } = connectionData;
  const port = Number(process.env.ROUTEROS_PORT) || 8728;
  const secure = process.env.ROUTEROS_SECURE === 'true';

  const rosClient = new RouterOSClient(
    host,
    port,
    secure
  );

  // ✅ Opcional: set debug flag si existe
  rosClient.debug = process.env.ROUTEROS_DEBUG === 'true';

  rosClient.on('connect', () => {
    console.log(chalk.greenBright('[CONNECTED] Conectado al RouterOS'));
  });

  rosClient.on('error', (err) => {
    console.error(chalk.redBright('[ERROR]'), err.message);
  });

  rosClient.on('data', (data) => {
    if (rosClient.debug) {
      console.log(chalk.yellow('[RAW DATA]'), data.toString('utf8'));
    }
  });

  rosClient.on('sentence', (sentence) => {
    if (rosClient.debug) {
      console.log(chalk.cyan('[SENTENCE]'));
      console.dir(sentence, { colors: true, depth: null });
    }
  });

  rosClient.on('close', () => {
    console.log(chalk.gray('[CLOSED] Conexión cerrada'));
  });

  try {
    await rosClient.connect();
    const loginSuccess = await rosClient.login(username, password);

    if (loginSuccess) {
      rl.prompt();
      rl.on('line', async (input) => {
        switch (input.trim()) {
          case 'help':
            console.log(`
Comandos disponibles:
  help  - Ayuda
  q     - Cerrar
  <cmd> - Ejecuta comando RouterOS`);
            break;
          case 'q':
            console.log(chalk.gray('Cerrando conexión...'));
            rosClient.close();
            rl.close();
            break;
          default:
            try {
              const response = await rosClient.sendCommand(input.split(' '));
              console.log(chalk.magenta('[RESPONSE]'));
              console.dir(response, { colors: true, depth: null });
            } catch (err) {
              console.error(chalk.red('[SEND ERROR]'), err.message);
            }
            break;
        }
        rl.prompt();
      });

    } else {
      console.error(chalk.red('Login fallido.'));
      rl.close();
    }

  } catch (err) {
    console.error(chalk.red('Error:'), err.message);
    rl.close();
  }
};

console.clear();
rl.question(`host [${connectionData.host}]: `, (host) => {
  if (host) connectionData.host = host;
  rl.question(`user [${connectionData.username}]: `, (username) => {
    if (username) connectionData.username = username;
    rl.question('password: ', (password) => {
      if (password) connectionData.password = password;
      handleConnection();
    });
  });
});

rl.on('close', () => {
  console.log(chalk.gray('¡Hasta luego!'));
  process.exit(0);
});
