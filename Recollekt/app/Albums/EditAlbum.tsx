import React, { useState } from 'react';
import { View, Text, TextInput, Image, FlatList, StyleSheet, TouchableOpacity, Alert, Button } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../(tabs)/types'; // Adjust the path as necessary
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Albums/EditAlbum'>;
type EditAlbumRouteProp = RouteProp<RootStackParamList, 'Albums/EditAlbum'>;

export default function EditAlbum() {
  const route = useRoute<EditAlbumRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { _id, title: initialTitle, coverImage: initialCoverImage, images: initialImages } = route.params;

  const [title, setTitle] = useState(initialTitle);
  const [coverImage, setCoverImage] = useState(initialCoverImage);
  const [images, setImages] = useState<string[]>(initialImages);

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
      setImages((prevImages) => [...prevImages, ...selectedImages]);
    }
  };

  const handleDeleteImage = (imageUri: string) => {
    setImages((prevImages) => prevImages.filter((img) => img !== imageUri));
  };

  const handleSave = async () => {
    if (!title || !coverImage) {
      Alert.alert('Error', 'Please enter an album title and select a cover image');
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
  
      const response = await fetch('http://localhost:3000/edit-album', {
        method: 'PUT', // Use PUT for updating resources
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // Include the token for authentication
        },
        body: JSON.stringify({
          id: route.params._id, // Pass the album ID to identify the album
          title,
          coverImage,
          images,
        }),
      });
  
      if (response.ok) {
        Alert.alert('Success', 'Album updated successfully!');
        navigation.navigate('Albums/ViewAlbum', {
            _id: route.params._id,
            title,
            coverImage,
            images,
          }); // Navigate back to the previous screen
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to update album');
      }
    } catch (error) {
      console.error('Error updating album:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };

  const handleCancel = () => {
    navigation.goBack(); // Navigate back to the previous screen without saving
  };

  const renderImage = ({ item }: { item: string }) => (
    <View style={styles.imageContainer}>
      <Image source={{ uri: item }} style={styles.albumImage} />
      <TouchableOpacity onPress={() => handleDeleteImage(item)} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Title Input */}
      <Text style={styles.label}>Album Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Enter album title"
      />

      {/* Cover Image */}
      <Text style={styles.label}>Cover Image</Text>
      <TouchableOpacity onPress={handlePickCoverImage}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>Pick a Cover Image</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Album Images */}
      <Text style={styles.label}>Album Images</Text>
      <FlatList
        data={images}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderImage}
        contentContainerStyle={styles.imageList}
      />
      <TouchableOpacity onPress={handleAddImages} style={styles.addButton}>
        <Text style={styles.addButtonText}>Add More Images</Text>
      </TouchableOpacity>

      {/* Save and Cancel Buttons */}
      <View style={styles.buttonContainer}>
        <Button title="Save" onPress={handleSave} />
        <Button title="Cancel" onPress={handleCancel} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 70,
    paddingBottom: 40,
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
  coverImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
  },
  coverPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  coverPlaceholderText: {
    color: '#888',
    fontSize: 16,
  },
  imageList: {
    paddingBottom: 20,
  },
  imageContainer: {
    marginBottom: 10,
    position: 'relative',
  },
  albumImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'red',
    padding: 5,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
});