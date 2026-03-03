export type WorkspaceVisibility = "private" | "public";

export type PipelineStepID = "script" | "style" | "worldview" | "audio" | "storyboard" | "export";

export type ProjectCardModel = {
  id: string;
  ownerId: string;
  ownerAvatar: string;
  ownerLabel: string;
  title: string;
  stage: string;
  statusLabel: string;
  progress: number;
  updated: string;
  visibility: WorkspaceVisibility;
  visibilityLabel: string;
};

export type WorkspaceProject = {
  id: string;
  ownerId: string;
  owner?: {
    id: string;
    nickname: string;
    avatarSeed?: string;
    avatarBackground?: string;
  };
  name: string;
  description: string;
  tags: string[];
  visibility: WorkspaceVisibility;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceAssetKind =
  | "character_ref"
  | "environment_ref"
  | "shot_final"
  | "shot_ref"
  | "audio"
  | "video"
  | "other";

export type WorkspaceAsset = {
  id: string;
  ownerId?: string;
  projectId?: string;
  kind: WorkspaceAssetKind;
  bucket: string;
  objectKey: string;
  publicUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  sha256?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type WorkspaceCharacter = {
  id: string;
  projectId: string;
  name: string;
  title?: string;
  visualSpec: Record<string, unknown>;
  primaryAssetId?: string;
  primaryAsset?: WorkspaceAsset;
  createdAt: string;
  updatedAt: string;
};

export type WorkspacePromptTemplate = {
  id: string;
  projectId: string;
  ownerId: string;
  title: string;
  content: string;
  previewResult: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceStylePreset = {
  id: string;
  projectId: string;
  name: string;
  spec: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceVoicePreset = {
  id: string;
  projectId: string;
  ownerId: string;
  name: string;
  provider: string;
  voiceId: string;
  config: Record<string, unknown>;
  previewText: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceEnvironment = {
  id: string;
  projectId: string;
  name: string;
  visualSpec: Record<string, unknown>;
  primaryAssetId?: string;
  primaryAsset?: WorkspaceAsset;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceStoryboard = {
  id: string;
  projectId: string;
  title: string;
  stylePresetId?: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceShot = {
  id: string;
  storyboardId: string;
  seqNo: number;
  voiceRole?: string;
  voiceLine?: string;
  sfxHint?: string;
  visualSpec: Record<string, unknown>;
  finalAssetId?: string;
  finalAsset?: WorkspaceAsset;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceJobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type WorkspaceJobType = "image_generate" | "voice_generate" | "video_compose" | "other";

export type WorkspaceJob = {
  id: string;
  projectId: string;
  storyboardId?: string;
  shotId?: string;
  type: WorkspaceJobType;
  status: WorkspaceJobStatus;
  progress: number;
  request: Record<string, unknown>;
  result: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
};

export type WorkspaceJobEvent = {
  id: number;
  jobId: string;
  level: string;
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type WorkspaceProjectDetail = {
  project: WorkspaceProject;
  characters: WorkspaceCharacter[];
  environments: WorkspaceEnvironment[];
  storyboards: WorkspaceStoryboard[];
};

export type WorkspaceProjectLibrary = {
  prompts: WorkspacePromptTemplate[];
  styles: WorkspaceStylePreset[];
  characters: WorkspaceCharacter[];
  environments: WorkspaceEnvironment[];
  voices: WorkspaceVoicePreset[];
};

export type WorkspaceStoryboardBundle = {
  storyboard: WorkspaceStoryboard;
  shots: WorkspaceShot[];
};

export type WorkspaceProjectsResponse = {
  items: WorkspaceProject[];
  count: number;
};

export type WorkspaceCharactersResponse = {
  items: WorkspaceCharacter[];
  count: number;
};

export type WorkspacePromptsResponse = {
  items: WorkspacePromptTemplate[];
  count: number;
};

export type WorkspaceStylesResponse = {
  items: WorkspaceStylePreset[];
  count: number;
};

export type WorkspaceEnvironmentsResponse = {
  items: WorkspaceEnvironment[];
  count: number;
};

export type WorkspaceVoicesResponse = {
  items: WorkspaceVoicePreset[];
  count: number;
};

export type WorkspaceStoryboardsResponse = {
  items: WorkspaceStoryboard[];
  count: number;
};

export type WorkspaceShotsResponse = {
  items: WorkspaceShot[];
  count: number;
};

export type WorkspaceJobEventsResponse = {
  items: WorkspaceJobEvent[];
  count: number;
};
