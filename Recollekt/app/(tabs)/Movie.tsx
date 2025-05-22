import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNPickerSelect from 'react-native-picker-select';
import { Picker } from '@react-native-picker/picker';

// Define album type once
type Album = {
  _id: string;
  title: string;
  coverImage: string;
  images: { url: string; timestamp: string }[];
};

const Movie = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [sharedAlbums, setSharedAlbums] = useState<Album[]>([]);
  const [selectedAlbums, setSelectedAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          console.error('No token found');
          return;
        }

        const [sharedResponse, albumsResponse] = await Promise.all([
          fetch(`http://localhost:3000/albums/shared`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`http://localhost:3000/albums`, {
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

  const createVideo = () => {
    if (selectedAlbums.length === 0) {
      Alert.alert('No Albums Selected', 'Please select at least one album to create a video.');
      return;
    }

    Alert.alert('Video Creation', 'Video creation process started!');
    console.log('Selected Albums:', selectedAlbums);

    // Future logic: generate video using a library like react-native-ffmpeg
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={styles.container}>
        <View style={styles.card}>
      <Text style={styles.header}>Select Albums to Create a Video</Text>

      {/* Album Picker */}
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

      {/* Add Album Button */}
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

      {/* Selected Albums List */}
      <Text style={styles.sectionHeader}>Selected Albums:</Text>
      {selectedAlbums.map((album) => (
        <Text key={album._id} style={styles.albumText}>{album.title}</Text>
      ))}

      {/* Create Video Button */}
      <TouchableOpacity style={styles.createButton} onPress={createVideo}>
        <Text style={styles.createButtonText}>Create Video</Text>
      </TouchableOpacity>
 
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
  
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  
  card: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
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
  
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  
  selectedAlbum: {
    fontSize: 14,
    marginBottom: 4,
    paddingHorizontal: 4,
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
});

const pickerSelectStyles = {
  inputIOS: {
    fontSize: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    color: 'black',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  inputAndroid: {
    fontSize: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    color: 'black',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
};

export default Movie;
