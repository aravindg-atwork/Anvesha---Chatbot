import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/geist';
import './styles/tailwind.css';
import './styles/app.css';
import './styles/product.css';
import './styles/journey.css';
import './styles/brand.css';
import './styles/glass.css';
import './styles/premium.css';
import './styles/workspace.css';
import { App } from './ui/App';
import { initializeSession } from './domain/store';

void initializeSession().finally(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
));
