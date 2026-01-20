import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { LoginPage } from '../features/login/LoginPage';
import { PlayerProvider } from '../player/PlayerContext';
import { useAuth } from '../session/AuthProvider';

import { Shell } from './Shell';

export function App() {
  const auth = useAuth();

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {auth.isAuthenticated ? (
          <Route
            path="/*"
            element={
              <PlayerProvider>
                <Shell />
              </PlayerProvider>
            }
          />
        ) : (
          <Route path="/*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </HashRouter>
  );
}
