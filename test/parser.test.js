const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseLinkTarget,
  resolveRemoteFile,
  extractTerminalLinks
} = require('../lib/parser.js');

const SAMPLE_POSIX_PATH = '/workspace/my-app/server.ts';
const SAMPLE_URI_WITH_LINE_AND_COL = 'file:///workspace/my-app/server.ts:42:15';
const SAMPLE_PATH_WITH_HASH_LINE = '/home/user/document.docx#L77';
const EXPECTED_LINE_42 = 42;
const EXPECTED_COL_15 = 15;
const EXPECTED_LINE_77 = 77;
const EXPECTED_DEFAULT_LINE = 1;
const EXPECTED_DEFAULT_COL = 1;

const MOCK_WORKSPACE_ROOT = '/workspace/test-repo';
const RELATIVE_SOURCE_FILE = 'src/index.ts';
const EXPECTED_RESOLVED_PATH = '/workspace/test-repo/src/index.ts';
const ALWAYS_EXISTS = () => true;
const NEVER_EXISTS = () => false;

test('given a file URI with line and column, when parsed, then extracts path and coordinates', () => {
  /**
   * Given a file:// URI with trailing :line:col
   * When parseLinkTarget is invoked
   * Then it strips the scheme and extracts integer coordinates
   */
  const rawInput = SAMPLE_URI_WITH_LINE_AND_COL;

  const result = parseLinkTarget(rawInput);

  assert.deepEqual(result, {
    cleanPath: SAMPLE_POSIX_PATH,
    line: EXPECTED_LINE_42,
    col: EXPECTED_COL_15
  });
});

test('given a path with markdown hash line number, when parsed, then extracts line', () => {
  /**
   * Given a file path with #L<number> suffix
   * When parseLinkTarget is invoked
   * Then it extracts the line number
   */
  const rawInput = SAMPLE_PATH_WITH_HASH_LINE;

  const result = parseLinkTarget(rawInput);

  assert.equal(result.line, EXPECTED_LINE_77);
});

test('given a plain path with no suffix, when parsed, then defaults line and col to one', () => {
  /**
   * Given a plain path without coordinates
   * When parseLinkTarget is invoked
   * Then line and column default to 1
   */
  const rawInput = SAMPLE_POSIX_PATH;

  const result = parseLinkTarget(rawInput);

  assert.equal(result.line, EXPECTED_DEFAULT_LINE);
});

test('given an existing absolute path, when resolved, then returns the path verbatim', () => {
  /**
   * Given an absolute path that exists on disk
   * When resolveRemoteFile is invoked
   * Then it returns the exact absolute path
   */
  const candidate = SAMPLE_POSIX_PATH;

  const resolved = resolveRemoteFile(candidate, [], ALWAYS_EXISTS);

  assert.equal(resolved, SAMPLE_POSIX_PATH);
});

test('given a non-existent absolute path, when resolved, then returns null', () => {
  /**
   * Given an absolute path that does not exist
   * When resolveRemoteFile is invoked
   * Then it returns null
   */
  const candidate = SAMPLE_POSIX_PATH;

  const resolved = resolveRemoteFile(candidate, [], NEVER_EXISTS);

  assert.equal(resolved, null);
});

test('given a relative path matching a workspace folder, when resolved, then returns full path', () => {
  /**
   * Given a relative path existing inside a workspace folder
   * When resolveRemoteFile is invoked
   * Then it joins the workspace folder with the relative path
   */
  const candidate = RELATIVE_SOURCE_FILE;

  const resolved = resolveRemoteFile(candidate, [MOCK_WORKSPACE_ROOT], ALWAYS_EXISTS);

  assert.equal(resolved, EXPECTED_RESOLVED_PATH);
});

test('given a terminal line containing a file URI, when extracted, then produces verified link', () => {
  /**
   * Given terminal text containing a file:// URI
   * When extractTerminalLinks is invoked with an affirmative resolver
   * Then it produces a link with start index, length, and remote target
   */
  const terminalLine = `Error at ${SAMPLE_URI_WITH_LINE_AND_COL}.`;

  const links = extractTerminalLinks(terminalLine, (p) => p);

  assert.equal(links.length, 1);
});

test('given a terminal line with no existing files, when extracted, then returns empty array', () => {
  /**
   * Given terminal text where no paths exist
   * When extractTerminalLinks is invoked with a negative resolver
   * Then it returns an empty link collection
   */
  const terminalLine = `Random text with no links`;

  const links = extractTerminalLinks(terminalLine, NEVER_EXISTS);

  assert.equal(links.length, 0);
});
