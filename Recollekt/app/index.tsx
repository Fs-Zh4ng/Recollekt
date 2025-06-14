import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';

export default function Home() {
    console.log('Home component rendered');
  return (
    <Redirect href="/login/login" />
  );
}
