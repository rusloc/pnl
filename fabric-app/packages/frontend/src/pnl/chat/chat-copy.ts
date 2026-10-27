// The assistant's fixed copy (ADR-0009): its name, the transparency line shown
// at the top of every conversation (the EU AI Act notice: users are told they
// talk to an AI), and the starter questions of an empty conversation.
export const CHAT_BUTTON_ID = 'pnl-chat-button';
export const CHAT_TITLE = 'AI assistant';
export const CHAT_TRANSPARENCY =
  'This is an AI assistant. It answers from the figures of this report, read with the same queries as the views under your own access, and it can still be wrong: check important numbers in the view before you rely on them.';
export const STARTER_QUESTIONS: readonly string[] = ['How are we doing against budget?', 'Why is net revenue above or below budget?', 'Which lines moved the most?'];
