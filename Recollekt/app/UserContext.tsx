import React, { createContext, useState, ReactNode } from 'react';

// Define the shape of the user object
export type User = {
  username: string;
};

// Define the shape of the context
export type UserContextType = {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  isAuthenticated: boolean;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
};

// Create the context
export const UserContext = createContext<UserContextType | undefined>(undefined);

// Create the provider component
export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User>({ username: 'Guest' }); // Default user
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Default to not authenticated

  return (
    <UserContext.Provider value={{ user, setUser, isAuthenticated, setIsAuthenticated }}>
      {children}
    </UserContext.Provider>
  );
};