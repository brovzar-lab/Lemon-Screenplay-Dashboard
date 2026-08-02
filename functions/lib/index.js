"use strict";
/**
 * Firebase Cloud Functions — Lemon Screenplay Dashboard (V9)
 *
 * Active functions:
 *   - llmProxy: Routes all LLM calls server-side (Anthropic/Google)
 *   - onScreenplayUploaded: Triggers VPS daemon on new PDF upload
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readerChat = exports.calibrationManager = exports.queueManager = exports.onScreenplayUploaded = exports.googleProxy = exports.llmProxy = void 0;
var llmProxy_1 = require("./llmProxy");
Object.defineProperty(exports, "llmProxy", { enumerable: true, get: function () { return llmProxy_1.llmProxy; } });
var googleProxy_1 = require("./googleProxy");
Object.defineProperty(exports, "googleProxy", { enumerable: true, get: function () { return googleProxy_1.googleProxy; } });
var onScreenplayUploaded_1 = require("./onScreenplayUploaded");
Object.defineProperty(exports, "onScreenplayUploaded", { enumerable: true, get: function () { return onScreenplayUploaded_1.onScreenplayUploaded; } });
var queueManager_1 = require("./queueManager");
Object.defineProperty(exports, "queueManager", { enumerable: true, get: function () { return queueManager_1.queueManager; } });
var calibrationManager_1 = require("./calibrationManager");
Object.defineProperty(exports, "calibrationManager", { enumerable: true, get: function () { return calibrationManager_1.calibrationManager; } });
var readerChat_1 = require("./readerChat");
Object.defineProperty(exports, "readerChat", { enumerable: true, get: function () { return readerChat_1.readerChat; } });
//# sourceMappingURL=index.js.map