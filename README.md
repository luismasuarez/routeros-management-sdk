# RouterOS SDK

![Project Status](https://img.shields.io/badge/status-WIP-orange)
![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)


Un SDK completo para la gestión y administración de dispositivos RouterOS a través de la API oficial de MikroTik. Este proyecto incluye un cliente TypeScript/JavaScript, una API REST, una interfaz web moderna y herramientas de desarrollo.

## 🚀 Características Principales

### 📦 SDK Core
- **Cliente TypeScript/JavaScript** para comunicación directa con RouterOS
- **Conexiones TCP y TLS/SSL** con soporte para autenticación
- **Reconexión automática** con configuración de reintentos
- **Manejo de eventos** para monitoreo en tiempo real
- **Parsing automático** de respuestas de la API RouterOS
- **Métodos helper** para operaciones comunes (interfaces, direcciones IP, etc.)

### 🌐 API REST
- **Servidor Express.js** con endpoints RESTful
- **Gestión de conexiones múltiples** con identificadores únicos
- **Validación de parámetros** y manejo de errores
- **CORS habilitado** para integración con frontends
- **Endpoints para comandos genéricos** y operaciones específicas

### 🎨 Interfaz Web
- **Dashboard moderno** con Tailwind CSS
- **Conexión visual** a dispositivos RouterOS
- **Comandos rápidos** para operaciones comunes
- **Visualización de resultados** en tiempo real
- **Interfaz responsive** para diferentes dispositivos

### 🛠️ Herramientas de Desarrollo
- **CLI interactivo** para pruebas y desarrollo
- **Configuración con variables de entorno** (.env)
- **Docker Compose** para entorno de pruebas con RouterOS
- **Build system** con tsup para múltiples formatos
- **TypeScript** con tipos completos

## ⚠️ Estado del Proyecto

**Este SDK está en fase de desarrollo activo.**  
Es posible que existan *breaking changes*, funciones incompletas o comportamientos inestables.  
Úsalo bajo tu propio riesgo y contribuye con *issues* y *pull requests* para ayudar a mejorarlo.

## 📋 Requisitos

- Node.js 16+ 
- npm o yarn
- Docker (opcional, para entorno de pruebas)

## 🛠️ Instalación

```bash
# Clonar el repositorio
git clone <repository-url>
cd router-os-sdk

# Instalar dependencias
npm install

# Construir el proyecto
npm run build
```

## 🚀 Uso Rápido

### 1. SDK Core (TypeScript/JavaScript)

```typescript
import { RouterOSClient } from 'router-os-sdk';

// Crear cliente
const client = new RouterOSClient('192.168.88.1', 8728, false);

// Conectar y autenticar
await client.connect();
await client.login('admin', 'password');

// Ejecutar comandos
const interfaces = await client.sendCommand(['/interface/print']);
const addresses = await client.getAddresses();

// Cerrar conexión
client.close();
```

### 2. API REST

```bash
# Iniciar servidor
npm run dev

# Conectar a dispositivo
curl -X POST http://localhost:3000/api/connect \
  -H "Content-Type: application/json" \
  -d '{
    "host": "192.168.88.1",
    "username": "admin", 
    "password": "password"
  }'

# Ejecutar comando
curl -X POST http://localhost:3000/api/command \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "192.168.88.1:8728",
    "command": ["/interface/print"]
  }'
```

### 3. Interfaz Web

```bash
# Iniciar servidor
npm run dev

# Abrir navegador en http://localhost:3000
```

### 4. CLI Interactivo

```bash
# Ejecutar CLI
npm run connect

# O configurar variables de entorno
export ROUTEROS_HOST=192.168.88.1
export ROUTEROS_USERNAME=admin
export ROUTEROS_PASSWORD=password
npm run connect
```

## 🔧 Configuración

### Variables de Entorno (.env)

```env
ROUTEROS_HOST=192.168.88.1
ROUTEROS_PORT=8728
ROUTEROS_USERNAME=admin
ROUTEROS_PASSWORD=password
ROUTEROS_SECURE=false
ROUTEROS_DEBUG=true
```

### Docker para Pruebas

```bash
# Iniciar RouterOS en Docker
docker-compose up -d

# Acceder a RouterOS en http://localhost:8089
# Usuario: admin, Contraseña: (vacía)
```

## 📚 API Reference

### RouterOSClient

#### Constructor
```typescript
new RouterOSClient(
  host: string,
  port?: number,
  secure?: boolean,
  maxReconnectAttempts?: number,
  reconnectInterval?: number,
  connectionTimeout?: number,
  debug?: boolean
)
```

#### Métodos Principales

- `connect()`: Establece conexión con el dispositivo
- `login(username, password)`: Autentica con el dispositivo
- `sendCommand(words[])`: Ejecuta comandos RouterOS
- `getInterfaces()`: Obtiene lista de interfaces
- `getAddresses()`: Obtiene direcciones IP
- `close()`: Cierra la conexión

#### Eventos

- `connect`: Conexión establecida
- `error`: Error de conexión
- `close`: Conexión cerrada
- `data`: Datos recibidos (modo debug)
- `trap`: Error de comando RouterOS
- `fatal`: Error fatal de RouterOS

### API REST Endpoints

#### POST /api/connect
Conecta a un dispositivo RouterOS

```json
{
  "host": "192.168.88.1",
  "port": 8728,
  "secure": false,
  "username": "admin",
  "password": "password"
}
```

#### POST /api/command
Ejecuta un comando RouterOS

```json
{
  "connectionId": "192.168.88.1:8728",
  "command": ["/interface/print"]
}
```

#### GET /api/interfaces/:connectionId
Obtiene interfaces del dispositivo

#### GET /api/addresses/:connectionId
Obtiene direcciones IP del dispositivo

#### DELETE /api/connect/:connectionId
Cierra la conexión

## 🎯 Ejemplos de Uso

### Gestión de Interfaces

```typescript
// Obtener interfaces
const interfaces = await client.getInterfaces();

// Agregar interfaz
await client.sendCommand([
  '/interface/add',
  '=name=ether2',
  '=type=ether'
]);

// Habilitar interfaz
await client.sendCommand([
  '/interface/enable',
  '=.id=ether2'
]);
```

### Configuración de IP

```typescript
// Agregar dirección IP
await client.sendCommand([
  '/ip/address/add',
  '=address=192.168.1.1/24',
  '=interface=ether1',
  '=comment=Main gateway'
]);

// Obtener direcciones
const addresses = await client.getAddresses();
```

### Monitoreo del Sistema

```typescript
// Recursos del sistema
const resources = await client.sendCommand(['/system/resource/print']);

// Paquetes instalados
const packages = await client.sendCommand(['/system/package/print']);

// Información del sistema
const system = await client.sendCommand(['/system/resource/print']);
```

## 🏗️ Estructura del Proyecto

```
router-os-sdk/
├── src/
│   ├── index.ts              # Punto de entrada principal
│   ├── routeros.client.ts    # Cliente RouterOS core
│   ├── types.ts              # Definiciones de tipos
│   └── api/
│       └── server.ts         # Servidor REST API
├── public/
│   ├── index.html            # Interfaz web
│   └── js/
│       └── app.js           # JavaScript del frontend
├── scripts/
│   └── example.js           # CLI interactivo
├── routeros-data/           # Datos para Docker RouterOS
├── dist/                    # Archivos compilados
└── docker-compose.yml       # Configuración Docker
```

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Ejecutar con coverage
npm run test:coverage
```

## 📦 Scripts Disponibles

- `npm run build`: Construir el proyecto
- `npm run dev`: Iniciar servidor de desarrollo
- `npm run connect`: Ejecutar CLI interactivo
- `npm run test`: Ejecutar tests
- `npm run dev:watch`: Build en modo watch

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia **GNU AGPLv3**. Ver el archivo `LICENSE` para más detalles.

## 👨‍💻 Autor

**Luisma Suarez** - [GitHub](https://github.com/luismasuarez)

---

## 🔗 Enlaces Útiles

- [Documentación oficial de RouterOS API](https://help.mikrotik.com/docs/display/ROS/API)
- [MikroTik RouterOS](https://mikrotik.com/)
- [Docker RouterOS](https://hub.docker.com/r/evilfreelancer/docker-routeros)
