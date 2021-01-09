'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const spawn = require('cross-spawn');

const { fixturesDir, spawnOpts } = require('./util');

const elmtestPath = path.join(__dirname, '..', 'bin', 'elm-test');

const packageInfo = require('../package.json');
const elmTestVersion = packageInfo.version;

// exit codes
const resultSuccess = 0;
const resultErrored = 1;
const resultFailureThreshold = 2;

function execElmTest(args, cwd = '.') {
  return spawn.sync(
    elmtestPath,
    args,
    Object.assign({ encoding: 'utf-8', cwd }, spawnOpts)
  );
}

function getDetailedMessage(message, runResult) {
  return (
    message +
    '\n\n' +
    'STDOUT\n' +
    runResult.stdout +
    '\n\n' +
    'STDERR\n' +
    runResult.stderr
  );
}

function assertTestSuccess(runResult) {
  const msg =
    'Expected success (exit code ' +
    resultSuccess +
    '), but got ' +
    runResult.status;
  assert.strictEqual(
    resultSuccess,
    runResult.status,
    getDetailedMessage(msg, runResult)
  );
}

function assertTestErrored(runResult) {
  const msg =
    'Expected error (exit code ' +
    resultErrored +
    '), but got ' +
    runResult.status;
  assert.strictEqual(
    resultErrored,
    runResult.status,
    getDetailedMessage(msg, runResult)
  );
}

function assertTestFailure(runResult) {
  const msg =
    'Expected failure (exit code >= ' +
    resultFailureThreshold +
    '), but got ' +
    runResult.status;
  assert.ok(
    runResult.status >= resultFailureThreshold,
    getDetailedMessage(msg, runResult)
  );
}

function readdir(dir) {
  return fs
    .readdirSync(dir)
    .filter((item) => item.endsWith('.elm'))
    .sort();
}

describe('--help', () => {
  it('Should print the usage and exit indicating success', () => {
    const runResult = execElmTest(['--help']);
    assertTestSuccess(runResult);
    // ensure we have a non-empty output
    assert.ok(runResult.stdout.length > 0);
  }).timeout(5000);
});

describe('--version', () => {
  it('Should print the version and exit indicating success', () => {
    const runResult = execElmTest(['--version']);
    assertTestSuccess(runResult);
    assert.strictEqual(elmTestVersion, runResult.stdout.trim());
  }).timeout(5000);
});

/* Test examples */

describe('Testing elm-test on an example application', () => {
  const cwd = 'example-application';

  it('Should pass for successful tests', () => {
    const args = path.join('tests', '*Pass*.elm');
    const runResult = execElmTest([args], cwd);
    assertTestSuccess(runResult);
  }).timeout(60000);

  it('Should fail for failing tests', () => {
    const args = path.join('tests', '*Fail*.elm');
    const runResult = execElmTest([args], cwd);
    assertTestFailure(runResult);
  }).timeout(60000);
});

describe('Testing elm-test on an example package', () => {
  const cwd = 'example-package';

  it('Should pass for successful tests', () => {
    const args = path.join('tests', '*Pass*.elm');
    const runResult = execElmTest([args], cwd);
    assertTestSuccess(runResult);
  }).timeout(60000);

  it('Should fail for failing tests', () => {
    const args = path.join('tests', '*Fail*.elm');
    const runResult = execElmTest([args], cwd);
    assertTestFailure(runResult);
  }).timeout(60000);
});

describe('Testing elm-test on example-application-src', () => {
  const cwd = 'example-application-src';

  it('Should pass successfully', () => {
    const runResult = execElmTest(['src'], cwd);
    assertTestSuccess(runResult);
  }).timeout(60000);
});

describe('Testing elm-test on an application with no tests', () => {
  const cwd = 'example-application-no-tests';

  it('Should fail due to missing tests', () => {
    const runResult = execElmTest([], cwd);
    assertTestFailure(runResult);
  }).timeout(60000);
});

/* ci tests on single elm files */
describe('Testing elm-test on single Elm files', () => {
  const cwd = fixturesDir;

  // passing tests
  const passingTestFiles = [
    'Dependency.elm',
    'One.elm',
    'Ports.elm',
    'Several.elm',
    'TrickyMultilines.elm',
    'Unexposed.elm',
  ];

  for (const testToRun of passingTestFiles) {
    it(`Should succeed for the passing test: ${testToRun}`, () => {
      const itsPath = path.join('tests', 'Passing', testToRun);
      const runResult = execElmTest([itsPath], cwd);
      assertTestSuccess(runResult);
    }).timeout(10000);
  }

  it(`Should run every file in tests/Passing`, () => {
    const filesFound = readdir(path.join(cwd, 'tests', 'Passing'));
    assert.deepStrictEqual(filesFound, passingTestFiles);
  });

  // failing tests
  const failingTestFiles = [
    'Fuzz.elm',
    'One.elm',
    'OneRuntimeException.elm',
    'OneTodo.elm',
    'Several.elm',
    'SeveralTodos.elm',
    'SeveralWithComments.elm',
    'SplitSocketMessage.elm',
  ];

  for (const testToRun of failingTestFiles) {
    it(`Should fail for the failing test: ${testToRun}`, () => {
      const itsPath = path.join('tests', 'Failing', testToRun);
      const runResult = execElmTest([itsPath], cwd);
      assertTestFailure(runResult);
    }).timeout(10000);
  }

  it(`Should run every file in tests/Failing`, () => {
    const filesFound = readdir(path.join(cwd, 'tests', 'Failing'));
    assert.deepStrictEqual(filesFound, failingTestFiles);
  });

  // tests that raise runtime errors
  const erroredTestFiles = ['OnePort.elm'];

  for (const testToRun of erroredTestFiles) {
    it(`Should raise a runtime exception for test: ${testToRun}`, () => {
      const itsPath = path.join('tests', 'RuntimeException', testToRun);
      const runResult = execElmTest([itsPath], cwd);
      assertTestErrored(runResult);
    }).timeout(10000);
  }

  it(`Should run every file in tests/RuntimeException`, () => {
    const filesFound = readdir(path.join(cwd, 'tests', 'RuntimeException'));
    assert.deepStrictEqual(filesFound, erroredTestFiles);
  });
});
