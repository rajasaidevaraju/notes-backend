export const CLIPBOARD_NOTE_TITLE = 'Clipboard';

// Maximum accepted lengths for user-supplied text. Enforced server-side so a
// client on the shared LAN can't push arbitrarily large payloads into the DB.
export const LIMITS = {
  TITLE: 255,
  NOTE_CONTENT: 100_000,
  CHECKLIST_ITEM: 2_000,
  TRACKER_VALUE: 500,
  TRACKER_UNIT: 50,
} as const;
