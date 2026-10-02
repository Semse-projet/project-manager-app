import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createAgroIncident, proposeAgroIntake } from "../../api/agro";
import AgroReportIncidentScreen from "./AgroReportIncidentScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/agro", () => ({
  proposeAgroIntake: jest.fn(),
  createAgroIncident: jest.fn(),
}));
jest.mock("../../api/evidence", () => ({
  presignEvidenceUpload: jest.fn(),
  uploadToPresignedUrl: jest.fn(),
  buildEvidenceFileUrl: (key: string) => `https://api.example.com/v1/uploads/files/${key}`,
}));
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof AgroReportIncidentScreen>[0]["navigation"];
const baseRoute = { params: { farmId: "farm1", farmName: "Finca El Roble" } } as unknown as Parameters<typeof AgroReportIncidentScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("asks for a text description before any proposal exists", async () => {
  await render(<AgroReportIncidentScreen navigation={mockNavigation} route={baseRoute} />);
  expect(screen.getByPlaceholderText("Ej: Al lote 15 le falta agua desde ayer.")).toBeTruthy();
  expect(proposeAgroIntake).not.toHaveBeenCalled();
});

it("proposes from typed text and prefills the review form, always requiring human confirmation", async () => {
  (proposeAgroIntake as jest.Mock).mockResolvedValue({
    proposal: {
      intent: "INCIDENT",
      confidence: 0.8,
      disclaimer: "Esto es una propuesta, no un diagnóstico. Confírmala antes de guardar.",
      requiresHumanReview: true,
      transcribedFrom: [],
      visionSignals: [],
      incident: {
        type: "WATER_SHORTAGE",
        suggestedSeverity: "HIGH",
        severityConfirmed: false,
        title: "Falta agua en lote 15",
        description: "Al lote 15 le falta agua desde ayer.",
        relations: { farmUnitId: null, animalGroupId: null, animalId: null },
      },
      recommendedAction: { kind: "CREATE_INCIDENT" },
    },
  });

  await render(<AgroReportIncidentScreen navigation={mockNavigation} route={baseRoute} />);
  await fireEvent.changeText(
    screen.getByPlaceholderText("Ej: Al lote 15 le falta agua desde ayer."),
    "Al lote 15 le falta agua desde ayer.",
  );
  await fireEvent.press(screen.getByText("Analizar"));

  await waitFor(() => expect(proposeAgroIntake).toHaveBeenCalledWith("farm1", { text: "Al lote 15 le falta agua desde ayer." }));
  await waitFor(() => expect(screen.getByDisplayValue("Falta agua en lote 15")).toBeTruthy());
  expect(screen.getByText("Esto es una propuesta, no un diagnóstico. Confírmala antes de guardar.")).toBeTruthy();
});

it("creates the incident only after the human confirms, sending no photo evidence when none was attached", async () => {
  (proposeAgroIntake as jest.Mock).mockResolvedValue({
    proposal: {
      intent: "INCIDENT",
      confidence: 0.8,
      disclaimer: "Confírmala antes de guardar.",
      requiresHumanReview: true,
      transcribedFrom: [],
      visionSignals: [],
      incident: {
        type: "WATER_SHORTAGE",
        suggestedSeverity: "HIGH",
        severityConfirmed: false,
        title: "Falta agua en lote 15",
        description: "Al lote 15 le falta agua desde ayer.",
        relations: { farmUnitId: null, animalGroupId: null, animalId: null },
      },
      recommendedAction: { kind: "CREATE_INCIDENT" },
    },
  });
  (createAgroIncident as jest.Mock).mockResolvedValue({ incident: { id: "inc1" } });

  await render(<AgroReportIncidentScreen navigation={mockNavigation} route={baseRoute} />);
  await fireEvent.changeText(
    screen.getByPlaceholderText("Ej: Al lote 15 le falta agua desde ayer."),
    "Al lote 15 le falta agua desde ayer.",
  );
  await fireEvent.press(screen.getByText("Analizar"));
  await waitFor(() => expect(screen.getByText("Confirmar y crear")).toBeTruthy());

  await fireEvent.press(screen.getByText("Confirmar y crear"));
  await waitFor(() =>
    expect(createAgroIncident).toHaveBeenCalledWith("farm1", {
      type: "WATER_SHORTAGE",
      severity: "HIGH",
      title: "Falta agua en lote 15",
      description: "Al lote 15 le falta agua desde ayer.",
      source: "MOBILE",
      evidence: [],
    }),
  );
  expect(navigate).toHaveBeenCalledWith("AgroIncidents", { farmId: "farm1", farmName: "Finca El Roble" });
});
