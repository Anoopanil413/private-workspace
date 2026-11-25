const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSecureStore } = require('../lib/secure-store');

function fakeCipher({ available = true } = {}) {
  return {
    isAvailable: () => available,
    encrypt: (s) => Buffer.from([...Buffer.from(s, 'utf8').toString('base64')].reverse().join(''), 'utf8'),
    decrypt: (b) => {
      const text = Buffer.from([...b.toString('utf8')].reverse().join(''), 'base64').toString('utf8');
      if (!text.startsWith('{')) throw new Error('Decryption failed');
      return text;
    },
  };
}

const tempFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pw-secure-')), 'data.enc');
const validate = (x) => {
  if (!x || typeof x.value !== 'string') throw new TypeError('bad');
  return { value: x.value };
};
const empty = () => ({ value: '' });
const make = (file, opts = {}) => createSecureStore({ file, cipher: fakeCipher(opts), validate, empty });

test('save then load returns the data, and the file does not contain it in plain text', async () => {
  const file = tempFile();
  await make(file).save({ value: 'https://mail.google.com' });
  assert.deepEqual(await make(file).load(), { value: 'https://mail.google.com' });
  assert.ok(!fs.readFileSync(file, 'utf8').includes('mail.google'));
});

test('a missing file loads as empty', async () => {
  assert.deepEqual(await make(tempFile()).load(), { value: '' });
});

test('a garbage file loads as empty and the next save replaces it', async () => {
  const file = tempFile();
  fs.writeFileSync(file, 'garbage');
  const store = make(file);
  assert.deepEqual(await store.load(), { value: '' });
  await store.save({ value: 'new' });
  assert.deepEqual(await store.load(), { value: 'new' });
});

test('a file that decrypts to invalid data loads as empty', async () => {
  const file = tempFile();
  fs.writeFileSync(file, fakeCipher().encrypt(JSON.stringify({ value: 5 })));
  assert.deepEqual(await make(file).load(), { value: '' });
});

test('with encryption unavailable, load is empty and save throws without writing', async () => {
  const file = tempFile();
  const store = make(file, { available: false });
  assert.deepEqual(await store.load(), { value: '' });
  await assert.rejects(store.save({ value: 'x' }), /Encryption unavailable/);
  assert.equal(fs.existsSync(file), false);
});

test('invalid data is rejected on save', async () => {
  await assert.rejects(make(tempFile()).save({ value: 1 }), TypeError);
});

test('no .tmp file remains and overlapping saves keep the last one', async () => {
  const file = tempFile();
  const store = make(file);
  await Promise.all([store.save({ value: 'first' }), store.save({ value: 'second' })]);
  await store.whenIdle();
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['data.enc']);
  assert.deepEqual(await store.load(), { value: 'second' });
});
