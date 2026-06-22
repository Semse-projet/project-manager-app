import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

export const useNotifications = () => {
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  return {
    send: async (title: string, body: string) => {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: 'default', badge: 1 },
        trigger: { seconds: 2 },
      });
    },
    requestPermission: async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    },
  };
};

export const addNotificationListener = (callback: any) => {
  const subscription = Notifications.addNotificationResponseReceivedListener(callback);
  return () => subscription.remove();
};
