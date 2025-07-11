import { EventEmitter } from "events";
import * as net from "net";
import * as tls from "tls";
import { RouterOSResponse } from "./types";

export class RouterOSClient extends EventEmitter {
  private host: string;
  private port: number;
  private secure: boolean;
  private socket: net.Socket | tls.TLSSocket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number;
  private reconnectInterval: number;
  private connectionTimeout: number;
  private debug: boolean;
  private sessionCookie: string | null = null;

  /**
   * Creates an instance of RouterOSClient.
   * @param host - The IP address or hostname of the RouterOS device.
   * @param port - The port number for the connection (default 8728 for non-secure, 8729 for secure).
   * @param secure - Whether to use a secure (TLS) connection.
   * @param maxReconnectAttempts - Maximum number of reconnection attempts (default 3).
   * @param reconnectInterval - Interval between reconnection attempts in ms (default 2000).
   * @param connectionTimeout - Timeout for connection attempts in ms (default 10000).
   */
  constructor(
    host: string,
    port?: number,
    secure = false,
    maxReconnectAttempts = 3,
    reconnectInterval = 2000,
    connectionTimeout = 10000,
    debug = false
  ) {
    super(); // Initialize EventEmitter
    this.host = host;
    this.port = port || (secure ? 8729 : 8728);
    this.secure = secure;
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.reconnectInterval = reconnectInterval;
    this.connectionTimeout = connectionTimeout;
    this.debug = debug; // guardar el flag
  }

  /**
   * Connects to the RouterOS device, with automatic reconnection on failure and timeout.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      const doConnect = () => {
        const connection = this.secure
          ? tls.connect(this.port, this.host, {}, onConnect)
          : net.connect(this.port, this.host, onConnect);

        connection.on("error", onError);
        connection.on("data", (data) => {
          this.buffer = Buffer.concat([this.buffer, data]);
          this.emit("data", data); // NUEVO: evento de datos crudos
        });
        connection.on("close", () => this.emit("close"));
        connection.on("end", () => this.emit("end"));
        connection.on("timeout", () => this.emit("timeout"));

        this.socket = connection;
      };

      const onConnect = () => {
        if (timeoutId) clearTimeout(timeoutId);
        this.reconnectAttempts = 0;
        this.emit("connect");
        resolve();
      };

      const onError = (err: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        this.emit("error", err);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => {
            doConnect();
          }, this.reconnectInterval);
        } else {
          reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts: ${err.message}`));
        }
      };

      timeoutId = setTimeout(() => {
        this.emit("timeout");
        reject(new Error(`Connection timed out after ${this.connectionTimeout} ms`));
      }, this.connectionTimeout);

      doConnect();
    });
  }

  /**
   * Logs in to the RouterOS device.
   * @param username - The username for authentication.
   * @param password - The password for authentication.
   */
  async login(username: string, password: string): Promise<boolean> {
    await this.writeSentence(["/login", `=name=${username}`, `=password=${password}`]);
    const response = await this.readResponse();

    // Extraer cookie de sesión si está presente
    const cookieResponse = response.find(resp => resp.attributes.ret);
    if (cookieResponse) {
      this.sessionCookie = cookieResponse.attributes.ret;
    }

    // Verificar múltiples tipos de respuesta
    const hasDone = response.some((resp) => resp.type === "!done");
    const hasTrap = response.some((resp) => resp.type === "!trap");
    const hasFatal = response.some((resp) => resp.type === "!fatal");

    if (hasTrap || hasFatal) {
      const errorMsg = response.find(resp => resp.type === "!trap" || resp.type === "!fatal");
      throw new Error(`Login failed: ${errorMsg?.attributes.message || 'Unknown error'}`);
    }

    return hasDone;
  }

  /**
   * Sends a command to the RouterOS device.
   * @param words - The command and its parameters as an array of strings.
   */
  async sendCommand(words: string[]): Promise<RouterOSResponse[]> {
    this.writeSentence(words);
    const responses: RouterOSResponse[] = [];

    while (true) {
      const sentence = await this.readSentence();
      if (sentence.length === 0) continue;

      const reply = sentence[0];
      const attributes = this.parseAttributes(sentence.slice(1));

      responses.push({ type: reply, attributes });

      // Manejar diferentes tipos de respuesta
      if (reply === "!done") break;
      if (reply === "!trap") {
        this.emit("trap", { type: reply, attributes });
        // Opcional: lanzar error
      }
      if (reply === "!fatal") {
        this.emit("fatal", { type: reply, attributes });
        break;
      }
    }

    return responses;
  }

  /**
   * Writes a sentence (array of words) to the RouterOS device.
   * @param words - The command and parameters as an array of strings.
   */
  writeSentence(words: string[]): void {
    if (!words.length || !words[0].startsWith('/')) {
      throw new Error('Invalid command format. Must start with /');
    }
    for (const word of words) {
      this.writeWord(word);
    }
    this.writeWord(""); // Empty word to end the sentence.
  }

  /**
   * Writes a single word to the RouterOS device.
   * @param word - The word to send.
   */
  writeWord(word: string): void {
    if (this.debug) console.log(`<<< ${word}`);
    const length = Buffer.byteLength(word, "utf8");
    const lengthBuffer = this.encodeLength(length);
    const wordBuffer = Buffer.from(word, "utf8");
    this.socket?.write(Buffer.concat([lengthBuffer, wordBuffer]));
  }

