/* 1. Tokens & fonts */
import './css/fonts.css';
/* 2. Reset & base */
import './css/base.css';
/* 3. Global layout */
import './css/layout.css';
/* 4. Shared components */
import './css/phase8.css';
/* 5. Public pages */
import './css/public.css';
/* 6. Animations */
import './css/motion.css';
/* 7. Responsive overrides */
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
