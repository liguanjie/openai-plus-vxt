export function normalizeBaseUrl(rawValue = ''): string {
  const value = String(rawValue || '').trim();
  if (!value) return '';

  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(candidate);
    parsed.hash = '';
    parsed.search = '';
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${pathname}`;
  } catch {
    return '';
  }
}

export function normalizeDomain(rawValue = ''): string {
  let value = String(rawValue || '').trim().toLowerCase();
  if (!value) return '';
  value = value.replace(/^@+/, '');
  value = value.replace(/^https?:\/\//, '');
  value = value.replace(/\/.*$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
    return '';
  }
  return value;
}

export function normalizeDomains(values: any[]): string[] {
  const domains: string[] = [];
  const seen = new Set<string>();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeDomain(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    domains.push(normalized);
  }
  return domains;
}

export function buildHeaders(
  config: { adminAuth?: string; customAuth?: string },
  options: { json?: boolean; acceptJson?: boolean } = {}
): Record<string, string> {
  const headers: Record<string, string> = {};
  const adminAuth = config.adminAuth?.trim();
  const customAuth = config.customAuth?.trim();
  if (adminAuth) {
    headers['x-admin-auth'] = adminAuth;
  }
  if (customAuth) {
    headers['x-custom-auth'] = customAuth;
  }
  if (options.json) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.acceptJson !== false) {
    headers.Accept = 'application/json';
  }
  return headers;
}

export function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = String(path || '').trim();
  if (!normalizedBase || !normalizedPath) return normalizedBase || '';
  return `${normalizedBase}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
}

// MIME parsing functions
function splitRawMessage(raw = ''): { headerText: string; bodyText: string } {
  const source = String(raw || '');
  if (!source) {
    return { headerText: '', bodyText: '' };
  }

  const normalized = source.replace(/\r\n/g, '\n');
  const separatorIndex = normalized.indexOf('\n\n');
  if (separatorIndex === -1) {
    return { headerText: normalized, bodyText: '' };
  }

  return {
    headerText: normalized.slice(0, separatorIndex),
    bodyText: normalized.slice(separatorIndex + 2),
  };
}

function parseRawHeaders(headerText = ''): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = String(headerText || '').split('\n');
  let currentName = '';

  for (const line of lines) {
    if (!line) continue;
    if ((line.startsWith(' ') || line.startsWith('\t')) && currentName) {
      headers[currentName] += ` ${line.trim()}`;
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) continue;
    currentName = line.slice(0, separatorIndex).trim().toLowerCase();
    headers[currentName] = line.slice(separatorIndex + 1).trim();
  }

  return headers;
}

function base64ToBytes(value = ''): Uint8Array {
  const normalized = String(value || '').replace(/\s+/g, '');
  if (!normalized) return new Uint8Array();

  if (typeof atob === 'function') {
    const decoded = atob(normalized);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  }
  throw new Error('No base64 decoder available');
}

function quotedPrintableToBytes(value = '', options: { headerMode?: boolean } = {}): Uint8Array {
  const { headerMode = false } = options;
  const source = String(value || '')
    .replace(/=\r?\n/g, '')
    .replace(headerMode ? /_/g : /$^/, ' ');

  const bytes: number[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '=' && /^[0-9A-Fa-f]{2}$/.test(source.slice(index + 1, index + 3))) {
      bytes.push(parseInt(source.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }
    bytes.push(char.charCodeAt(0));
  }
  return new Uint8Array(bytes);
}

function decodeBytesToString(bytes: Uint8Array, charset = 'utf-8'): string {
  const normalizedCharset = String(charset || 'utf-8').trim().toLowerCase();
  const candidates = [normalizedCharset];
  if (normalizedCharset === 'utf8') {
    candidates.unshift('utf-8');
  }
  if (normalizedCharset === 'gb2312' || normalizedCharset === 'gbk') {
    candidates.unshift('gb18030');
  }

  for (const candidate of candidates) {
    try {
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder(candidate, { fatal: false }).decode(bytes);
      }
    } catch {
      // ignore and try fallback
    }
  }

  let result = '';
  for (const byte of bytes) {
    result += String.fromCharCode(byte);
  }
  return result;
}

