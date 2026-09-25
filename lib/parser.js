const fs = require('fs');
const path = require('path');

const FILE_SCHEME_PREFIX = 'file://';
const TRAILING_PUNCTUATION_REGEX = /[.,:;!?\>]+$/;
const LINE_AND_COLUMN_REGEX = /(?:#L(\d+)(?:-L\d+)?|:(\d+)(?::(\d+))?)$/i;

const ABSOLUTE_URI_PATTERN =
  /(?:file:\/\/(?:\/[^\s'"\)\]\>]+)|\/(?:home|workspace|tmp|etc|var|usr)[^\s'"\)\]\>]+)/g;

const RELATIVE_CANDIDATE_PATTERN =
  /(?:[a-zA-Z0-9_\-\.~]+(?:\/[a-zA-Z0-9_\-\.~]+)+|[a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9_\-]+|\b(?:Dockerfile|Makefile|LICENSE|Procfile|Gemfile|Rakefile|\.[a-zA-Z0-9_\-]+)\b)(?:#L\d+(?:-L\d+)?|:\d+(?::\d+)?)?/g;

/**
 * Extracts all verified terminal links from a line of text.
 */
function extractTerminalLinks(lineText, resolveFile) {
  if (!lineText) {
    return [];
  }

  const rawMatches = collectRawMatches(lineText);
  return assembleVerifiedLinks(rawMatches, resolveFile);
}

/**
 * Resolves a candidate string to an existing file path.
 */
function resolveRemoteFile(candidatePath, workspaceFolders = [], fileExists = defaultFileExists) {
  if (!candidatePath || candidatePath.length < 2) {
    return null;
  }

  if (path.isAbsolute(candidatePath)) {
    return fileExists(candidatePath) ? candidatePath : null;
  }

  return resolveWorkspaceRelative(candidatePath, workspaceFolders, fileExists);
}

/**
 * Parses clean path, line number, and column number from a raw token.
 */
function parseLinkTarget(rawToken) {
  const strippedScheme = stripFileScheme(rawToken);
  const trimmedToken = stripTrailingPunctuation(strippedScheme);
  const locationInfo = extractLocationCoordinates(trimmedToken);

  return {
    cleanPath: locationInfo.cleanPath,
    line: locationInfo.line,
    col: locationInfo.col
  };
}

/**
 * Collects all candidate match spans from a line of text.
 */
function collectRawMatches(lineText) {
  const matches = [];
  const coveredIndices = new Set();

  findRegexMatches(lineText, ABSOLUTE_URI_PATTERN, matches, coveredIndices);
  findRegexMatches(lineText, RELATIVE_CANDIDATE_PATTERN, matches, coveredIndices);

  return matches;
}

/**
 * Scans a line for matches and records non-overlapping spans.
 */
function findRegexMatches(lineText, pattern, results, coveredIndices) {
  const regex = new RegExp(pattern.source, pattern.flags);
  let match;

  while ((match = regex.exec(lineText)) !== null) {
    const startIndex = match.index;
    if (coveredIndices.has(startIndex)) {
      continue;
    }

    const matchedText = match[0];
    results.push({ text: matchedText, startIndex, length: matchedText.length });
    markCoveredIndices(coveredIndices, startIndex, matchedText.length);
  }
}

/**
 * Marks index ranges as covered to avoid duplicate nested matches.
 */
function markCoveredIndices(indexSet, start, length) {
  for (let i = start; i < start + length; i++) {
    indexSet.add(i);
  }
}

/**
 * Converts candidate matches into verified link objects.
 */
function assembleVerifiedLinks(candidates, resolveFile) {
  const links = [];

  for (const candidate of candidates) {
    const parsed = parseLinkTarget(candidate.text);
    const resolvedPath = resolveFile(parsed.cleanPath);

    if (resolvedPath) {
      links.push(createLinkObject(candidate, parsed, resolvedPath));
    }
  }

  return links;
}

/**
 * Creates a domain link descriptor for VS Code consumption.
 */
function createLinkObject(candidate, parsed, resolvedPath) {
  const suffix = parsed.line > 1 ? `:${parsed.line}` : '';

  return {
    startIndex: candidate.startIndex,
    length: candidate.length,
    tooltip: `Open remote file: ${resolvedPath}${suffix}`,
    targetPath: resolvedPath,
    line: parsed.line,
    col: parsed.col
  };
}

/**
 * Resolves a relative path against an array of workspace folders.
 */
function resolveWorkspaceRelative(candidatePath, workspaceFolders, fileExists) {
  for (const ws of workspaceFolders) {
    const fullPath = path.join(ws, candidatePath);
    if (fileExists(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Strips the file:// URI scheme if present.
 */
function stripFileScheme(input) {
  return input.startsWith(FILE_SCHEME_PREFIX)
    ? input.slice(FILE_SCHEME_PREFIX.length)
    : input;
}

/**
 * Strips trailing sentence punctuation from path strings.
 */
function stripTrailingPunctuation(input) {
  return input.replace(TRAILING_PUNCTUATION_REGEX, '');
}

/**
 * Extracts line and column coordinates from path suffixes.
 */
function extractLocationCoordinates(input) {
  const match = input.match(LINE_AND_COLUMN_REGEX);
  if (!match) {
    return { cleanPath: input, line: 1, col: 1 };
  }

  const rawLine = match[1] || match[2];
  const rawCol = match[3];
  const cleanPath = input.slice(0, match.index);

  return {
    cleanPath,
    line: rawLine ? parseInt(rawLine, 10) : 1,
    col: rawCol ? parseInt(rawCol, 10) : 1
  };
}

/**
 * Default filesystem existence check.
 */
function defaultFileExists(targetPath) {
  try {
    return fs.existsSync(targetPath) && fs.statSync(targetPath).isFile();
  } catch (_) {
    return false;
  }
}

module.exports = {
  extractTerminalLinks,
  resolveRemoteFile,
  parseLinkTarget
};
