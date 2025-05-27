import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Image, FlatList, StyleSheet, TouchableOpacity, Alert, Button } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../(tabs)/types'; // Adjust the path as necessary
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { getLocalIPAddress } from '/Users/Ferdinand/NoName/Recollekt/utils/network';
import { useFocusEffect } from 'expo-router';



type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Albums/EditAlbum'>;
type EditAlbumRouteProp = RouteProp<RootStackParamList, 'Albums/EditAlbum'>;


const convertToISO8601 = (input: string): string => {
  // Replace ":" with "-" in date portion and split
  const [datePart, timePart] = input.split(' ');
  const [year, month, day] = datePart.split(':');

  // Construct a valid ISO string
  const isoString = new Date(`${year}-${month}-${day}T${timePart}Z`).toISOString();

  return isoString;
};


export default function EditAlbum() {


  const route = useRoute<EditAlbumRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { _id, title: initialTitle, coverImage: initialCoverImage, images: initialImages } = route.params;

  const [title, setTitle] = useState(initialTitle);
  const [coverImage, setCoverImage] = useState<string>(initialCoverImage);

  const [images, setImages] = useState<{ uri: string; timestamp: { type: string; required: true }; }[]>(
    initialImages.map(image => ({
      ...image,
      timestamp: { ...image.timestamp, required: true },
    }))
  );

  const changeImage = async (uri: string) => {
    const res = await fetch(`http://recollekt.local:3000/images?url=${uri}`, {
      method: 'GET',
    });
    const data = await res.json();
    return data.image.replace('dataimage/jpegbase64', '');
  };

  useFocusEffect(() => {
    (async () => {
      for (const image of images) {
        const img = await changeImage(image.uri);
        setImages((prevImages) =>
          prevImages.map((imgItem) =>
            imgItem.uri === image.uri ? { ...imgItem, uri: img } : imgItem
          )
        );
      }
      if (coverImage.startsWith('https')) {
        const img = await changeImage(coverImage);
        setCoverImage(img);
      }
    })();
  });



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
      const imageUri: { uri: string; timestamp: {type: string; required: true} }[] = [];
      console.log('Selected images:', result.assets.length);
      for (let i = 0; i < result.assets.length; i++) {
        const time = convertToISO8601(result.assets[i].exif?.DateTime || new Date().toISOString());
        imageUri.push({uri: 'data:image/jpeg;base64,' + result.assets[i].base64, timestamp: {type: time, required: true}});
        console.log(new Date(time));
      }
      setImages((prevImages) => [...prevImages, ...imageUri]);
      // console.log('Selected images:', albumImages);
    } else {
      console.log('Image selection canceled');
    }
  };

  const handleDeleteImage = (imageUri: string) => {
    setImages((prevImages) => prevImages.filter((img) => img.uri !== imageUri));
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
              const id = route.params._id;
          
              const formData = new FormData();
              formData.append('id', id); // Include the creator ID
              formData.append('title', title);
              formData.append('coverImage', coverImage); // Base64 string
            
              // Append each image and its timestamp
              images.forEach((image, index) => {
                formData.append(`images[${index}]`, image.uri); 
                console.log('image',image.uri.substring(0, 100));// Base64 string
                formData.append(`timestamps[${index}]`, image.timestamp.type || new Date().toISOString());
              });
  
      const response = await fetch(`http://recollekt.local:3000/edit-album`, {
        method: 'PUT', // Use PUT for updating resources
        headers: {
          Authorization: `Bearer ${token}`, // Include the token for authentication
        },
        body: formData,
      });

      console.log('Response:', response); // Log the response for debugging
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Album updated successfully!');
        navigation.navigate('Albums/ViewAlbum', {
            _id: data.album.id,
            title: data.album.title,
            coverImage: data.album.coverImage,
            images: data.album.images.map((image: { url: string; timestamp: {type: string; required: true} }) => ({
              uri: image.url,
              timestamp: {type: image.timestamp, required: true}, // Assuming timestamp is already in the correct format
            })),
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

  const renderImage = ({ item, index }: { item: { uri: string; timestamp: any }; index: number }) => {
    console.log('timestamps:', images[index].timestamp);
    const imageUrl = item.uri; // Remove the prefix for the URI
    console.log('Image URL:', imageUrl.substring(0, 100)); // Log the image URL for debugging
    console.log(item.timestamp);
    let timestampString = '';
    if (typeof item.timestamp === 'object' && item.timestamp.required) {
      timestampString = Object.values(item.timestamp).join(''); // Join the values to form the string
    } else if (typeof item.timestamp === 'string') {
      timestampString = item.timestamp; // Use the string directly if it's valid
    }
    console.log('timestampString:', timestampString);
    timestampString = timestampString.replace('true', '');
    console.log('Formatted timestampString:', timestampString); // Format the timestamp string
    

    const readableDate = new Date(timestampString).toLocaleString(); 
    
    return (

    <View style={styles.imageContainer}>
      <Image source={{ uri: item.uri }} style={styles.albumImage} />
      <Text style={styles.timestampText}>
        Taken on: {readableDate}
      </Text>
      <TouchableOpacity onPress={() => handleDeleteImage(item.uri)} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  )};

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
        data={images.map(image => ({ uri: image.uri, timestamp: image.timestamp }))}
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
  timestampText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
});