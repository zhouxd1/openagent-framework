"use strict";
/**
 * Event Types for OpenAgent Framework
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventType = void 0;
/**
 * Event types enum
 */
var EventType;
(function (EventType) {
    // Agent events
    EventType["AGENT_START"] = "agent:start";
    EventType["AGENT_END"] = "agent:end";
    EventType["AGENT_ERROR"] = "agent:error";
    // Tool events
    EventType["TOOL_START"] = "tool:start";
    EventType["TOOL_END"] = "tool:end";
    EventType["TOOL_ERROR"] = "tool:error";
    // Session events
    EventType["SESSION_CREATED"] = "session:created";
    EventType["SESSION_UPDATED"] = "session:updated";
    EventType["SESSION_CLOSED"] = "session:closed";
    // Message events
    EventType["MESSAGE_CREATED"] = "message:created";
    // Error events
    EventType["ERROR"] = "error";
    // LLM events
    EventType["LLM_REQUEST"] = "llm:request";
    EventType["LLM_RESPONSE"] = "llm:response";
    EventType["LLM_ERROR"] = "llm:error";
    // Permission events
    EventType["PERMISSION_CHECKED"] = "permission:checked";
    EventType["PERMISSION_DENIED"] = "permission:denied";
})(EventType || (exports.EventType = EventType = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0eXBlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7O0dBRUc7OztBQUlIOztHQUVHO0FBQ0gsSUFBWSxTQThCWDtBQTlCRCxXQUFZLFNBQVM7SUFDbkIsZUFBZTtJQUNmLHdDQUEyQixDQUFBO0lBQzNCLG9DQUF1QixDQUFBO0lBQ3ZCLHdDQUEyQixDQUFBO0lBRTNCLGNBQWM7SUFDZCxzQ0FBeUIsQ0FBQTtJQUN6QixrQ0FBcUIsQ0FBQTtJQUNyQixzQ0FBeUIsQ0FBQTtJQUV6QixpQkFBaUI7SUFDakIsZ0RBQW1DLENBQUE7SUFDbkMsZ0RBQW1DLENBQUE7SUFDbkMsOENBQWlDLENBQUE7SUFFakMsaUJBQWlCO0lBQ2pCLGdEQUFtQyxDQUFBO0lBRW5DLGVBQWU7SUFDZiw0QkFBZSxDQUFBO0lBRWYsYUFBYTtJQUNiLHdDQUEyQixDQUFBO0lBQzNCLDBDQUE2QixDQUFBO0lBQzdCLG9DQUF1QixDQUFBO0lBRXZCLG9CQUFvQjtJQUNwQixzREFBeUMsQ0FBQTtJQUN6QyxvREFBdUMsQ0FBQTtBQUN6QyxDQUFDLEVBOUJXLFNBQVMseUJBQVQsU0FBUyxRQThCcEIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEV2ZW50IFR5cGVzIGZvciBPcGVuQWdlbnQgRnJhbWV3b3JrXG4gKi9cblxuaW1wb3J0IHsgTWV0YWRhdGEgfSBmcm9tICcuLi90eXBlcyc7XG5cbi8qKlxuICogRXZlbnQgdHlwZXMgZW51bVxuICovXG5leHBvcnQgZW51bSBFdmVudFR5cGUge1xuICAvLyBBZ2VudCBldmVudHNcbiAgQUdFTlRfU1RBUlQgPSAnYWdlbnQ6c3RhcnQnLFxuICBBR0VOVF9FTkQgPSAnYWdlbnQ6ZW5kJyxcbiAgQUdFTlRfRVJST1IgPSAnYWdlbnQ6ZXJyb3InLFxuXG4gIC8vIFRvb2wgZXZlbnRzXG4gIFRPT0xfU1RBUlQgPSAndG9vbDpzdGFydCcsXG4gIFRPT0xfRU5EID0gJ3Rvb2w6ZW5kJyxcbiAgVE9PTF9FUlJPUiA9ICd0b29sOmVycm9yJyxcblxuICAvLyBTZXNzaW9uIGV2ZW50c1xuICBTRVNTSU9OX0NSRUFURUQgPSAnc2Vzc2lvbjpjcmVhdGVkJyxcbiAgU0VTU0lPTl9VUERBVEVEID0gJ3Nlc3Npb246dXBkYXRlZCcsXG4gIFNFU1NJT05fQ0xPU0VEID0gJ3Nlc3Npb246Y2xvc2VkJyxcblxuICAvLyBNZXNzYWdlIGV2ZW50c1xuICBNRVNTQUdFX0NSRUFURUQgPSAnbWVzc2FnZTpjcmVhdGVkJyxcblxuICAvLyBFcnJvciBldmVudHNcbiAgRVJST1IgPSAnZXJyb3InLFxuXG4gIC8vIExMTSBldmVudHNcbiAgTExNX1JFUVVFU1QgPSAnbGxtOnJlcXVlc3QnLFxuICBMTE1fUkVTUE9OU0UgPSAnbGxtOnJlc3BvbnNlJyxcbiAgTExNX0VSUk9SID0gJ2xsbTplcnJvcicsXG5cbiAgLy8gUGVybWlzc2lvbiBldmVudHNcbiAgUEVSTUlTU0lPTl9DSEVDS0VEID0gJ3Blcm1pc3Npb246Y2hlY2tlZCcsXG4gIFBFUk1JU1NJT05fREVOSUVEID0gJ3Blcm1pc3Npb246ZGVuaWVkJyxcbn1cblxuLyoqXG4gKiBBZ2VudCBldmVudCBzdHJ1Y3R1cmVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBZ2VudEV2ZW50IHtcbiAgdHlwZTogRXZlbnRUeXBlO1xuICBzZXNzaW9uSWQ/OiBzdHJpbmc7XG4gIGFnZW50SWQ/OiBzdHJpbmc7XG4gIHRpbWVzdGFtcDogRGF0ZTtcbiAgZGF0YTogdW5rbm93bjtcbiAgbWV0YWRhdGE/OiBNZXRhZGF0YTtcbn1cblxuLyoqXG4gKiBFdmVudCBoYW5kbGVyIGZ1bmN0aW9uIHR5cGVcbiAqL1xuZXhwb3J0IHR5cGUgRXZlbnRIYW5kbGVyID0gKGV2ZW50OiBBZ2VudEV2ZW50KSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbiJdfQ==