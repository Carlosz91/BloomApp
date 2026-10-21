import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showErrorToast, showSuccessToast } from '../services/Notifications';
import { API_BASE_URL } from '../config/api';

// Context for JWT token and user auth state
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Try to read token from storage on mount
  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('bloomapp_token');
        const storedUser = await AsyncStorage.getItem('bloomapp_user');
        
        setToken(storedToken);
        setUser(storedUser ? JSON.parse(storedUser) : null);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading auth state', error);
        setIsLoading(false);
      }
    };

    loadAuthState();
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
  const loginWithGoogle = async (idToken) => {
    if (!idToken) {
      showErrorToast({
        title: 'Google',
        description: 'No se recibió el token de Google',
      });
      return;
    }

    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });

    if (res.ok) {
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      await AsyncStorage.setItem('bloomapp_token', data.token);
      await AsyncStorage.setItem('bloomapp_user', JSON.stringify(data.user));
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