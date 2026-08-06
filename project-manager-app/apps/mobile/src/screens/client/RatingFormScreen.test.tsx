import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { submitRating } from "../../api/ratings";
import RatingFormScreen from "./RatingFormScreen";

jest.mock("../../api/ratings", () => ({ submitRating: jest.fn() }));

const goBack = jest.fn();
const mockNavigation = { goBack } as unknown as Parameters<typeof RatingFormScreen>[0]["navigation"];

function mockRoute() {
  return {
    params: { jobId: "job1", jobTitle: "Reparar techo", toUserId: "usr_pro", toUserEmail: "pro@demo.semse" },
  } as unknown as Parameters<typeof RatingFormScreen>[0]["route"];
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("does not submit until a score is picked", async () => {
  await render(<RatingFormScreen navigation={mockNavigation} route={mockRoute()} />);
  await fireEvent.press(screen.getByText("Enviar calificación"));
  expect(submitRating).not.toHaveBeenCalled();
});

it("submits the chosen score, jobId, toUserId and trimmed comment", async () => {
  (submitRating as jest.Mock).mockResolvedValue({});
  await render(<RatingFormScreen navigation={mockNavigation} route={mockRoute()} />);

  await fireEvent.press(screen.getByLabelText("4 estrellas"));
  await fireEvent.changeText(screen.getByPlaceholderText("¿Cómo fue trabajar con este profesional?"), "  Excelente trabajo  ");
  await fireEvent.press(screen.getByText("Enviar calificación"));

  await waitFor(() =>
    expect(submitRating).toHaveBeenCalledWith({
      jobId: "job1",
      toUserId: "usr_pro",
      score: 4,
      comment: "Excelente trabajo",
    }),
  );
});

it("shows a thank-you state and disables re-submitting after success", async () => {
  (submitRating as jest.Mock).mockResolvedValue({});
  await render(<RatingFormScreen navigation={mockNavigation} route={mockRoute()} />);

  await fireEvent.press(screen.getByLabelText("5 estrellas"));
  await fireEvent.press(screen.getByText("Enviar calificación"));

  await waitFor(() => expect(screen.getByText("¡Gracias por tu calificación!")).toBeTruthy());
  expect(submitRating).toHaveBeenCalledTimes(1);
});

it("shows an error message when the submit fails", async () => {
  (submitRating as jest.Mock).mockRejectedValue(new Error("network down"));
  await render(<RatingFormScreen navigation={mockNavigation} route={mockRoute()} />);

  await fireEvent.press(screen.getByLabelText("3 estrellas"));
  await fireEvent.press(screen.getByText("Enviar calificación"));

  await waitFor(() => expect(screen.getByText("network down")).toBeTruthy());
});

it("shows a guard message instead of a form when the professional's userId is missing", async () => {
  const route = {
    params: { jobId: "job1", jobTitle: "Reparar techo", toUserId: "", toUserEmail: "" },
  } as unknown as Parameters<typeof RatingFormScreen>[0]["route"];
  await render(<RatingFormScreen navigation={mockNavigation} route={route} />);
  await waitFor(() =>
    expect(screen.getByText("No se pudo identificar al profesional de este job.")).toBeTruthy(),
  );
});
