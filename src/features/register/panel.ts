import type { FeaturePanelHandle } from '../../app/types';
import { saveRegisterState } from '../../app/state';
import type { RegisterController } from './types';

export function createRegisterPanel(container: HTMLElement, controller: RegisterController): FeaturePanelHandle {
  // 1. 邮箱服务 Row
  const serviceField = document.createElement('div');
  serviceField.className = 'opx-field';
  
  const serviceLabel = document.createElement('label');
  serviceLabel.className = 'opx-label';
  serviceLabel.textContent = '邮箱服务';
  
  const serviceGroup = document.createElement('div');
  serviceGroup.style.display = 'grid';
  serviceGroup.style.gridTemplateColumns = 'minmax(0, 3fr) minmax(0, 1fr)';
  serviceGroup.style.gap = '8px';
  serviceGroup.style.alignItems = 'start';
  
  const serviceSelect = document.createElement('select');
  serviceSelect.className = 'opx-select';
  const optOutlook = document.createElement('option');
  optOutlook.value = 'outlook';
  optOutlook.textContent = 'Outlook 行模式';
  const optCfTemp = document.createElement('option');
  optCfTemp.value = 'cloudflare-temp';
  optCfTemp.textContent = 'Cloudflare Temp Email';
  serviceSelect.append(optOutlook, optCfTemp);
  
  const deployBtn = createButton('部署');
  deployBtn.style.marginBottom = '8px';
  deployBtn.addEventListener('click', () => {
    window.open('https://github.com/vual/cloudflare-temp-email', '_blank');
  });
  
  serviceGroup.append(serviceSelect, deployBtn);
  serviceField.append(serviceLabel, serviceGroup);

  // 2. 邮箱生成 Row
  const generatorField = document.createElement('div');
  generatorField.className = 'opx-field';
  
  const generatorLabel = document.createElement('label');
  generatorLabel.className = 'opx-label';
  generatorLabel.textContent = '邮箱生成';
  
  const generatorSelect = document.createElement('select');
  generatorSelect.className = 'opx-select';
  const optGenCustom = document.createElement('option');
  optGenCustom.value = 'custom';
  optGenCustom.textContent = '手动粘贴邮箱';
  const optGenCfTemp = document.createElement('option');
  optGenCfTemp.value = 'cloudflare-temp';
  optGenCfTemp.textContent = 'Cloudflare Temp Email';
  generatorSelect.append(optGenCustom, optGenCfTemp);
  
  generatorField.append(generatorLabel, generatorSelect);

  // 3. Collapsible Configuration Accordion (Details/Summary)
  const configAccordion = document.createElement('details');
  configAccordion.className = 'opx-accordion-section';
  configAccordion.style.marginBottom = '10px';
  
  const accordionSummary = document.createElement('summary');
  accordionSummary.textContent = 'Cloudflare Temp Email 配置';
  accordionSummary.style.outline = 'none';
  
  const accordionContent = document.createElement('div');
  accordionContent.className = 'opx-copy-section-body';
  accordionContent.style.display = 'flex';
  accordionContent.style.flexDirection = 'column';
  accordionContent.style.gap = '8px';
  accordionContent.style.padding = '8px';
  
  // 3.1 TEMP API Input
  const apiField = document.createElement('div');
  apiField.className = 'opx-field';
  const apiLabel = document.createElement('label');
  apiLabel.className = 'opx-label';
  apiLabel.textContent = 'TEMP API';
  const apiInput = document.createElement('input');
  apiInput.className = 'opx-input';
  apiInput.type = 'text';
  apiInput.placeholder = 'https://temp-email-worker.xxxx.workers.dev';
  apiField.append(apiLabel, apiInput);
  
  // 3.2 ADMIN AUTH password field
  const adminAuthField = document.createElement('div');
  adminAuthField.className = 'opx-field';
  const adminAuthLabel = document.createElement('label');
  adminAuthLabel.className = 'opx-label';
  adminAuthLabel.textContent = 'ADMIN AUTH';
  const { container: adminAuthContainer, input: adminAuthInput } = createPasswordInputWithToggle('Admin Auth Token', 'cf-temp-admin-auth');
  adminAuthField.append(adminAuthLabel, adminAuthContainer);
  
  // 3.3 CUSTOM AUTH password field
  const customAuthField = document.createElement('div');
  customAuthField.className = 'opx-field';
  const customAuthLabel = document.createElement('label');
  customAuthLabel.className = 'opx-label';
  customAuthLabel.textContent = 'CUSTOM AUTH';
  const { container: customAuthContainer, input: customAuthInput } = createPasswordInputWithToggle('Custom Auth Token', 'cf-temp-custom-auth');
  const customAuthHint = document.createElement('div');
  customAuthHint.className = 'opx-hint';
  customAuthHint.textContent = '仅当站点启用了访问密码时再填写；这是额外鉴权，不替代 Admin Auth。';
  customAuthField.append(customAuthLabel, customAuthContainer, customAuthHint);
  
  // 3.4 查信方式 Toggle Tabs
  const lookupModeField = document.createElement('div');
  lookupModeField.className = 'opx-field';
  const lookupModeLabel = document.createElement('label');
  lookupModeLabel.className = 'opx-label';
  lookupModeLabel.textContent = '查信方式';
  
  const lookupTabsContainer = document.createElement('div');
  lookupTabsContainer.style.display = 'flex';
  lookupTabsContainer.style.gap = '6px';
  lookupTabsContainer.style.marginBottom = '8px';
  
  const lookupModeReceiveBtn = createButton('邮件接收', 'opx-mini-button');
  lookupModeReceiveBtn.style.flex = '1';
  lookupModeReceiveBtn.style.height = '28px';
  
  const lookupModeRegBtn = createButton('注册邮箱', 'opx-mini-button opx-mini-button-secondary');
  lookupModeRegBtn.style.flex = '1';
  lookupModeRegBtn.style.height = '28px';
  
  lookupTabsContainer.append(lookupModeReceiveBtn, lookupModeRegBtn);
  lookupModeField.append(lookupModeLabel, lookupTabsContainer);
  
  // 3.5 邮件接收 Input Field
  const receiveMailboxField = document.createElement('div');
  receiveMailboxField.className = 'opx-field';
  const receiveMailboxLabel = document.createElement('label');
  receiveMailboxLabel.className = 'opx-label';
  receiveMailboxLabel.textContent = '邮件接收';
  const receiveMailboxInput = document.createElement('input');
  receiveMailboxInput.className = 'opx-input';
  receiveMailboxInput.type = 'text';
  receiveMailboxInput.placeholder = '用于接收转发邮件的邮箱，例如 1@email.example.com';
  receiveMailboxField.append(receiveMailboxLabel, receiveMailboxInput);
  
  // 3.6 随机子域 Checkbox
  const randomSubdomainField = document.createElement('div');
  randomSubdomainField.className = 'opx-field';
  const randomSubdomainLabel = document.createElement('label');
  randomSubdomainLabel.className = 'opx-check-row';
  const randomSubdomainCheckbox = document.createElement('input');
  randomSubdomainCheckbox.type = 'checkbox';
  randomSubdomainCheckbox.className = 'opx-checkbox';
  const randomSubdomainSpan = document.createElement('span');
  randomSubdomainSpan.textContent = ' 依赖后端 RANDOM_SUBDOMAIN_DOMAINS';
  randomSubdomainLabel.append(randomSubdomainCheckbox, randomSubdomainSpan);
  randomSubdomainField.append(randomSubdomainLabel);
  
  // 3.7 指定子域 Input Field
  const customSubdomainField = document.createElement('div');
  customSubdomainField.className = 'opx-field';
  const customSubdomainLabel = document.createElement('label');
  customSubdomainLabel.className = 'opx-label';
  customSubdomainLabel.textContent = '指定子域';
  const customSubdomainInput = document.createElement('input');
  customSubdomainInput.className = 'opx-input';
  customSubdomainInput.type = 'text';
  customSubdomainInput.placeholder = 'edu';
  customSubdomainField.append(customSubdomainLabel, customSubdomainInput);
  
  // 3.8 TEMP 域名 Selection & 同步 Button
  const domainField = document.createElement('div');
  domainField.className = 'opx-field';
  const domainLabel = document.createElement('label');
  domainLabel.className = 'opx-label';
  domainLabel.textContent = 'TEMP 域名';
  
  const domainGroup = document.createElement('div');
  domainGroup.style.display = 'flex';
  domainGroup.style.gap = '8px';
  
  const domainSelect = document.createElement('select');
  domainSelect.className = 'opx-select';
  domainSelect.style.flex = '1';
  domainSelect.style.marginBottom = '0';
  
  const syncDomainsBtn = createButton('更新');
  syncDomainsBtn.style.width = 'auto';
  syncDomainsBtn.style.padding = '0 12px';
  syncDomainsBtn.style.marginBottom = '0';
  
  domainGroup.append(domainSelect, syncDomainsBtn);
  domainField.append(domainLabel, domainGroup);
  
  accordionContent.append(
    apiField,
    adminAuthField,
    customAuthField,
    lookupModeField,
    receiveMailboxField,
    randomSubdomainField,
    customSubdomainField,
    domainField
  );
  configAccordion.append(accordionSummary, accordionContent);

  // 4. 注册邮箱 / Input Area Row
  const accountField = document.createElement('div');
  accountField.className = 'opx-field';
  
  const accountLabel = document.createElement('label');
  accountLabel.className = 'opx-label';
  accountLabel.textContent = '注册邮箱';
  
  const accountGroup = document.createElement('div');
  accountGroup.style.display = 'grid';
  accountGroup.style.gap = '8px';
  accountGroup.style.alignItems = 'start';
  accountGroup.style.marginBottom = '8px';
  
  const accountInput = document.createElement('textarea');
  accountInput.className = 'opx-textarea';
  accountInput.placeholder = '邮箱或 Outlook 行';
  accountInput.autocomplete = 'off';
  accountInput.spellcheck = false;
  accountInput.style.marginBottom = '0';
  
  const generateTempBtn = createButton('生成 Temp');
  generateTempBtn.style.marginBottom = '0';
  
  accountGroup.append(accountInput, generateTempBtn);
  accountField.append(accountLabel, accountGroup);

  const inputHint = document.createElement('div');
  inputHint.className = 'opx-hint';
  inputHint.textContent = '支持 user@example.com 或 email----password----client_id----refresh_token';

  const emailButton = createButton('填入邮箱并继续');
  const otp = document.createElement('input');
  otp.className = 'opx-input';
  otp.type = 'text';
  otp.inputMode = 'numeric';
  otp.placeholder = '验证码';
  otp.autocomplete = 'one-time-code';

  const otpButton = createButton('填入验证码并继续');
  const autoOtpButton = createButton('自动接收并填入验证码', 'opx-button opx-button-secondary');
  const profileButton = createButton('填写资料并创建');

  const guideBox = document.createElement('div');
  guideBox.className = 'opx-guide-box';

  const guideTitle = document.createElement('div');
  guideTitle.className = 'opx-guide-title';
  guideTitle.textContent = '💡 流程快捷导航';

  const guideLinks = document.createElement('div');
  guideLinks.className = 'opx-guide-links';

  const chatgptLink = createGuideLink('➡️ 登录/注册', 'https://chatgpt.com/auth/login');

  guideLinks.append(chatgptLink);
  guideBox.append(guideTitle, guideLinks);

  const status = document.createElement('div');
  status.className = 'opx-status';
  status.textContent = '等待操作';

  const update = async () => {
    const page = controller.getPageState();
    const saved = await controller.loadState();
    
    if (accountInput.value !== saved.rawInput) {
      accountInput.value = saved.rawInput;
    }
    // Highlight the active navigation link based on current URL
    const isChatGpt = location.hostname === 'chatgpt.com';
    chatgptLink.classList.toggle('is-active', isChatGpt);

    // Sync input options/values to state
    serviceSelect.value = saved.cfTempEmailService;
    generatorSelect.value = saved.cfTempEmailGenerator;
    
    apiInput.value = saved.cfTempEmailApi;
    adminAuthInput.value = saved.cfTempEmailAdminAuth;
    customAuthInput.value = saved.cfTempEmailCustomAuth;
    
    if (saved.cfTempEmailLookupMode === 'registration-email') {
      lookupModeReceiveBtn.className = 'opx-mini-button opx-mini-button-secondary';
      lookupModeRegBtn.className = 'opx-mini-button';
      receiveMailboxField.style.display = 'block';
    } else {
      lookupModeReceiveBtn.className = 'opx-mini-button';
      lookupModeRegBtn.className = 'opx-mini-button opx-mini-button-secondary';
      receiveMailboxField.style.display = 'none';
    }
    
    receiveMailboxInput.value = saved.cfTempEmailReceiveMailbox;
    randomSubdomainCheckbox.checked = saved.cfTempEmailUseRandomSubdomain;
    customSubdomainInput.value = saved.cfTempEmailCustomSubdomain;
    
    if (saved.cfTempEmailUseRandomSubdomain) {
      customSubdomainField.style.display = 'none';
    } else {
      customSubdomainField.style.display = 'block';
    }

    // Update Domain Selector options
    domainSelect.innerHTML = '';
    for (const d of saved.cfTempEmailDomains) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      if (d === saved.cfTempEmailSelectedDomain) {
        opt.selected = true;
      }
      domainSelect.append(opt);
    }
    domainSelect.value = saved.cfTempEmailSelectedDomain;

    // Toggle Collapsible Accordion display
    const isCfUsed = saved.cfTempEmailService === 'cloudflare-temp' || saved.cfTempEmailGenerator === 'cloudflare-temp';
    configAccordion.style.display = isCfUsed ? 'block' : 'none';

    // Update Email Textarea structure based on generator choice
    if (saved.cfTempEmailGenerator === 'cloudflare-temp') {
      accountGroup.style.gridTemplateColumns = 'minmax(0, 3fr) minmax(0, 1fr)';
      generateTempBtn.style.display = 'block';
      accountInput.placeholder = '点击生成 Cloudflare Temp Email，或手动粘贴邮箱';
    } else {
      accountGroup.style.gridTemplateColumns = '1fr';
      generateTempBtn.style.display = 'none';
      accountInput.placeholder = '邮箱或 Outlook 行';
    }

    // Toggle displays to keep UI clean and guide the user
    emailButton.style.display = page.canFillEmail ? 'block' : 'none';
    otp.style.display = page.canFillOtp ? 'block' : 'none';
    otpButton.style.display = page.canFillOtp ? 'block' : 'none';
    
    // Auto OTP triggers for either Outlook Line mode or Cloudflare Temp Email service
    const isAutoOtpAvailable = page.canFillOtp && (saved.autoOtp || saved.cfTempEmailService === 'cloudflare-temp');
    autoOtpButton.style.display = isAutoOtpAvailable ? 'block' : 'none';
    
    profileButton.style.display = page.canFillProfile ? 'block' : 'none';
    guideBox.style.display = 'block';

    emailButton.disabled = !page.canFillEmail;
    otpButton.disabled = !page.canFillOtp;
    autoOtpButton.disabled = !page.canFillOtp;
    profileButton.disabled = !page.canFillProfile;
    
    if (saved.cfTempEmailService === 'cloudflare-temp') {
      inputHint.textContent = 'Cloudflare Temp Email 模式：将通过 Cloudflare Worker API 自动接收并填入验证码';
    } else if (saved.autoOtp) {
      inputHint.textContent = 'Outlook 行模式：验证码页会通过本地 API 自动收码';
    } else {
      inputHint.textContent = '单邮箱模式：验证码需要手动输入';
    }
  };

  // State Change & Action Listeners
  serviceSelect.addEventListener('change', async () => {
    await saveRegisterState({ cfTempEmailService: serviceSelect.value as any });
    await update();
  });

  generatorSelect.addEventListener('change', async () => {
    await saveRegisterState({ cfTempEmailGenerator: generatorSelect.value as any });
    await update();
  });

  apiInput.addEventListener('change', async () => {
    await saveRegisterState({ cfTempEmailApi: apiInput.value.trim() });
  });

  adminAuthInput.addEventListener('change', async () => {
    await saveRegisterState({ cfTempEmailAdminAuth: adminAuthInput.value.trim() });
  });

  customAuthInput.addEventListener('change', async () => {
    await saveRegisterState({ cfTempEmailCustomAuth: customAuthInput.value.trim() });
  });

  lookupModeReceiveBtn.addEventListener('click', async () => {
    await saveRegisterState({ cfTempEmailLookupMode: 'receive-mailbox' });
    await update();
  });

  lookupModeRegBtn.addEventListener('click', async () => {
    await saveRegisterState({ cfTempEmailLookupMode: 'registration-email' });
    await update();
  });

  receiveMailboxInput.addEventListener('change', async () => {
    await saveRegisterState({ cfTempEmailReceiveMailbox: receiveMailboxInput.value.trim() });
  });

  randomSubdomainCheckbox.addEventListener('change', async () => {
    await saveRegisterState({ cfTempEmailUseRandomSubdomain: randomSubdomainCheckbox.checked });
    await update();
  });

  customSubdomainInput.addEventListener('change', async () => {
    await saveRegisterState({ cfTempEmailCustomSubdomain: customSubdomainInput.value.trim() });
  });

  domainSelect.addEventListener('change', async () => {
    await saveRegisterState({ cfTempEmailSelectedDomain: domainSelect.value });
  });

  syncDomainsBtn.addEventListener('click', async () => {
    setStatus(status, '正在同步可用域名...', 'pending');
    const result = await controller.syncTempEmailDomains();
    setResult(status, result);
    await update();
  });

  generateTempBtn.addEventListener('click', async () => {
    setStatus(status, '正在生成临时邮箱...', 'pending');
    const result = await controller.generateTempEmailAddress();
    setResult(status, result);
    await update();
  });

  accountInput.addEventListener('input', async () => {
    const saved = await controller.saveInput(accountInput.value);
    inputHint.textContent = saved.autoOtp
      ? 'Outlook 行模式：验证码页会通过本地 API 自动收码'
      : '单邮箱模式：验证码需要手动输入';
  });

  emailButton.addEventListener('click', async () => {
    setStatus(status, '正在提交邮箱...', 'pending');
    await controller.saveInput(accountInput.value);
    setResult(status, await controller.fillEmailFromInput());
    await update();
  });

  otpButton.addEventListener('click', async () => {
    setStatus(status, '正在提交验证码...', 'pending');
    setResult(status, await controller.fillOtp(otp.value));
    await update();
  });

  autoOtpButton.addEventListener('click', async () => {
    const saved = await controller.loadState();
    if (saved.cfTempEmailService === 'cloudflare-temp') {
      setStatus(status, '等待 Cloudflare Temp Email 验证码...', 'pending');
      setResult(status, await controller.waitForTempEmailOtp());
    } else {
      setStatus(status, '等待 Outlook 验证码...', 'pending');
      setResult(status, await controller.waitForOutlookOtp());
    }
    await update();
  });

  profileButton.addEventListener('click', async () => {
    setStatus(status, '正在填写资料...', 'pending');
    setResult(status, await controller.fillProfileAndCreate());
    await update();
  });

  container.append(
    guideBox,
    serviceField,
    generatorField,
    configAccordion,
    accountField,
    inputHint,
    emailButton,
    otp,
    otpButton,
    autoOtpButton,
    profileButton,
    status
  );
  void update();
  return { update };
}

