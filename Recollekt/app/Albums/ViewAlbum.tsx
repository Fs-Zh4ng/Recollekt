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
} from 'react-native';
import {
  useRoute,
  RouteProp,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';
import { RootStackParamList } from '../(tabs)/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ImageModal from 'react-native-image-modal';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Permissions from 'expo-permissions';
import { getLocalIPAddress } from '/Users/Ferdinand/NoName/Recollekt/utils/network';
import Zeroconf from 'react-native-zeroconf';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Albums/ViewAlbum'>;
type ViewAlbumRouteProp = RouteProp<RootStackParamList, 'Albums/ViewAlbum'>;

interface ZeroconfService {
  host: string;
  port: number;
  [key: string]: any; // Include additional properties if needed
}

export default function ViewAlbum() {
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

  const route = useRoute<ViewAlbumRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const navi2 = useNavigation();
  const { _id, title: initialTitle, coverImage: initialCoverImage, images: initialImages } = route.params;

  const [title, setTitle] = useState(initialTitle);
  const [coverImage, setCoverImage] = useState(initialCoverImage);

  const [images, setImages] = useState<
    { url: string; base64Uri: string | null; timestamp: string }[]
  >(
    (initialImages || []).map((image: string | { url: string; timestamp: string }) =>
      typeof image === 'string'
        ? {
            url: image,
            base64Uri: image.startsWith('file://') ? null : image,
            timestamp: '',
          }
        : {
            ...image,
            base64Uri: image.url.startsWith('file://') ? null : image.url,
          }
    )
  );

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
  
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('Saved Photos', asset, false);
      Alert.alert('Success', 'Image saved to camera roll!');
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save image.');
    }
  };


  const convertToBase64 = async (uri: string) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        console.warn('File does not exist:', uri);
        return null;
      }
  
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
  
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('Failed to convert image:', uri, error);
      return null;
    }
  };

  useEffect(() => {
    const fetchBase64Images = async () => {
      const updatedImages = await Promise.all(
        images.map(async (image) => {
          if (!image.base64Uri && image.url?.startsWith('file://')) {
            const base64Uri = await convertToBase64(image.url);
            return { ...image, base64Uri };
          }
          return image;
        })
      );
      setImages(updatedImages.filter((image) => image.url !== null) as { url: string; base64Uri: string | null; timestamp: string }[]);
    }
  }, []);

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

        const response = await fetch(`http://recollekt.local:3000/albums/${_id}/share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
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

  const handleEdit = () => {
    navigation.navigate('Albums/EditAlbum', route.params);
  };

  const handleDelete = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        return;
      }

      const response = await fetch(`http://recollekt.local:3000/albums/${_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
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
  const checkFileExists = async (uri: string) => {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    console.log(fileInfo);
    return fileInfo.exists;
  };

  useFocusEffect(
    React.useCallback(() => {
      const fetchUpdatedAlbum = async () => {
        try {
          const token = await AsyncStorage.getItem('token');
          if (!token) {
            console.error('No token found');
            return;
          }

          const response = await fetch(`http://recollekt.local:3000/albums/${_id}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const updatedAlbum = await response.json();
            setTitle(updatedAlbum.title);
            setCoverImage(updatedAlbum.coverImage);
            setImages(
              updatedAlbum.images.map(
                (image: string | { url: string; timestamp: string }) =>
                  typeof image === 'string'
                    ? {
                        url: image,
                        base64Uri: image.startsWith('file://') ? null : image,
                        timestamp: '',
                      }
                    : {
                        ...image,
                        base64Uri: image.url.startsWith('file://') ? null : image.url,
                      }
              )
            );
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

  const renderImage = ({ item, index }: { item: { url: string; base64Uri: string | null; timestamp: string }; index: number }) => (
    <TouchableOpacity onPress={() => handleImagePress(index)} style={styles.imageContainer}>
      <Image
        resizeMode="cover"
        style={styles.albumImage}
        source={{ uri: item.url }}
      />
      <Text style={styles.timestampText}>
        Taken on: {new Date(item.timestamp).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
  
  useEffect(() => {
    const checkImages = async () => {
      const updatedImages = await Promise.all(
        images.map(async (image) => {
          if (image.url.startsWith('file://')) {
            const fileExists = await checkFileExists(image.url);
            if (!fileExists) {
              console.warn('File not found:', image.url);
              return { ...image, url: null };
            }
          }
          return image;
        })
      );
      setImages(updatedImages.filter((image) => image.url !== null) as { url: string; base64Uri: string | null; timestamp: string }[]);
    };
  
    checkImages();
  }, []);
  

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
        <Image source={{ uri: coverImage }} style={styles.coverImage} />
        <Text style={styles.title}>{title}</Text>
      </View>

      <FlatList
        data={images}
        keyExtractor={(item, index) => index.toString()}
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
            pagingEnabled
            initialScrollIndex={currentImageIndex}
            getItemLayout={(data, index) => ({
              length: Dimensions.get('window').width, // Use the screen width dynamically
              offset: Dimensions.get('window').width * index,
              index,
            })}
            renderItem={({ item }) => {
              console.log('Image URL:', item.url); // Debugging log
              return (
                <Image
                  source={{ uri: item.url }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              );
            }}
          />
          <TouchableOpacity
            onPress={() => saveImageToCameraRoll(images[currentImageIndex].url)}
            style={styles.saveButton}
          >
            <Text style={styles.closeButtonText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
});
