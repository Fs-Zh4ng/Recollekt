import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, Redirect, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-reanimated';
import { Text } from 'react-native';

import { UserProvider } from './UserContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export const AuthContext = React.createContext({
  isAuthenticated: false,
  setIsAuthenticated: (value: boolean) => {},
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated }}>
      <UserProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/* 🚨 Always render <Slot /> */}
          {!isAuthenticated && <Redirect href="/login/login" />}
          <Slot />
          <StatusBar style="auto" />
        </ThemeProvider>
      </UserProvider>
    </AuthContext.Provider>
  );
}
function createContext<T>(defaultValue: T) {
  const context = React.createContext<T>(defaultValue);
  return context;
}

 

