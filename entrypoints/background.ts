import { browser } from 'wxt/browser';
import { requestCancel, runBatchDownload } from '../lib/download-manager';
import type { BackgroundRequest, ProgressMessage } from '../lib/types';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
    if (message.type === 'moodleloader:download-batch') {
      runBatchDownload(message.tabId, message.courses, message.saveCourseAsHtml, (state) => {
        const progressMessage: ProgressMessage = { type: 'moodleloader:progress', state };
        browser.runtime.sendMessage(progressMessage).catch(() => {
          // Popup ist evtl. geschlossen - Downloads laufen unabhängig davon weiter.
        });
      }).then(() => sendResponse({ ok: true }));
      return true;
    }
    if (message.type === 'moodleloader:cancel') {
      requestCancel();
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });
});
