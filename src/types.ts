import { Socket } from 'net';
import { TLSSocket } from 'tls';

export type TSocket = Socket | TLSSocket | null

/**
* Tipo que representa un objeto con pares clave-valor.
*/
export type ParsedObject = { [key: string]: string | null };

export type RouterOSResponse = { type: string; attributes: Record<string, string> };
