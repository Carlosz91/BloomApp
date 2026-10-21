import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showErrorToast, showSuccessToast } from '../services/Notifications';
import { API_BASE_URL } from '../config/api';

// Context for JWT token and user auth state
const AuthContext = createContext();

// ---- Session plumbing (module scope) ---------------------------------------
// The backend runs sliding inactivity sessions: every authenticated response
// carries a freshly signed token in the `X-Auth-Token` header and activity is
// the only thing keeping the session alive. This wrapper adopts the renewed
// token transparently and logs out when an authenticated call expires, so no
// screen needs to know about the mechanism. Also mirrors the terms version
// constant in OnboardingScreen (bump both together).
const TERMS_VERSION = 'v1';
let adoptFreshSessionToken = null;
let handleSessionExpired = null;

if (!globalThis.__bloomSessionFetchInstalled) {
  globalThis.__bloomSessionFetchInstalled = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    // Only authenticated calls participate in the session lifecycle.
    const initHeaders = (init && init.headers) || null;
    const headerNames = initHeaders ? Object.keys(initHeaders).map(String) : [];
    const hadAuthHeader = headerNames.some((name) => /authorization/i.test(name));
    if (hadAuthHeader) {
      const freshToken = response.headers?.get?.('x-auth-token');
      // 401/403 on an authenticated call means the inactivity window closed
      // (or the token was rejected): the session is over, log out.
      if (response.status === 401 || response.status === 403) {
        if (handleSessionExpired) handleSessionExpired();
      } else if (freshToken && adoptFreshSessionToken) {
        adoptFreshSessionToken(freshToken);
      }
    }
    return response;
  };
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Upload the device-recorded onboarding acceptance to the server once per
  // session: the DB row is the durable legal proof, the device copy is only a
  // UX cache for the pre-login flow. Best-effort and silent; a failed attempt
  // retries on the next successful login because /auth/me shows the missing
  // record.
  const syncTermsAcceptance = async (authToken, userFromServer) => {
    try {
      if (!authToken || !userFromServer || userFromServer.terms_accepted_at) return;
      const stored = await AsyncStorage.getItem('bloomapp_terms_accept');
      const acceptance = stored ? JSON.parse(stored) : null;
      if (!acceptance || acceptance.version !== TERMS_VERSION) return;
      await fetch(`${API_BASE_URL}/auth/terms-accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ version: acceptance.version })
      });
    } catch (error) {
      console.error('Error syncing terms acceptance', error);
    }
  };

  // Try to read token from storage on mount
  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('bloomapp_token');
        const storedUser = await AsyncStorage.getItem('bloomapp_user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;

        setToken(storedToken);
        setUser(parsedUser);
        setIsLoading(false);
        syncTermsAcceptance(storedToken, parsedUser);
      } catch (error) {
        console.error('Error loading auth state', error);
        setIsLoading(false);
      }
    };

    loadAuthState();
  }, []);

  useEffect(() => {
    // Plug the sliding-session plumbing into this mounted provider.
    adoptFreshSessionToken = async (freshToken) => {
      if (!freshToken) return;
      setToken(freshToken);
      AsyncStorage.setItem('bloomapp_token', freshToken).catch((error) =>
        console.error('Error persisting sliding token', error)
      );
    };
    handleSessionExpired = () => {
      AsyncStorage.removeItem('bloomapp_token').catch(() => {});
      AsyncStorage.removeItem('bloomapp_user').catch(() => {});
      setToken(null);
      setUser(null);
    };
    return () => {
      adoptFreshSessionToken = null;
      handleSessionExpired = null;
    };
  }, []);

  const login = async (credentials) => {
    // Validación: correo y contraseña son obligatorios
    if (!credentials.email || !credentials.password) {
      showErrorToast({
        title: 'Credenciales incompletas',
        description: 'Correo y contraseña son obligatorios',
      });
      return;
    }

    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    if (res.ok) {
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      await AsyncStorage.setItem('bloomapp_token', data.token);
      await AsyncStorage.setItem('bloomapp_user', JSON.stringify(data.user));
      syncTermsAcceptance(data.token, data.user);
    } else {
      const errorData = await res.json();
      showErrorToast({
        title: 'Error de login',
        description: errorData.message || 'Credenciales inválidas',
      });
      throw new Error(errorData.message || 'Login failed');
    }
  };

  // Exchange a Google ID token (already signature-verified by our backend)
  // for a BloomApp JWT session. Persistence mirrors login() exactly.
  // The nonce binds the token to the browser session that requested it
  // and the backend rejects any mismatch (anti-replay).
  const loginWithGoogle = async ({ idToken, nonce }) => {
    if (!idToken || !nonce) {
      showErrorToast({
        title: 'Google',
        description: 'No se recibió el token de Google',
      });
      return;
    }

    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, nonce })
    });

    if (res.ok) {
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      await AsyncStorage.setItem('bloomapp_token', data.token);
      await AsyncStorage.setItem('bloomapp_user', JSON.stringify(data.user));
      syncTermsAcceptance(data.token, data.user);
    } else {
      const errorData = await res.json();
      showErrorToast({
        title: 'Error con Google',
        description: errorData.message || 'No se pudo iniciar sesión con Google',
      });
      throw new Error(errorData.message || 'Google login failed');
    }
  };

  const register = async ({ nombre, email, password }) => {
    // Validación: nombre, correo y contraseña son obligatorios
    if (!nombre || !email || !password) {
      showErrorToast({
        title: 'Campos obligatorios',
        description: 'Nombre, correo y contraseña son obligatorios',
      });
      return;
    }

    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password })
    });
    
    if (res.ok) {
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      await AsyncStorage.setItem('bloomapp_token', data.token);
      await AsyncStorage.setItem('bloomapp_user', JSON.stringify(data.user));
      syncTermsAcceptance(data.token, data.user);
    } else {
      const errorData = await res.json();
      showErrorToast({
        title: 'Error de registro',
        description: errorData.message || 'El registro falló',
      });
      throw new Error(errorData.message || 'Registro fallido');
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('bloomapp_token');
    await AsyncStorage.removeItem('bloomapp_user');
    setToken(null);
    setUser(null);
  };

  // Update the stored profile (nombre, telefono) after saving to the API.
  const updateUser = async (partial) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...partial };
      AsyncStorage.setItem('bloomapp_user', JSON.stringify(next)).catch((error) =>
        console.error('Error persisting user', error)
      );
      return next;
    });
  };

  const value = {
    token,
    user,
    isLoading,
    login,
    loginWithGoogle,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthProvider;