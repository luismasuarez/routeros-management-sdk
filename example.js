import * as readline from 'readline';
import { RouterOSClient } from './dist/index.js'; // Asegúrate de importar correctamente tu clase ROS

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
  const { host, username, password } = connectionData;
  const port = 8728;
  const secure = false;  // Ajusta a `true` si la conexión debe ser segura

  // Instancia de la clase ROS
  const rosClient = new RouterOSClient(host, port, secure);

  try {
    // Abrir la conexión al socket
    await rosClient.connect();

    // Intentar iniciar sesión
    const loginSuccess = await rosClient.login(username, password);
    if (loginSuccess) {
      // Mantener el flujo interactivo de comandos
      rl.on('line', async (input) => {
        switch (input) {
          case 'help':
            console.log('Comandos disponibles:');
            console.log('help - Muestra este mensaje');
            console.log('q - Cierra la aplicación');
            break;
          case 'q':
            rosClient.close()
            rl.close();
            break;
          default:
            try {
              await rosClient.sendCommand(input.split(' '));
              // console.log(`Comando enviado: ${input}`);
            } catch (error) {
              // console.error('Error enviando comando:', error.message);
            }
            rl.prompt();  // Mantener el prompt activo
            break;
        }
      });

    } else {
      console.error('Fallo al iniciar sesión.');
    }

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
  console.log('¡Hasta luego!');
  process.exit(0);
});
