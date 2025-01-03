const net = require("net");
const tls = require("tls");
const crypto = require("crypto");

class RouterOSClient {
  /**
   * Creates an instance of RouterOSClient.
   * @param {string} host - The IP address or hostname of the RouterOS device.
   * @param {number} port - The port number for the connection (default 8728 for non-secure, 8729 for secure).
   * @param {boolean} secure - Whether to use a secure (TLS) connection.
   */
  constructor(host, port, secure = false) {
    this.host = host;
    this.port = port || (secure ? 8729 : 8728);
    this.secure = secure;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.authenticated = false;
  }

  /**
   * Connects to the RouterOS device.
   * @returns {Promise<void>} Resolves when the connection is established.
   * @throws {Error} If the connection fails.
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const connection = this.secure
        ? tls.connect(this.port, this.host, {}, resolve)
        : net.connect(this.port, this.host, resolve);

      connection.on("error", (err) => reject(err));
      connection.on("data", (data) => (this.buffer = Buffer.concat([this.buffer, data])));

      this.socket = connection;
    });
  }

  /**
   * Logs in to the RouterOS device.
   * @param {string} username - The username for authentication.
   * @param {string} password - The password for authentication.
   * @returns {Promise<boolean>} True if login is successful, false otherwise.
   */
  async login(username, password) {
    await this.writeSentence(["/login", `=name=${username}`, `=password=${password}`]);
    const response = await this.readResponse();

    return response.some((resp) => resp.type === "!done");
  }

  /**
   * Sends a command to the RouterOS device.
   * @param {string[]} words - The command and its parameters as an array of strings.
   * @returns {Promise<Object[]>} The parsed response from the RouterOS device.
   */
  async sendCommand(words) {

    if (this.writeSentence(words) === 0) {
      return [];
    }

    const responses = [];

    while (true) {
      const sentence = await this.readSentence();
      console.log(sentence);

      if (sentence.length === 0) {
        continue;
      }

      const reply = sentence[0];
      const attrs = {};

      for (const word of sentence.slice(1)) {
        const index = word.indexOf('=', 1);
        if (index === -1) {
          attrs[word] = '';
        } else {
          attrs[word.slice(0, index)] = word.slice(index + 1);
        }
      }

      responses.push([reply, attrs]);

      if (reply === '!done') {
        return responses;
      }
    }
  }

  /**
   * Writes a sentence (array of words) to the RouterOS device.
   * @param {string[]} words - The command and parameters as an array of strings.
   */
  writeSentence(words) {
    for (const word of words) {
      this.writeWord(word);
    }
    this.writeWord(""); // Empty word to end the sentence.
  }

  /**
   * Writes a single word to the RouterOS device.
   * @param {string} word - The word to send.
   */
  writeWord(word) {
    // console.log(`<<< ${word}`);
    const length = Buffer.byteLength(word, "utf8");
    const lengthBuffer = this.encodeLength(length);
    const wordBuffer = Buffer.from(word, "utf8");
    this.socket.write(Buffer.concat([lengthBuffer, wordBuffer]));
  }

  /**
   * Encodes the length of a word into a binary format for RouterOS.
   * @param {number} length - The length of the word.
   * @returns {Buffer} The encoded length as a buffer.
   * @throws {Error} If the length exceeds the maximum allowed size.
   */
  encodeLength(length) {
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
   * @returns {Promise<Object[]>} The parsed response as an array of objects.
   */
  async readResponse() {
    const responses = [];
    while (true) {
      const sentence = await this.readSentence();
      const type = sentence[0];
      const attributes = sentence.slice(1).reduce((acc, word) => {
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
   * @returns {Promise<string[]>} The sentence as an array of strings.
   */
  async readSentence() {
    const sentence = [];
    while (true) {
      const word = await this.readWord();
      if (word === '') break;
      sentence.push(word);
    }
    return sentence;
  }

  /**
   * Reads a single word from the RouterOS device.
   * @returns {Promise<string>} The word as a string.
   */
  async readWord() {
    const length = await this.readLength();
    if (length === 0) return "";
    while (this.buffer.length < length) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const word = this.buffer.slice(0, length).toString("utf8");
    this.buffer = this.buffer.slice(length);
    // console.log(`>>> ${word}`);
    return word;
  }

  /**
   * Reads the length of the next word from the RouterOS device.
   * @returns {Promise<number>} The length of the word.
   * @throws {Error} If the length encoding is unsupported.
   */
  async readLength() {
    while (this.buffer.length < 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const firstByte = this.buffer[0];
    let length;
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
  * Cierra la conexión del socket.
  */
  close() {
    if (this.socket) {
      this.socket.setTimeout(5000); // Esperar hasta 5 segundos para cerrar correctamente
      this.socket.end();
    }
  }
}

// Example usage
(async () => {
  const client = new RouterOSClient("127.0.0.1", 8728, false);
  try {
    await client.connect();

    const loggedIn = await client.login("admin", "1892");
    if (loggedIn) {
      const response = await client.sendCommand(["/interface/print"]);
      // console.log(response);
      // const resoueces = await client.sendCommand(["/system/resource/print"]);
      // const resoueces = await client.sendCommand(["/ip/address/print"]);
      // console.log(resoueces);
    } else {
      console.log("Login failed");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (client.socket) client.socket.end();
  }
})();

module.exports = RouterOSClient;