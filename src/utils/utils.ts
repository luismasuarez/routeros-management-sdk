import { ParsedObject } from "../types";

export function clearData(data: string) {
  return data.replace(/\s+/g, '');
}

/**
 * Limpia y parsea una respuesta de texto en formato clave-valor.
 * @param response - Respuesta en bruto a procesar.
 * @returns Arreglo de objetos donde cada objeto representa una sección parseada.
 */
export function parseResponse(response: string): ParsedObject[] {
  // Limpiar caracteres no imprimibles
  response = response.replace(/[\x00-\x1F\x7F]/g, ''); // Elimina caracteres de control
  response = response.replace(/!done/g, ''); // Elimina la cadena '!done'

  return response
    .split("!re") // Separar por cada sección !re
    .filter((entry) => entry.includes("="))  // Excluir secciones irrelevantes
    .map((entry) => {
      const regex = /=([^=]+)=([^=]+)/g; // Expresión para pares clave-valor
      let match: RegExpExecArray | null;
      const obj: ParsedObject = {};

      // Extraer todos los pares clave-valor
      while ((match = regex.exec(entry)) !== null) {
        const key = match[1].trim(); // Clave
        const value = match[2].trim(); // Valor
        obj[key] = value || null; // Asignar al objeto, valores nulos si no existen
      }

      return obj;
    });
}
