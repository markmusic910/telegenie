import '@telegenie/libs/polyfills/disposable-stack';

import { TeleGenieServiceWorker } from './telegenie.service-worker';

new TeleGenieServiceWorker().init();
