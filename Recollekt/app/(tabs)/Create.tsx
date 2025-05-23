import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserContext, UserContextType } from '../UserContext';
import { jwtDecode } from 'jwt-decode';
import { useNavigation } from 'expo-router';
import { getLocalIPAddress } from '/Users/Ferdinand/NoName/Recollekt/utils/network';
import Zeroconf from 'react-native-zeroconf';


interface ZeroconfService {
  host: string;
  port: number;
  [key: string]: any; // Include additional properties if needed
}




export default function CreateAlbum() {
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

  const [albumName, setAlbumName] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [albumImages, setAlbumImages] = useState<string[]>([]);
    const { user } = useContext(UserContext) as UserContextType;
  const navigation = useNavigation();

  const handlePickCoverImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setCoverImage(result.assets[0].uri);
    }
  };

  const handleAddImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      const selectedImages = result.assets.map((asset) => asset.uri);
      setAlbumImages((prevImages) => [...prevImages, ...selectedImages]);
    }
  };

  const handleCreateAlbum = async () => {
    if (!albumName || !coverImage) {
      Alert.alert('Error', 'Please enter an album name and select a cover image');
      return;
    }
  
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication token is missing. Please log in again.');
        return;
      }
  
      // Decode the token to get the user ID
      const decodedToken = jwtDecode<{ id: string }>(token);
      const creatorId = decodedToken.id;
  
      const response = await fetch(`http://recollekt.local:3000/albums`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: albumName,
          coverImage,
          images: albumImages,
          creatorId, // Use the extracted user ID
        }),
      });
  
      const text = await response.text();
      console.log('Server Response:', text);
  
      if (!response.headers.get('content-type')?.includes('application/json')) {
        Alert.alert('Error', 'Unexpected server response. Please try again later.');
        return;
      }
  
      const data = JSON.parse(text);
  
      if (response.ok) {
        Alert.alert('Success', 'Album created successfully!');
        console.log('Album created:', data.album);
        setAlbumName('');
        setCoverImage(null);
        setAlbumImages([]);
        navigation.navigate('index' as never); // Navigate back to the home screen
      } else {
        Alert.alert('Error', data.error || 'Failed to create album');
      }
    } catch (error) {
      console.error('Error creating album:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };

  return (
    <KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
>
  <ScrollView
    contentContainerStyle={styles.scrollContainer} // Use flexGrow for scrollable content
    showsVerticalScrollIndicator={false} // Optional: Hide the scroll indicator
  >
    <Text style={styles.label}>Album Title</Text>
    <TextInput
      style={styles.input}
      placeholder="Enter album title"
      value={albumName}
      onChangeText={setAlbumName}
    />

    <Text style={styles.label}>Cover Image</Text>
    <TouchableOpacity style={styles.imageButton} onPress={handlePickCoverImage}>
      <Text style={styles.imageButtonText}>Select Cover Image</Text>
    </TouchableOpacity>
    {coverImage ? (
      <Image source={{ uri: coverImage }} style={styles.coverImagePreview} />
    ) : null}

    <Text style={styles.label}>Album Images</Text>
    <TouchableOpacity style={styles.imageButton} onPress={handleAddImages}>
      <Text style={styles.imageButtonText}>Add Images</Text>
    </TouchableOpacity>

    <View style={styles.imageList}>
      {albumImages.map((imageUri, index) => (
        <Image key={index} source={{ uri: imageUri }} style={styles.imagePreviewSmall} />
      ))}
    </View>

    <TouchableOpacity onPress={handleCreateAlbum} style={styles.editButton}>
      <Text style={styles.buttonText}>Create</Text>
    </TouchableOpacity>
  </ScrollView>
</KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    top: 50,
    marginBottom: 100,
  },
  scrollContainer: {
    flexGrow: 1, // Ensures the content inside ScrollView is scrollable
    padding: 20,
    backgroundColor: '#fff',
    top: 50, // Add padding to prevent cutoff at the bottom
  },
  label: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  imageButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  imageButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 5,
    marginBottom: 20,
  },
  imagePreviewSmall: {
    width: 60,
    height: 60,
    borderRadius: 5,
    marginRight: 10,
    marginBottom: 10,
  },
  imageList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  editButton: {
    backgroundColor: '#28ad4b',
    padding: 20,
    borderRadius: 10,
    marginBottom: 100,
  },
  coverImagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 5,
    marginBottom: 20,
  },
});