"use strict";
/**
 * Firebase Cloud Functions — Lemon Screenplay Dashboard (V9)
 *
 * Active functions:
 *   - llmProxy: Routes all LLM calls server-side (Anthropic/Google)
 *   - onScreenplayUploaded: Triggers VPS daemon on new PDF upload
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onScreenplayUploaded = exports.googleProxy = exports.llmProxy = void 0;
var llmProxy_1 = require("./llmProxy");
Object.defineProperty(exports, "llmProxy", { enumerable: true, get: function () { return llmProxy_1.llmProxy; } });
var googleProxy_1 = require("./googleProxy");
Object.defineProperty(exports, "googleProxy", { enumerable: true, get: function () { return googleProxy_1.googleProxy; } });
var onScreenplayUploaded_1 = require("./onScreenplayUploaded");
Object.defineProperty(exports, "onScreenplayUploaded", { enumerable: true, get: function () { return onScreenplayUploaded_1.onScreenplayUploaded; } });
//# sourceMappingURL=index.js.map