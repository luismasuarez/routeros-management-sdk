import * as net from "net";
import * as tls from "tls";
import { RouterOSResponse } from "./types";

export class RouterOSClient {
  private host: string;
  private port: number;
  private secure: boolean;
  private socket: net.Socket | tls.TLSSocket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number;
  private reconnectInterval: number;
  private connectionTimeout: number;

  /**
   * Creates an instance of RouterOSClient.
   * @param host - The IP address or hostname of the RouterOS device.
   * @param port - The port number for the connection (default 8728 for non-secure, 8729 for secure).
   * @param secure - Whether to use a secure (TLS) connection.
   * @param maxReconnectAttempts - Maximum number of reconnection attempts (default 3).
   * @param reconnectInterval - Interval between reconnection attempts in ms (default 2000).
   * @param connectionTimeout - Timeout for connection attempts in ms (default 10000).
   */
  constructor(host: string, port?: number, secure = false, maxReconnectAttempts = 3, reconnectInterval = 2000, connectionTimeout = 10000) {
    this.host = host;
    this.port = port || (secure ? 8729 : 8728);
    this.secure = secure;
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.reconnectInterval = reconnectInterval;
    this.connectionTimeout = connectionTimeout;
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
        });

        this.socket = connection;
      };

      const onConnect = () => {
        if (timeoutId) clearTimeout(timeoutId);
        this.reconnectAttempts = 0;
        resolve();
      };

      const onError = (err: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
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
    return response.some((resp) => resp.type === "!done");
  }

  /**
   * Sends a command to the RouterOS device.
   * @param words - The command and its parameters as an array of strings.
   */
  async sendCommand(words: string[]): Promise<RouterOSResponse[]> {
    this.writeSentence(words)

    const responses: RouterOSResponse[] = [];

    while (true) {
      const sentence = await this.readSentence();

      if (sentence.length === 0) {
        continue;
      }

      const reply = sentence[0];
      const attributes: Record<string, string> = {};

      for (const word of sentence.slice(1)) {
        const index = word.indexOf("=", 1);
        if (index === -1) {
          attributes[word] = "";
        } else {
          attributes[word.slice(0, index)] = word.slice(index + 1);
        }
      }

      responses.push({ type: reply, attributes });

      if (reply === "!done") {
        return responses;
      }
    }
  }

  /**
   * Writes a sentence (array of words) to the RouterOS device.
   * @param words - The command and parameters as an array of strings.
   */
  writeSentence(words: string[]): void {
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
    console.log(`<<< ${word}`);
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
      return Buffer.from([length]);
    } else if (length < 0x4000) {
      return Buffer.from([(length >> 8) | 0x80, length & 0xff]);
    } else if (length < 0x200000) {
      return Buffer.from([(length >> 16) | 0xc0, (length >> 8) & 0xff, length & 0xff]);
    } else if (length < 0x10000000) {
      return Buffer.from([
        (length >> 24) | 0xe0,
        (length >> 16) & 0xff,
        (length >> 8) & 0xff,
        length & 0xff,
      ]);
    } else {
      throw new Error("Length too large");
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
      const attributes = sentence.slice(1).reduce<Record<string, string>>((acc, word) => {
        const [key, value] = word.split("=", 2);
        acc[key] = value || "";
        return acc;
      }, {});
      responses.push({ type, attributes });
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
    console.log(`>>> ${word}`);
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
    } else if (firstByte < 0xc0) {
      while (this.buffer.length < 2) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      length = ((firstByte & ~0x80) << 8) | this.buffer[1];
      this.buffer = this.buffer.slice(2);
    } else {
      throw new Error("Unsupported length encoding");
    }
    return length;
  }

  /**
   * Closes the socket connection.
   */
  close(): void {
    this.socket?.setTimeout(5000);
    this.socket?.end();
  }
}
