import { loadLinkExtractorState, saveLinkExtractorState } from '../../app/state';
import type { FeaturePanelHandle } from '../../app/types';
import { extractAccessToken, normalizeCheckoutOptions } from './checkout';
import type { ChatGptSessionResponse, CheckoutLinkResponse, CheckoutOptions } from './types';
import { exportCpaSessionJson, exportSub2SessionJson } from './exporter';

const REGION_OPTIONS = [
  ['ID', '印尼 / IDR'],
  ['DE', '德国 / EUR'],
  ['JP', '日本 / JPY'],
  ['US', '美国 / USD'],
];

export function createLinkExtractorPanel(container: HTMLElement): FeaturePanelHandle {
  const linkSummary = document.createElement('div');
  linkSummary.className = 'opx-summary';

  const sessionCard = document.createElement('div');
  sessionCard.className = 'opx-session-card';
  const emailValue = createSessionRow('邮箱', '未读取');
  const planValue = createSessionRow('套餐', '未读取');
  const tokenValue = createSessionRow('Token', '未读取');
  sessionCard.append(emailValue.row, planValue.row, tokenValue.row);

  const sessionButtonRow = document.createElement('div');
  sessionButtonRow.className = 'opx-button-row';
  const refreshSessionButton = createButton('读取 session', 'opx-button opx-button-secondary');
  const exportCpaButton = createButton('导出 CPA', 'opx-button opx-button-secondary');
  const exportSub2Button = createButton('导出 SUB2', 'opx-button opx-button-secondary');
  sessionButtonRow.append(refreshSessionButton, exportCpaButton, exportSub2Button);

  const planSelect = createSelect([
    ['chatgptplusplan', 'ChatGPT Plus'],
    ['chatgptteamplan', 'ChatGPT Team'],
  ]);
  const uiModeSelect = createSelect([
    ['hosted', '长链接 / hosted'],
    ['custom', '短链接 / custom'],
  ]);
  const regionSelect = createSelect(REGION_OPTIONS);
  const workspaceInput = createInput('Workspace 名称', 'text');
  const seatsInput = createInput('席位数量', 'number');
  seatsInput.min = '2';
  seatsInput.step = '1';

  const mainGrid = document.createElement('div');
  mainGrid.className = 'opx-grid';
  const planField = createField('套餐类型', planSelect);
  const uiModeField = createField('链接形式', uiModeSelect);
  const regionField = createField('计费区域', regionSelect);
  mainGrid.append(planField, uiModeField, regionField);

  const teamOptions = document.createElement('div');
  teamOptions.className = 'opx-team-options';
  const teamGrid = document.createElement('div');
  teamGrid.className = 'opx-grid';
  teamGrid.append(
    createField('Workspace', workspaceInput),
    createField('席位', seatsInput),
  );
  teamOptions.append(teamGrid);

  const tokenInput = document.createElement('textarea');
  tokenInput.className = 'opx-textarea opx-token-textarea';
  tokenInput.placeholder = '自动读取或手动粘贴 ChatGPT session JSON / Access Token';
  tokenInput.autocomplete = 'off';
  tokenInput.spellcheck = false;

  const tokenHint = document.createElement('div');
  tokenHint.className = 'opx-hint';
  tokenHint.textContent = '切到提链接 tab 会读取 /api/auth/session；token 只在当前页面内使用。';

  const refreshButton = createButton('刷新', 'opx-button opx-button-secondary');
  const generateLinkButton = createButton('生成订阅链接');
  const actionGrid = document.createElement('div');
  actionGrid.className = 'opx-grid-1-3';
  actionGrid.append(refreshButton, generateLinkButton);

  const linkOutput = document.createElement('textarea');
  linkOutput.className = 'opx-textarea opx-output';
  linkOutput.placeholder = '生成后的订阅链接';
  linkOutput.readOnly = true;
  linkOutput.spellcheck = false;

  const linkButtonRow = document.createElement('div');
  linkButtonRow.className = 'opx-button-row';
  const copyLinkButton = createButton('复制链接', 'opx-button opx-button-secondary');
  const openLinkButton = createButton('打开链接', 'opx-button opx-button-secondary');
  const clearLinkButton = createButton('清空', 'opx-button opx-button-secondary');
  linkButtonRow.append(copyLinkButton, openLinkButton, clearLinkButton);

  const linkStatus = document.createElement('div');
  linkStatus.className = 'opx-status';
  linkStatus.textContent = '等待读取 ChatGPT session。';

  let generatedLink = '';
  let sessionAccessToken = '';
  let sessionFetchInFlight = false;
  let sessionFetchedOnce = false;
  let currentSessionObject: Record<string, any> | null = null;

  const update = async () => {
    const saved = await loadLinkExtractorState();
    setCheckoutOptions(saved.checkoutOptions);
  };

  const onShow = async () => {
    await refreshSession();
  };

  const syncLinkOptions = async () => {
    try {
      const options = readCheckoutOptions();
      await saveLinkExtractorState({ checkoutOptions: options });
      setLinkSummary(options);
      setStatus(linkStatus, '本地参数已更新', 'ok');
    } catch (error) {
      setStatus(linkStatus, errorMessage(error), 'error');
    }
  };

  for (const item of [planSelect, uiModeSelect, regionSelect, workspaceInput, seatsInput]) {
    item.addEventListener('change', () => void syncLinkOptions());
    item.addEventListener('input', () => void syncLinkOptions());
  }

  const handleExport = async (format: 'cpa' | 'sub2') => {
    if (!currentSessionObject) {
      await refreshSession();
    }
    if (!currentSessionObject) {
      setStatus(linkStatus, '未读取到 ChatGPT session，请先确保已登录 ChatGPT 并点击“读取 session”重试。', 'error');
      return;
    }
    try {
      if (format === 'cpa') {
        const result = exportCpaSessionJson(currentSessionObject);
        downloadTextFile(result.fileContent, result.fileName);
        if (result.hasRefreshToken) {
          setStatus(linkStatus, 'CPA JSON 导出成功', 'ok');
        } else {
          setStatus(linkStatus, '导出成功（注：当前 session 不含 refresh_token，导出文件无法自动续期）', 'ok');
        }
      } else {
        const result = exportSub2SessionJson(currentSessionObject);
        downloadTextFile(result.fileContent, result.fileName);
        setStatus(linkStatus, 'SUB2 JSON 导出成功', 'ok');
      }
    } catch (error) {
      setStatus(linkStatus, `导出失败：${errorMessage(error)}`, 'error');
    }
  };

  refreshSessionButton.addEventListener('click', () => void refreshSession());
  refreshButton.addEventListener('click', () => void refreshSession());
  exportCpaButton.addEventListener('click', () => void handleExport('cpa'));
  exportSub2Button.addEventListener('click', () => void handleExport('sub2'));

  tokenInput.addEventListener('paste', () => window.setTimeout(() => normalizeTokenInput(false), 0));
  tokenInput.addEventListener('input', () => {
    sessionAccessToken = '';
    if (tokenInput.value.includes('accessToken') || tokenInput.value.length > 900) {
      normalizeTokenInput(false);
    }
  });

  generateLinkButton.addEventListener('click', async () => {
    setStatus(linkStatus, '正在生成订阅链接...', 'pending');
    const token = tokenInput.value.trim() ? normalizeTokenInput(true) : sessionAccessToken;
    if (!token) {
      setStatus(linkStatus, '没有 accessToken，请先读取 session 或手动粘贴。', 'error');
      return;
    }

    let options: CheckoutOptions;
    try {
      options = readCheckoutOptions();
      await saveLinkExtractorState({ checkoutOptions: options });
    } catch (error) {
      setStatus(linkStatus, errorMessage(error), 'error');
      return;
    }

    let response: CheckoutLinkResponse;
    try {
      response = await browser.runtime.sendMessage({
        type: 'opx:create-checkout-link',
        raw: token,
        options,
      });
    } catch (error) {
      setStatus(linkStatus, `生成失败：${String(error)}`, 'error');
      return;
    }

    const link = response?.link || response?.url || '';
    if (!isCheckoutLinkResponse(response) || !response.ok || !link) {
      setStatus(linkStatus, response?.message || '生成失败：返回结果无效', 'error');
      setGeneratedLink('');
      return;
    }

    setGeneratedLink(link);
    setStatus(linkStatus, response.message, 'ok');
  });

  copyLinkButton.addEventListener('click', async () => {
    if (!generatedLink) {
      return;
    }
    await navigator.clipboard.writeText(generatedLink);
    setStatus(linkStatus, '已复制链接', 'ok');
  });

  openLinkButton.addEventListener('click', () => {
    if (generatedLink) {
      window.open(generatedLink, '_blank', 'noopener,noreferrer');
    }
  });

  clearLinkButton.addEventListener('click', () => {
    tokenInput.value = '';
    sessionAccessToken = '';
    currentSessionObject = null;
    tokenHint.textContent = '切到提链接 tab 会读取 /api/auth/session；token 只在当前页面内使用。';
    tokenHint.classList.remove('is-ok');
    setGeneratedLink('');
    setSessionRows('', '', '');
    setStatus(linkStatus, '已清空', 'ok');
    tokenInput.focus();
  });

  container.append(
    linkSummary,
    sessionCard,
    sessionButtonRow,
    mainGrid,
    teamOptions,
    tokenInput,
    tokenHint,
    actionGrid,
    createField('订阅链接', linkOutput),
    linkButtonRow,
    linkStatus,
  );
  void update();
  setGeneratedLink('');
  return { update, onShow };

  async function refreshSession(): Promise<void> {
    if (sessionFetchInFlight) {
      return;
    }
    sessionFetchInFlight = true;
    refreshSessionButton.disabled = true;
    refreshButton.disabled = true;
    exportCpaButton.disabled = true;
    exportSub2Button.disabled = true;
    setStatus(linkStatus, '正在读取 https://chatgpt.com/api/auth/session ...', 'pending');
    try {
      const response: ChatGptSessionResponse = await browser.runtime.sendMessage({
        type: 'opx:fetch-chatgpt-session',
      });
      sessionFetchedOnce = true;
      if (!isChatGptSessionResponse(response)) {
        setStatus(linkStatus, 'session 返回结果无效', 'error');
        return;
      }

      const session = response.session;
      currentSessionObject = session?.raw || (session ? { accessToken: session.accessToken, email: session.email, planType: session.planType } : null);
      setSessionRows(session?.email || '', session?.planType || '', session?.accessToken || '');
      if (session?.accessToken) {
        sessionAccessToken = session.accessToken;
        tokenInput.value = session.accessToken;
        tokenHint.textContent = '已从 ChatGPT session 读取 accessToken。';
        tokenHint.classList.add('is-ok');
      }
      setStatus(linkStatus, response.message, response.ok ? 'ok' : 'error');
    } catch (error) {
      setStatus(linkStatus, `读取 session 失败：${String(error)}`, 'error');
    } finally {
      refreshSessionButton.disabled = false;
      refreshButton.disabled = false;
      exportCpaButton.disabled = false;
      exportSub2Button.disabled = false;
      sessionFetchInFlight = false;
    }
  }

  function downloadTextFile(content: string, fileName: string, mimeType = 'application/json;charset=utf-8'): void {
    const blob = new Blob([content], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function setCheckoutOptions(optionsInput: unknown): void {
    const options = normalizeCheckoutOptions(optionsInput);
    planSelect.value = options.planName;
    uiModeSelect.value = options.uiMode;
    regionSelect.value = options.region;
    workspaceInput.value = options.workspaceName;
    seatsInput.value = String(options.seatQuantity);
    setLinkSummary(options);
  }

  function readCheckoutOptions(): CheckoutOptions {
    return normalizeCheckoutOptions({
      planName: planSelect.value,
      uiMode: uiModeSelect.value,
      region: regionSelect.value,
      workspaceName: workspaceInput.value,
      seatQuantity: Number(seatsInput.value || 5),
    });
  }

  function setLinkSummary(options: CheckoutOptions): void {
    const planText = options.planName === 'chatgptteamplan' ? `Team · ${options.seatQuantity} seats` : 'Plus';
    const modeText = options.uiMode === 'hosted' ? '长链接 hosted' : '短链接 custom';
    const sessionText = sessionFetchedOnce ? 'session 已请求' : 'session 待读取';
    linkSummary.textContent = `${planText} · ${modeText} · ${options.region} · ${sessionText}`;
    teamOptions.hidden = options.planName !== 'chatgptteamplan';
    regionField.hidden = options.planName === 'chatgptteamplan';
  }

  function normalizeTokenInput(showError: boolean): string {
    try {
      const token = extractAccessToken(tokenInput.value);
      if (tokenInput.value.trim() !== token) {
        tokenInput.value = token;
      }
      tokenHint.textContent = '已本地提取 accessToken。';
      tokenHint.classList.add('is-ok');
      return token;
    } catch (error) {
      tokenHint.classList.remove('is-ok');
      if (showError) {
        setStatus(linkStatus, errorMessage(error), 'error');
      }
      return '';
    }
  }

  function setGeneratedLink(link: string): void {
    generatedLink = link;
    linkOutput.value = link;
    copyLinkButton.disabled = !link;
    openLinkButton.disabled = !link;
  }

  function setSessionRows(email: string, planType: string, accessToken: string): void {
    emailValue.value.textContent = email || '未读取';
    planValue.value.textContent = planType || '未读取';
    tokenValue.value.textContent = accessToken ? '已获取' : '未获取';
  }
}

function createSessionRow(label: string, initialValue: string): { row: HTMLElement; value: HTMLElement } {
  const row = document.createElement('div');
  row.className = 'opx-session-row';
  const labelElement = document.createElement('span');
  labelElement.textContent = label;
  const value = document.createElement('strong');
  value.textContent = initialValue;
  row.append(labelElement, value);
  return { row, value };
}

function createButton(label: string, className = 'opx-button'): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = label;
  return button;
}

function createInput(placeholder: string, type: string): HTMLInputElement {
  const input = document.createElement('input');
  input.className = 'opx-input';
  input.type = type;
  input.placeholder = placeholder;
  return input;
}

function createSelect(options: string[][]): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'opx-select';
  for (const [value, label] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  return select;
}

function createField(label: string, control: HTMLElement): HTMLElement {
  const field = document.createElement('label');
  field.className = 'opx-field';
  const caption = document.createElement('span');
  caption.className = 'opx-label';
  caption.textContent = label;
  field.append(caption, control);
  return field;
}

function setStatus(element: HTMLElement, message: string, type: 'pending' | 'ok' | 'error'): void {
  element.textContent = message;
  element.dataset.type = type;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isCheckoutLinkResponse(value: unknown): value is CheckoutLinkResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as CheckoutLinkResponse).ok === 'boolean' &&
      typeof (value as CheckoutLinkResponse).message === 'string',
  );
}

function isChatGptSessionResponse(value: unknown): value is ChatGptSessionResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as ChatGptSessionResponse).ok === 'boolean' &&
      typeof (value as ChatGptSessionResponse).message === 'string',
  );
}
