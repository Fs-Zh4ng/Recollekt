import React, { useEffect, useState } from 'react';
import { ThemedView } from '@/components/ThemedView';
import { StyleSheet, TouchableOpacity, Text, FlatList, View, Image, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
type NavigationProp = NativeStackNavigationProp<RootStackParamList, '(tabs)/index'>;



export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [albums, setAlbums] = useState([]);
  const [sharedAlbums, setSharedAlbums] = useState([]);// State to hold shared albums
  const [loading, setLoading] = useState<boolean>(true); // Loading state
  const [images, setImages] = useState<{ uri: string; timestamp: { type: string; required: true } }[]>([]); // State to hold images
  const [coverImage, setCoverImage] = useState<string>(''); // State to hold cover image



  
  // Fetch albums from the backend
  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        try {
          setLoading(true); // Set loading to true before fetching data
          // Fetch shared albums
          const token = await AsyncStorage.getItem('token');
          if (!token) {
            return;
          }
          
          const sharedResponse = await fetch(`http://35.183.184.126:3000/albums/shared`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
  
          if (sharedResponse.ok) {
            const sharedAlbumsData = await sharedResponse.json(); // Extract the shared albums array
            setSharedAlbums(sharedAlbumsData.sharedAlbums);
          } else {
            console.error('Failed to fetch shared albums');
            setSharedAlbums([]); // Set to empty array if fetch fails
          }
  
          // Fetch user albums
          const albumsResponse = await fetch(`http://35.183.184.126:3000/albums`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
  
          if (albumsResponse.ok) {
            const albumsData = await albumsResponse.json(); // Extract the albums array
            setAlbums(albumsData.albums);
            setLoading(false); // Set loading to false after fetching data

          } else {
            console.error('Failed to fetch albums');
            setAlbums([]); // Set to empty array if fetch fails
            setLoading(false); // Set loading to false even if fetch fails
          }
        } catch (error) {
          console.error('Error fetching data:', error);
        }
        
      };
  
      fetchData();


    }, [])
  );


  const handleCreate = () => {
    console.log('Create button pressed');
    console.log(navigation.getState().routes);
    navigation.navigate('Create' as never); // Navigate to the CreateAlbum screen
  };

  useEffect(() => {
    console.log('Loading state changed:', loading);
  }, [loading]);

  

  const handleViewAlbum = async (albumId: string, title: string, coverImage: string, images: { url: string; timestamp: {type: string; required: true} }[]) => {

    setLoading(true);
    console.log(loading); // Set loading to true before navigating

    try {

      await new Promise((resolve) => setTimeout(resolve, 500));
      navigation.navigate('Albums/ViewAlbum', {
        _id: albumId,
        title,
        coverImage,
        images: images.map(image => ({
          uri: image.url, // Assuming image.uri is a string
          timestamp: image.timestamp // Assuming image.timestamp is a Date object
        })),
      });
    } catch (error) {
      console.error('Error navigating to ViewAlbum:', error);
      Alert.alert('Error', 'An error occurred while navigating to the album');
    }
    setLoading(false); // Set loading to false after navigating

  };


  
const renderAlbum = ({ item }: { item: any }) => {
  
  // Log the Base64 string
  let imageUri = item.coverImage.replace('dataimage/jpegbase64', ''); // Remove the prefix for the URI

  console.log('Cover Image Base64 (truncated):', imageUri.substring(0, 100));

  return (
    <TouchableOpacity
      style={styles.albumContainer}
      onPress={() => {
        handleViewAlbum(item._id, item.title, imageUri, item.images); // Pass the full URI to the function
      }}
    >
      <Image
        source={{ uri: imageUri }} // Use the full URI
        style={styles.albumCover}
      />
      <Text style={styles.albumTitle}>{item.title}</Text>
    </TouchableOpacity>
  );
};

  if (loading) {
    // Show loading indicator while fetching
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

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

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});