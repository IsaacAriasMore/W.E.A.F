import '@fontsource-variable/archivo/wght.css';
import './css/base.css';
import './css/layout.css';
import './css/public.css';
import './css/auth.css';
import './css/app.css';
import './css/breeds.css';
import './css/admin.css';
import './css/servers.css';
import './css/phase8.css';
import './css/motion.css';
import './css/responsive.css';
import { startApp } from './App.js';
import { initializePwa } from './services/pwaService.js';
import { initI18n } from './i18n/index.js';

initI18n();
initializePwa();
startApp(document.querySelector('#app'));
