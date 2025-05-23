import * as Network from 'expo-network';

export const getLocalIPAddress = async () => {
  try {
    const ipAddress = await Network.getIpAddressAsync();
    console.log('Detected local IP address:', ipAddress);
    return ipAddress;
  } catch (error) {
    console.error('Error fetching local IP address:', error);
    return null;
  }
};