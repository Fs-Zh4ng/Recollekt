declare module 'react-native-exif' {
    export function getExif(uri: string): Promise<{ [key: string]: any }>;
  }