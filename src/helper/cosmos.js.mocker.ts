jest.mock('@cosmjs/encoding', () => ({
  ...(jest.requireActual('@cosmjs/encoding') as any),
  fromBase64: jest.fn((base64String: string): Uint8Array | string => {
    try {
      if (!base64String.match(/^[a-zA-Z0-9+/]*={0,2}$/)) {
        throw new Error('Invalid base64 string format');
      }
      return Buffer.from(base64String, 'base64');
    } catch (e) {
      return base64String;
    }
  }),
}));
