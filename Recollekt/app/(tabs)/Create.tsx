import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserContext, UserContextType } from '../UserContext';
import { jwtDecode } from 'jwt-decode';
import { useNavigation } from 'expo-router';
import { getLocalIPAddress } from '/Users/Ferdinand/NoName/Recollekt/utils/network';
import * as MediaLibrary from 'expo-media-library';







export default function CreateAlbum() {
  const [serverIP, setServerIP] = useState<string | null>(null);


  const [albumName, setAlbumName] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [albumImages, setAlbumImages] = useState<string[]>([]);
  const [imageTimestamps, setImageTimestamps] = useState<string[]>([]);

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
      exif: true,
    });

    if (!result.canceled) {
      const newImageUris: string[] = [];
      const newTimestamps: string[] = [];

      for (const asset of result.assets) {
        newImageUris.push(asset.uri);

        let timestamp = new Date().toISOString(); // Default

        try {
          const createdAsset = await MediaLibrary.createAssetAsync(asset.uri);
          const assetInfo = await MediaLibrary.getAssetInfoAsync(createdAsset.id);
          const exifData = assetInfo.exif as { [key: string]: any };
          console.log('EXIF Data:', exifData);

          if (exifData && exifData.DateTimeOriginal) {
            // Clean and convert timestamp
            const cleanedDate = exifData.DateTimeOriginal.replace(/:/g, '-');
            timestamp = new Date(cleanedDate).toISOString();
          }
        } catch (error) {
          console.warn('Failed to retrieve EXIF data:', error);
        }

        newTimestamps.push(timestamp);
      }

      setAlbumImages((prev) => [...prev, ...newImageUris]);
      setImageTimestamps((prev) => [...prev, ...newTimestamps]);
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

      const decodedToken = jwtDecode<{ id: string }>(token);
      const creatorId = decodedToken.id;

      const formData = new FormData();
      formData.append('title', albumName);
      formData.append('creatorId', creatorId);

      const coverImageName = coverImage.split('/').pop();
      const coverImageType = `image/${coverImageName?.split('.').pop()}`;
      formData.append('coverImage', {
        uri: coverImage,
        name: coverImageName,
        type: coverImageType,
      } as any);

      for (let i = 0; i < albumImages.length; i++) {
        const imageUri = albumImages[i];
        const imageName = imageUri.split('/').pop();
        const imageType = `image/${imageName?.split('.').pop()}`;

        formData.append('images', {
          uri: imageUri,
          name: imageName,
          type: imageType,
        } as any);

        formData.append('imageTimestamps[]', imageTimestamps[i]);
        console.log('Image Timestamp:', imageTimestamps[i]);
      }

      const response = await fetch(`http://recollekt.local:3000/albums`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const text = await response.text();
      console.log('Server Response:', text);

      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error('Error parsing JSON:', err);
        data = { error: text };
      }

      if (response.ok) {
        Alert.alert('Success', 'Album created successfully!');
        setAlbumName('');
        setCoverImage(null);
        setAlbumImages([]);
        setImageTimestamps([]);
        navigation.navigate('index' as never);
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