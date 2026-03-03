import { apiRequest } from "@/lib/api/client";
import { getServerStudioApiBaseUrl } from "@/lib/env";
import type {
  WorkspaceCharacter,
  WorkspaceCharactersResponse,
  WorkspaceEnvironment,
  WorkspaceEnvironmentsResponse,
  WorkspaceJob,
  WorkspaceJobEventsResponse,
  WorkspaceProjectLibrary,
  WorkspaceProject,
  WorkspaceProjectDetail,
  WorkspaceProjectsResponse,
  WorkspacePromptTemplate,
  WorkspacePromptsResponse,
  WorkspaceShot,
  WorkspaceShotsResponse,
  WorkspaceStylePreset,
  WorkspaceStylesResponse,
  WorkspaceStoryboardBundle,
  WorkspaceStoryboardsResponse,
  WorkspaceVisibility,
  WorkspaceVoicePreset,
  WorkspaceVoicesResponse,
} from "@/types/studio";

type StudioRequestBase = {
  accessToken: string;
};

function studioBase() {
  return getServerStudioApiBaseUrl();
}

export async function listWorkspaceProjects(input: StudioRequestBase): Promise<WorkspaceProjectsResponse> {
  return apiRequest<WorkspaceProjectsResponse>("/v1/projects", {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function createWorkspaceProject(
  input: {
    name?: string;
    title?: string;
    description?: string;
    tags?: string[];
    visibility?: WorkspaceVisibility;
  } & StudioRequestBase,
): Promise<WorkspaceProject> {
  return apiRequest<WorkspaceProject>("/v1/projects", {
    method: "POST",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      name: input.name ?? input.title ?? "Untitled",
      description: input.description ?? "",
      tags: input.tags ?? [],
      visibility: input.visibility ?? "private",
    },
  });
}

export async function getWorkspaceProject(input: { projectId: string } & StudioRequestBase): Promise<WorkspaceProjectDetail> {
  return apiRequest<WorkspaceProjectDetail>(`/v1/projects/${input.projectId}`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function updateWorkspaceProject(
  input: {
    projectId: string;
    name?: string;
    title?: string;
    description?: string;
    tags?: string[];
    visibility?: WorkspaceVisibility;
  } & StudioRequestBase,
): Promise<WorkspaceProject> {
  return apiRequest<WorkspaceProject>(`/v1/projects/${input.projectId}`, {
    method: "PATCH",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      ...(input.name !== undefined || input.title !== undefined ? { name: input.name ?? input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    },
  });
}

export async function getWorkspaceProjectLibrary(
  input: { projectId: string } & StudioRequestBase,
): Promise<WorkspaceProjectLibrary> {
  return apiRequest<WorkspaceProjectLibrary>(`/v1/projects/${input.projectId}/library`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function listWorkspacePromptTemplates(
  input: { projectId: string } & StudioRequestBase,
): Promise<WorkspacePromptsResponse> {
  return apiRequest<WorkspacePromptsResponse>(`/v1/projects/${input.projectId}/prompts`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function createWorkspacePromptTemplate(
  input: {
    projectId: string;
    title: string;
    content?: string;
    tags?: string[];
  } & StudioRequestBase,
): Promise<WorkspacePromptTemplate> {
  return apiRequest<WorkspacePromptTemplate>(`/v1/projects/${input.projectId}/prompts`, {
    method: "POST",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      title: input.title,
      content: input.content ?? "",
      tags: input.tags ?? [],
    },
  });
}

export async function updateWorkspacePromptTemplate(
  input: {
    promptId: string;
    title?: string;
    content?: string;
    previewResult?: string;
    tags?: string[];
  } & StudioRequestBase,
): Promise<WorkspacePromptTemplate> {
  return apiRequest<WorkspacePromptTemplate>(`/v1/prompts/${input.promptId}`, {
    method: "PATCH",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.previewResult !== undefined ? { previewResult: input.previewResult } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    },
  });
}

export async function deleteWorkspacePromptTemplate(input: { promptId: string } & StudioRequestBase): Promise<void> {
  await apiRequest<void>(`/v1/prompts/${input.promptId}`, {
    method: "DELETE",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function listWorkspaceStylePresets(
  input: { projectId: string } & StudioRequestBase,
): Promise<WorkspaceStylesResponse> {
  return apiRequest<WorkspaceStylesResponse>(`/v1/projects/${input.projectId}/styles`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function createWorkspaceStylePreset(
  input: {
    projectId: string;
    name: string;
    spec?: Record<string, unknown>;
    isDefault?: boolean;
  } & StudioRequestBase,
): Promise<WorkspaceStylePreset> {
  return apiRequest<WorkspaceStylePreset>(`/v1/projects/${input.projectId}/styles`, {
    method: "POST",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      name: input.name,
      spec: input.spec ?? {},
      isDefault: input.isDefault ?? false,
    },
  });
}

export async function updateWorkspaceStylePreset(
  input: {
    styleId: string;
    name?: string;
    spec?: Record<string, unknown>;
    isDefault?: boolean;
  } & StudioRequestBase,
): Promise<WorkspaceStylePreset> {
  return apiRequest<WorkspaceStylePreset>(`/v1/styles/${input.styleId}`, {
    method: "PATCH",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.spec !== undefined ? { spec: input.spec } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    },
  });
}

export async function deleteWorkspaceStylePreset(input: { styleId: string } & StudioRequestBase): Promise<void> {
  await apiRequest<void>(`/v1/styles/${input.styleId}`, {
    method: "DELETE",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function listWorkspaceVoicePresets(
  input: { projectId: string } & StudioRequestBase,
): Promise<WorkspaceVoicesResponse> {
  return apiRequest<WorkspaceVoicesResponse>(`/v1/projects/${input.projectId}/voices`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function createWorkspaceVoicePreset(
  input: {
    projectId: string;
    name: string;
    provider?: string;
    voiceId: string;
    config?: Record<string, unknown>;
    previewText?: string;
  } & StudioRequestBase,
): Promise<WorkspaceVoicePreset> {
  return apiRequest<WorkspaceVoicePreset>(`/v1/projects/${input.projectId}/voices`, {
    method: "POST",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      name: input.name,
      provider: input.provider ?? "indextts",
      voiceId: input.voiceId,
      config: input.config ?? {},
      previewText: input.previewText ?? "",
    },
  });
}

export async function updateWorkspaceVoicePreset(
  input: {
    voicePresetId: string;
    name?: string;
    provider?: string;
    voiceId?: string;
    config?: Record<string, unknown>;
    previewText?: string;
  } & StudioRequestBase,
): Promise<WorkspaceVoicePreset> {
  return apiRequest<WorkspaceVoicePreset>(`/v1/voices/${input.voicePresetId}`, {
    method: "PATCH",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.voiceId !== undefined ? { voiceId: input.voiceId } : {}),
      ...(input.config !== undefined ? { config: input.config } : {}),
      ...(input.previewText !== undefined ? { previewText: input.previewText } : {}),
    },
  });
}

export async function deleteWorkspaceVoicePreset(input: { voicePresetId: string } & StudioRequestBase): Promise<void> {
  await apiRequest<void>(`/v1/voices/${input.voicePresetId}`, {
    method: "DELETE",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function deleteWorkspaceProject(input: { projectId: string } & StudioRequestBase): Promise<void> {
  await apiRequest<void>(`/v1/projects/${input.projectId}`, {
    method: "DELETE",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function listWorkspaceCharacters(
  input: { projectId: string } & StudioRequestBase,
): Promise<WorkspaceCharactersResponse> {
  return apiRequest<WorkspaceCharactersResponse>(`/v1/projects/${input.projectId}/characters`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function createWorkspaceCharacter(
  input: {
    projectId: string;
    name: string;
    title?: string;
    visualSpec?: Record<string, unknown>;
    primaryAssetId?: string;
  } & StudioRequestBase,
): Promise<WorkspaceCharacter> {
  return apiRequest<WorkspaceCharacter>(`/v1/projects/${input.projectId}/characters`, {
    method: "POST",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      name: input.name,
      title: input.title ?? "",
      visualSpec: input.visualSpec ?? {},
      primaryAssetId: input.primaryAssetId ?? "",
    },
  });
}

export async function updateWorkspaceCharacter(
  input: {
    characterId: string;
    name?: string;
    title?: string;
    visualSpec?: Record<string, unknown>;
    primaryAssetId?: string;
  } & StudioRequestBase,
): Promise<WorkspaceCharacter> {
  return apiRequest<WorkspaceCharacter>(`/v1/characters/${input.characterId}`, {
    method: "PATCH",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.visualSpec !== undefined ? { visualSpec: input.visualSpec } : {}),
      ...(input.primaryAssetId !== undefined ? { primaryAssetId: input.primaryAssetId } : {}),
    },
  });
}

export async function listWorkspaceEnvironments(
  input: { projectId: string } & StudioRequestBase,
): Promise<WorkspaceEnvironmentsResponse> {
  return apiRequest<WorkspaceEnvironmentsResponse>(`/v1/projects/${input.projectId}/environments`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function createWorkspaceEnvironment(
  input: {
    projectId: string;
    name: string;
    visualSpec?: Record<string, unknown>;
    primaryAssetId?: string;
  } & StudioRequestBase,
): Promise<WorkspaceEnvironment> {
  return apiRequest<WorkspaceEnvironment>(`/v1/projects/${input.projectId}/environments`, {
    method: "POST",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      name: input.name,
      visualSpec: input.visualSpec ?? {},
      primaryAssetId: input.primaryAssetId ?? "",
    },
  });
}

export async function updateWorkspaceEnvironment(
  input: {
    environmentId: string;
    name?: string;
    visualSpec?: Record<string, unknown>;
    primaryAssetId?: string;
  } & StudioRequestBase,
): Promise<WorkspaceEnvironment> {
  return apiRequest<WorkspaceEnvironment>(`/v1/environments/${input.environmentId}`, {
    method: "PATCH",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.visualSpec !== undefined ? { visualSpec: input.visualSpec } : {}),
      ...(input.primaryAssetId !== undefined ? { primaryAssetId: input.primaryAssetId } : {}),
    },
  });
}

export async function listWorkspaceStoryboards(
  input: { projectId: string } & StudioRequestBase,
): Promise<WorkspaceStoryboardsResponse> {
  return apiRequest<WorkspaceStoryboardsResponse>(`/v1/projects/${input.projectId}/storyboards`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function createWorkspaceStoryboard(
  input: {
    projectId: string;
    title?: string;
    stylePresetId?: string;
    status?: string;
    shots?: Array<{
      seqNo?: number;
      voiceRole?: string;
      voiceLine?: string;
      sfxHint?: string;
      visualSpec?: Record<string, unknown>;
      status?: string;
    }>;
  } & StudioRequestBase,
): Promise<WorkspaceStoryboardBundle> {
  return apiRequest<WorkspaceStoryboardBundle>(`/v1/projects/${input.projectId}/storyboards`, {
    method: "POST",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      title: input.title ?? "",
      stylePresetId: input.stylePresetId ?? "",
      status: input.status ?? "draft",
      shots: input.shots ?? [],
    },
  });
}

export async function getWorkspaceStoryboard(
  input: { storyboardId: string } & StudioRequestBase,
): Promise<WorkspaceStoryboardBundle> {
  return apiRequest<WorkspaceStoryboardBundle>(`/v1/storyboards/${input.storyboardId}`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function listWorkspaceShots(
  input: { storyboardId: string } & StudioRequestBase,
): Promise<WorkspaceShotsResponse> {
  return apiRequest<WorkspaceShotsResponse>(`/v1/storyboards/${input.storyboardId}/shots`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function updateWorkspaceShot(
  input: {
    shotId: string;
    seqNo?: number;
    voiceRole?: string;
    voiceLine?: string;
    sfxHint?: string;
    visualSpec?: Record<string, unknown>;
    finalAssetId?: string;
    status?: string;
  } & StudioRequestBase,
): Promise<WorkspaceShot> {
  return apiRequest<WorkspaceShot>(`/v1/shots/${input.shotId}`, {
    method: "PATCH",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      ...(input.seqNo !== undefined ? { seqNo: input.seqNo } : {}),
      ...(input.voiceRole !== undefined ? { voiceRole: input.voiceRole } : {}),
      ...(input.voiceLine !== undefined ? { voiceLine: input.voiceLine } : {}),
      ...(input.sfxHint !== undefined ? { sfxHint: input.sfxHint } : {}),
      ...(input.visualSpec !== undefined ? { visualSpec: input.visualSpec } : {}),
      ...(input.finalAssetId !== undefined ? { finalAssetId: input.finalAssetId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
}

export async function createWorkspaceImageJob(
  input: {
    shotId: string;
    prompt?: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    seed?: number;
  } & StudioRequestBase,
): Promise<WorkspaceJob> {
  return apiRequest<WorkspaceJob>(`/v1/shots/${input.shotId}/generate-image`, {
    method: "POST",
    accessToken: input.accessToken,
    baseUrl: studioBase(),
    body: {
      prompt: input.prompt ?? "",
      negativePrompt: input.negativePrompt ?? "",
      width: input.width ?? 0,
      height: input.height ?? 0,
      seed: input.seed ?? 0,
    },
  });
}

export async function getWorkspaceJob(input: { jobId: string } & StudioRequestBase): Promise<WorkspaceJob> {
  return apiRequest<WorkspaceJob>(`/v1/jobs/${input.jobId}`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}

export async function listWorkspaceJobEvents(
  input: { jobId: string; after?: number; limit?: number } & StudioRequestBase,
): Promise<WorkspaceJobEventsResponse> {
  const params = new URLSearchParams();
  if (input.after !== undefined) params.set("after", String(input.after));
  if (input.limit !== undefined) params.set("limit", String(input.limit));
  const query = params.toString();
  return apiRequest<WorkspaceJobEventsResponse>(`/v1/jobs/${input.jobId}/events${query ? `?${query}` : ""}`, {
    accessToken: input.accessToken,
    baseUrl: studioBase(),
  });
}
