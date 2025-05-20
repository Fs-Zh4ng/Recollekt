import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Image, FlatList, Alert, TextInput, TouchableOpacity } from 'react-native';
import { UserContext, UserContextType } from '../UserContext';
import { AuthContext } from '../_layout'; // Adjust the path to your UserContext file
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
  const { user, setUser } = useContext(UserContext) as UserContextType;
  const { setIsAuthenticated } = useContext(AuthContext);
  const navigation = useNavigation();

  const [friendRequestUsername, setFriendRequestUsername] = useState('');
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);

  useEffect(() => {
    // Fetch pending friend requests from the backend
    const fetchPendingRequests = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await fetch('http://localhost:3000/friends/pending', {
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

    fetchPendingRequests();
  }, []);


  const handleSendFriendRequest = async () => {
    if (!friendRequestUsername) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch('http://localhost:3000/friends/request', {
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
      const response = await fetch('http://localhost:3000/friends/approve', {
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
    <View style={styles.container}>
      {/* User Profile Image */}

    <View style={styles.section}>
      {/* Friends List */}
      <Text style={styles.sectionTitle}>Friends:</Text>
      {user.friends && user.friends.length > 0 ? (
        <FlatList
          data={user.friends}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderFriend}
          style={styles.friendsList}
        />
      ) : (
        <Text style={styles.noFriendsText}>You have no friends yet.</Text>
      )}
    </View>
    <View style={styles.section}>
      {/* Friend Requests */}
      <Text style={styles.sectionTitle}>Pending Friend Requests:</Text>
      {pendingRequests.length > 0 ? (
        <FlatList
          data={pendingRequests}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderPendingRequest}
          style={styles.pendingRequestsList}
        />
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
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
  },
  username: {
    fontSize: 18,
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
});