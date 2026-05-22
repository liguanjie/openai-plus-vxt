import type { ActionResult } from '../../app/types';

export type { ActionResult } from '../../app/types';

export interface PageState {
  kind: 'login' | 'email-verification' | 'about-you' | 'unknown';
  label: string;
  canFillEmail: boolean;
  canFillOtp: boolean;
  canFillProfile: boolean;
}

export interface RegisterController {
  getPageState(): PageState;
  loadState(): Promise<RegisterState>;
  saveInput(rawInput: string): Promise<RegisterState>;
  fillEmailFromInput(): Promise<ActionResult>;
  fillOtp(code: string): Promise<ActionResult>;
  waitForOutlookOtp(): Promise<ActionResult>;
  fillProfileAndCreate(): Promise<ActionResult>;
  autoRunForCurrentPage(): Promise<void>;
  syncTempEmailDomains(): Promise<ActionResult>;
  generateTempEmailAddress(): Promise<ActionResult>;
  waitForTempEmailOtp(): Promise<ActionResult>;
}

export interface RegisterState {
  rawInput: string;
  email: string;
  accountLine: string;
  inputMode: AccountInputMode;
  autoOtp: boolean;
  apiBase: string;
  otpRequestedAt: number;
  updatedAt: number;

  // Cloudflare Temp Email fields
  cfTempEmailService: 'custom' | 'outlook' | 'cloudflare-temp';
  cfTempEmailGenerator: 'custom' | 'cloudflare-temp';
  cfTempEmailApi: string;
  cfTempEmailAdminAuth: string;
  cfTempEmailCustomAuth: string;
  cfTempEmailLookupMode: 'receive-mailbox' | 'registration-email';
  cfTempEmailReceiveMailbox: string;
  cfTempEmailUseRandomSubdomain: boolean;
  cfTempEmailCustomSubdomain: string;
  cfTempEmailDomains: string[];
  cfTempEmailSelectedDomain: string;
}

export type AccountInputMode = 'empty' | 'email' | 'outlook-line' | 'invalid';

export interface ParsedAccountInput {
  ok: boolean;
  mode: AccountInputMode;
  email: string;
  accountLine: string;
  message: string;
}

export interface OutlookOtpMessage {
  type: 'opx:wait-outlook-otp';
  accountLine: string;
  apiBase?: string;
  timeoutMs?: number;
  intervalMs?: number;
  since?: number;
}

export interface OutlookOtpResponse {
  ok: boolean;
  message: string;
  code?: string;
}

export interface FetchTempEmailDomainsMessage {
  type: 'opx:fetch-temp-email-domains';
  api: string;
  adminAuth: string;
  customAuth: string;
}

export interface GenerateTempEmailMessage {
  type: 'opx:generate-temp-email';
  api: string;
  adminAuth: string;
  customAuth: string;
  domain: string;
  useRandomSubdomain: boolean;
  customSubdomain: string;
}

export interface WaitTempEmailOtpMessage {
  type: 'opx:wait-temp-email-otp';
  api: string;
  adminAuth: string;
  customAuth: string;
  lookupMode: 'receive-mailbox' | 'registration-email';
  receiveMailbox: string;
  targetEmail: string;
  since: number;
  timeoutMs?: number;
  intervalMs?: number;
}

