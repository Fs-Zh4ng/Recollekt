// Define the navigation parameters for each route
export type RootStackParamList = {
    Home: undefined; // No parameters for the Home screen
    Create: undefined; // No parameters for the Create screen
    'Albums/ViewAlbum': {
      _id: string; // Album ID
      title: string;
      coverImage: string;
      images: string[];
    }; // Parameters for the ViewAlbum screen
    'Albums/EditAlbum': {
      _id: string; // Album ID
      title: string;
      coverImage: string;
      images: string[];
    }; // Parameters for the EditAlbum screen
  };