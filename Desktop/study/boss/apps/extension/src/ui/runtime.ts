import type { RuntimeMessage, RuntimeResponse } from '../types/messages';

export async function sendRuntimeMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(message);
}
