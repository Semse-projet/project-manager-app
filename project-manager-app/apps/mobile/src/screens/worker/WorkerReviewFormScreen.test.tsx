import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { submitRating } from "../../api/ratings";
import WorkerReviewFormScreen from "./WorkerReviewFormScreen";

jest.mock("../../api/ratings", () => ({
  submitRating: jest.fn(),
}));

const goBack = jest.fn();
const mockNavigation = { goBack } as unknown as Parameters<typeof WorkerReviewFormScreen>[0]["navigation"];
const baseRoute = {
  params: { jobId: "job1", jobTitle: "Reparar techo", toUserId: "client1", toUserEmail: "cliente@demo.semse" },
} as unknown as Parameters<typeof WorkerReviewFormScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("requires a star rating before allowing submit", async () => {
  await render(<WorkerReviewFormScreen navigation={mockNavigation} route={baseRoute} />);
  await fireEvent.press(screen.getByText("Enviar calificación"));
  expect(submitRating).not.toHaveBeenCalled();
});

it("submits the selected score and comment", async () => {
  (submitRating as jest.Mock).mockResolvedValue({ id: "r1" });
  await render(<WorkerReviewFormScreen navigation={mockNavigation} route={baseRoute} />);

  await fireEvent.press(screen.getByLabelText("4 estrellas"));
  await fireEvent.changeText(screen.getByPlaceholderText("¿Cómo fue trabajar con este cliente?"), "Muy puntual");
  await fireEvent.press(screen.getByText("Enviar calificación"));

  await waitFor(() => expect(submitRating).toHaveBeenCalledWith({
    jobId: "job1",
    toUserId: "client1",
    score: 4,
    comment: "Muy puntual",
  }));
  await waitFor(() => expect(screen.getByText("¡Gracias por tu calificación!")).toBeTruthy());
});
