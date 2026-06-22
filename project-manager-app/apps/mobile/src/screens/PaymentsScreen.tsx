import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView } from 'react-native';

interface Draw {
  id: string;
  drawNumber: number;
  amount: number;
  status: string;
  fundedAt?: string;
}

export const PaymentsScreen = () => {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [currentDraw, setCurrentDraw] = useState<Draw | null>(null);

  useEffect(() => {
    fetchDraws();
  }, []);

  const fetchDraws = async () => {
    try {
      const response = await fetch('/v1/projects/draws', {
        headers: { Authorization: 'Bearer token' },
      });
      const data = await response.json();
      setDraws(data);
      setCurrentDraw(data.find((d: Draw) => d.status === 'DRAFT' || d.status === 'PENDING_LENDER'));
    } catch (error) {
      console.error('Failed to fetch draws', error);
    }
  };

  const requestDraw = async () => {
    if (!currentDraw) return;

    try {
      await fetch(`/v1/projects/draws/${currentDraw.id}/submit`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      });
      fetchDraws();
    } catch (error) {
      console.error('Request failed', error);
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>Payments</Text>

      {currentDraw && (
        <View style={{ backgroundColor: '#f0f0f0', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <Text style={{ fontWeight: 'bold' }}>Draw #{currentDraw.drawNumber}</Text>
          <Text>Amount: ${currentDraw.amount}</Text>
          <Text>Status: {currentDraw.status}</Text>

          {currentDraw.status === 'DRAFT' && (
            <TouchableOpacity
              onPress={requestDraw}
              style={{ marginTop: 12, backgroundColor: '#007AFF', padding: 8, borderRadius: 4 }}
            >
              <Text style={{ color: 'white', textAlign: 'center' }}>Request Draw</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>History</Text>
      <FlatList
        scrollEnabled={false}
        data={draws}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: '#ddd' }}>
            <Text>Draw #{item.drawNumber}</Text>
            <Text>${item.amount} - {item.status}</Text>
            {item.fundedAt && <Text>Funded: {new Date(item.fundedAt).toLocaleDateString()}</Text>}
          </View>
        )}
      />
    </ScrollView>
  );
};
