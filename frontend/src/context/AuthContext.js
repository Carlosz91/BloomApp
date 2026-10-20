import React, { createContext, useContext, useState, useEffect } from 'react';

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
        // TODO: Descomentar cuando tenga AsyncStorage configurado
        // const storedToken = await AsyncStorage.getItem('bloomapp_token');
        // const storedUser = await AsyncStorage.getItem('bloomapp_user');
        
        // Por ahora, simular carga
        // const mockToken = storedToken || null;
        // const mockUser = storedUser ? JSON.parse(storedUser) : null;
        
        // setToken(mockToken);
        // setUser(mockUser);
        // setIsLoading(false);
        
        // Sin sesión guardada: el usuario pasa por Onboarding -> Login
        // (el auto-login mock anterior se retiró para que ese flujo sea alcanzable).
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading auth state', error);
        setIsLoading(false);
      }
    };

    loadAuthState();
  }, []);

  const login = async (credentials) => {
    // TODO: Descomentar cuando tenga endpoint real
    // const res = await fetch('http://localhost:3000/auth/login', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(credentials)
    // });
    // 
    // if (res.ok) {
    //   const data = await res.json();
    //   setToken(data.token);
    //   setUser(data.user);
    //   await AsyncStorage.setItem('bloomapp_token', data.token);
    //   await AsyncStorage.setItem('bloomapp_user', JSON.stringify(data.user));
    // }
    
    // Simulación para desarrollo
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token';
    const mockUser = { id: 1, nombre: credentials.nombre, email: `${credentials.nombre.toLowerCase()}@luminabeauty.com` };
    
    setToken(mockToken);
    setUser(mockUser);
    // await AsyncStorage.setItem('bloomapp_token', mockToken);
    // await AsyncStorage.setItem('bloomapp_user', JSON.stringify(mockUser));
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