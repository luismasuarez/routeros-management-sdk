import * as net from 'net';
import * as tls from 'tls';

/**
 * Clase para manejar la conexión con RouterOS a través de un socket.
 * Permite crear una conexión TCP o TLS/SSL.
 */
export class RouterOSClient {
  private host: string;
  private port: number;
  private secure: boolean;
  private socket: net.Socket | tls.TLSSocket | null = null;
  private authenticated: boolean = false;
  private buffer: Buffer;

  /**
   * Crea una instancia de ApiRosSocket.
   * @param host - Dirección IP o nombre del host.
   * @param port - Puerto al que conectar.
   * @param secure - Indica si debe usar conexión segura (TLS/SSL).
   */
  constructor(host: string, port: number, secure: boolean = false) {
    this.host = host;
    this.port = port;
    this.secure = secure;
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Abre un socket hacia el destino especificado en el puerto indicado.
   * Si `secure` es true, se establecerá una conexión TLS/SSL.
   */
  openSocket() {
    const socket = this.secure
      ? tls.connect(this.port, this.host, {
        rejectUnauthorized: true
      }, () => {
        console.log(`Conectado de forma segura a ${this.host}:${this.port}`);
      })
      : net.connect(this.port, this.host, () => {
        console.log(`Conectado sin seguridad \n HOST_IP: ${this.host} \n PORT: ${this.port}`);
      }
      );

    socket.on('connect', () => {
      console.log('Conexión establecida');
    })

    socket.on('error', (err: Error) => {
      console.error(`Error de conexión: ${err.message}`);
      this.close();
    });

    socket.on('close', () => {
      console.log('Conexión cerrada');
    })

    this.socket = socket;
  }

  /**
   * Realiza el login con el servidor RouterOS.
   * @param username - Nombre de usuario para la autenticación.
   * @param password - Contraseña para la autenticación.
   */
  async login(username: string, password: string): Promise<void> {
    try {
      const loginRequest = [
        '/login',
        '=name=' + username,
        '=password=' + password
      ];

      // Enviar el comando de login
      await this.sendMessage(loginRequest);

      // Leer la respuesta para verificar si la autenticación fue exitosa
      const response = this.buffer.toString();

      if (response.includes('!fatal')) {
        throw new Error('Error de autenticación: ' + response);
      } else {
        console.log('Autenticación exitosa');
        this.authenticated = true;
      }
    } catch (err) {
      throw new Error('Error en el proceso de login: ' + err);
    }
  }

  /**
   * Codifica una palabra según las reglas de RouterOS.
   * @param word - La palabra a codificar.
   * @returns - La palabra codificada.
   */
  encodeWord(word: string): Buffer {
    let length = word.length;
    let lengthBytes = this.encodeLength(length);
    let wordBytes = Buffer.from(word, 'utf-8'); // Codificamos el contenido como UTF-8

    return Buffer.concat([lengthBytes, wordBytes]);
  }

  /**
   * Codifica la longitud de una palabra según las reglas de RouterOS.
   * @param length - La longitud de la palabra.
   * @returns - Los bytes que representan la longitud de la palabra.
   */
  encodeLength(length: number): Buffer {
    if (length <= 0x7F) {
      return Buffer.from([length]);  // Un byte para longitudes pequeñas
    } else if (length <= 0x3FFF) {
      return Buffer.from([0x80 | (length >> 8), length & 0xFF]); // Dos bytes para longitudes medianas
    } else if (length <= 0x1FFFFF) {
      return Buffer.from([0xC0 | (length >> 16), (length >> 8) & 0xFF, length & 0xFF]); // Tres bytes
    } else if (length <= 0xFFFFFFF) {
      return Buffer.from([0xE0 | (length >> 24), (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF]); // Cuatro bytes
    } else {
      return Buffer.from([0xF0, (length >> 24) & 0xFF, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF]); // Cinco bytes
    }
  }

  /**
   * Envia un mensaje codificado a través del socket.
   * @param words - Las palabras a enviar (por ejemplo, ['/interface/print']).
   */
  async sendMessage(words: string[]): Promise<void> {
    const messageBuffer = Buffer.concat(words.map(word => this.encodeWord(word)));

    if (!(messageBuffer instanceof Buffer)) {
      throw new Error("messageBuffer no es un Buffer");
    }

    await new Promise<void>((resolve, reject) => {
      this.socket?.write(messageBuffer, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Finalmente, enviar una palabra de longitud cero para indicar el final de la sentencia
    await new Promise<void>((resolve, reject) => {
      this.socket?.write(this.encodeWord(''), (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Lee los datos del socket.
   * @returns - Devuelve los datos recibidos como un string.
   */
  async readData(): Promise<string> {
    let accumulatedData = '';
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("Socket no está conectado"));
        return;
      }

      this.socket.on('data', (data) => {
        accumulatedData += data.toString();
        if (accumulatedData.includes('!done')) {
          resolve(accumulatedData);
        }
      });

      this.socket.once('error', (err: Error) => {
        reject(err);
      });
    });
  }

  /**
   * Cierra la conexión del socket.
   */
  close(): void {
    if (this.socket) {
      this.socket.setTimeout(5000); // Esperar hasta 5 segundos para cerrar correctamente
      this.socket.end();
    }
  }
}
