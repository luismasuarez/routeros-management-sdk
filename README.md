## Documentación del SDK para RouterOS

Esta documentación proporciona ejemplos prácticos para entender cómo usar el SDK para comunicarse con dispositivos RouterOS utilizando la API oficial. Se cubren los conceptos clave y cómo se manejan los comandos y atributos en tu SDK.

---

### Conexión con el Dispositivo RouterOS

Para interactuar con un dispositivo RouterOS, primero debes establecer una conexión. Tu SDK permite conexiones TCP y TLS/SSL según sea necesario.

#### Ejemplo de Conexión
```typescript
import { RouterOSClient } from './client';

const client = new RouterOSClient('192.168.88.1', 8728, false); // Conexión TCP
client.openSocket();
```
En este ejemplo:
- `192.168.88.1` es la dirección IP del dispositivo.
- `8728` es el puerto de la API.
- El tercer parámetro (`false`) indica que no se utiliza TLS/SSL.

---

### Autenticación

La autenticación se realiza utilizando el comando `/login` de la API. El SDK abstrae este proceso para simplificarlo.

#### Ejemplo de Login
```typescript
await client.login('admin', 'password');
```
En este caso:
- `admin` es el nombre de usuario.
- `password` es la contraseña.

Si la autenticación falla, el SDK arrojará un error.

---

### Envío de Comandos

Los comandos en la API de RouterOS consisten en un **command word** seguido de una lista opcional de **attribute words**. El SDK maneja automáticamente la codificación de estos comandos.

#### Ejemplo 1: Consultar Interfaces
Este ejemplo muestra cómo enviar un comando para listar las interfaces del dispositivo.

```typescript
const command = ['/interface/print'];
await client.sendMessage(command);
const response = await client.readData();
console.log(response);
```
Aquí:
- `/interface/print` es el **command word** que solicita la lista de interfaces.
- `sendMessage` envía el comando, y `readData` recupera la respuesta.

#### Ejemplo 2: Agregar una Dirección IP

```typescript
const command = [
  '/ip/address/add',
  '=address=192.168.1.1',
  '=interface=ether1',
  '=comment=Main gateway'
];
await client.sendMessage(command);
const response = await client.readData();
console.log(response);
```
En este caso:
- `/ip/address/add` es el comando para agregar una dirección IP.
- `=address=192.168.1.1` especifica la dirección IP.
- `=interface=ether1` indica la interfaz a usar.
- `=comment=Main gateway` añade un comentario descriptivo.

#### Ejemplo 3: Reiniciar el Dispositivo

```typescript
const command = ['/system/reboot'];
await client.sendMessage(command);
```
Este comando envía una solicitud para reiniciar el dispositivo RouterOS.

---

### Manejo de Respuestas

El SDK incluye utilidades para procesar las respuestas de la API, las cuales suelen estar en formato clave-valor.

#### Ejemplo: Parsear una Respuesta
Imagina que recibes la siguiente respuesta:
```
!re
=address=192.168.1.1
=interface=ether1
!done
```
Puedes procesarla con el método `parseResponse`:

```typescript
import { parseResponse } from './utils';

const rawResponse = '!re\n=address=192.168.1.1\n=interface=ether1\n!done';
const parsedData = parseResponse(rawResponse);
console.log(parsedData);
```
Salida:
```json
[
  {
    "address": "192.168.1.1",
    "interface": "ether1"
  }
]
```

---

### Cierre de la Conexión

Una vez que hayas terminado de usar el dispositivo RouterOS, asegúrate de cerrar la conexión para liberar recursos.

#### Ejemplo de Cierre
```typescript
client.close();
```

---

### Resumen de Métodos Clave

| Método          | Descripción                                         |
| --------------- | --------------------------------------------------- |
| `openSocket`    | Abre una conexión TCP o TLS con el dispositivo.     |
| `login`         | Autentica al usuario con el dispositivo RouterOS.   |
| `sendMessage`   | Envía comandos codificados al dispositivo.          |
| `readData`      | Lee y devuelve las respuestas del dispositivo.      |
| `close`         | Cierra la conexión del socket.                      |
| `parseResponse` | Procesa y convierte las respuestas en formato JSON. |

---

# 📦 Your npm Module Template

Welcome to your new npm module template! 🎉 Here’s a quick guide to get started.

## 📁 Project Structure

- **`/src`**: Source code
  - `index.ts`: Entry point
  - `starter_example.ts`: Example functions
  - `types.ts`: Type definitions
- **`package.json`**: Project metadata and scripts
- **`tsconfig.json`**: TypeScript configuration
- **`tsup.config.ts`**: Build configuration

## ✏️ Customization Steps

1. **Edit `src/starter_example.ts`**  
   Modify or add functions as needed.

2. **Update `src/types.ts`**  
   Define or change types for your module.

3. **Configure `src/index.ts`**  
   Export functions and types from this file.

4. **Update `package.json`**  
   Set your module’s name, description, and other details.

5. **Build Your Module**  
   Run `npm run build` to compile the TypeScript code.

## 🚀 Publishing Your Module

1. **Login to npm**  
   If you haven’t logged in yet, run:
   ```bash
   npm login
   ```
2. **Publish to npm**
   ```bash
   npm publish
   ```

Happy coding! 🚀