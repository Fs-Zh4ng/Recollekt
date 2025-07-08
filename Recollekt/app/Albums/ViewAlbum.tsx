import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import {
  useRoute,
  RouteProp,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ImageModal from 'react-native-image-modal';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';



type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Albums/ViewAlbum'>;
type ViewAlbumRouteProp = RouteProp<RootStackParamList, 'Albums/ViewAlbum'>;



export default function ViewAlbum() {

  const route = useRoute<ViewAlbumRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const navi2 = useNavigation();
  const { _id, title: initialTitle, coverImage: initialCoverImage, images: initialImages } = route.params;
  console.log('Initial Images:', initialImages);

  const [title, setTitle] = useState(initialTitle);
  const [coverImage, setCoverImage] = useState(initialCoverImage);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [images, setImages] = useState<{ uri: string; timestamp: { type: string; required: true }; }[]>([]);



  const getImages = async (url: string) => {
    try {
      const response = await fetch(`http://35.183.184.126:3000/images?url=${url}`, {
        method: 'GET',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }
      const data = await response.json();
      return data.image
    } catch (error) {
      console.error('Error fetching images:', error);
      Alert.alert('Error', 'Failed to fetch images.');
      return '';
    }
  }

  const [isModalVisible, setModalVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleImagePress = (index: number) => {
    setCurrentImageIndex(index);
    setModalVisible(true);
  };
  const saveImageToCameraRoll = async (uri: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera roll permission is required to save images.');
        return;
      }
  
      if (uri.startsWith('data:image')) {
        // Handle Base64 URI
        const fileExtension = uri.split(';')[0].split('/')[1]; // Extract file extension (e.g., 'jpeg', 'png')
        const filePath = `${FileSystem.cacheDirectory}image.${fileExtension}`;
        await FileSystem.writeAsStringAsync(filePath, uri.split(',')[1], { encoding: FileSystem.EncodingType.Base64 });
  
        console.log('Saved Base64 image to local file:', filePath);
  
        const asset = await MediaLibrary.createAssetAsync(filePath);
        await MediaLibrary.createAlbumAsync('Saved Photos', asset, false);
        Alert.alert('Success', 'Image saved to camera roll!');
      } else {
        // Handle regular URI
        const asset = await MediaLibrary.createAssetAsync(uri);
        await MediaLibrary.createAlbumAsync('Saved Photos', asset, false);
        Alert.alert('Success', 'Image saved to camera roll!');
      }
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save image.');
    }
  };



  const handleShare = async () => {
  Alert.prompt(
    'Share Album',
    'Enter the username of the user you want to share this album with:',
    async (input) => {
      if (!input) {
        Alert.alert('Error', 'Please enter a valid email or username.');
        return;
      }

      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          console.error('No token found');
          return;
        }

        const response = await fetch(`http://35.183.184.126:3000/albums/${_id}/share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await AsyncStorage.getItem('token')}`,
          },
          body: JSON.stringify({ sharedWith: input }),
        });

        if (response.ok) {
          Alert.alert('Success', `Album shared successfully with ${input}`);
        } else {
          console.error('Failed to share album');
          Alert.alert('Error', 'Failed to share album. Please try again.');
        }
      } catch (error) {
        console.error('Error sharing album:', error);
        Alert.alert('Error', 'An error occurred while sharing the album.');
      }
    }
  );
};

  const handleBack = () => {
    navi2.navigate('(tabs)' as never);
  };

  const handleEdit = async() => {
    setIsLoading(true);
    console.log(isLoading); // Set loading to true before navigating

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      navigation.navigate('Albums/EditAlbum', route.params);
    } catch (error) {
      console.error('Error navigating to EditAlbum:', error);
      Alert.alert('Error', 'An error occurred while navigating to the edit album screen');
    }
    setIsLoading(false);
  };

  const handleDelete = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        return;
      }

      const response = await fetch(`http://35.183.184.126:3000/albums/${_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${await AsyncStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        Alert.alert('Success', 'Album deleted successfully');
        navi2.navigate('(tabs)' as never);
      } else {
        console.error('Failed to delete album');
        Alert.alert('Error', 'Failed to delete album');
      }
    } catch (error) {
      console.error('Error deleting album:', error);
      Alert.alert('Error', 'An error occurred while deleting the album');
    }
  };
  const fetchUpdatedAlbum = async () => {
    try {
      const response = await fetch(`http://35.183.184.126:3000/albums/${_id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${await AsyncStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const updatedAlbum = data.album;
        setTitle(updatedAlbum.title);
        setCoverImage(updatedAlbum.coverImage.replace('dataimage/jpegbase64', ''));
      }
    } catch (error) {
      console.error('Error fetching updated album:', error);
    }
  };

  const fetchImages = async (pageNumber = 1) => {
      if (isLoading || !hasMore) return;
  
      setIsLoading(true);
      try {
        const token = await AsyncStorage.getItem('token'); // Retrieve token
        const response = await fetch(`http://35.183.184.126:3000/albums/${_id}/images?page=${pageNumber}&limit=4`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      console.log("res", response);
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched images data:', data); // Log the fetched data for debugging
        if (data.images.length > 0) {
          setImages((prevImages) => [...prevImages, ...data.images.map((image: { url: string; timestamp: any }) => ({
            uri: image.url.replace('dataimage/jpegbase64', ''),
            timestamp: image.timestamp,
          }))]);
          console.log('Fetched images:', data.images);
          setPage(pageNumber + 1);
        } else {
          console.log("idk")
          setHasMore(false);
        }
      } else {
        console.log("smtg aint right");
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdatedAlbum();
    fetchImages();
  }, [_id]);

  const renderImage = ({ item, index }: { item: { uri: string; timestamp: any }; index: number }) => {
    console.log('timestamps:', images[index].timestamp);
    let imageUrl =item.uri;// Remove the prefix for the URI
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
      <TouchableOpacity onPress={() => handleImagePress(index)} style={styles.imageContainer}>
        <Image
          resizeMode="cover"
          style={styles.albumImage}
          source={{ uri: imageUrl }}
        />
        <Text style={styles.timestampText}>
          Taken on: {readableDate}
       </Text>
    </TouchableOpacity>
  );
};
  
  

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.albumHeader}>
        <Image
          source={{ uri: typeof coverImage === 'string' ? coverImage : '' }}
          style={styles.coverImage}
        />
        <Text style={styles.title}>{title}</Text>
      </View>

      <FlatList
        data={images.map(image => ({
          uri: image.uri,
          timestamp: image.timestamp,
        }))}
        keyExtractor={(item, index) => index.toString()}
        onEndReached={() => fetchImages(page)} // Fetch more images when reaching the end
        onEndReachedThreshold={0.5}
        renderItem={renderImage}
        numColumns={2}
        contentContainerStyle={styles.imageList}
      />
