---
name: design-review
description: 视觉走查修复流程：定位代码、修改、验证、提交、回复，以及完成走查和发起 MR 的固定步骤与范围规则。
---

# 视觉走查修复

你在一个独立的走查 worktree 中工作。运行消息会列出本轮要处理的条目编号 `<no>`，并可能附带「已撤销的条目」的说明。

## 1. 运行开始

- 先读 worktree 根目录的 `AGENTS.md` 和 `docs/ai/conventions.md`，再读 `docs/ai/rn-rules.md` 的 §3.8、§8.2、§8.3。
- 每次运行开始，先执行 `git status`。如果看到上次中断的运行留下的未提交改动：不要把它们提交进任何条目，先执行 `git stash push -u -m "design-review 遗留"` 收进 stash，避免把废弃的编辑混进别的条目的 commit。

## 2. 逐条处理

对消息中列出的每一个条目编号，依次执行 claim → 读取 → 定位 → 修改 → 验证 → 提交 → 回复；列出的每一条都处理完之前不要结束运行，不要只处理一条就停。

1. `npx rn-grab-review claim <no>` 领取条目；如果返回 `invalid_state`，跳过该条，继续下一条。
2. `npx rn-grab-review item <no>` 读取条目信息和打印的截图路径，查看截图，然后定位代码：
   - 控件条目：用 grab frames 给出的源码位置，结合控件矩形 rect 和路由名定位。
   - 整页条目：用 `src/config/router.js` 把路由映射到页面组件。
3. 条目带 Figma 链接且 Figma MCP 可用时，读取设计值再动手修改。
4. 修改后验证并提交：`npx eslint <改动文件>`，再跑 `node scripts/ai/check.js`；每条一个 commit，message 为 `fix(design-review): #<no> <中文简述>`，须通过 `node scripts/ai/check-commit-msg.js` 校验。范围为「改公共组件」的条目，commit subject 必须包含「公共组件」。
5. `npx rn-grab-review reply <no> --message "<中文回复>" --commit <sha>` 回复，然后处理下一条。

## 3. 范围与禁区

- 「只改这里」（默认）：只改当前页面或调用处的代码。根因在公共组件、公共样式或 token 定义里时不要改；在回复中说明影响范围（例如「Button 有 63 处在用」），请设计师决定是否改为「改公共组件」后打回。
- 「改公共组件」：可以修改公共组件或样式定义；回复中必须列出使用处数量和主要受影响的页面，commit 和 MR 都要标明涉及公共组件。
- 走查中不改：`src/config/router.js`、`src/core/`、`src/native/`、store shape。某条必须动这些位置时，不改代码，回复说明，交人工处理。
- 文案类条目：只改涉及的 `zh-Hans-CN` 和 `en` key；其他语言走现有翻译流程，并在回复中说明。
- 不需要改代码的条目（需要切图、需要确认或无法修复）：不改代码，只回复说明原因和需要谁提供什么。
- 同一条连续两次尝试失败后，停止修改，回复「需要人工处理」。

## 4. 已撤销的条目

消息中附带的已撤销条目，其改动已经被 revert：不要恢复这些改动，不要引用它们，也不要再处理这些条目。

## 5. 完成走查

1. 在 worktree 中执行 `yarn test`。
2. 执行 `git push -u origin <走查分支>`。
3. 用 `glab api --method POST projects/:fullpath/uploads` 逐条上传条目截图，记录返回的链接。
4. 执行 `glab mr create --source-branch <走查分支> --target-branch <base> --title "fix(design-review): 视觉走查修复（<走查分支>）"`；描述逐条列出截图、设计师每一轮的描述、改动范围、每一轮回复和对应 commit，并单独列出涉及公共组件的条目、未修复（需要人工处理）的条目和已撤销的条目。
5. 执行 `npx rn-grab-review complete --mr <MR 链接>`。

## 6. 禁止

- 禁止推送走查分支以外的任何分支，禁止 force push，禁止 merge。
- 禁止修改 `.codemaker/`、`.rn-grab-review/` 和 worktree 以外的任何文件。
