export interface UngroundedNumber {
  text: string;
  value: number;
}

export interface GroundingReport {
  isGrounded: boolean;
  ungrounded: UngroundedNumber[];
  toolNumberCount: number;
}
