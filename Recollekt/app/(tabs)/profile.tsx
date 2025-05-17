import React, { useContext } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { UserContext, UserContextType } from '../UserContext';
import { AuthContext } from '../_layout'; // Adjust the path to your UserContext file
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
  const { user } = useContext(UserContext) as UserContextType;
  const { setIsAuthenticated } = useContext(AuthContext);
    const navigation = useNavigation();
    console.log(user.username);

  const handleSubmit = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('Error', 'No token found');
      return;
    } else {
      console.log('Token:', token);
      await AsyncStorage.removeItem('token');
      setIsAuthenticated(false);
      Alert.alert('Success', 'Logged out successfully');
      // Optionally, navigate to the login screen or perform any other action
      navigation.reset({
        index: 0,
        routes: [{ name: 'login/login' as never }], // Set the new stack with only the login route
      }); 
    }
  };
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to the Profile Screen!</Text>
      <Text style={styles.username}>Username: {user.username}</Text>
      <Button title="Logout" onPress={handleSubmit} />
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