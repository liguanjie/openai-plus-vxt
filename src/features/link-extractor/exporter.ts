/**
 * Utility functions for exporting ChatGPT session into CPA JSON and SUB2 JSON formats.
 * Ported from GuJumpgate and refactored into TypeScript.
 */

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value || '').trim();
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function normalizeEmailValue(value: unknown): string {
  const email = normalizeString(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function timestampFromUnixSeconds(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  const date = new Date(numeric * 1000);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function normalizeTimestamp(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value > 1e11 ? value : value * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function epochSecondsFromValue(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.trunc(numeric > 1e11 ? numeric / 1000 : numeric);
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? Math.trunc(parsed / 1000) : 0;
}

function decodeBase64UrlSegment(segment = ''): string {
  const normalized = normalizeString(segment)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!normalized) {
    return '';
  }
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8');
    }
    if (typeof atob === 'function') {
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder().decode(bytes);
      }
      return binary;
    }
  } catch {
    return '';
  }
  return '';
}

function encodeBase64UrlJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseJwtPayload(token = ''): Record<string, any> | null {
  const normalized = normalizeString(token);
  if (!normalized) {
    return null;
  }
  const parts = normalized.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    return JSON.parse(decodeBase64UrlSegment(parts[1]));
  } catch {
    return null;
  }
}

function getOpenAiAuthSection(payload: any): Record<string, any> {
  if (!isPlainObject(payload)) {
    return {};
  }
  const auth = payload['https://api.openai.com/auth'];
  return isPlainObject(auth) ? auth : {};
}

function getOpenAiProfileSection(payload: any): Record<string, any> {
  if (!isPlainObject(payload)) {
    return {};
  }
  const profile = payload['https://api.openai.com/profile'];
  return isPlainObject(profile) ? profile : {};
}

function buildSyntheticCodexIdToken(
  email: string,
  accountId: string,
  planType: string,
  userId: string,
  expiresAt: string
): string {
  const normalizedAccountId = normalizeString(accountId);
  if (!normalizedAccountId) {
    return '';
  }
  const now = Math.trunc(Date.now() / 1000);
  const expires = epochSecondsFromValue(expiresAt) || now + 90 * 24 * 60 * 60;
  const authInfo: Record<string, string> = { chatgpt_account_id: normalizedAccountId };

  if (planType) {
    authInfo.chatgpt_plan_type = normalizeString(planType);
  }
  if (userId) {
    authInfo.chatgpt_user_id = normalizeString(userId);
    authInfo.user_id = normalizeString(userId);
  }

  const payload: Record<string, any> = {
    iat: now,
    exp: expires,
    'https://api.openai.com/auth': authInfo,
  };
  if (email) {
    payload.email = normalizeString(email);
  }

  return `${encodeBase64UrlJson({ alg: 'none', typ: 'JWT', cpa_synthetic: true })}.${encodeBase64UrlJson(payload)}.synthetic`;
}

function normalizePlanTypeForFileName(planType = ''): string {
  return normalizeString(planType)
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join('-');
}

