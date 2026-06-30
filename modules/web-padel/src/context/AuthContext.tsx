import React, { createContext, useContext, useState, useCallback } from 'react';
import { apolloClient, gql } from '../utils/apollo';

const AUTHENTICATE_MUTATION = gql`
  mutation Authenticate($userid: String!, $password: String!) {
    authenticate(userid: $userid, password: $password) {
      user { id name email userid status }
      token
      refreshToken
      expiresIn
    }
  }
`;

interface AuthUser {
  id: string;
  name: string;
  email: string;
  userid: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (userid: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('padel_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (userid: string, password: string): Promise<AuthUser> => {
    setLoading(true);
    try {
      const result = await apolloClient.mutate({
        mutation: AUTHENTICATE_MUTATION,
        variables: { userid, password },
      });

      const payload = (result.data as any).authenticate;
      const expiresIn = payload.expiresIn ?? 30;
      const authUser: AuthUser = {
        id: payload.user.id,
        name: payload.user.name,
        email: payload.user.email,
        userid: payload.user.userid,
        token: payload.token,
        refreshToken: payload.refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
      };

      localStorage.setItem('padel_user', JSON.stringify(authUser));
      setUser(authUser);
      setLoading(false);
      return authUser;
    } catch (err) {
      localStorage.removeItem('padel_user');
      setUser(null);
      setLoading(false);
      throw new Error('Invalid credentials');
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('padel_user');
    setUser(null);
    window.location.href = '/auth';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
};
