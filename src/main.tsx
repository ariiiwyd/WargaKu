import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { router } from '@/app/router';
import { ToastProvider } from '@/motion';
import { applyTheme, useUi } from '@/stores/ui.store';
import { useAuth } from '@/stores/auth.store';
import '@/styles/globals.css';

applyTheme(useUi.getState().theme);
useAuth.getState().init();
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
