import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Toast } from 'expo-toast';

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
    const res = await fetch('http://localhost:3000/auth/login', {
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
      Toast.show({
        title: 'Error de login',
        description: errorData.message || 'Credenciales inválidas',
        type: 'error',
        duration: 3000,
      });
      throw new Error(errorData.message || 'Login failed');
    }
  };

  const register = async ({ nombre, email, password }) => {
    const res = await fetch('http://localhost:3000/auth/register', {
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
      Toast.show({
        title: 'Error de registro',
        description: errorData.message || 'El registro falló',
        type: 'error',
        duration: 3000,
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

  const register = async ({ nombre, email }) => {
    // TODO: Reemplazar por el endpoint real de registro
    setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token');
    setUser({ id: 1, nombre, email });
  };

  const logout = async () => {
    // TODO: Descomentar cuando tenga integración real
    // await AsyncStorage.removeItem('bloomapp_token');
    // await AsyncStorage.removeItem('bloomapp_user');
    // setToken(null);
    // setUser(null);
    
    // Simulación
    setToken(null);
    setUser(null);
  };

  const value = {
    token,
    user,
    isLoading,
    login,
    register,
    logout,
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