(() => {
  'use strict';

  const installButton = document.querySelector('#install-app-button');
  let deferredInstallPrompt = null;

  registerServiceWorker();
  bindInstallPrompt();

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(error => {
        console.warn('Could not register the Scenario service worker.', error);
      });
    });
  }

  function bindInstallPrompt() {
    if (!installButton || isStandalone()) return;

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      installButton.hidden = false;
    });

    installButton.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;

      installButton.disabled = true;

      try {
        await deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
      } catch (error) {
        console.warn('Could not open the install prompt.', error);
      } finally {
        deferredInstallPrompt = null;
        installButton.hidden = true;
        installButton.disabled = false;
      }
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      installButton.hidden = true;
    });
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }
})();
