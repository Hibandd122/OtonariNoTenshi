import crypto from 'node:crypto';

export const EDGE_TTS_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
export const EDGE_TTS_VERSION = '143.0.3650.75';

const COPYRIGHT_PREFIX = Buffer.from('Copyright (C) Microsoft Corporation. All rights reserved.', 'ascii');

function rol16(value) {
  return ((value << 16) | (value >>> 16)) >>> 0;
}

function toLittleEndianWords(data) {
  const padded = Buffer.alloc(Math.ceil(data.length / 8) * 8);
  data.copy(padded);
  const words = [];
  for (let offset = 0; offset < padded.length; offset += 4) words.push(padded.readUInt32LE(offset));
  return words;
}

function cs64Digest(data, digest) {
  const keyA = (digest.readUInt32LE(0) | 1) >>> 0;
  const keyB = (digest.readUInt32LE(4) | 1) >>> 0;
  const words = toLittleEndianWords(data);
  let swapAcc = 0;
  let swapLast = 0;
  for (let i = 0; i < words.length; i += 2) {
    const x = words[i];
    const y = words[i + 1];
    let t = rol16((Math.imul(rol16(x), 0xef0569fb) + Math.imul(x, keyA)) >>> 0);
    let q = Math.imul(t, 0x76f50f34) >>> 0;
    swapAcc = (swapAcc + Math.imul(rol16(q), 0xc3efea97) + q) >>> 0;
    t = rol16((Math.imul(rol16(y), 0xc31713db) + Math.imul(y, keyB)) >>> 0);
    q = Math.imul(t, 0x1881ce3c) >>> 0;
    swapLast = (Math.imul(rol16(q), 0x35bd1ec9) + q) >>> 0;
    swapAcc = (swapAcc + swapLast) >>> 0;
  }

  let state = 0;
  let acc = 0;
  for (let i = 0; i < words.length; i += 2) {
    state = Math.imul(state + words[i], keyA) >>> 0;
    for (const c of [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83]) {
      state = Math.imul(rol16(state), c) >>> 0;
    }
    let t = Math.imul(words[i + 1] + state, keyB) >>> 0;
    t = Math.imul(rol16(t), 0xa27416f5) >>> 0;
    t = rol16(Math.imul(rol16(t), 0xd38396ff) >>> 0);
    acc = (acc + state) >>> 0;
    state = Math.imul(rol16(Math.imul(t, 0x7c932b89) >>> 0), 0xbfa49f69) >>> 0;
    acc = (acc + state) >>> 0;
  }
  const output = Buffer.alloc(8);
  output.writeUInt32LE((swapLast ^ state) >>> 0, 0);
  output.writeUInt32LE((swapAcc ^ acc) >>> 0, 4);
  return output.toString('hex').toUpperCase();
}

export function generateSecMsGecV2(now = Date.now()) {
  let ticks = Math.floor(now / 1000) + 11644473600;
  ticks -= ticks % 300;
  ticks = (ticks * 1_000_000_000) / 100;
  const tickText = ticks.toFixed(0);
  const input = Buffer.concat([COPYRIGHT_PREFIX, Buffer.from(`${tickText}${EDGE_TTS_TOKEN}`, 'ascii')]);
  const sha256 = crypto.createHash('sha256').update(input).digest();
  return `${cs64Digest(input, sha256)}-${sha256.toString('hex').toUpperCase()}`;
}

export function generateMuid() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}
