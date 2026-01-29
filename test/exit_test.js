/* globals QUnit */
'use strict';

var fs = require('fs');
var cp = require('child_process');

// A few helper functions.
function normalizeLineEndings(s) {
  return s.replace(/\r?\n/g, '\n');
}

// Read a fixture file, normalizing file contents to unix file endings.
function fixture(filename) {
  return normalizeLineEndings(String(fs.readFileSync(filename)));
}

// https://github.com/qunitjs/qunit/issues/1764
function eachEntry(dataset) {
  return Object.entries(dataset)
    .reduce((obj, [key, val]) => {
      obj[key] = [key, val];
      return obj;
    }, {});
}

QUnit.module('node-exit-x', function (hooks) {

  hooks.beforeEach(function () {
    this.origCwd = process.cwd();
    process.chdir('test/fixtures');
  });

  hooks.afterEach(function () {
    process.chdir(this.origCwd);
  });

  var fixtures = {
    '10-stdout-stderr.txt': 'node log.js 0 10 --stdout --stderr',
    '10-stdout.txt': 'node log.js 0 10 --stdout',
    '10-stderr.txt': 'node log.js 0 10 --stderr',
    '100-stdout-stderr.txt': 'node log.js 0 100 --stdout --stderr',
    '100-stdout.txt': 'node log.js 0 100 --stdout',
    '100-stderr.txt': 'node log.js 0 100 --stderr',
    '1000-stdout-stderr.txt': 'node log.js 0 1000 --stdout --stderr',
    '1000-stdout.txt': 'node log.js 0 1000 --stdout',
    '1000-stderr.txt': 'node log.js 0 1000 --stderr'
  };

  QUnit.test.each('exit output unpiped', eachEntry(fixtures), function (assert, [filename, command]) {
    var stdout;
    try {
      stdout = cp.execSync(command + ' 2>&1', { encoding: 'utf8' });
    } catch (e) {
      stdout = e.stdout;
    }
    var actual = normalizeLineEndings(stdout);
    var expected = fixture(filename);
    // Sometimes, the actual file lines are out of order on Windows.
    // But since the point of this lib is to drain the buffer and not
    // guarantee output order, we only test the length.
    assert.equal(actual.length, expected.length, 'output length');
    // The "fail" lines in log.js should NOT be output!
    assert.ok(actual.indexOf('fail') === -1, 'no output after exit');
  });

  QUnit.test.each('exit output piped', eachEntry(fixtures), function (assert, [filename, command]) {
    // On Windows, look for find, which is a horribly crippled grep alternative.
    var grep = process.platform === 'win32' ? 'find' : 'grep';

    var stdout;
    try {
      stdout = cp.execSync(command + ' 2>&1 | ' + grep + ' "std"', { encoding: 'utf8' });
    } catch (e) {
      stdout = e.stdout;
    }
    var actual = normalizeLineEndings(stdout);
    var expected = fixture(filename);
    assert.equal(actual.length, expected.length, 'output length');
    assert.ok(actual.indexOf('fail') === -1, 'no output after exit');
  });

  QUnit.test.each('exit code', eachEntry({
    'node log.js 0 10 --stdout --stderr': 0,
    'node log.js 1 10 --stdout --stderr': 1,
    'node log.js 123 10 --stdout --stderr': 123,
  }), function (assert, [command, expected]) {
    var status;
    try {
      cp.execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      status = 0;
    } catch (e) {
      status = e.status;
    }
    // The specified exit code should be passed through.
    assert.equal(status, expected, 'error code');
  });
});
