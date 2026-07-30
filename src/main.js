import '@fontsource-variable/archivo/wght.css';
import './css/base.css';
import './css/layout.css';
import './css/public.css';
import './css/phase8.css';
import './css/motion.css';
import './css/responsive.css';
import { startApp } from './App.js';
import { initializePwa } from './services/pwaService.js';
import { initI18n } from './i18n/index.js';

initI18n();
startApp(document.querySelector('#app'));

const initializePwaWhenIdle = () => {
  const load = () => initializePwa();
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 2000 });
  else window.setTimeout(load, 500);
};

if (document.readyState === 'complete') initializePwaWhenIdle();
else window.addEventListener('load', initializePwaWhenIdle, { once: true });
