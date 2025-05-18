import React from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../(tabs)/types'; // Adjust the path as necessary

type ViewAlbumRouteProp = RouteProp<RootStackParamList, 'Albums/ViewAlbum'>;

export default function ViewAlbum() {
  const route = useRoute<ViewAlbumRouteProp>();
  const navigation = useNavigation();
  const { title, coverImage, images } = route.params;

  const renderImage = ({ item }: { item: string }) => (
    <Image source={{ uri: item }} style={styles.albumImage} />
  );

  const handleBack = () => {
    navigation.goBack(); // Navigate back to the previous screen
  };

  // const handleEdit = () => {
  //   navigation.navigate('EditAlbum', route.params); // Navigate to an EditAlbum screen (if implemented)
  // };

  return (
    <View style={styles.container}>
      {/* Header with Back and Edit Buttons */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editButton}>
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
});