function decodeMimeEncodedWords(value = ''): string {
  const source = String(value || '');
  return source.replace(/=\?([^?]+)\?([bBqQ])\?([^?]+)\?=/g, (_match, charset, encoding, encodedText) => {
    try {
      if (String(encoding).toUpperCase() === 'B') {
        return decodeBytesToString(base64ToBytes(encodedText), charset);
      }
      return decodeBytesToString(
        quotedPrintableToBytes(String(encodedText).replace(/_/g, ' '), { headerMode: true }),
        charset
      );
    } catch {
      return encodedText;
    }
  });
}

function getCharsetFromContentType(contentType = ''): string {
  const match = String(contentType || '').match(/charset="?([^";]+)"?/i);
  return match ? match[1].trim() : 'utf-8';
}

function getBoundaryFromContentType(contentType = ''): string {
  const match = String(contentType || '').match(/boundary="?([^";]+)"?/i);
  return match ? match[1] : '';
}

function stripHtmlTags(value = ''): string {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeMimeBody(bodyText = '', headers: Record<string, string> = {}): string {
  const contentType = String(headers['content-type'] || '');
  const transferEncoding = String(headers['content-transfer-encoding'] || '').trim().toLowerCase();
  const charset = getCharsetFromContentType(contentType);
  let decoded = String(bodyText || '');

  if (transferEncoding === 'base64') {
    decoded = decodeBytesToString(base64ToBytes(decoded), charset);
  } else if (transferEncoding === 'quoted-printable') {
    decoded = decodeBytesToString(quotedPrintableToBytes(decoded), charset);
  }

  if (/text\/html/i.test(contentType)) {
    return stripHtmlTags(decoded);
  }
  return decoded.replace(/\s+/g, ' ').trim();
}

export function extractTextFromMime(rawMessage = '', depth = 0): { headers: Record<string, string>; text: string } {
  const { headerText, bodyText } = splitRawMessage(rawMessage);
  const headers = parseRawHeaders(headerText);
  const contentType = String(headers['content-type'] || '');
  const boundary = getBoundaryFromContentType(contentType);

  if (/multipart\//i.test(contentType) && boundary && depth < 6) {
    const marker = `--${boundary}`;
    const sections = String(bodyText || '')
      .split(marker)
      .map((part) => part.trim())
      .filter((part) => part && part !== '--');

    const extractedParts = sections
      .map((part) => part.replace(/--\s*$/, '').trim())
      .map((part) => extractTextFromMime(part, depth + 1)?.text || '')
      .filter(Boolean);

    const plainText = extractedParts.join(' ').replace(/\s+/g, ' ').trim();
    return {
      headers,
      text: plainText,
    };
  }

  return {
    headers,
    text: decodeMimeBody(bodyText, headers),
  };
}

function normalizeReceivedDateTime(value: any): string {
  if (!value && value !== 0) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  const source = String(value || '').trim();
  if (!source) return '';
  const parsed = Date.parse(source);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : source;
}

export interface TempEmailMessage {
  id: string;
  address: string;
  originalRecipient: string;
  addressId: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
    };
  };
  bodyPreview: string;
  raw: string;
  receivedDateTime: string;
}

function firstNonEmptyString(values: any[]): string {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return '';
}

export function normalizeMessage(row: any): TempEmailMessage | null {
  if (!row || typeof row !== 'object') return null;

  const address = String(firstNonEmptyString([
    row.address,
    row.mail_address,
    row.email,
    row.recipient,
  ])).trim().toLowerCase();

  const originalRecipient = String(firstNonEmptyString([
    row.original_recipient,
    row.originalRecipient,
    row.original_recipient_email,
    row.originalRecipientEmail,
  ])).trim().toLowerCase();

  const raw = firstNonEmptyString([row.raw, row.source, row.mime, row.message]);
  const parsedMime = raw ? extractTextFromMime(raw) : { headers: {} as Record<string, string>, text: '' };
  
  const subject = decodeMimeEncodedWords(firstNonEmptyString([
    row.subject,
    parsedMime.headers.subject,
  ]));

  const fromAddress = decodeMimeEncodedWords(firstNonEmptyString([
    row.from,
    row.sender,
    row.mail_from,
    parsedMime.headers.from,
  ]));

  const bodyPreview = firstNonEmptyString([
    row.text,
    row.preview,
    row.body,
    parsedMime.text,
    raw,
  ]).replace(/\s+/g, ' ').trim();

  return {
    id: firstNonEmptyString([row.id, row.mail_id]),
    address,
    originalRecipient,
    addressId: firstNonEmptyString([row.address_id, row.addressId]),
    subject,
    from: {
      emailAddress: {
        address: fromAddress,
      },
    },
    bodyPreview,
    raw,
    receivedDateTime: normalizeReceivedDateTime(firstNonEmptyString([
      row.receivedDateTime,
      row.received_at,
      row.created_at,
      row.createdAt,
      row.updated_at,
      row.date,
    ])),
  };
}

function getRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const candidates = [
    payload.data,
    payload.items,
    payload.messages,
    payload.mails,
    payload.results,
    payload.rows,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return [];
}

export function normalizeMailApiMessages(payload: any): TempEmailMessage[] {
  return getRows(payload)
    .map((row) => normalizeMessage(row))
    .filter((item): item is TempEmailMessage => item !== null);
}

export function extractVerificationCode(text: string): string | null {
  const source = String(text || '');

  const matchCn = source.match(/(?:代码为|验证码[^0-9]*?)[\s：:]*(\d{6})/i);
  if (matchCn) return matchCn[1];

  const matchLoginCode = source.match(/(?:log-?in\s+code|enter\s+this\s+code)[^0-9]{0,24}(\d{6})/i);
  if (matchLoginCode) return matchLoginCode[1];

  const matchEn = source.match(/code(?:\s+is|[\s:])+(\d{6})/i);
  if (matchEn) return matchEn[1];

  const matchStandalone = source.match(/\b(\d{6})\b/);
  return matchStandalone ? matchStandalone[1] : null;
}

export async function fetchCloudflareTempEmailAvailableDomains(
  api: string,
  adminAuth: string,
  customAuth: string
): Promise<string[]> {
  const baseUrl = normalizeBaseUrl(api);
  if (!baseUrl) {
    throw new Error('Cloudflare Temp Email 服务地址为空或格式无效。');
  }

  let openSettingsError: Error | null = null;
  // 1. Try public /open_api/settings
  try {
    const url = joinUrl(baseUrl, '/open_api/settings');
    const response = await fetch(url, {
      cache: 'no-store',
      headers: buildHeaders({ adminAuth, customAuth }),
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (response.ok) {
      const domains = normalizeDomains(payload?.domains || []);
      if (domains.length) {
        return domains;
      }
    }
    openSettingsError = new Error(payload?.message || payload?.error || '公开设置未返回可用域名。');
  } catch (error: any) {
    openSettingsError = error;
  }

  // 2. Try private /admin/worker/configs
  try {
    const url = joinUrl(baseUrl, '/admin/worker/configs');
    const response = await fetch(url, {
      cache: 'no-store',
      headers: buildHeaders({ adminAuth, customAuth }),
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
    }
    const domains = normalizeDomains(payload?.DOMAINS || []);
    if (!domains.length) {
      throw new Error('管理配置未返回可用域名。');
    }
    return domains;
  } catch (error: any) {
    throw openSettingsError || error;
  }
}

export async function fetchCloudflareTempEmailAddress(config: {
  api: string;
  adminAuth: string;
  customAuth: string;
  domain: string;
  useRandomSubdomain: boolean;
  customSubdomain: string;
}): Promise<string> {
  const baseUrl = normalizeBaseUrl(config.api);
  if (!baseUrl) {
    throw new Error('Cloudflare Temp Email 服务地址为空或格式无效。');
  }
  const cleanDomain = normalizeDomain(config.domain);
  if (!cleanDomain) {
    throw new Error('Cloudflare Temp Email 域名为空或格式无效。');
  }

  const requestedName = generateRandomLocalPart();
  const customSubdomain = config.customSubdomain.trim().toLowerCase();
  
  const payload: any = {
    enablePrefix: true,
    enableRandomSubdomain: customSubdomain ? false : config.useRandomSubdomain,
    name: requestedName,
    domain: customSubdomain ? `${customSubdomain}.${cleanDomain}` : cleanDomain,
  };
  if (customSubdomain) {
    payload.subdomain = customSubdomain;
  }

  const url = joinUrl(baseUrl, '/admin/new_address');
  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(config, { json: true }),
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const result = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const errorMsg = result.message || result.error || result.msg || `HTTP ${response.status}`;
    throw new Error(`Cloudflare Temp Email 生成失败：${errorMsg}`);
  }

  const address = firstNonEmptyString([
    result.address,
    result.email,
    result.data?.address,
    result.data?.email,
  ]).trim().toLowerCase();

  if (!address) {
    throw new Error('Cloudflare Temp Email 未返回可用邮箱地址。');
  }

  return address;
}

function generateRandomLocalPart(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const chars: string[] = [];

  for (let i = 0; i < 12; i++) {
    chars.push(letters[Math.floor(Math.random() * letters.length)]);
  }
  for (let i = 0; i < 8; i++) {
    chars.push(digits[Math.floor(Math.random() * digits.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }
  return chars.join('');
}

export async function pollCloudflareTempEmailVerificationCode(config: {
  api: string;
  adminAuth: string;
  customAuth: string;
  lookupMode: 'receive-mailbox' | 'registration-email';
  receiveMailbox: string;
  targetEmail: string;
  since: number;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<{ ok: boolean; code?: string; message: string }> {
  const baseUrl = normalizeBaseUrl(config.api);
  if (!baseUrl) {
    return { ok: false, message: 'Cloudflare Temp Email 服务地址为空或格式无效。' };
  }

  const lookupMode = config.lookupMode;
  const isRegEmailMode = lookupMode === 'registration-email';
  const receiveMailbox = config.receiveMailbox.trim().toLowerCase();
  const targetEmail = config.targetEmail.trim().toLowerCase();

  if (isRegEmailMode && !receiveMailbox) {
    return { ok: false, message: '注册邮箱模式下，必须配置“邮件接收”邮箱。' };
  }

  const queryAddress = isRegEmailMode ? '' : targetEmail;
  const deadline = Date.now() + (config.timeoutMs ?? 180_000);
  const intervalMs = config.intervalMs ?? 5000;

  while (Date.now() <= deadline) {
    try {
      const url = new URL(joinUrl(baseUrl, '/admin/mails'));
      url.searchParams.set('limit', '20');
      url.searchParams.set('offset', '0');
      if (queryAddress) {
        url.searchParams.set('address', queryAddress);
      }

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: buildHeaders(config),
      });

      if (!response.ok) {
        const text = await response.text();
        console.warn(`Cloudflare Temp Email API error: ${response.status}`, text);
      } else {
        const text = await response.text();
        const payload = text ? JSON.parse(text) : {};
        const allMessages = normalizeMailApiMessages(payload);

        // Filter by originalRecipient if in registration-email mode
        const messages = allMessages.filter((msg) => {
          if (isRegEmailMode) {
            return msg.originalRecipient === receiveMailbox;
          }
          if (!targetEmail) return true;
          return msg.address === targetEmail;
        });

        // Find the latest message that matches our code constraints and since timestamp
        const matched = messages
          .filter((msg) => {
            const msgTime = msg.receivedDateTime ? Date.parse(msg.receivedDateTime) : 0;
            // Accept messages received near or after target timestamp (with 15s leeway)
            return !msgTime || msgTime >= config.since - 15000;
          })
          .sort((a, b) => {
            const aTime = a.receivedDateTime ? Date.parse(a.receivedDateTime) : 0;
            const bTime = b.receivedDateTime ? Date.parse(b.receivedDateTime) : 0;
            return bTime - aTime;
          });

        for (const msg of matched) {
          const code = extractVerificationCode([msg.subject, msg.bodyPreview].join(' '));
          if (code) {
            return { ok: true, code, message: `成功接收验证码: ${code}` };
          }
        }
      }
    } catch (error: any) {
      console.warn('Cloudflare Temp Email polling attempt failed:', error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { ok: false, message: '等待 Cloudflare Temp Email 验证码超时' };
}
