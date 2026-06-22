import React, { useState } from 'react';
import { View, FlatList, Image, TouchableOpacity, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface Photo {
  id: string;
  uri: string;
  timestamp: string;
  exifData?: any;
}

export const PhotoGalleryScreen = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      const photo: Photo = {
        id: Date.now().toString(),
        uri: result.assets[0].uri,
        timestamp: new Date().toISOString(),
      };
      setPhotos([photo, ...photos]);
      uploadPhoto(photo);
    }
  };

  const uploadPhoto = async (photo: Photo) => {
    try {
      const formData = new FormData();
      formData.append('photo', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: `photo_${photo.id}.jpg`,
      });

      await fetch('/v1/projects/photos', {
        method: 'POST',
        body: formData,
        headers: { Authorization: 'Bearer token' },
      });
    } catch (error) {
      console.error('Upload failed', error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={pickPhoto}
        style={{ padding: 12, backgroundColor: '#007AFF', margin: 16, borderRadius: 8 }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
          Add Photo
        </Text>
      </TouchableOpacity>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.uri }}
            style={{ width: '50%', height: 200, margin: 8 }}
          />
        )}
      />
    </View>
  );
};
