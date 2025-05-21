import React, { useEffect, useState } from 'react';
import { ThemedView } from '@/components/ThemedView';
import { StyleSheet, TouchableOpacity, Text, FlatList, View, Image, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
type NavigationProp = NativeStackNavigationProp<RootStackParamList, '(tabs)/index'>;



export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [albums, setAlbums] = useState([]);
  const [sharedAlbums, setSharedAlbums] = useState([]);// State to hold shared albums

  // Fetch albums from the backend
  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        try {
          // Fetch shared albums
          const token = await AsyncStorage.getItem('token');
          if (!token) {
            console.error('No token found');
            return;
          }
  
          const sharedResponse = await fetch(`http://localhost:3000/albums/shared`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
  
          if (sharedResponse.ok) {
            const sharedAlbumsData = await sharedResponse.json();
            console.log("Raw Shared Albums Response:", sharedAlbumsData); // Extract the shared albums array
            setSharedAlbums(sharedAlbumsData.sharedAlbums);
          } else {
            console.error('Failed to fetch shared albums');
            setSharedAlbums([]); // Set to empty array if fetch fails
          }
          console.log("SHARED ALBUMS", sharedAlbums);
  
          // Fetch user albums
          const albumsResponse = await fetch(`http://localhost:3000/albums`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
  
          if (albumsResponse.ok) {
            const albumsData = await albumsResponse.json(); // Extract the albums array
            setAlbums(albumsData.albums);
            console.log("ALBUMS", albums);
          } else {
            console.error('Failed to fetch albums');
            setAlbums([]); // Set to empty array if fetch fails
          }
 // Combine albums and shared albums
        } catch (error) {
          console.error('Error fetching data:', error);
        }
        
      };
  
      fetchData();
    }, [])
  );

  const handleViewAlbum = (album: { _id: string; title: string; coverImage: string; images: {url: string; timestamp: string}[] }) => {
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
      <Text style={{ fontSize: 40, fontWeight: 'bold', textAlign: 'center', marginTop: 20, marginBottom: 20, fontFamily: 'Inter' }}>
        Your Albums
      </Text>
      <FlatList
        data={[...(albums || []), ...(sharedAlbums || [])]} // Use the combined albums array
        keyExtractor={(item) => item._id} // Assuming each album has a unique `_id`
        renderItem={renderAlbum}
        numColumns={2}
        contentContainerStyle={styles.albumList}
        ListEmptyComponent={<Text style={styles.emptyText}>No albums found</Text>}
        style={{ width: '100%', alignSelf: 'center' }} // Add margin to the d bottom of the FlatList
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
    margin: 5,
    marginBottom: 30,
    alignItems: 'center',
  },
  albumCover: {
    width: '50%',
    aspectRatio: 1,
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