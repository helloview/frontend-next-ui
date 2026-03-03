import { auth } from "@/auth";
import { ApiRequestError } from "@/lib/api/client";

const SESSION_RETRY_DELAY_MS = 180;

type SessionSnapshot = {
  accessToken?: string;
  refreshToken?: string;
  error?: string;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readSessionSnapshot(): Promise<SessionSnapshot> {
  const session = await auth();
  return {
    accessToken: session?.accessToken,
    refreshToken: session?.refreshToken,
    error: session?.error,
  };
}

function canRetry(snapshot: SessionSnapshot): boolean {
  if (snapshot.refreshToken) {
    return true;
  }
  return snapshot.error === "RefreshAccessTokenTransientError";
}

export async function withStudioAccessToken<T>(run: (accessToken: string) => Promise<T>): Promise<T> {
  const first = await readSessionSnapshot();
  let accessToken = first.accessToken;

  if (!accessToken && canRetry(first)) {
    await wait(SESSION_RETRY_DELAY_MS);
    const retried = await readSessionSnapshot();
    accessToken = retried.accessToken;
  }

  if (!accessToken) {
    throw new ApiRequestError(401, "Unauthorized");
  }

  try {
    return await run(accessToken);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401 || !canRetry(first)) {
      throw error;
    }

    await wait(SESSION_RETRY_DELAY_MS);
    const retried = await readSessionSnapshot();
    if (!retried.accessToken) {
      throw error;
    }
    return run(retried.accessToken);
  }
}
