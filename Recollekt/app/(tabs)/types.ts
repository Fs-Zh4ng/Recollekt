// Define the navigation parameters for each route
export type RootStackParamList = {
    '(tabs)/index': undefined; // No parameters for the Home screen
    Create: undefined; // No parameters for the Create screen
    'Albums/ViewAlbum': {
      _id: string; // Album ID
      title: string;
      coverImage: string,
      images: 
        {
          uri: string, // Image URL
          timestamp: { type: string, required: true }, // Timestamp for when the image was taken
        }[],// Array of images with url and timestamp
    }; // Parameters for the ViewAlbum screen
    'Albums/EditAlbum': {
      _id: string; // Album ID
      title: string;
      coverImage: string,
      images: 
        {
          uri: string, // Image URL
          timestamp: { type: string, required: true }, // Timestamp for when the image was taken
        }[], // Array of images with url and timestamp
    }; // Parameters for the EditAlbum screen
  };