function sanitizeFileSegment(value = '', fallback = 'chatgpt-session'): string {
  const normalized = normalizeString(value)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function buildCpaAuthFileName(metadata: { email?: string; planType?: string; accountId?: string }): string {
  const email = sanitizeFileSegment(metadata.email || '');
  const planType = normalizePlanTypeForFileName(metadata.planType || '');
  const accountId = sanitizeFileSegment(metadata.accountId || '');
  if (email && planType) {
    return `codex-${email}-${planType}.json`;
  }
  if (email) {
    return `codex-${email}.json`;
  }
  if (accountId && planType) {
    return `codex-${accountId}-${planType}.json`;
  }
  if (accountId) {
    return `codex-${accountId}.json`;
  }
  return `codex-${Date.now()}.json`;
}

export interface CpaExportResult {
  fileName: string;
  fileContent: string;
  hasRefreshToken: boolean;
}

export function exportCpaSessionJson(session: Record<string, any>): CpaExportResult {
  if (!isPlainObject(session)) {
    throw new Error('未读取到可导入的 ChatGPT 会话数据。');
  }

  const accessToken = normalizeString(session.accessToken);
  if (!accessToken) {
    throw new Error('未读取到可导入的 ChatGPT accessToken。');
  }

  const inputIdToken = firstNonEmpty(
    session.idToken,
    session.id_token
  );
  const refreshToken = firstNonEmpty(
    session.refreshToken,
    session.refresh_token
  );
  const sessionToken = firstNonEmpty(
    session.sessionToken,
    session.session_token
  );

  const accessPayload = parseJwtPayload(accessToken);
  const idPayload = parseJwtPayload(inputIdToken);
  const accessAuth = getOpenAiAuthSection(accessPayload);
  const idAuth = getOpenAiAuthSection(idPayload);
  const profile = getOpenAiProfileSection(accessPayload);

  const expiresAt = firstNonEmpty(
    timestampFromUnixSeconds(accessPayload?.exp),
    normalizeTimestamp(session.expires),
    normalizeTimestamp(session.expiresAt),
    normalizeTimestamp(session.expired),
    normalizeTimestamp(session.expires_at)
  );

  const email = firstNonEmpty(
    normalizeEmailValue(session.user?.email),
    normalizeEmailValue(session.email),
    normalizeEmailValue(profile?.email),
    normalizeEmailValue(idPayload?.email),
    normalizeEmailValue(accessPayload?.email)
  );

  const accountId = firstNonEmpty(
    session.account?.id,
    session.account_id,
    accessAuth?.chatgpt_account_id,
    idAuth?.chatgpt_account_id
  );

  const userId = firstNonEmpty(
    session.user?.id,
    session.user_id,
    accessAuth?.chatgpt_user_id,
    accessAuth?.user_id,
    idAuth?.chatgpt_user_id,
    idAuth?.user_id
  );

  const planType = firstNonEmpty(
    session.account?.planType,
    session.account?.plan_type,
    session.planType,
    session.plan_type,
    accessAuth?.chatgpt_plan_type,
    idAuth?.chatgpt_plan_type
  );

  const exportedAt = new Date().toISOString();
  const syntheticIdToken = inputIdToken
    ? ''
    : buildSyntheticCodexIdToken(email, accountId, planType, userId, expiresAt);
  const idToken = inputIdToken || syntheticIdToken;

  const authJson = Object.fromEntries(
    Object.entries({
      type: 'codex',
      account_id: accountId,
      chatgpt_account_id: accountId,
      email,
      name: firstNonEmpty(email, 'ChatGPT Account'),
      plan_type: planType,
      chatgpt_plan_type: planType,
      id_token: idToken,
      id_token_synthetic: syntheticIdToken ? true : undefined,
      access_token: accessToken,
      refresh_token: refreshToken || '',
      session_token: sessionToken,
      last_refresh: exportedAt,
      expired: expiresAt,
      disabled: session.disabled === true ? true : undefined,
    }).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  return {
    fileName: buildCpaAuthFileName({ email, planType, accountId }),
    fileContent: JSON.stringify(authJson, null, 2),
    hasRefreshToken: Boolean(refreshToken),
  };
}

export interface Sub2ExportResult {
  fileName: string;
  fileContent: string;
}

export function exportSub2SessionJson(session: Record<string, any>): Sub2ExportResult {
  if (!isPlainObject(session)) {
    throw new Error('未读取到可导入的 ChatGPT 会话数据。');
  }

  const accessToken = normalizeString(session.accessToken);
  const contentObject = { ...session };
  if (accessToken) {
    contentObject.accessToken = accessToken;
  }

  // Remove our custom nested reference if it is present
  if ('raw' in contentObject) {
    delete contentObject.raw;
  }

  const email = sanitizeFileSegment(
    contentObject.user?.email || contentObject.email || '',
    'chatgpt-session'
  );

  return {
    fileName: `sub2api-${email}.json`,
    fileContent: JSON.stringify(contentObject, null, 2),
  };
}
