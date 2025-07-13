import cors from 'cors';
import express from 'express';
import { RouterOSClient } from '../routeros.client';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Almacenar conexiones activas
const activeConnections = new Map<string, RouterOSClient>();

// Middleware para validar parámetros de conexión
const validateConnectionParams = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { host, port, secure, username, password } = req.body;

  if (!host || !username || !password) {
    return res.status(400).json({
      error: 'Missing required parameters: host, username, password'
    });
  }

  next();
};

// Conectar a RouterOS
app.post('/api/connect', validateConnectionParams, async (req, res) => {
  try {
    const { host, port, secure = false, username, password } = req.body;
    const connectionId = `${host}:${port || (secure ? 8729 : 8728)}`;

    // Verificar si ya existe una conexión
    if (activeConnections.has(connectionId)) {
      return res.json({
        success: true,
        message: 'Connection already exists',
        connectionId
      });
    }

    const client = new RouterOSClient(
      host,
      port,
      secure,
      3, // maxReconnectAttempts
      2000, // reconnectInterval
      10000, // connectionTimeout
      true // debug
    );

    // Eventos del cliente
    client.on('connect', () => {
      console.log(`Connected to ${host}`);
    });

    client.on('error', (error) => {
      console.error(`Connection error to ${host}:`, error);
    });

    client.on('close', () => {
      console.log(`Connection closed to ${host}`);
      activeConnections.delete(connectionId);
    });

    // Conectar y hacer login
    await client.connect();
    const loginSuccess = await client.login(username, password);

    if (!loginSuccess) {
      throw new Error('Login failed');
    }

    activeConnections.set(connectionId, client);

    res.json({
      success: true,
      message: 'Connected successfully',
      connectionId
    });

  } catch (error) {
    console.error('Connection error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Connection failed'
    });
  }
});

// Ejecutar comando
app.post('/api/command', async (req, res) => {
  try {
    const { connectionId, command } = req.body;

    if (!connectionId || !command) {
      return res.status(400).json({
        error: 'Missing required parameters: connectionId, command'
      });
    }

    const client = activeConnections.get(connectionId);
    if (!client) {
      return res.status(404).json({
        error: 'Connection not found. Please reconnect.'
      });
    }

    const response = await client.sendCommand(command);

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Command error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Command execution failed'
    });
  }
});

// Obtener interfaces
app.get('/api/interfaces/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const client = activeConnections.get(connectionId);

    if (!client) {
      return res.status(404).json({
        error: 'Connection not found. Please reconnect.'
      });
    }

    const interfaces = await client.getInterfaces();

    res.json({
      success: true,
      data: interfaces
    });

  } catch (error) {
    console.error('Get interfaces error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get interfaces'
    });
  }
});

// Obtener direcciones IP
app.get('/api/addresses/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const client = activeConnections.get(connectionId);

    if (!client) {
      return res.status(404).json({
        error: 'Connection not found. Please reconnect.'
      });
    }

    const addresses = await client.getAddresses();

    res.json({
      success: true,
      data: addresses
    });

  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get addresses'
    });
  }
});

// Desconectar
app.delete('/api/connect/:connectionId', (req, res) => {
  const { connectionId } = req.params;
  const client = activeConnections.get(connectionId);

  if (client) {
    client.close();
    activeConnections.delete(connectionId);
    res.json({
      success: true,
      message: 'Connection closed'
    });
  } else {
    res.status(404).json({
      error: 'Connection not found'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    activeConnections: activeConnections.size
  });
});

app.listen(PORT, () => {
  console.log(`🚀 RouterOS API Server running on port ${PORT}`);
  console.log(`�� Health check: http://localhost:${PORT}/api/health`);
});