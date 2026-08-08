export type ClientEscrowPaymentStatus = "funded" | "released" | "pending";

export type ClientEscrowPayment = {
  id: string;
  concept: string;
  amount: number;
  status: ClientEscrowPaymentStatus;
  date: string;
};
