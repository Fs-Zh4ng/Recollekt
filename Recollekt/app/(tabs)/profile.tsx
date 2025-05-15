import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserContext, UserContextType } from '../UserConext'; // Adjust the path to your UserContext file

export default function ProfileScreen() {
  const { user } = useContext(UserContext) as UserContextType;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to the Profile Screen!</Text>
      <Text style={styles.username}>Username: {user.username}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 18,
    color: '#333',
    marginBottom: 10,
  },
  username: {
    fontSize: 16,
    color: '#555',
  },
});