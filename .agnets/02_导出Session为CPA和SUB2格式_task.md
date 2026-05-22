# Task List: Integrate Session Export Feature

- [x] 1. Modify `src/features/link-extractor/types.ts` to include `raw` in `ChatGptSessionInfo`.
- [x] 2. Modify `entrypoints/background.ts` to pass the raw session response object in `fetchChatGptSessionInTab()`.
- [x] 3. Create `src/features/link-extractor/exporter.ts` to implement the CPA and SUB2 session format converter logic.
- [x] 4. Modify `src/features/link-extractor/panel.ts` to build the new three-column button layout and implement the download trigger logic.
- [x] 5. Create `02_导出Session为CPA和SUB2格式.md` in `openai-plus-vxt/.agnets`.
- [x] 6. Run manual and code build verifications.
