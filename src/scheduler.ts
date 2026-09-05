import crypto from "node:crypto";
import { get, put } from "./store.js";

export type ScheduledPost = {
  id: string;
  userKey: string;
  commentary: string;
  imageUrl?: string;
  altText?: string;
  publishAt: string;
  createdAt: string;
  status: "scheduled" | "published" | "cancelled" | "failed";
  qstashMessageId?: string;
  postId?: string | null;
  error?: string;
};

const postKey = (id: string) => `linkedin:scheduled:${id}`;
const userIndexKey = (userKey: string) => `linkedin:scheduled-index:${userKey}`;

async function addToUserIndex(userKey: string, id: string) {
  const ids = (await get<string[]>(userIndexKey(userKey))) ?? [];
  if (!ids.includes(id)) await put(userIndexKey(userKey), [id, ...ids].slice(0, 200));
}

export async function getScheduledPost(id: string) {
  return get<ScheduledPost>(postKey(id));
}

export async function saveScheduledPost(post: ScheduledPost) {
  await put(postKey(post.id), post, 60 * 60 * 24 * 365);
  await addToUserIndex(post.userKey, post.id);
}

export async function listScheduledPosts(userKey: string) {
  const ids = (await get<string[]>(userIndexKey(userKey))) ?? [];
  const posts = await Promise.all(ids.map((id) => getScheduledPost(id)));
  return posts.filter((post): post is ScheduledPost => Boolean(post));
}

export async function scheduleDelivery(input: Omit<ScheduledPost, "id" | "createdAt" | "status" | "qstashMessageId">) {
  const publishAt = new Date(input.publishAt);
  if (!Number.isFinite(publishAt.getTime())) throw new Error("publishAt must be a valid ISO-8601 date/time");
  if (publishAt.getTime() <= Date.now() + 15_000) throw new Error("publishAt must be at least 15 seconds in the future");

  const qstashToken = process.env.QSTASH_TOKEN;
  const dispatchSecret = process.env.SCHEDULER_DISPATCH_SECRET;
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (!qstashToken || !dispatchSecret || !publicBaseUrl) {
    throw new Error("Scheduling is not configured. QSTASH_TOKEN, SCHEDULER_DISPATCH_SECRET and PUBLIC_BASE_URL are required.");
  }

  const post: ScheduledPost = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "scheduled",
  };
  await saveScheduledPost(post);

  const destination = `${publicBaseUrl}/internal/scheduled/${post.id}`;
  const response = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(destination)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${qstashToken}`,
      "Content-Type": "application/json",
      "Upstash-Method": "POST",
      "Upstash-Not-Before": String(Math.floor(publishAt.getTime() / 1000)),
      "Upstash-Retries": "3",
      "Upstash-Deduplication-Id": `linkedin-${post.id}`,
      "Upstash-Forward-Authorization": `Bearer ${dispatchSecret}`,
    },
    body: JSON.stringify({ scheduledPostId: post.id }),
  });

  if (!response.ok) {
    post.status = "failed";
    post.error = `Scheduler ${response.status}: ${await response.text()}`;
    await saveScheduledPost(post);
    throw new Error(post.error);
  }

  const result = (await response.json()) as { messageId?: string };
  post.qstashMessageId = result.messageId;
  await saveScheduledPost(post);
  return post;
}

export async function cancelScheduledPost(userKey: string, id: string) {
  const post = await getScheduledPost(id);
  if (!post || post.userKey !== userKey) throw new Error("Scheduled post not found");
  if (post.status !== "scheduled") throw new Error(`Scheduled post is already ${post.status}`);

  const qstashToken = process.env.QSTASH_TOKEN;
  if (post.qstashMessageId && qstashToken) {
    const response = await fetch(`https://qstash.upstash.io/v2/messages/${encodeURIComponent(post.qstashMessageId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${qstashToken}` },
    });
    if (!response.ok && response.status !== 404) throw new Error(`Could not cancel scheduler message: ${response.status}`);
  }

  post.status = "cancelled";
  await saveScheduledPost(post);
  return post;
}
