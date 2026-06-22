import React, { useEffect, useState } from 'react';
import { View, FlatList, TouchableOpacity, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface Project {
  id: string;
  name: string;
  status: string;
  budget: number;
  spent: number;
}

export const ProjectsScreen = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const navigation = useNavigation();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/v1/projects', {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>Projects</Text>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
            style={{
              padding: 12,
              marginBottom: 8,
              backgroundColor: '#f0f0f0',
              borderRadius: 8,
            }}
          >
            <Text style={{ fontWeight: 'bold' }}>{item.name}</Text>
            <Text>Status: {item.status}</Text>
            <Text>Budget: ${item.spent} / ${item.budget}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const getToken = async () => 'token_placeholder';
