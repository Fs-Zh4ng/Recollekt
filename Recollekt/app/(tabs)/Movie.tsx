import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import {Video, ResizeMode} from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { getLocalIPAddress } from '/Users/Ferdinand/NoName/Recollekt/utils/network';
import Zeroconf from 'react-native-zeroconf';

// Define album type
type Album = {
  _id: string;
  title: string;
  coverImage: string;
  images: { url: string; timestamp: string }[];
};

interface ZeroconfService {
  host: string;
  port: number;
  [key: string]: any; // Include additional properties if needed
}


const Movie = () => {
  const [serverIP, setServerIP] = useState<string | null>(null);
  const zeroconf = new Zeroconf();

zeroconf.on('resolved', (service: ZeroconfService) => {
  console.log('Resolved service:', service);
  const { host, port } = service;
  const serverIP = `${host}:${port}`;
  console.log('Backend server IP:', serverIP);
  setServerIP(serverIP); // Save the detected IP for API calls
});

zeroconf.scan('http', 'tcp', 'local');
  useEffect(() => {
    const fetchIPAddress = async () => {
      const ip = await getLocalIPAddress();
      if (ip) {
        setServerIP(ip);
      } else {
        Alert.alert('Error', 'Unable to detect local IP address.');
      }
    };

    fetchIPAddress();
  }, []);

  const [albums, setAlbums] = useState<Album[]>([]);
  const [sharedAlbums, setSharedAlbums] = useState<Album[]>([]);
  const [selectedAlbums, setSelectedAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          console.error('No token found');
          return;
        }

        const [sharedResponse, albumsResponse] = await Promise.all([
          fetch(`http://recollekt.local:3000/albums/shared`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`http://recollekt.local:3000/albums`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (sharedResponse.ok) {
          const sharedAlbumsData = await sharedResponse.json();
          setSharedAlbums(sharedAlbumsData.sharedAlbums);
        } else {
          console.error('Failed to fetch shared albums');
          setSharedAlbums([]);
        }

        if (albumsResponse.ok) {
          const albumsData = await albumsResponse.json();
          setAlbums(albumsData.albums);
        } else {
          console.error('Failed to fetch albums');
          setAlbums([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const addAlbumToVideo = (albumId: string) => {
    const allAlbums = [...albums, ...sharedAlbums];
    const albumToAdd = allAlbums.find((album) => album._id === albumId);

    if (!albumToAdd) {
      Alert.alert('No Album Selected', 'Please select an album to add.');
      return;
    }

    if (selectedAlbums.some((album) => album._id === albumToAdd._id)) {
      Alert.alert('Album Already Added', 'This album is already added to the video.');
      return;
    }

    setSelectedAlbums((prev) => [...prev, albumToAdd]);
  };

  const createVideo = async () => {
    if (selectedAlbums.length === 0) {
      Alert.alert('No Albums Selected', 'Please select at least one album to create a video.');
      return;
    }

    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication token missing.');
        return;
      }

      const payload = selectedAlbums.map((album) => ({
        title: album.title,
        coverImage: album.coverImage,
        images: album.images.map((img) => img.url),
      }));

      const response = await fetch(`http://recollekt.local:3000/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ albums: payload }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        Alert.alert('Video Error', errorData.error || 'Failed to create video.');
        return;
      }

      const data = await response.json();
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl);
      } else {
        Alert.alert('Error', 'Unexpected response from server.');
      }
    } catch (error) {
      console.error('Error creating video:', error);
      Alert.alert('Error', 'Failed to create video.');
    } finally {
      setIsLoading(false);
    }
  };
  const saveToPhotoAlbum = async () => {
    if (!videoUrl) return;
    console.log('Downloading video from:', videoUrl);
  
    try {
      setIsSaving(true);
  
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'You need to grant permission to save the video.');
        return;
      }
  
      // Download the video to a temporary path in the cache directory
      const tempUri = `${FileSystem.cacheDirectory}temp_video.mp4`;
      console.log('Downloading video to temporary path:', tempUri);
      const response = await FileSystem.downloadAsync(videoUrl, tempUri);
  
      // Move the file to the document directory
      const permanentUri = `${FileSystem.documentDirectory}video.mp4`;
      console.log('Moving video to document directory:', permanentUri);
      await FileSystem.moveAsync({
        from: response.uri,
        to: permanentUri,
      });
  
      // Create an asset for the video
      console.log('Creating asset for the video...');
      const asset = await MediaLibrary.createAssetAsync(permanentUri);
  
      // Save the asset to the photo library
      console.log('Saving asset to photo album...');
      await MediaLibrary.saveToLibraryAsync(asset.uri);
      Alert.alert('Success', 'Video saved to your photo album!');
    } catch (error) {
      console.error('Error saving video:', error);
      Alert.alert('Error', 'Failed to save video.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {videoUrl ? (
          <View style={styles.fullscreenVideoContainer}>
            <Video
              source={{ uri: videoUrl }}
              style={styles.fullscreenVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
            {isSaving ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <TouchableOpacity style={styles.saveButton} onPress={saveToPhotoAlbum}>
                <Text style={styles.saveButtonText}>Save to Camera Roll</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.backButton} onPress={() => setVideoUrl(null)}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={styles.card}>
              <Text style={styles.header}>Select Albums to Create a Video</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedAlbum}
                  onValueChange={(itemValue) => setSelectedAlbum(itemValue)}
                  style={styles.picker}
                  dropdownIconColor="#000"
                >
                  <Picker.Item label="Select an album..." value={null} />
                  {albums.map((album) => (
                    <Picker.Item
                      key={album._id}
                      label={`My Album: ${album.title}`}
                      value={album._id}
                      color="#000"
                    />
                  ))}
                  {sharedAlbums.map((album) => (
                    <Picker.Item
                      key={album._id}
                      label={`Shared Album: ${album.title}`}
                      value={album._id}
                      color="#000"
                    />
                  ))}
                </Picker>
              </View>

              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  if (selectedAlbum) {
                    addAlbumToVideo(selectedAlbum);
                  } else {
                    Alert.alert('No Album Selected', 'Please select an album to add.');
                  }
                }}
              >
                <Text style={styles.addButtonText}>Add Album</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeader}>Selected Albums:</Text>
            {selectedAlbums.map((album) => (
              <Text key={album._id} style={styles.albumText}>
                {album.title}
              </Text>
            ))}

            <TouchableOpacity style={styles.createButton} onPress={createVideo}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create Video</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  albumText: {
    fontSize: 16,
    marginVertical: 4,
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 50,
  },
  card: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  pickerContainer: {
    height: 50,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#000',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 80,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fullscreenVideoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 30,
  },
  fullscreenVideo: {
    width: '100%',
    height: '70%',
    backgroundColor: 'black',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#888',
    borderRadius: 6,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default Movie;