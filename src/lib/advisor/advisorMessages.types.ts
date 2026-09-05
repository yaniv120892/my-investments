export type AdvisorMessageSender = "user" | "advisor";

export interface AdvisorChatMessage {
  sender: AdvisorMessageSender;
  text: string;
}
