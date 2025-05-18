import React, { useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../(tabs)/types'; // Adjust the path as necessary
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Albums/ViewAlbum'>;
import AsyncStorage from '@react-native-async-storage/async-storage';

type ViewAlbumRouteProp = RouteProp<RootStackParamList, 'Albums/ViewAlbum'>;

export default function ViewAlbum() {
  const route = useRoute<ViewAlbumRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { _id, title: initialTitle, coverImage: initialCoverImage, images: initialImages } = route.params;


  const [title, setTitle] = useState(initialTitle);
  const [coverImage, setCoverImage] = useState(initialCoverImage);
  const [images, setImages] = useState<{ url: string; timestamp: string }[]>(
    (initialImages || []).map((image) =>
      typeof image === 'string' ? { url: image, timestamp: '' } : image
    )
  );

  const renderImage = ({ item }: { item: { url: string; timestamp: string } }) => (
    <View style={styles.imageContainer}>
      <Image source={{ uri: item.url }} style={styles.albumImage} />
      <Text style={styles.timestampText}>
        Taken on: {new Date(item.timestamp).toLocaleString()}
      </Text>
    </View>
  );

  const handleBack = () => {
    navigation.goBack(); // Navigate back to the previous screen
  };

  const handleEdit = () => {
    navigation.navigate('Albums/EditAlbum', route.params); // Navigate to an EditAlbum screen (if implemented)
  };

  const handleDelete = async () => {
    try {
      const token = await AsyncStorage.getItem('token'); // Retrieve the token from AsyncStorage
      if (!token) {
        console.error('No token found');
        return;
      }

      const response = await fetch(`http://localhost:3000/albums/${_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`, // Include the token in the Authorization header
        },
      });

      if (response.ok) {
        navigation.goBack(); // Navigate back to the previous screen after deletion
      } else {
        console.error('Failed to delete album');
      }
    } catch (error) {
      console.error('Error deleting album:', error);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      const fetchUpdatedAlbum = async () => {
        try {
          const token = await AsyncStorage.getItem('token'); // Retrieve the token from AsyncStorage
          if (!token) {
            console.error('No token found');
            return;
          }
  
          const response = await fetch(`http://localhost:3000/albums/${_id}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`, // Include the token in the Authorization header
            },
          });
  
          if (response.ok) {
            const updatedAlbum = await response.json();
            console.log('Updated album:', updatedAlbum);
            // Sort images by their "taken timestamp"
            const sortedImages = updatedAlbum.images.sort(
              (a: { timestamp: string }, b: { timestamp: string }) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
  
            setTitle(updatedAlbum.title);
            setCoverImage(updatedAlbum.coverImage);
            setImages(sortedImages); // Set the sorted images
          } else {
            console.error('Failed to fetch updated album');
          }
        } catch (error) {
          console.error('Error fetching updated album:', error);
        }
      };
  
      fetchUpdatedAlbum();
    }, [_id])
  );

  return (
    <View style={styles.container}>
      {/* Header with Back and Edit Buttons */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        
      </View>

      {/* Album Title and Cover */}
      <View style={styles.albumHeader}>
        <Image source={{ uri: coverImage }} style={styles.coverImage} />
        <Text style={styles.title}>{title}</Text>
      </View>

      {/* Album Images */}
      <FlatList
        data={images}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderImage}
        contentContainerStyle={styles.imageList}
      />
      <TouchableOpacity onPress={handleDelete} style={styles.dltButton}>
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    top: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dltButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    margin: 30,
    marginTop: 10,
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
  },
  editButton: {
    backgroundColor: '#FF9500',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  albumHeader: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  coverImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  imageList: {
    padding: 10,
    paddingBottom: 50,
  },
  albumImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
  imageContainer: {
    marginBottom: 10,
  },
  timestampText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
});