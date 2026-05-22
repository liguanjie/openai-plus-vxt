import { fillEmailAndContinue, isChatGptLoginPage } from './chatgpt-auth-page';
import { fillOtpAndContinue, isEmailVerificationPage } from './openai-email-verification-page';
import { fillAboutYouAndCreate, isAboutYouPage } from './openai-about-you-page';
import { parseAccountInput } from './account-input';
import { loadRegisterState, saveRegisterState } from '../../app/state';
import type { ActionResult, PageState, RegisterController } from './types';

let autoProfileStarted = false;

export function createRegisterController(): RegisterController {
  return {
    getPageState,
    loadState: loadRegisterState,
    saveInput: async (rawInput: string) => {
      const parsed = parseAccountInput(rawInput);
      return saveRegisterState({
        rawInput,
        email: parsed.email,
        accountLine: parsed.accountLine,
        inputMode: parsed.mode,
        autoOtp: parsed.mode === 'outlook-line',
      });
    },
    fillEmailFromInput: async () => {
      const state = await loadRegisterState();
      const parsed = parseAccountInput(state.rawInput);
      if (!parsed.ok) {
        return fail(parsed.message);
      }
      if (!isChatGptLoginPage()) {
        return fail('当前页面不是 ChatGPT 登录页');
      }
      await saveRegisterState({
        email: parsed.email,
        accountLine: parsed.accountLine,
        inputMode: parsed.mode,
        autoOtp: parsed.mode === 'outlook-line',
        otpRequestedAt: Date.now(),
      });
      return fillEmailAndContinue(parsed.email);
    },
    fillOtp: async (code: string) => {
      if (!isEmailVerificationPage()) {
        return fail('当前页面不是邮箱验证码页');
      }
      return fillOtpAndContinue(code);
    },
    waitForOutlookOtp: async () => {
      if (!isEmailVerificationPage()) {
        return fail('当前页面不是邮箱验证码页');
      }
      const state = await loadRegisterState();
      if (!state.accountLine) {
        return fail('当前输入不是 Outlook 账号行，不能自动接收验证码');
      }

      const response = await browser.runtime.sendMessage({
        type: 'opx:wait-outlook-otp',
        accountLine: state.accountLine,
        apiBase: state.apiBase,
        since: state.otpRequestedAt || state.updatedAt || Date.now(),
        timeoutMs: 180_000,
        intervalMs: 5_000,
      });

      if (!isActionResult(response)) {
        return fail('Outlook API 没有返回有效结果');
      }

      if (!response.ok || !response.code) {
        return response;
      }

      const fillResult = await fillOtpAndContinue(response.code);
      return {
        ...fillResult,
        code: response.code,
        message: fillResult.ok ? `已收到并提交验证码：${response.code}` : fillResult.message,
      };
    },
    fillProfileAndCreate: async () => {
      if (!isAboutYouPage()) {
        return fail('当前页面不是资料填写页');
      }
      return fillAboutYouAndCreate();
    },
    autoRunForCurrentPage: async () => {
      if (!isAboutYouPage() || autoProfileStarted) {
        return;
      }
      autoProfileStarted = true;
      await waitForPageReady();
      await fillAboutYouAndCreate();
    },
    syncTempEmailDomains: async () => {
      const state = await loadRegisterState();
      const response = await browser.runtime.sendMessage({
        type: 'opx:fetch-temp-email-domains',
        api: state.cfTempEmailApi,
        adminAuth: state.cfTempEmailAdminAuth,
        customAuth: state.cfTempEmailCustomAuth,
      });
      if (response?.ok && Array.isArray(response.domains)) {
        const nextDomain = response.domains.includes(state.cfTempEmailSelectedDomain)
          ? state.cfTempEmailSelectedDomain
          : (response.domains[0] || '');
        await saveRegisterState({
          cfTempEmailDomains: response.domains,
          cfTempEmailSelectedDomain: nextDomain,
        });
        return { ok: true, message: `同步成功，获取到 ${response.domains.length} 个域名` };
      }
      return { ok: false, message: response?.message || '同步域名失败' };
    },
    generateTempEmailAddress: async () => {
      const state = await loadRegisterState();
      if (!state.cfTempEmailApi) {
        return fail('请先配置 Cloudflare Temp Email API 地址');
      }
      if (!state.cfTempEmailSelectedDomain) {
        return fail('请先选择或同步 Cloudflare Temp Email 域名');
      }
      const response = await browser.runtime.sendMessage({
        type: 'opx:generate-temp-email',
        api: state.cfTempEmailApi,
        adminAuth: state.cfTempEmailAdminAuth,
        customAuth: state.cfTempEmailCustomAuth,
        domain: state.cfTempEmailSelectedDomain,
        useRandomSubdomain: state.cfTempEmailUseRandomSubdomain,
        customSubdomain: state.cfTempEmailCustomSubdomain,
      });
      if (response?.ok && response.email) {
        await saveRegisterState({
          rawInput: response.email,
          email: response.email,
          accountLine: '',
          inputMode: 'email',
          autoOtp: false,
        });
        return { ok: true, message: `生成成功: ${response.email}` };
      }
      return { ok: false, message: response?.message || '生成临时邮箱失败' };
    },
    waitForTempEmailOtp: async () => {
      if (!isEmailVerificationPage()) {
        return fail('当前页面不是邮箱验证码页');
      }
      const state = await loadRegisterState();
      if (!state.email) {
        return fail('当前没有配置或生成临时邮箱');
      }
      const response = await browser.runtime.sendMessage({
        type: 'opx:wait-temp-email-otp',
        api: state.cfTempEmailApi,
        adminAuth: state.cfTempEmailAdminAuth,
        customAuth: state.cfTempEmailCustomAuth,
        lookupMode: state.cfTempEmailLookupMode,
        receiveMailbox: state.cfTempEmailReceiveMailbox,
        targetEmail: state.email,
        since: state.otpRequestedAt || state.updatedAt || Date.now(),
        timeoutMs: 180_000,
        intervalMs: 5_000,
      });
      if (response?.ok && response.code) {
        const fillResult = await fillOtpAndContinue(response.code);
        return {
          ...fillResult,
          code: response.code,
          message: fillResult.ok ? `已收到并提交验证码：${response.code}` : fillResult.message,
        };
      }
      return { ok: false, message: response?.message || '等待验证码失败或超时' };
    },
  };
}

function getPageState(): PageState {
  if (isChatGptLoginPage()) {
    return {
      kind: 'login',
      label: 'ChatGPT 登录页',
      canFillEmail: true,
      canFillOtp: false,
      canFillProfile: false,
    };
  }

  if (isEmailVerificationPage()) {
    return {
      kind: 'email-verification',
      label: '邮箱验证码页',
      canFillEmail: false,
      canFillOtp: true,
      canFillProfile: false,
    };
  }

  if (isAboutYouPage()) {
    return {
      kind: 'about-you',
      label: '资料填写页',
      canFillEmail: false,
      canFillOtp: false,
      canFillProfile: true,
    };
  }

  return {
    kind: 'unknown',
    label: '未识别页面',
    canFillEmail: false,
    canFillOtp: false,
    canFillProfile: false,
  };
}

function fail(message: string): ActionResult {
  return { ok: false, message };
}

function isActionResult(value: unknown): value is ActionResult {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as ActionResult).ok === 'boolean' &&
      typeof (value as ActionResult).message === 'string',
  );
}

function waitForPageReady(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 800));
}
