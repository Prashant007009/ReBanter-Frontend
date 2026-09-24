import { createBanter, sendMessage } from "./banters";
import { ensureBanterKey } from "@/crypto/banterKeys";

/**
 * Send someone a Direct message from outside a thread (Moment replies, sharing
 * a drop): opens or reuses the 1:1 banter, makes sure its E2E key is ready,
 * then sends through the normal encrypted path.
 */
export async function sendDirect(
  userId: string,
  input: { kind: "text"; body: string } | { kind: "drop"; dropId: string; body?: string }
) {
  const banter = await createBanter(userId);
  const key = await ensureBanterKey(banter.id);
  if (!key) throw new Error("Encryption for that chat isn't ready yet");
  return sendMessage(banter.id, input);
}