function createPasswordInputWithToggle(placeholder: string, id: string) {
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.display = 'flex';
  container.style.alignItems = 'center';

  const input = document.createElement('input');
  input.className = 'opx-input';
  input.type = 'password';
  input.placeholder = placeholder;
  input.id = id;
  input.style.paddingRight = '32px';
  input.style.marginBottom = '0';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.textContent = '👁️';
  toggleBtn.style.position = 'absolute';
  toggleBtn.style.right = '8px';
  toggleBtn.style.background = 'none';
  toggleBtn.style.border = 'none';
  toggleBtn.style.color = '#94a3b8';
  toggleBtn.style.cursor = 'pointer';
  toggleBtn.style.padding = '4px';
  toggleBtn.style.fontSize = '14px';

  toggleBtn.addEventListener('click', () => {
    if (input.type === 'password') {
      input.type = 'text';
      toggleBtn.textContent = '🔒';
    } else {
      input.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  });

  container.append(input, toggleBtn);
  return { container, input };
}

function createGuideLink(label: string, url: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'opx-guide-link';
  a.href = url;
  a.textContent = label;
  return a;
}

function createButton(label: string, className = 'opx-button'): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = label;
  return button;
}

function setResult(element: HTMLElement, result: { ok: boolean; message: string }): void {
  setStatus(element, result.message, result.ok ? 'ok' : 'error');
}

function setStatus(element: HTMLElement, message: string, type: 'pending' | 'ok' | 'error'): void {
  element.textContent = message;
  element.dataset.type = type;
}
