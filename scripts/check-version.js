// Release guard: the pushed tag must be exactly "v" + package.json's version, so a
// release is never published under the wrong number (installed apps compare versions
// to decide whether to update).
//   node scripts/check-version.js "$GITHUB_REF"     (refs/tags/v1.2.3 or v1.2.3)
function checkVersion(tag, version) {
  const name = String(tag || '').replace(/^refs\/tags\//, '');
  const expected = `v${version}`;
  if (!name || name.startsWith('refs/')) {
    return { ok: false, message: `"${tag || ''}" is not a version tag; expected tag ${expected}` };
  }
  if (name !== expected) {
    return {
      ok: false,
      message: `tag ${name} doesn't match package.json version ${version}; expected tag ${expected}` +
        ' (use "npm version patch|minor|major" to bump the version and tag together)',
    };
  }
  return { ok: true, message: `tag ${name} matches package.json version ${version}` };
}

if (require.main === module) {
  const { version } = require('../package.json');
  const result = checkVersion(process.argv[2], version);
  (result.ok ? console.log : console.error)(result.message);
  process.exit(result.ok ? 0 : 1);
}

module.exports = { checkVersion };
