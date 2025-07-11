import { parseResponse } from './utils';

describe('parseResponse', () => {
  it('debería parsear una respuesta simple correctamente', () => {
    const raw = '!re\n=address=192.168.1.1\n=interface=ether1\n!done';
    const result = parseResponse(raw);
    expect(result).toEqual([
      {
        address: '192.168.1.1',
        interface: 'ether1',
      },
    ]);
  });

  it('debería devolver un array vacío si no hay datos', () => {
    const raw = '!done';
    const result = parseResponse(raw);
    expect(result).toEqual([]);
  });
});