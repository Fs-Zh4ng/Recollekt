import React, { useContext, useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../_layout';
import { useNavigation } from '@react-navigation/native';
import { UserContext } from '../UserContext'; // Adjust the path to your UserContext file
import { getLocalIPAddress } from '/Users/Ferdinand/NoName/Recollekt/utils/network';
import Zeroconf from 'react-native-zeroconf';


export default function LoginScreen() {
  const navigation = useNavigation();
  const [serverIP, setServerIP] = useState<string | null>(null);

  const { setIsAuthenticated } = useContext(AuthContext);
  const userContext = useContext(UserContext); // Adjust the path to your UserContext file
  if (!userContext) {
    throw new Error('UserContext is undefined. Please ensure it is properly provided.');
  }
  const { setUser } = userContext;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [logorSign, setLogorSign] = useState(0);
  const [confirmPassword, setConfirmPassword] = useState('');


  const handleSignUp = async () => {
    if (!username || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    console.log('Sign Up:', { username, password });
    try { 
      const response = await fetch(`http://recollekt.local:3000/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      console.log('Sign Up Response:', data);

      if (response.ok) {
        Alert.alert('Success', 'Account created successfully');
        setLogorSign(0); // Switch to login mode
      } else {
        Alert.alert('Sign Up Failed', data.error || 'Something went wrong');
      }
    }
    catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again later.');
      console.error(error); 
    }
    finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`http://recollekt.local:3000/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      console.log(response);

      const data = await response.json();
      console.log('Login Response:', data);

      if (response.ok) {
        // Save the token (optional, for future API requests)
        await AsyncStorage.setItem('token', data.token);
        navigation.reset({
          index: 0,
          routes: [{ name: '(tabs)' as never }], // Set the new stack with only the (tabs) route
        }); // Navigate to the home screen

        // Set authentication state to true\
        console.log(data.username);
        console.log(data.friends);
        console.log(data.profileImage);
        let img = data.profileImage; // Default to the provided profileImage
        if (!(data.profileImage == '/Users/Ferdinand/NoName/Recollekt/assets/images/DefProfile.webp')) {
          const profImage = await fetch(`http://recollekt.local:3000/images?url=${data.profileImage}`, {
            method: 'GET',
          });
          console.log(profImage);
          const img1 = await profImage.json();
          console.log(img1.image.substring(0, 100));
          img = img1.image.replace('dataimage/jpegbase64', ''); // Extract the image URL from the response
        }
        
 // Log the first 100 characters of the image URL for debugging
        setUser({
          username: data.username,
          friends: data.friends || [], // Use an empty array if friends are not provided
          profileImage: img || '', // Use an empty string if profileImage is not provided
        }); // Set user data in context
        setIsAuthenticated(true);
        
      } else {
        Alert.alert('Login Failed', data.error || 'Invalid credentials');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again later.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {logorSign === 0 ? (
        <>
        <Text style={styles.title}>Welcome to Recollekt</Text>
        <Text style={styles.subtitle}>Please log in to continue</Text>
        <Button title="Sign Up" onPress={() => setLogorSign(1)} />
        <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
      />
            <Button title={loading ? 'Logging in...' : 'Login'} onPress={handleLogin} disabled={loading} />

        </>
      ) : (
        <>
        <Text style={styles.title}>Welcome to Recollekt</Text>
        <Text style={styles.subtitle}>Please sign up to continue</Text>
        <Button title="Log In" onPress={() => setLogorSign(0)} />
        <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry={true}
      />
            <Button title={loading ? 'Signing Up...' : 'Sign Up'} onPress={handleSignUp} disabled={loading} />
        </>
      )
      }
      

      

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    bottom: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
});