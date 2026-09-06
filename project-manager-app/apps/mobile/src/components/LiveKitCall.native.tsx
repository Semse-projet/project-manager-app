import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AudioSession, isTrackReference, LiveKitRoom, useLocalParticipant, useTracks, VideoTrack } from "@livekit/react-native";
import { Track } from "livekit-client";
import { getLiveSessionMediaToken, type LiveSessionMediaToken } from "../api/liveSessions";

export default function LiveKitCall({ sessionId }: { sessionId: string }) {
  const [media, setMedia] = useState<LiveSessionMediaToken | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getLiveSessionMediaToken(sessionId).then((value) => active && setMedia(value)).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "No se pudo preparar la inspección.");
    });
    return () => { active = false; };
  }, [sessionId]);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!media) return <Text style={styles.state}>Preparando cámara y micrófono…</Text>;

  return (
    <LiveKitRoom serverUrl={media.serverUrl} token={media.token} connect audio video>
      <RoomControls />
    </LiveKitRoom>
  );
}

function RoomControls() {
  const tracks = useTracks([Track.Source.Camera]);
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();

  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => { void AudioSession.stopAudioSession(); };
  }, []);

  return (
    <View style={styles.room}>
      <View style={styles.videoArea}>
        {tracks.filter(isTrackReference).map((track) => (
          <VideoTrack key={`${track.participant.identity}-${track.source}`} trackRef={track} style={styles.video} />
        ))}
      </View>
      <View style={styles.controls}>
        <Pressable style={styles.control} onPress={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}>
          <Text style={styles.controlText}>{isMicrophoneEnabled ? "Silenciar" : "Activar micrófono"}</Text>
        </Pressable>
        <Pressable style={styles.control} onPress={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}>
          <Text style={styles.controlText}>{isCameraEnabled ? "Apagar cámara" : "Activar cámara"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  room: { minHeight: 380, gap: 12 },
  videoArea: { minHeight: 320, borderRadius: 22, overflow: "hidden", backgroundColor: "#15191B" },
  video: { flex: 1 },
  controls: { flexDirection: "row", justifyContent: "center", gap: 10 },
  control: { backgroundColor: "#202629", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  controlText: { color: "#F5F7F8", fontSize: 12 },
  state: { color: "#64748b", marginVertical: 12 },
  error: { color: "#dc2626", marginVertical: 12 },
});