  /**
   * Encodes the length of a word into a binary format for RouterOS.
   * @param length - The length of the word.
   */
  private encodeLength(length: number): Buffer {
    if (length < 0x80) {
      // 1 byte
      return Buffer.from([length]);
    } else if (length < 0x4000) {
      // 2 bytes, big-endian
      const val = length | 0x8000;
      return Buffer.from([(val >> 8) & 0xFF, val & 0xFF]);
    } else if (length < 0x200000) {
      // 3 bytes, big-endian
      const val = length | 0xC00000;
      return Buffer.from([
        (val >> 16) & 0xFF,
        (val >> 8) & 0xFF,
        val & 0xFF
      ]);
    } else if (length < 0x10000000) {
      // 4 bytes, big-endian
      const val = length | 0xE0000000;
      return Buffer.from([
        (val >> 24) & 0xFF,
        (val >> 16) & 0xFF,
        (val >> 8) & 0xFF,
        val & 0xFF
      ]);
    } else {
      // 5 bytes: 0xF0, luego 4 bytes big-endian
      return Buffer.from([
        0xF0,
        (length >> 24) & 0xFF,
        (length >> 16) & 0xFF,
        (length >> 8) & 0xFF,
        length & 0xFF
      ]);
    }
  }

  /**
   * Reads the response from the RouterOS device.
   */
  async readResponse(): Promise<RouterOSResponse[]> {
    const responses: RouterOSResponse[] = [];
    while (true) {
      const sentence = await this.readSentence();
      const type = sentence[0];
      const attributes: Record<string, string> = {};
      for (const word of sentence.slice(1)) {
        const index = word.indexOf("=", 1);
        if (index === -1) {
          attributes[word] = "";
        } else {
          attributes[word.slice(0, index)] = word.slice(index + 1);
        }
      }
      responses.push({ type, attributes });
      if (type === "!trap") {
        this.emit("trap", { type, attributes });
        // Decidir si continuar o lanzar error
      }
      if (type === "!fatal") {
        this.emit("fatal", { type, attributes }); // NUEVO: evento fatal
        break;
      }
      if (type === "!done") break;
    }
    return responses;
  }

  /**
   * Reads a sentence (array of words) from the RouterOS device.
   */
  async readSentence(): Promise<string[]> {
    const sentence: string[] = [];
    while (true) {
      const word = await this.readWord();
      if (word === "") break;
      sentence.push(word);
    }
    this.emit("sentence", sentence); // NUEVO: evento de sentencia completa
    return sentence;
  }

  /**
   * Reads a single word from the RouterOS device.
   */
  async readWord(): Promise<string> {
    const length = await this.readLength();
    if (length === 0) return "";
    while (this.buffer.length < length) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const word = this.buffer.slice(0, length).toString("utf8");
    this.buffer = this.buffer.slice(length);
    if (this.debug) console.log(`>>> ${word}`);
    return word;
  }


  /**
   * Reads the length of the next word from the RouterOS device.
   */
  private async readLength(): Promise<number> {
    while (this.buffer.length < 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const firstByte = this.buffer[0];
    let length: number;

    if (firstByte < 0x80) {
      length = firstByte;
      this.buffer = this.buffer.slice(1);
    } else if (firstByte < 0xC0) {
      while (this.buffer.length < 2) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      length = ((this.buffer[0] & 0x7F) << 8) | this.buffer[1];
      this.buffer = this.buffer.slice(2);
    } else if (firstByte < 0xE0) {
      while (this.buffer.length < 3) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      length = ((this.buffer[0] & 0x3F) << 16) | (this.buffer[1] << 8) | this.buffer[2];
      this.buffer = this.buffer.slice(3);
    } else if (firstByte < 0xF0) {
      while (this.buffer.length < 4) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      length = ((this.buffer[0] & 0x1F) << 24) | (this.buffer[1] << 16) | (this.buffer[2] << 8) | this.buffer[3];
      this.buffer = this.buffer.slice(4);
    } else if (firstByte === 0xF0) {
      while (this.buffer.length < 5) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      length = (this.buffer[1] << 24) | (this.buffer[2] << 16) | (this.buffer[3] << 8) | this.buffer[4];
      this.buffer = this.buffer.slice(5);
    } else {
      throw new Error("Unsupported length encoding");
    }
    return length;
  }

  /**
   * Parses attributes from an array of words.
   * @param words - The words to parse.
   * @returns A dictionary of attributes.
   */
  private parseAttributes(words: string[]): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (const word of words) {
      const index = word.indexOf("=", 1);
      if (index === -1) {
        attributes[word] = "";
      } else {
        attributes[word.slice(0, index)] = word.slice(index + 1);
      }
    }
    return attributes;
  }

  /**
   * Closes the socket connection.
   */
  close(): void {
    this.socket?.setTimeout(5000);
    this.socket?.end();
  }

  // Métodos helper para operaciones comunes
  async getInterfaces(): Promise<RouterOSResponse[]> {
    return this.sendCommand(["/interface/print"]);
  }

  async getAddresses(): Promise<RouterOSResponse[]> {
    return this.sendCommand(["/ip/address/print"]);
  }

  async addInterface(name: string, type: string): Promise<RouterOSResponse[]> {
    return this.sendCommand(["/interface/add", `=name=${name}`, `=type=${type}`]);
  }
}
