"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openStackFrameInEditor = void 0;
const dev_server_1 = require("./dev-server");
const openStackFrameInEditor = async (payload) => {
    const response = await fetch(`${(0, dev_server_1.getDevServer)().url}open-stack-frame`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Open stack frame request failed with status ${response.status}`);
    }
};
exports.openStackFrameInEditor = openStackFrameInEditor;
//# sourceMappingURL=open.js.map