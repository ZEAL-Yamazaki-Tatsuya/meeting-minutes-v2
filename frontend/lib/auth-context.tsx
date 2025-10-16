'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import * as auth from './auth';

interface User {
  userId: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 初期化時にユーザー情報を復元
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (auth.isAuthenticated()) {
          const savedUser = auth.getUser();
          setUser(savedUser);
        }
      } catch (error) {
        console.error('認証の初期化エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    try {
      const user = await auth.signIn(email, password);
      setUser(user);
    } catch (error) {
      throw error;
    }
  };

  const handleSignUp = async (email: string, password: string, name?: string) => {
    try {
      await auth.signUp(email, password, name);
    } catch (error) {
      throw error;
    }
  };

  const handleConfirmSignUp = async (email: string, code: string) => {
    try {
      await auth.confirmSignUp(email, code);
    } catch (error) {
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      setUser(null);
      router.push('/auth/signin');
    } catch (error) {
      console.error('サインアウトエラー:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn: handleSignIn,
    signUp: handleSignUp,
    confirmSignUp: handleConfirmSignUp,
    signOut: handleSignOut,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
