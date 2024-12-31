import * as readline from 'readline';
import { RouterOSClient, clearData } from './dist/index.js';

// Crear la interfaz readline
const rl = readline.createInterface({
  input: process.stdin,  // Entrada (lo que el usuario escribe)
  output: process.stdout,  // Salida (lo que se muestra en la consola)
  prompt: 'ROS> '  // Mensaje de prompt que aparecerá antes de que el usuario ingrese algo
});

// Almacenar los datos en un objeto
let connectionData = {
  host: '127.0.0.1',
  username: 'admin',
  password: '1892'
};

// Crear el cliente RouterOS

// Función para manejar la conexión y los comandos
const handleConnection = async () => {
  const dst = connectionData.host;
  const port = 8728;
  const secure = false;
  const username = connectionData.username;
  const password = connectionData.password;

  const apiRosSocket = new RouterOSClient(dst, port, secure);

  try {
    // Abre la conexión al socket
    await apiRosSocket.openSocket();

    // Enviar el comando de login
    await apiRosSocket.login(username, password);
    const loginRes = await apiRosSocket.readData();
    console.log(`Login response: ${clearData(loginRes.toString())}`);

    // Mantener el flujo interactivo de comandos
    rl.on('line', async (input) => {
      switch (input) {
        case 'help':
          console.log('Help command');
          break;
        case 'exit':
          rl.close();
          break;
        default:
          try {
            await apiRosSocket.sendMessage(input.split(' '));
            const response = await apiRosSocket.readData();
            console.log(`${clearData(response.toString())}`);
          } catch (error) {
            console.error('Error sending command:', error.message);
          }
          rl.prompt();  // Mantener el prompt activo
          break;
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
};

rl.question('host: ', (host) => {
  if (host) {
    connectionData.host = host;
  }

  rl.question('user: ', (username) => {
    if (username) {
      connectionData.username = username;
    }
    rl.question('password: ', (password) => {
      if (password) {
        connectionData.password = password;
      }
      rl.prompt();

      // Llamar a la función que maneja la conexión y comandos
      handleConnection();
    });
  });
});

rl.on('close', () => {
  console.log('Bye!');
  process.exit(0);
});
