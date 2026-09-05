import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { presignEvidenceUpload, registerEvidence, uploadToPresignedUrl } from "../api/evidence";
import { EvidenceCapture } from "./EvidenceCapture";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("../api/evidence", () => ({
  presignEvidenceUpload: jest.fn(),
  uploadToPresignedUrl: jest.fn(),
  registerEvidence: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("uploads a photo taken with the camera end to end", async () => {
  (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
  (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///photo.jpg", type: "image", fileName: "photo.jpg", mimeType: "image/jpeg", fileSize: 1234 }],
  });
  (presignEvidenceUpload as jest.Mock).mockResolvedValue({
    uploadUrl: "https://api.example.com/v1/uploads/files/key1",
    key: "key1",
    contentType: "image/jpeg",
    domain: "evidence",
  });
  (uploadToPresignedUrl as jest.Mock).mockResolvedValue(undefined);
  (registerEvidence as jest.Mock).mockResolvedValue({ id: "ev1", key: "key1", kind: "PHOTO", filename: "photo.jpg" });

  const onUploaded = jest.fn();
  await render(<EvidenceCapture target={{ jobId: "job1" }} onUploaded={onUploaded} />);

  await fireEvent.press(screen.getByText("📷 Tomar foto"));

  await waitFor(() => expect(registerEvidence).toHaveBeenCalledWith({
    jobId: "job1",
    key: "key1",
    kind: "PHOTO",
    filename: "photo.jpg",
  }));
  expect(uploadToPresignedUrl).toHaveBeenCalledWith(
    "https://api.example.com/v1/uploads/files/key1",
    "file:///photo.jpg",
    "image/jpeg",
  );
  await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: "ev1" })));
});

it("shows an error and does not upload when camera permission is denied", async () => {
  (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });

  await render(<EvidenceCapture target={{ jobId: "job1" }} />);
  await fireEvent.press(screen.getByText("📷 Tomar foto"));

  await waitFor(() => expect(screen.getByText("Necesitamos permiso de cámara para esto.")).toBeTruthy());
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(presignEvidenceUpload).not.toHaveBeenCalled();
});

it("does nothing when the picker is canceled", async () => {
  (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });

  await render(<EvidenceCapture target={{ jobId: "job1" }} />);
  await fireEvent.press(screen.getByText("🖼️ Galería"));

  await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
  expect(presignEvidenceUpload).not.toHaveBeenCalled();
});

it("surfaces an upload failure without crashing", async () => {
  (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
  (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///photo.jpg", type: "image", fileName: "photo.jpg", mimeType: "image/jpeg" }],
  });
  (presignEvidenceUpload as jest.Mock).mockRejectedValue(new Error("network down"));

  await render(<EvidenceCapture target={{ jobId: "job1" }} />);
  await fireEvent.press(screen.getByText("📷 Tomar foto"));

  await waitFor(() => expect(screen.getByText("network down")).toBeTruthy());
  expect(registerEvidence).not.toHaveBeenCalled();
});
