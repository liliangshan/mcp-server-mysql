const DDL_COMMANDS = new Set(['CREATE', 'ALTER', 'TRUNCATE', 'RENAME', 'COMMENT']);
const DML_COMMANDS = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE']);
const LOCK_FUNCTIONS = new Set(['GET_LOCK', 'RELEASE_LOCK', 'RELEASE_ALL_LOCKS']);

/**
 * Tokenize one MySQL statement without treating quoted text or ordinary comments as SQL.
 * Executable comments and ambiguous nested comments are rejected rather than ignored.
 * @param {string} sql SQL submitted by the client.
 * @param {boolean} backslashEscapes Whether backslashes escape string delimiters.
 * @param {boolean} ansiQuotes Whether double quotes delimit identifiers instead of strings.
 * @returns {Array<{type: string, value: string}>} Tokens with normalized words.
 * @throws {Error} If the SQL is empty, malformed, executable-commented or multi-statement.
 */
function tokenizeSql(sql, backslashEscapes, ansiQuotes) {
  const tokens = [];
  let index = 0;
  let terminated = false;
  let depth = 0;

  while (index < sql.length) {
    const char = sql[index];
    if (/[ \t\r\n\f\v]/.test(char)) {
      index++;
      continue;
    }

    if (char === '#' || (sql.startsWith('--', index) &&
        (index + 2 === sql.length || /[\x00-\x20]/.test(sql[index + 2])))) {
      while (index < sql.length && sql[index] !== '\n' && sql[index] !== '\r') index++;
      continue;
    }

    if (sql.startsWith('/*', index)) {
      if (/^\/\*(?:!|M!)/i.test(sql.slice(index, index + 4))) {
        throw new Error('Executable SQL comments are not allowed');
      }
      const end = sql.indexOf('*/', index + 2);
      if (end === -1 || sql.slice(index + 2, end).includes('/*')) {
        throw new Error('Unterminated or nested SQL comment');
      }
      index = end + 2;
      continue;
    }

    if (terminated) {
      throw new Error('Only one SQL statement is allowed');
    }
    if (char === ';') {
      terminated = true;
      index++;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      let value = '';
      let closed = false;
      index++;
      while (index < sql.length) {
        const current = sql[index++];
        if (current === '\\' && quote !== '`' && !(ansiQuotes && quote === '"') && backslashEscapes) {
          if (index < sql.length) value += sql[index++];
        } else if (current === quote) {
          if (sql[index] === quote) {
            value += sql[index++];
          } else {
            closed = true;
            break;
          }
        } else {
          value += current;
        }
      }
      if (!closed) throw new Error('Unterminated SQL quote');
      const isIdentifier = quote === '`' || (ansiQuotes && quote === '"');
      tokens.push({ type: isIdentifier ? 'identifier' : 'quoted', value: value.toUpperCase() });
      continue;
    }

    const word = /^[A-Za-z0-9_$\u0080-￿]+/.exec(sql.slice(index));
    if (word) {
      tokens.push({ type: 'word', value: word[0].toUpperCase() });
      index += word[0].length;
      continue;
    }

    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth < 0) throw new Error('Unbalanced SQL parentheses');
    tokens.push({ type: 'symbol', value: char });
    index++;
  }

  if (depth !== 0) throw new Error('Unbalanced SQL parentheses');
  if (tokens.length === 0) throw new Error('Missing sql parameter');
  return tokens;
}

/**
 * Find the command following WITH definitions so CTE-wrapped DELETE obeys permissions.
 * This does not expand the readonly allowlist: WITH is still rejected in readonly mode.
 * @param {Array<{type: string, value: string}>} tokens Tokenized SQL.
 * @returns {string} The main command, or an empty string for an invalid command token.
 * @throws {Error} If a WITH clause cannot be classified safely.
 */
