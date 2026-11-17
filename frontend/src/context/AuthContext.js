import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as secureStorage from '../services/secureStorage';
import { showErrorToast, showSuccessToast } from '../services/Notifications';
import { API_BASE_URL } from '../config/api';

// Idle timeout for ending a session with no user interaction at all. Keep in
// sync with the backend SESSION_IDLE_SECONDS (enforced server-side): the
// backend only expires on the next request, while this timer IS the proactive
// logout that lands the user on login without touching anything.
const SESSION_INACTIVITY_MS = 180 * 1000;

// Context for JWT token and user auth state
const AuthContext = createContext();

// ---- Session plumbing (module scope) ---------------------------------------
// The backend issues a short-lived access token plus a rotating refresh token.
// This wrapper refreshes transparently: when an authenticated call fails with
// 401 `token_expired`, it performs ONE shared POST /auth/refresh, stores the
// new pair and retries the original request once. A failed refresh, or any 401
// `session_invalid`, ends the session. No screen needs to know about the
// mechanism. Also mirrors the terms version constant in OnboardingScreen
// (bump both together).
const TERMS_VERSION = 'v1';
const TOKEN_KEY = 'bloomapp_token';
const REFRESH_TOKEN_KEY = 'bloomapp_refresh_token';
let handleSessionExpired = null;
let adoptRefreshedToken = null;
let refreshInFlight = null;
const baseFetch = globalThis.__bloomOriginalFetch || globalThis.fetch;

// Single in-flight refresh shared by every concurrent caller. Resolves to
// { status: 'ok', token } | { status: 'rejected' } | { status: 'network' }.
const refreshSession = () => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshToken = await secureStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) return { status: 'rejected' };
        let res;
        try {
          res = await baseFetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
        } catch {
          return { status: 'network' };
        }
        if (res.status >= 500) return { status: 'network' };
        if (!res.ok) return { status: 'rejected' };
        const data = await res.json();
        if (!data.token || !data.refreshToken) return { status: 'rejected' };
        await secureStorage.setItem(TOKEN_KEY, data.token);
        await secureStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        if (adoptRefreshedToken) adoptRefreshedToken(data.token);
        return { status: 'ok', token: data.token };
      } catch {
        return { status: 'network' };
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
};

// Copy of the request init with the Authorization header replaced.
const withAuthorization = (init, token) => {
  const headers = init.headers;
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    const copy = new Headers(headers);
    copy.set('Authorization', `Bearer ${token}`);
    return { ...init, headers: copy };
  }
  const copy = {};
  Object.keys(headers || {}).forEach((name) => {
    if (!/^authorization$/i.test(name)) copy[name] = headers[name];
  });
  copy.Authorization = `Bearer ${token}`;
  return { ...init, headers: copy };
};

const readErrorCode = async (response) => {
  try {
    const body = await response.clone().json();
    return body && body.code;
  } catch {
    return null;
  }
};

if (!globalThis.__bloomSessionFetchInstalled) {
  globalThis.__bloomSessionFetchInstalled = true;
  globalThis.__bloomOriginalFetch = globalThis.fetch;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    // Only authenticated calls participate in the session lifecycle.
    const initHeaders = (init && init.headers) || null;
    const headerNames = initHeaders
      ? (typeof Headers !== 'undefined' && initHeaders instanceof Headers
          ? Array.from(initHeaders.keys())
          : Object.keys(initHeaders).map(String))
      : [];
    const hadAuthHeader = headerNames.some((name) => /authorization/i.test(name));
    if (!hadAuthHeader || response.status !== 401) return response;

    const code = await readErrorCode(response);
    if (code === 'token_expired') {
      const refreshed = await refreshSession();
      if (refreshed.status === 'ok') {
        // Retry the original request exactly once with the new access token.
        const retry = await originalFetch(input, withAuthorization(init, refreshed.token));
        if (retry.status === 401 && handleSessionExpired) handleSessionExpired();
        return retry;
      }
      // Transient network/server trouble: keep the session, surface the 401.
      if (refreshed.status === 'network') return response;
    }
    if (handleSessionExpired) handleSessionExpired();
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
        const storedToken = await secureStorage.getItem(TOKEN_KEY);
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
    // Plug the session plumbing into this mounted provider.
    adoptRefreshedToken = (freshToken) => {
      if (freshToken) setToken(freshToken);
    };
    handleSessionExpired = () => {
      secureStorage.removeItem(TOKEN_KEY).catch(() => {});
      secureStorage.removeItem(REFRESH_TOKEN_KEY).catch(() => {});
      AsyncStorage.removeItem('bloomapp_user').catch(() => {});
      setToken(null);
      setUser(null);
    };
    return () => {
      adoptRefreshedToken = null;
      handleSessionExpired = null;
    };
  }, []);

  // Last moment a real human interaction happened. The session ends from user
  // inactivity, never from app-generated traffic (background refreshes,
  // screen mounts, etc. do not count as activity). Initialized by the
  // effects below instead of at declaration: Date.now() is impure during
  // render.
  const lastUserActivityRef = useRef(null);

  // Web: every real interaction resets the idle window.
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    lastUserActivityRef.current = Date.now();
    const markActivity = () => {
      lastUserActivityRef.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, markActivity));
    };
  }, []);

  // Native: there is no global touch hook, so foreground transitions are the
  // activity signal. Returning to the app after longer than the idle window
  // closes the session immediately; shorter returns just refresh it.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    lastUserActivityRef.current = Date.now();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      const elapsedIdleMs = Date.now() - lastUserActivityRef.current;
      if (lastUserActivityRef.current && elapsedIdleMs > SESSION_INACTIVITY_MS) {
        if (handleSessionExpired) handleSessionExpired();
        return;
      }
      lastUserActivityRef.current = Date.now();
    });
    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  // Web ticker: while a session exists, the idle window is checked every 30s
  // so the app routes itself to login with zero interaction. On native a
  // foregrounded-idle logout cannot be distinguished from active use, so
  // expiry stays request-driven plus the AppState resume check above.
  useEffect(() => {
    if (!token) return undefined;
    lastUserActivityRef.current = Date.now();
    const ticker = setInterval(() => {
      if (
        Platform.OS === 'web' &&
        handleSessionExpired &&
        Date.now() - lastUserActivityRef.current > SESSION_INACTIVITY_MS
      ) {
        handleSessionExpired();
      }
    }, 30 * 1000);
    return () => clearInterval(ticker);
  }, [token]);

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
      await secureStorage.setItem(TOKEN_KEY, data.token);
      if (data.refreshToken) await secureStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
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
      await secureStorage.setItem(TOKEN_KEY, data.token);
      if (data.refreshToken) await secureStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
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
      await secureStorage.setItem(TOKEN_KEY, data.token);
      if (data.refreshToken) await secureStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
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
    // Best-effort server-side revocation BEFORE clearing local state. Network
    // errors and slow servers must never trap the user in a logged-in UI.
    try {
      const currentToken = (await secureStorage.getItem(TOKEN_KEY)) || token;
      if (currentToken) {
        await Promise.race([
          fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${currentToken}` }
          }),
          new Promise((resolve) => setTimeout(resolve, 3000))
        ]);
      }
    } catch {
      // ignored on purpose
    }
    await secureStorage.removeItem(TOKEN_KEY);
    await secureStorage.removeItem(REFRESH_TOKEN_KEY);
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