import React, { useEffect, useState } from 'react';
import { ThemedView } from '@/components/ThemedView';
import { StyleSheet, TouchableOpacity, Text, FlatList, View, Image, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;



export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [albums, setAlbums] = useState([]);

  // Fetch albums from the backend
  const fetchAlbums = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication token is missing. Please log in again.');
        return;
      }

      const response = await fetch('http://localhost:3000/albums', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAlbums(data.albums); // Assuming the backend returns an array of albums
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to fetch albums');
      }
    } catch (error) {
      console.error('Error fetching albums:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };

  // Fetch albums when the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        await fetchAlbums();
      };
      fetchData();
    }, [])
  );

  const handleViewAlbum = (album: { _id: string; title: string; coverImage: string; images: string[] }) => {
    navigation.navigate('Albums/ViewAlbum', album); // Pass album details as params
  };

  const handleCreate = () => {
    console.log('Create button pressed');
    navigation.navigate('Create' as never); // Navigate to the CreateAlbum screen
  };

  
  const renderAlbum = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => handleViewAlbum(item)}>
      <View style={styles.albumContainer}>
        <Image source={{ uri: item.coverImage }} style={styles.albumCover} />
        <Text style={styles.albumTitle}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={albums}
        keyExtractor={(item) => item._id} // Assuming each album has a unique `_id`
        renderItem={renderAlbum}
        contentContainerStyle={styles.albumList}
        ListEmptyComponent={<Text style={styles.emptyText}>No albums found</Text>}
      />
      <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
        <Text style={styles.plusSign}>+</Text>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    top: 50,
  },
  albumList: {
    paddingBottom: 130,
    paddingTop: 20,
  },
  albumContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  albumCover: {
    width: 150,
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 18,
    color: '#888',
  },
  createButton: {
    position: 'absolute',
    bottom: 150,
    right: 30,
    backgroundColor: '#007AFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  plusSign: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
});