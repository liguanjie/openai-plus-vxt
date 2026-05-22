# Task List: Integrate Cloudflare Temp Email Feature

- [x] 1. Modify `src/features/register/types.ts` to extend `RegisterState` and add the 11 new configuration parameters and background message interface types.
- [x] 2. Modify `src/app/state.ts` to add default state values and integrate the normalization rules for state initialization.
- [x] 3. Create `src/features/register/temp-email.ts` to implement the core Cloudflare API integration, MIME parsing, OTP regex capture, and domain sync routines.
- [x] 4. Modify `entrypoints/background.ts` to setup the 3 new background message routes (`opx:fetch-temp-email-domains`, `opx:generate-temp-email`, `opx:wait-temp-email-otp`) and implement the type guard guards.
- [x] 5. Modify `wxt.config.ts` to grant the general `"<all_urls>"` host permissions for cross-origin API calls.
- [x] 6. Modify `src/features/register/controller.ts` to implement the `syncTempEmailDomains`, `generateTempEmailAddress`, and `waitForTempEmailOtp` controller hooks.
- [x] 7. Modify `src/features/register/panel.ts` to build the new UI interface (dropdowns, collapsible config details block, input password toggles, "生成 Temp" textarea actions).
- [x] 8. Run compilation checks and document progress.
