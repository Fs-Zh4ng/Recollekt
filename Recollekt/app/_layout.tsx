import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, Redirect, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { UserProvider, UserContext } from './UserContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);

  const segments = useSegments();

  // Check for existing authentication token on app startup
  React.useEffect(() => {
    const checkAuthToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          // Just check if token exists, UserContext will validate it and load user data
          setIsAuthenticated(true);
          console.log('Token found, user should be authenticated');
        }
      } catch (error) {
        console.error('Error checking auth token:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuthToken();
  }, []);

  // Listen for token removal (when UserContext detects invalid token)
  React.useEffect(() => {
    const checkForTokenRemoval = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token && isAuthenticated) {
        // Token was removed, set authentication to false
        setIsAuthenticated(false);
        console.log('Token was removed, user logged out');
      }
    };

    // Check every second for token removal
    const interval = setInterval(checkForTokenRemoval, 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Show loading screen while fonts are loading, segments are empty, or auth is loading
  if (!loaded || segments.length === 0 as number || isAuthLoading) {
    return null;
  }

  const isInAuthGroup = segments[0] === 'login';
  console.log('isInAuthGroup:', isInAuthGroup);

  return (
    <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated }}>
      <UserProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style="auto" />
          {!isAuthenticated && !isInAuthGroup ? (
            <Redirect href="/login/login" />
          ) : (
            <Slot />
          )}
        </ThemeProvider>
      </UserProvider>
    </AuthContext.Provider>
  );
}

 

