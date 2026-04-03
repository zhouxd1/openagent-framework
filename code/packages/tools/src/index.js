"use strict";
/**
 * @openagent/tools
 * Tool execution system for OpenAgent Framework
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBuiltinTools = exports.ToolExecutor = void 0;
// Re-export core tool types
var core_1 = require("@openagent/core");
Object.defineProperty(exports, "ToolExecutor", { enumerable: true, get: function () { return core_1.ToolExecutor; } });
// Export builtin tools
__exportStar(require("./builtin"), exports);
// Export tool registration helper
var builtin_1 = require("./builtin");
Object.defineProperty(exports, "registerBuiltinTools", { enumerable: true, get: function () { return builtin_1.registerBuiltinTools; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDRCQUE0QjtBQUM1Qix3Q0FBOEQ7QUFBckQsb0dBQUEsWUFBWSxPQUFBO0FBRXJCLHVCQUF1QjtBQUN2Qiw0Q0FBMEI7QUFFMUIsa0NBQWtDO0FBQ2xDLHFDQUFpRDtBQUF4QywrR0FBQSxvQkFBb0IsT0FBQSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQG9wZW5hZ2VudC90b29sc1xuICogVG9vbCBleGVjdXRpb24gc3lzdGVtIGZvciBPcGVuQWdlbnQgRnJhbWV3b3JrXG4gKi9cblxuLy8gUmUtZXhwb3J0IGNvcmUgdG9vbCB0eXBlc1xuZXhwb3J0IHsgVG9vbEV4ZWN1dG9yLCBJVG9vbEV4ZWN1dG9yIH0gZnJvbSAnQG9wZW5hZ2VudC9jb3JlJztcblxuLy8gRXhwb3J0IGJ1aWx0aW4gdG9vbHNcbmV4cG9ydCAqIGZyb20gJy4vYnVpbHRpbic7XG5cbi8vIEV4cG9ydCB0b29sIHJlZ2lzdHJhdGlvbiBoZWxwZXJcbmV4cG9ydCB7IHJlZ2lzdGVyQnVpbHRpblRvb2xzIH0gZnJvbSAnLi9idWlsdGluJztcbiJdfQ==