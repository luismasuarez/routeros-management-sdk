import { Socket } from 'net';
import { TLSSocket } from 'tls';

export type TSocket = Socket | TLSSocket | null

export type ParsedObject = { [key: string]: string | null };

export type RouterOSResponse = { type: string; attributes: Record<string, string> };