<View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20 }}>
<TouchableOpacity onPress={handleShare} style={styles.shareButton}>
  <Text style={styles.buttonText}>Share</Text>
</TouchableOpacity>

      <TouchableOpacity onPress={() => Alert.alert('Delete Album', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Delete', onPress: handleDelete }])} style={styles.dltButton}>
        <Text style={styles.buttonText}>Delete</Text>
      </TouchableOpacity>
      </View>

      {/* Fullscreen Image Viewer Modal */}
      <Modal visible={isModalVisible} transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <FlatList
            data={images}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            pagingEnabled // Adjust threshold as needed
            initialScrollIndex={currentImageIndex}
            getItemLayout={(data, index) => ({
              length: Dimensions.get('window').width, // Use the screen width dynamically
              offset: Dimensions.get('window').width * index,
              index,
            })}
            renderItem={({ item }) => { // Debugging log
              return (
                <Image
                  source={{ uri: item.uri }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              );
            }}
          />
          <TouchableOpacity
            onPress={() => saveImageToCameraRoll(images[currentImageIndex].uri)}
            style={styles.saveButton}
          >
            <Text style={styles.closeButtonText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
            { isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#ffffff" />
              </View>
            )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    margin: 20,
    marginTop: 10,
    bottom: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    marginLeft: 20,
    marginTop: 5,
  },
  editButton: {
    backgroundColor: '#FF9500',
    padding: 10,
    borderRadius: 5,
    marginRight: 20,
    marginTop: 5,
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
    flex: 1,
    margin: 5,
  },
  imageWrapper: {
    flex: 1,
    margin: 5,
  },
  timestampText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: Dimensions.get('window').width, // Full screen width
    height: Dimensions.get('window').height, // Full screen height
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 5,
  },
  saveButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  shareButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    margin: 20,
    marginTop: 10,
    bottom: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
