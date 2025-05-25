import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserContext, UserContextType } from '../UserContext';
import { jwtDecode } from 'jwt-decode';
import { useNavigation } from 'expo-router';
import { getLocalIPAddress } from '/Users/Ferdinand/NoName/Recollekt/utils/network';
import * as MediaLibrary from 'expo-media-library';


export default function CreateAlbum() {
  const [serverIP, setServerIP] = useState<string | null>(null);


  const convertToISO8601 = (input: string): string => {
    // Replace ":" with "-" in date portion and split
    const [datePart, timePart] = input.split(' ');
    const [year, month, day] = datePart.split(':');
  
    // Construct a valid ISO string
    const isoString = new Date(`${year}-${month}-${day}T${timePart}Z`).toISOString();
  
    return isoString;
  };
  
  const [albumName, setAlbumName] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [albumImages, setAlbumImages] = useState<{uri: string; timestamp: Date}[]>([]);
  const [imageTimestamps, setImageTimestamps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

    const { user } = useContext(UserContext) as UserContextType;
  const navigation = useNavigation();

  const handlePickCoverImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 1,
      exif: true,
      base64: true,
    });
    if (!result.canceled) {
      setCoverImage('data:image/jpeg;base64,' + result.assets[0].base64);
      console.log('Selected cover image:', result.assets[0].exif);
    } else {
      console.log('Cover image selection canceled');
    }
  };

  const handleAddImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 1,
      exif: true,
      base64: true,
    });

    if (!result.canceled) {
      const imageUri: { uri: string; timestamp: Date }[] = [];
      console.log('Selected images:', result.assets.length);
      for (let i = 0; i < result.assets.length; i++) {
        const time = convertToISO8601(result.assets[i].exif?.DateTime || new Date().toISOString());
        imageUri.push({uri: 'data:image/jpeg;base64,' + result.assets[i].base64, timestamp: new Date(time)});
        console.log(new Date(time));
      }
      setAlbumImages((prevImages) => [...prevImages, ...imageUri]);
      // console.log('Selected images:', albumImages);
    } else {
      console.log('Image selection canceled');
    }
  };
  const handleCreateAlbum = async () => {

    if (!albumName || !coverImage || albumImages.length === 0) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const token = await AsyncStorage.getItem('token');
    if (!token) {
      console.error('No token found');
      return;
    }


  const formData = new FormData();
  formData.append('title', albumName);
  formData.append('coverImage', coverImage); // Base64 string

  // Append each image and its timestamp
  albumImages.forEach((image, index) => {
    formData.append(`images[${index}]`, image.uri); // Base64 string
    formData.append(`timestamps[${index}]`, image.timestamp.toISOString() || new Date().toISOString());
  });// Log the form data for debugging
   // Log the form data for debugging

  // console.log('Form data:', formData);
  // formData.forEach((value, key) => {
  //   console.log(key, value);
  // }); // Log the form data for debugging

  setLoading(true);
    try {
      const response = await fetch(`http://recollekt.local:3000/albums`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      console.log('Response:', response); // Log the response for debugging

      if (response.ok) {
        const data = await response.json();
        console.log('Album created successfully:', data);
        Alert.alert('Success', 'Album created successfully');
        // Clear the form
        setAlbumName('');
        setCoverImage('');
        setAlbumImages([]);
        setImageTimestamps([]);
        setLoading(false);
        navigation.navigate('index' as never);
      } else {
        console.error('Failed to create album:', await response.json());
        Alert.alert('Error', 'Failed to create album');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error creating album:', error);
      Alert.alert('Error', 'An error occurred while creating the album');
      setLoading(false);
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
        <Image key={index} source={{ uri: imageUri.uri }} style={styles.imagePreviewSmall} />
      ))}
    </View>

    <TouchableOpacity onPress={handleCreateAlbum} style={styles.editButton} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Create</Text>
          )}
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