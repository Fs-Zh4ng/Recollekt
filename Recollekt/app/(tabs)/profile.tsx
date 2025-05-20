import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Image, FlatList, Alert, TextInput, TouchableOpacity } from 'react-native';
import { UserContext, UserContextType } from '../UserContext';
import { AuthContext } from '../_layout'; // Adjust the path to your UserContext file
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const { user, setUser } = useContext(UserContext) as UserContextType;
  const { setIsAuthenticated } = useContext(AuthContext);
  const navigation = useNavigation();

  const [friendRequestUsername, setFriendRequestUsername] = useState('');
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);


  const [profileImage, setProfileImage] = useState(user.profileImage);

  const handleChangeProfilePicture = async () => {
    try {
      // Request permission to access the media library
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'You need to allow access to your media library to change the profile picture.');
        return;
      }

      // Open the image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 1,
      });

      if (!result.canceled) {
        const selectedImage = result.assets[0].uri; // Get the selected image URI
        setProfileImage(selectedImage);

        // Update the profile picture on the backend
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          Alert.alert('Error', 'No token found. Please log in again.');
          return;
        }

        const response = await fetch('http://localhost:3000/user/profile-picture', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ profileImage: selectedImage }),
        });

        if (response.ok) {
          const updatedUser = await response.json();
          setUser(updatedUser); // Update the user context with the new profile picture
          Alert.alert('Success', 'Profile picture updated successfully!');
        } else {
          Alert.alert('Error', 'Failed to update profile picture.');
        }
      }
    } catch (error) {
      console.error('Error changing profile picture:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };


  const handleLogout = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('Error', 'No token found');
      return;
    } else {
      console.log('Token:', token);
      await AsyncStorage.removeItem('token');
      setIsAuthenticated(false);
      Alert.alert('Success', 'Logged out successfully');
      navigation.reset({
        index: 0,
        routes: [{ name: 'login/login' as never }], // Set the new stack with only the login route
      });
    }
  };

  
  return (
    <View style={styles.container}>
      {/* User Profile Image */}
      <TouchableOpacity onPress={handleChangeProfilePicture}>
        <Image source={{ uri: profileImage }} style={styles.profileImage} />
        <Text style={styles.changePictureText}>Change Profile Picture</Text>
      </TouchableOpacity>

      {/* Username */}
      <Text style={styles.username}>{user.username}</Text>



      {/* Logout Button */}
      <TouchableOpacity onPress={handleLogout} style={styles.dltButton}>
                <Text style={styles.buttonText}>Log Out</Text>
              </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingBottom: 100,
    paddingTop: 70,
  },
  changePictureText: {
    fontSize: 18,
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 200,
    height: 200,
    borderRadius: 50,
    marginBottom: 20,
  },
  username: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  friendsList: {
    width: '100%',
    marginBottom: 20,
  },
  friendItem: {
    fontSize: 14,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  noFriendsText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  pendingRequestsList: {
    width: '100%',
    marginBottom: 20,
  },
  pendingRequestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  pendingRequestText: {
    fontSize: 14,
  },
  noPendingRequestsText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  friendRequestInput: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 10,
  },
  dltButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    margin: 30,
    marginTop: 100,
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});