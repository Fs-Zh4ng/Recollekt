import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Image,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { Video, ResizeMode } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import Slider from '@react-native-community/slider';
import path from 'path';

// Define album type


type Album = {
  _id: string;
  title: string;
  coverImage: string; // base64 or path
  images: { url: string; timestamp: string }[];
};

const Movie = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [sharedAlbums, setSharedAlbums] = useState<Album[]>([]);
  const [selectedAlbums, setSelectedAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0); // or default to video duration
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [editedVideoUrl, setEditedVideoUrl] = useState<string | null>(null);
  const [localVideoUri, setLocalVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0); // Duration of the video
  const [edited2, setEdited2] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null); // State to store the audio file name




  const handleTrimStartChange = (value: number) => {
    setTrimStart(value);
    if (value >= trimEnd) {
      setTrimEnd(value + 1); // Ensure trimEnd is always greater than trimStart
    }
  };

  const handleTrimEndChange = (value: number) => {
    setTrimEnd(value);
    if (value <= trimStart && value > 0) {
      setTrimStart(value - 1); // Ensure trimStart is always less than trimEnd
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          console.error('No token found');
          return;
        }

        const [sharedResponse, albumsResponse] = await Promise.all([
          fetch(`http://recollekt.local:3000/albums/shared`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`http://recollekt.local:3000/albums`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (sharedResponse.ok) {
          const sharedAlbumsData = await sharedResponse.json();
          setSharedAlbums(sharedAlbumsData.sharedAlbums);
        } else {
          console.error('Failed to fetch shared albums');
        }

        if (albumsResponse.ok) {
          const albumsData = await albumsResponse.json();
          setAlbums(albumsData.albums);
        } else {
          console.error('Failed to fetch albums');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
      });
  
      if (result.assets && result.assets.length > 0) {
        setAudioUri(result.assets[0].uri);
        setAudioName(result.assets[0].name); // Store the audio file name
        Alert.alert('Audio Selected', result.assets[0].name);
      }
    } catch (error) {
      console.error('Error picking audio:', error);
      Alert.alert('Error', 'Failed to pick audio file.');
    }
  };

  const handleTrim = async () => {

    if (trimEnd <= trimStart) {
      Alert.alert('Invalid Trim', 'Ensure the trim start and end values are correct.');
      return;
    }
  
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication token missing.');
        return;
      }
  
      const formData = new FormData();
      if (videoUrl) {
        formData.append('video', videoUrl);
      } else {
        throw new Error('Video URL is null');
      }
      formData.append('start', String(trimStart));
      formData.append('end', String(trimEnd));
      console.log(formData);
  
      const response = await fetch('http://recollekt.local:3000/trim-video', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trim video');
      }
  
      const data = await response.json();
      const trimmedVideoUri = `file:///Users/Ferdinand/NoName/Recollekt${data.trimmedVideoUrl}`;
      setEditedVideoUrl(trimmedVideoUri);
      setEdited2(data.videoUrl);
      setVideoDuration(data.duration || 0); // Set video duration if available
      console.log('Trimmed Video URL:', data.videoUrl);
      console.log('Trimmed Video URL:', trimmedVideoUri);
      Alert.alert('Success', 'Video trimmed successfully!');
      setTrimEnd(0);
      setTrimStart(0);
    } catch (error) {
      console.error('Trim error:', error);
      Alert.alert('Trim Failed');
    } finally {
      setIsLoading(false);
    }
  };
  
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

  const applyAudioToGeneratedVideo = async () => {
  
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
  
      if (edited2) {
        formData.append('video', edited2);
      } else if (videoUrl) {
        formData.append('video', videoUrl);
      } else {
        throw new Error('Video URL is null');
      }
  
      formData.append('audio', {
        uri: audioUri,
        name: 'audio.mp3',
        type: 'audio/mpeg', // Adjust the MIME type based on the file format
      } as any);

      console.log('FormData:', formData);
  
      const response = await fetch(`http://recollekt.local:3000/add-audio`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to add audio.');
        return;
      }
  
      const data = await response.json();
      setEditedVideoUrl(data.outputVideoPath);
      setEdited2(data.videoUrl);
      Alert.alert('Success', 'Audio added to video successfully!');
    } catch (error) {
      console.error('Error applying audio:', error);
      Alert.alert('Error', 'Failed to apply audio to video.');
    } finally {
      setIsLoading(false);
    }
  };

  const createVideo = async () => {
    if (selectedAlbums.length === 0) {
      Alert.alert('No Albums Selected', 'Please select at least one album to create a video.');
      return;
    }

    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication token missing.');
        return;
      }


      const payload = selectedAlbums.map((album) => ({
        title: album.title,
        coverImage: album.coverImage,
        images: album.images, // filter out nulls
      }));

      const formData = new FormData();
      formData.append('albums', JSON.stringify(payload));

      const response = await fetch(`http://recollekt.local:3000/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        Alert.alert('Video Error', errorData.error || 'Failed to create video.');
        return;
      }

      const data = await response.json();
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl);
        console.log('Video URL:', data.videoUrl);
        setLocalVideoUri(data.outputVideoPath);
        console.log('local:', data.outputVideoPath);
        setVideoDuration(data.duration); // Set video duration if available
        console.log('Video duration:', data.duration);
      } else {
        Alert.alert('Error', 'Unexpected response from server.');
      }
    } catch (error) {
      console.error('Error creating video:', error);
      Alert.alert('Error', 'Failed to create video.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    const res = fetch('http://recollekt.local:3000/clear', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((response) => response.json())
      .then((data) => {
        console.log('Clear response:', data);
      })
      .catch((error) => {
        console.error('Error clearing data:', error);
      });
  }

  const saveToPhotoAlbum = async () => {
    let url ='';
    if (edited2) {
      url = edited2;
    }
    else if (videoUrl) {
      url = videoUrl;
    } else {
      Alert.alert('No Video', 'Please create or select a video to save.');
      return;
    }

    try {
      setIsSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'You need to grant permission to save the video.');
        return;
      }

      const tempUri = `${FileSystem.cacheDirectory}temp_video.mp4`;
      const response = await FileSystem.downloadAsync(url, tempUri);

      const permanentUri = `${FileSystem.documentDirectory}video.mp4`;
      await FileSystem.moveAsync({ from: response.uri, to: permanentUri });
      console.log('Downloaded to:', response.uri);
      console.log('Moved to:', permanentUri);
const fileInfo = await FileSystem.getInfoAsync(permanentUri, { size: true });
console.log('File info:', fileInfo);

const data = await FileSystem.readAsStringAsync(permanentUri, {
  encoding: FileSystem.EncodingType.Base64,
});
console.log('Video base64 prefix:', data.slice(0, 30));

const asset = await MediaLibrary.createAssetAsync(permanentUri);
const album = await MediaLibrary.getAlbumAsync('Recollekt');
if (album) {
  await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
} else {
  await MediaLibrary.createAlbumAsync('Recollekt', asset, false);
}

Alert.alert('Success', 'Video saved to your photo album!');
} catch (error) {
console.error('Error saving video:', error);
Alert.alert('Error', 'Failed to save video to photo album.');
} finally {
setIsSaving(false);
}
  };

  const getImageSource = (img: string) => {
    return img.startsWith('data:image') ? img : `recollekt.local/${img}`;
  };

  return (
  //   <KeyboardAvoidingView
  //   style={{ flex: 1 }}
  //   behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  //   onLayout={(e) => console.log('ScrollView layout:', e.nativeEvent.layout)}
  // >
    
      <View style={styles.container}>
        {videoUrl ? (
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            >
          
          <View style={styles.fullscreenVideoContainer}>

            {edited2 ? (
            <Video
            source={{ uri: edited2 }}
            style={styles.fullscreenVideo}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping
            /> ): (
              <Video
              source={{ uri: videoUrl }}
              style={styles.fullscreenVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
            />
            )
            }
            <Text style={styles.header}>Trim Video (Every image is 5 seconds long)</Text>

<Text style={styles.label}>Trim Start: {trimStart}s</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={videoDuration}
        step={1}
        value={trimStart}
        onValueChange={handleTrimStartChange}
        minimumTrackTintColor="#007AFF"
        maximumTrackTintColor="#ccc"
        thumbTintColor="#007AFF"
      />

      <Text style={styles.label}>Trim End: {trimEnd}s</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={videoDuration}
        step={1}
        value={trimEnd}
        onValueChange={handleTrimEndChange}
        minimumTrackTintColor="#007AFF"
        maximumTrackTintColor="#ccc"
        thumbTintColor="#007AFF"
      />

      <TouchableOpacity
        style={[styles.trimButton, {marginBottom: 20, width: '90%', alignItems: 'center', alignSelf: 'center'}]}
        onPress={handleTrim}
      >
        {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Trim Video</Text>
              )}
      </TouchableOpacity>

      <View style={styles.card}>

      <Text style={styles.header}>Add Audio to Video</Text>

      <TouchableOpacity style={styles.audioButton} onPress={pickAudioFile}>
  <Text style={styles.audioButtonText}>
    Pick Audio
  </Text>
</TouchableOpacity>
{audioName && <Text>Selected Audio: {audioName}</Text>}
<TouchableOpacity style={styles.audioButton} onPress={applyAudioToGeneratedVideo}>
  <Text style={styles.audioButtonText}>
  {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Add Audio to Video</Text>
              ) }
  </Text>
</TouchableOpacity>
</View>
<TouchableOpacity style={styles.undoButton} onPress={() => {setEditedVideoUrl(null); setEdited2(null); setAudioUri(null); setAudioName(null); setTrimEnd(0); setTrimStart(0);}}>
  <Text style={styles.audioButtonText}>
    Undo
  </Text>
</TouchableOpacity>

<View>
            
            {isSaving ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <TouchableOpacity style={styles.saveButton} onPress={saveToPhotoAlbum}>
                <Text style={styles.saveButtonText}>Save to Camera Roll</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.backButton} onPress={() => { setVideoUrl(null); setEditedVideoUrl(null); setEdited2(null); setSelectedAlbums([]); setTrimEnd(0); setTrimStart(0); setLocalVideoUri(null); handleBack()}}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
          </View>
          </ScrollView>
        ) : (
          <View>
            <View style={[styles.card, {width: '100%'}]}>
              <Text style={styles.header}>Select Albums to Create a Video</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedAlbum}
                  onValueChange={(itemValue) => setSelectedAlbum(itemValue)}
                  style={styles.picker}
                  itemStyle={styles.pItem}
                  dropdownIconColor="#000"
                >
                  <Picker.Item label="Select an album..." value={null} style={styles.pItem} />
                  {albums.map((album) => (
                    <Picker.Item key={album._id} label={`My Album: ${album.title}`} value={album._id} style={styles.pItem} />
                  ))}
                  {sharedAlbums.map((album) => (
                    <Picker.Item key={album._id} label={`Shared Album: ${album.title}`} value={album._id} style={styles.pItem} />
                  ))}
                </Picker>
              </View>

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

            <Text style={styles.sectionHeader}>Selected Albums:</Text>
            {selectedAlbums.map((album) => (
              <View key={album._id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Image
                  source={{ uri: getImageSource(album.coverImage) }}
                  style={{ width: 50, height: 50, marginRight: 10, borderRadius: 6 }}
                />
                <Text style={styles.albumText}>{album.title}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.createButton} onPress={createVideo}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create Video</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    // </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({

  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  albumText: { fontSize: 16 },
  container: { flex: 1, padding: 20, backgroundColor: '#fff', marginTop: 50 },
  card: { marginTop: 20, paddingHorizontal: 20, backgroundColor: '#f9f9f9', borderRadius: 8, paddingVertical: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, overflow: 'visible', width: '90%' },
  pickerContainer: {
    height: 50,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginBottom: 12,
  },
  scrollContainer: {
    flexGrow: 1,
    height: '190%',
    backgroundColor: '#fff',
  },
  picker: { height: 50, width: '100%', color: '#CCCCCC' },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 80,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  createButton: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  fullscreenVideoContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingBottom: 30,
  },
  fullscreenVideo: { width: '100%', height: '40%', backgroundColor: 'black', marginBottom: 20 },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  undoButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  cont2: {
    padding: 20,
    backgroundColor: '#fff',
    width: '100%',
  },
  pItem: {
    color: '#333333',
    fontSize: 16,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backButton: { marginTop: 10, padding: 10, backgroundColor: '#888', borderRadius: 6, alignItems: 'center' },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600'},
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },

  audioButton: {
    backgroundColor: '#5856D6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },

  audioButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
label: {
  fontSize: 16,
  marginVertical: 10,
},
slider: {
  width: '90%',
  height: 40,
},
trimButton: {
  backgroundColor: '#007AFF',
  paddingVertical: 12,
  paddingHorizontal: 24,
  borderRadius: 8,
  marginTop: 20,
},
trimButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
});

export default Movie;
                                                                                                                                                                                                                                