import React, { useContext, useState, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, Button, Image, FlatList, Alert, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { UserContext, UserContextType } from '../UserContext';
import { AuthContext } from '../_layout'; // Adjust the path to your UserContext file
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';


export default function ProfileScreen() {
  const [serverIP, setServerIP] = useState<string | null>(null);

  const { user, setUser, isUserLoading } = useContext(UserContext) as UserContextType;
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
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 1,
        base64: true, // Get base64 encoded image
      });

      if (!result.canceled) {
        const selectedImage = result.assets[0].base64; // Get the selected image URI
        if (selectedImage) {
          setProfileImage('data:image/jpeg;base64,'+selectedImage);
          console.log('Selected profile image:', selectedImage.substring(0, 50) + '...'); // Log the first 50 characters of the base64 string
        }

        // Update the profile picture on the backend
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          Alert.alert('Error', 'No token found. Please log in again.');
          return;
        }

        const formData = new FormData();
        formData.append('profileImage', profileImage);

        const response = await fetch(`http://35.183.184.126:3000/user/profile-picture`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: formData,
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
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'No token found');
        return;
      }
      
      console.log('Token:', token);
      
      // Clear all stored data
      await AsyncStorage.removeItem('token');
      
      // Reset user context to default state
      setUser({ username: 'Guest', friends: [], profileImage: '' });
      
      // Set authentication state to false first
      setIsAuthenticated(false);
      
      // Small delay to ensure state updates are processed
      setTimeout(() => {
        Alert.alert('Success', 'Logged out successfully');
      }, 100);
      
      // The root layout will automatically redirect to login when isAuthenticated becomes false
      
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Something went wrong during logout');
    }
  };

  useFocusEffect(
    
    React.useCallback(() => {
    // Fetch pending friend requests from the backend
    const fetchPendingRequests = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await fetch(`http://35.183.184.126:3000/friends/pending`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setPendingRequests(data.pendingRequests || []);
        } else {
          console.error('Failed to fetch pending requests:', data.error);
        }
      } catch (error) {
        console.error('Error fetching pending requests:', error);
      }
    };

    const fetchUserProfile = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await fetch(`http://35.183.184.126:3000/user/profile`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setUser(data.user); // The server returns {user: userData}
        }
        else {
          console.error('Failed to fetch user profile:', data.error);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    fetchUserProfile();

    fetchPendingRequests();
  }, []));


  const handleSendFriendRequest = async () => {
    if (!friendRequestUsername) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch('http://35.183.184.126:3000/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: friendRequestUsername }),
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', `Friend request sent to ${friendRequestUsername}`);
        setFriendRequestUsername('');
      } else {
        Alert.alert('Error', data.error || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };

  const handleApproveRequest = async (username: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch('http://35.183.184.126:3000/friends/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', `Friend request from ${username} approved`);
        setPendingRequests((prev) => prev.filter((request) => request !== username));
        setUser((prevUser) => ({
          ...prevUser,
          friends: [...prevUser.friends, username],
        }));
      } else {
        Alert.alert('Error', data.error || 'Failed to approve friend request');
      }
    } catch (error) {
      console.error('Error approving friend request:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };

  const renderPendingRequest = ({ item }: { item: string }) => (
    <View style={styles.pendingRequestItem}>
      <Text style={styles.pendingRequestText}>{item}</Text>
      <Button title="Approve" onPress={() => handleApproveRequest(item)} />
    </View>
  );

  const renderFriend = ({ item }: { item: string }) => (
    <Text style={styles.friendItem}>{item}</Text>
  );

  
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
    <View style={styles.container}>
      {/* User Profile Image */}
      <TouchableOpacity onPress={handleChangeProfilePicture}>
        <Image source={{ uri: profileImage }} style={styles.profileImage} />
        <Text style={styles.changePictureText}>Change Profile Picture</Text>
      </TouchableOpacity>

      {/* Username */}
      <Text style={styles.username}>{user.username}</Text>

      <View style={styles.section}>
  {/* Friends List */}
  <Text style={styles.sectionTitle}>Friends:</Text>
  {user.friends && user.friends.length > 0 ? (
    user.friends.map((item, index) => (
      <View key={index} style={styles.friendItem}>
        {renderFriend({ item })}
      </View>
    ))
  ) : (
    <Text style={styles.noFriendsText}>You have no friends yet.</Text>
  )}
</View>

<View style={styles.section}>
  {/* Friend Requests */}
  <Text style={styles.sectionTitle}>Pending Friend Requests:</Text>
  {pendingRequests.length > 0 ? (
    pendingRequests.map((item, index) => (
      <View key={index} style={styles.pendingRequestItem}>
        {renderPendingRequest({ item })}
      </View>
    ))
  ) : (
    <Text style={styles.noPendingRequestsText}>No pending friend requests.</Text>
  )}
</View>
            <View style={styles.section}>
            {/* Send Friend Request */}
            <Text style={styles.sectionTitle}>Send Friend Request:</Text>
            <TextInput
              style={styles.friendRequestInput}
              placeholder="Enter username"
              value={friendRequestUsername}
              onChangeText={setFriendRequestUsername}
            />
                    <TouchableOpacity style={styles.sendButton} onPress={handleSendFriendRequest}>
                <Text style={styles.sendButtonText}>Send Request</Text>
              </TouchableOpacity>
            </View>



      {/* Logout Button */}
      <TouchableOpacity onPress={handleLogout} style={styles.dltButton}>
                <Text style={styles.buttonText}>Log Out</Text>
              </TouchableOpacity>
    </View>
    </ScrollView>
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
    scrollContainer: {
    flexGrow: 1,
    padding: 20, // Optional padding for the scrollable area
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    width: '100%', // Make the section span the full width
    marginBottom: 30,
    padding: 20, // Adjust padding for inner content
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
});