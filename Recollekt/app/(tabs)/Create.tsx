import React, { useState, useContext } from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserContext, UserContextType } from '../UserContext';
import { jwtDecode } from 'jwt-decode';
import { useNavigation } from 'expo-router';




export default function CreateAlbum() {
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
  
      const response = await fetch('http://localhost:3000/albums', {
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
    <View style={styles.container}>
      <Text style={styles.label}>Album Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter album name"
        value={albumName}
        onChangeText={setAlbumName}
      />

      <Text style={styles.label}>Cover Image</Text>
      {coverImage ? (
        <Image source={{ uri: coverImage }} style={styles.imagePreview} />
      ) : (
        <TouchableOpacity style={styles.imageButton} onPress={handlePickCoverImage}>
          <Text style={styles.imageButtonText}>Pick Cover Image</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.label}>Album Images</Text>
      <TouchableOpacity style={styles.imageButton} onPress={handleAddImages}>
        <Text style={styles.imageButtonText}>Add Images</Text>
      </TouchableOpacity>

      <View style={styles.imageList}>
        {albumImages.map((imageUri, index) => (
          <Image key={index} source={{ uri: imageUri }} style={styles.imagePreviewSmall} />
        ))}
      </View>

      <Button title="Create Album" onPress={handleCreateAlbum} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    top: 50,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
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
});