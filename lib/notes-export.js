// Notes export/import.
// .pwnotes: password-encrypted (scrypt -> AES-256-GCM), so it can be opened on any PC,
// unlike notes.enc, which only the same Windows account can decrypt.
// .txt: plain text, for reading elsewhere.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { validateNotes } = require('./notes-store');

const MIN_PASSWORD = 8;
const KDF = { name: 'scrypt', N: 32768, r: 8, p: 1 };
const MAX_N = 2 ** 20; // refuse files that would make scrypt run for minutes

function codeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function deriveKey(password, salt, { N, r, p }) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 32, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function encryptExport(data, password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw codeError('WEAK_PASSWORD', `Use a password of at least ${MIN_PASSWORD} characters.`);
  }
  const clean = validateNotes(data);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = await deriveKey(password, salt, KDF);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(clean), 'utf8'), cipher.final()]);
  return Buffer.from(JSON.stringify({
    format: 'pwnotes',
    v: 1,
    kdf: { ...KDF, salt: salt.toString('base64') },
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ct: ct.toString('base64'),
  }), 'utf8');
}

async function decryptExport(buf, password) {
  let file;
  try { file = JSON.parse(buf.toString('utf8')); } catch { file = null; }
  const kdf = file && file.kdf;
  if (!file || file.format !== 'pwnotes' || file.v !== 1 || !kdf || kdf.name !== 'scrypt'
      || !Number.isInteger(kdf.N) || kdf.N < 2 || kdf.N > MAX_N || kdf.r !== 8 || kdf.p !== 1
      || typeof kdf.salt !== 'string' || typeof file.iv !== 'string' || typeof file.tag !== 'string'
      || typeof file.ct !== 'string') {
    throw codeError('BAD_FORMAT', 'This is not a Private Workspace notes export.');
  }
  let plain;
  try {
    const key = await deriveKey(String(password), Buffer.from(kdf.salt, 'base64'), kdf);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(file.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(file.tag, 'base64'));
    plain = Buffer.concat([decipher.update(Buffer.from(file.ct, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw codeError('BAD_PASSWORD', 'Wrong password or damaged file.');
  }
  try {
    return validateNotes(JSON.parse(plain));
  } catch {
    throw codeError('BAD_FORMAT', 'The export opened but its notes are not valid.');
  }
}

const toText = (data) => data.notes.map((n) => n.body).join('\n\n---\n\n');

// Adds incoming notes after the existing ones. Notes whose text already exists are
// skipped; an incoming note whose id is taken by a different note gets a new id.
function mergeNotes(existing, incoming, makeId) {
  const ids = new Set(existing.notes.map((n) => n.id));
  const bodies = new Set(existing.notes.map((n) => n.body));
  const notes = existing.notes.slice();
  let added = 0;
  for (const note of incoming) {
    if (bodies.has(note.body)) continue;
    const id = ids.has(note.id) ? makeId() : note.id;
    notes.push({ id, body: note.body, updated: note.updated });
    ids.add(id);
    bodies.add(note.body);
    added++;
  }
  return { data: { version: 1, notes }, added };
}

const textToNotes = (files, now, makeId) => files
  .filter((f) => f.text.trim())
  .map((f) => ({ id: makeId(), body: f.text, updated: now }));

async function uniqueFile(dir, base, ext) {
  for (let i = 0; ; i++) {
    const file = path.join(dir, `${base}${i ? ` (${i})` : ''}.${ext}`);
    try { await fs.promises.access(file); } catch { return file; }
  }
}

module.exports = { encryptExport, decryptExport, toText, mergeNotes, textToNotes, uniqueFile, MIN_PASSWORD };
