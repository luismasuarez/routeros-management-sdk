### Palabras de respuesta

- Toda respuesta comienza con un signo `!`
- Toda respuesta termina con `!done`, con excepcion del tipo `!trap`
- Si un comando se procesa correctamente cada respuesta comienza con `!re`
- Si un comando no se procesa bien se recibe la respuesta `!fatal`
- Si la conexion de la API se cierra RouterOS envia `!fatal` seguido de la razon porque se cerro la conexion.

#### Ejemplos

```bash
# Login successful
>>> !done

# Login failed
>>> !trap
>>> =message=invalid user name or password (6)
>>> !done
    
#Unlogged command
>>> !fatal
>>> not logged in

# Logged with successful command
>>> !re
.......
.......
>>> !re
.......
.......
>>> !done
```

### En caso de manejar el reto en el login

```javascript
if (response[0] && response[0].attributes["=ret"]) {
      // Challenge-Response Authentication
      const challenge = Buffer.from(response[0].attributes["=ret"], "hex");
      const hash = crypto.createHash("md5");
      hash.update(Buffer.concat([Buffer.from([0]), Buffer.from(password, "utf8"), challenge]));
      const hashedPassword = hash.digest("hex");

      const authResponse = await this.sendCommand([
        "/login",
        `=name=${username}`,
        `=response=00${hashedPassword}`,
      ]);

      return authResponse.some((resp) => resp.type === "!done");
    }
```
