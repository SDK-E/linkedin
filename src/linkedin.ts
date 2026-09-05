const API_VERSION = "202608";

export type LinkedInSession = {
  accessToken: string;
  personUrn: string;
  expiresAt?: number;
};

const headers = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  "Linkedin-Version": API_VERSION,
  "X-Restli-Protocol-Version": "2.0.0",
  "Content-Type": "application/json",
});

async function linkedInJson<T>(url: string, init: RequestInit): Promise<{ data: T; response: Response }> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`LinkedIn ${response.status}: ${text}`);
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  return { data, response };
}

export async function publishText(session: LinkedInSession, commentary: string) {
  const { response } = await linkedInJson("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: headers(session.accessToken),
    body: JSON.stringify({
      author: session.personUrn,
      commentary,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  return response.headers.get("x-restli-id");
}

export async function publishImage(session: LinkedInSession, commentary: string, imageUrl: string, altText?: string) {
  const source = await fetch(imageUrl);
  if (!source.ok) throw new Error(`Could not download image: ${source.status}`);
  const bytes = await source.arrayBuffer();

  const { data } = await linkedInJson<{ value: { uploadUrl: string; image: string } }>(
    "https://api.linkedin.com/rest/images?action=initializeUpload",
    {
      method: "POST",
      headers: headers(session.accessToken),
      body: JSON.stringify({ initializeUploadRequest: { owner: session.personUrn } }),
    },
  );

  const upload = await fetch(data.value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": source.headers.get("content-type") ?? "application/octet-stream" },
    body: bytes,
  });
  if (!upload.ok) throw new Error(`LinkedIn image upload ${upload.status}: ${await upload.text()}`);

  const { response } = await linkedInJson("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: headers(session.accessToken),
    body: JSON.stringify({
      author: session.personUrn,
      commentary,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: data.value.image, altText: altText ?? "" } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  return response.headers.get("x-restli-id");
}
