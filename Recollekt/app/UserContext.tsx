import React, { createContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the shape of the user object
export type User = {
  username: string;
  friends: string[]; // Optional friends property
  profileImage: string;
};

// Define the shape of the context
export type UserContextType = {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  isUserLoading: boolean;
  onTokenInvalid?: () => void;
 // Optional profile image property
};

// Create the context
export const UserContext = createContext<UserContextType | undefined>(undefined);

// Create the provider component
export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User>({ username: 'Guest', friends: [], profileImage: '' }); // Default user
  const [isUserLoading, setIsUserLoading] = useState(true);

  const handleTokenInvalid = async () => {
    await AsyncStorage.removeItem('token');
    setUser({ username: 'Guest', friends: [], profileImage: '' });
    // The parent component (root layout) should handle setting authentication to false
  };

  // Restore user data when component mounts if token exists
  useEffect(() => {
    const restoreUserData = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          // Fetch user profile data from server
          try {
            const response = await fetch('http://35.183.184.126:3000/user/profile', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (response.ok) {
              const responseData = await response.json();
              const userData = responseData.user; // Extract user from the response object
              console.log('Restored user data:', userData);
              
              // Handle profile image if needed
              let img = userData.profileImage;
              if (userData.profileImage && !(userData.profileImage === '/Users/Ferdinand/NoName/Recollekt/assets/images/DefProfile.webp')) {
                // The server already returns base64 data, so we don't need to fetch it again
                img = userData.profileImage;
              }
              
              setUser({
                username: userData.username || 'Guest',
                friends: userData.friends || [],
                profileImage: img || '',
              });
            } else {
              console.log('Failed to fetch user profile:', response.status);
              // If fetching profile fails, the token might be invalid
              await handleTokenInvalid();
            }
          } catch (profileError) {
            console.error('Failed to fetch user profile:', profileError);
            // If fetching profile fails, the token might be invalid
            await handleTokenInvalid();
          }
        }
      } catch (error) {
        console.error('Error restoring user data:', error);
      } finally {
        setIsUserLoading(false);
      }
    };

    restoreUserData();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, isUserLoading, onTokenInvalid: handleTokenInvalid}}>
      {children}
    </UserContext.Provider>
  );
};