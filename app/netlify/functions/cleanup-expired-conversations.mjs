import {
  cleanupQueuedConversationAssets,
  purgeExpiredClosedConversations,
} from "./_lib/chat-retention.mjs";

export default async () => {
  const conversationsDeleted = await purgeExpiredClosedConversations();
  const assets = await cleanupQueuedConversationAssets();
  console.log("privacy-retention-cleanup", { conversationsDeleted, ...assets });
  return Response.json({ conversationsDeleted, assets });
};

export const config = { schedule: "@daily" };
