// A small encrypted JSON file (Electron safeStorage / Windows DPAPI in the app) for
// settings that reveal browsing, such as open tabs and per-site choices.
// Unlike notes, nothing here is precious: a missing, unreadable or invalid file simply
// starts fresh. Saves are validated, written to a temp file and renamed, one at a time.
const fs = require('fs');

function createSecureStore({ file, cipher, validate, empty }) {
  let queue = Promise.resolve();

  async function load() {
    try {
      if (!cipher.isAvailable()) return empty();
      return validate(JSON.parse(cipher.decrypt(await fs.promises.readFile(file))));
    } catch {
      return empty();
    }
  }

  function save(data) {
    const run = queue.then(async () => {
      const clean = validate(data);
      if (!cipher.isAvailable()) throw new Error('Encryption unavailable: not saved.');
      const tmp = `${file}.tmp`;
      await fs.promises.writeFile(tmp, cipher.encrypt(JSON.stringify(clean)));
      await fs.promises.rename(tmp, file);
    });
    queue = run.catch(() => {});
    return run;
  }

  return { load, save, whenIdle: () => queue };
}

module.exports = { createSecureStore };