function getCommand(tokens) {
  if (tokens[0].type !== 'word') return '';
  if (tokens[0].value !== 'WITH') return tokens[0].value;

  let index = tokens[1]?.value === 'RECURSIVE' ? 2 : 1;

  /**
   * Skip a balanced CTE column list or query body from the current token.
   * @returns {void}
   * @throws {Error} If the required parenthesized group is missing or incomplete.
   */
  function skipGroup() {
    if (tokens[index]?.type !== 'symbol' || tokens[index].value !== '(') {
      throw new Error('Unsupported WITH statement');
    }
    let depth = 0;
    do {
      const token = tokens[index++];
      if (!token) throw new Error('Unsupported WITH statement');
      if (token.type === 'symbol' && token.value === '(') depth++;
      if (token.type === 'symbol' && token.value === ')') depth--;
    } while (depth > 0);
  }

  while (index < tokens.length) {
    if (!['word', 'identifier', 'quoted'].includes(tokens[index]?.type)) {
      throw new Error('Unsupported WITH statement');
    }
    index++;
    if (tokens[index]?.value === '(') skipGroup();
    if (tokens[index]?.type !== 'word' || tokens[index].value !== 'AS') {
      throw new Error('Unsupported WITH statement');
    }
    index++;
    skipGroup();
    if (tokens[index]?.value !== ',') break;
    index++;
  }

  if (tokens[index]?.type !== 'word' || !DML_COMMANDS.has(tokens[index].value)) {
    throw new Error('Unsupported WITH statement');
  }
  return tokens[index].value;
}

/**
 * Enforce permission flags on a complete token stream, including SELECT side effects.
 * Database read-only transactions provide an additional guard for stored functions.
 * @param {Array<{type: string, value: string}>} tokens Tokenized SQL.
 * @param {object} permissions Effective readonly, allowDDL, allowDrop and allowDelete flags.
 * @returns {{command: string, isDdlOperation: boolean}} Classification used for audit logging.
 * @throws {Error} If the statement violates the configured policy.
 */
function checkTokens(tokens, permissions) {
  const command = getCommand(tokens);
  if (permissions.readonly) {
    if (tokens[0].type !== 'word' || !['SELECT', 'SHOW'].includes(tokens[0].value)) {
      throw new Error('Readonly mode is enabled. Only SELECT and SHOW commands are allowed');
    }

    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      const next = tokens[index + 1];
      if (token.type === 'word' && token.value === 'INTO') {
        throw new Error('Readonly mode does not allow SELECT INTO (files or variables)');
      }
      if (token.type === 'symbol' && token.value === ':' && next?.value === '=') {
        throw new Error('Readonly mode does not allow variable assignments');
      }
      if (token.type === 'word' && next?.type === 'word' &&
          ((token.value === 'FOR' && ['UPDATE', 'SHARE'].includes(next.value)) ||
           (token.value === 'LOCK' && next.value === 'IN'))) {
        throw new Error('Readonly mode does not allow locking reads');
      }
      if (LOCK_FUNCTIONS.has(token.value) && next?.type === 'symbol' && next.value === '(') {
        throw new Error('Readonly mode does not allow advisory lock functions');
      }
    }
  }

  const isDdlOperation = DDL_COMMANDS.has(command);
  if (isDdlOperation && !permissions.allowDDL) throw new Error('DDL operations are not allowed');
  if (command === 'DROP' && !permissions.allowDrop) throw new Error('DROP operations are not allowed');
  if (command === 'DELETE' && !permissions.allowDelete) throw new Error('DELETE operations are not allowed');
  return { command, isDdlOperation };
}

/**
 * Validate exactly one SQL statement before acquiring a database connection.
 * Every combination of backslash escapes and ANSI_QUOTES must be safe because pooled
 * sessions may use different sql_mode settings; ambiguous input is rejected, not rewritten.
 * @param {string} sql SQL submitted by the client.
 * @param {object} permissions Effective readonly, allowDDL, allowDrop and allowDelete flags.
 * @returns {{command: string, isDdlOperation: boolean}} Validated statement classification.
 * @throws {Error} If the SQL is missing, ambiguous or forbidden.
 */
function validateSql(sql, permissions) {
  if (typeof sql !== 'string' || !sql.trim()) throw new Error('Missing sql parameter');
  let classification;
  for (const backslashEscapes of [true, false]) {
    for (const ansiQuotes of [false, true]) {
      const current = checkTokens(tokenizeSql(sql, backslashEscapes, ansiQuotes), permissions);
      if (classification && classification.command !== current.command) {
        throw new Error('Ambiguous SQL statement');
      }
      classification = current;
    }
  }
  return classification;
}

module.exports = { validateSql };
