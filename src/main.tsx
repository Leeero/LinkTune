import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css';

import { App } from './app/App';
import './styles.css';
import { AuthProvider } from './session/AuthProvider';
import { ThemeProvider } from './theme/ThemeProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
