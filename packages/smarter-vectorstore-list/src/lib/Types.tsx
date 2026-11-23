/**
 * Central type definitions for the Vectorstore List React application.
 *
 * Vectorstore mirrors smarter.apps.vectorstore.serializers.VectorstoreSerializer, whose JSON field
 * names are camelCase. Related objects are given by name, and a Secret's value is never included.
 */
import type { SessionContext, Sorting, Annotations, Tags, UserProfile, Filtering } from "@smarter/common";

// ----------------------------------------------------------------------------
// Vectorstore Definition
// ----------------------------------------------------------------------------
export type VectorstoreBackend = "qdrant" | "pinecone";
export type VectorstoreHosting = "self_hosted" | "managed";
export type VectorstoreMetric = "cosine" | "euclidean" | "dotproduct";
export type VectorstoreStatus = "pending" | "provisioning" | "ready" | "stopped" | "failed" | "deleting";

export type Vectorstore = {
  // --- MetaDataWithOwnershipModel ---
  id: number;
  hashedId: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  description: string;
  version: string;
  tags: Tags;
  annotations: Annotations;
  userProfile: UserProfile;
  manifestUrl: string;
  /** The url of the vectorstore's detail: its manifest, what it uses, and what uses it. See ResourceDetail. */
  detailUrl: string | null;
  canDelete: boolean; // false if other resources depend on it, or you may not delete it

  // --- the manifest ---
  spec: Record<string, unknown>;
  backend: VectorstoreBackend;
  hosting: VectorstoreHosting;
  connection: string | null; // an ApiConnection's name
  isActive: boolean;
  dimension: number;
  metric: VectorstoreMetric;
  deletionProtection: boolean;
  embeddingsProvider: string | null; // a Provider's name
  embeddingsModel: string;

  // --- state ---
  status: VectorstoreStatus;
  statusMessage: string;
  indexName: string;
  endpointUrl: string;
  apiKeySecret: string | null; // a Secret's name, never its value
  vectorCount: number;
  documentCount: number;
  snapshotCount: number;
  stats: Record<string, unknown>;
  deployedAt: string | null;
  lastCheckedAt: string | null;
  lastSnapshotAt: string | null;
  lastMaintenanceAt: string | null;
};

// ----------------------------------------------------------------------------
// Documents: smarter.apps.vectorstore.contract.models.VectorstoreApiDocument and its responses
// ----------------------------------------------------------------------------
export type VectorstoreDocumentStatus = "pending" | "loading" | "loaded" | "failed" | "deleting";
export type VectorstoreDocumentSource = "upload" | "url" | "text" | "file";

export type VectorstoreDocument = {
  id: number;
  hashedId: string;
  createdAt: string | null;
  updatedAt: string | null;
  name: string; // its file name, or its url
  source: VectorstoreDocumentSource;
  contentType: string;
  sha256: string;
  sizeBytes: number;
  metadata: Record<string, unknown>;
  status: VectorstoreDocumentStatus;
  statusMessage: string; // why it failed, if it did
  chunkCount: number;
  loadedAt: string | null;
};

/** GET /api/v1/vectorstores/<hashed id>/documents/: the documents, newest first. */
export type VectorstoreDocuments = {
  documents: VectorstoreDocument[];
};

/** POST /api/v1/vectorstores/<hashed id>/documents/: what was added, and whether it is queued to be loaded. */
export type VectorstoreDocumentsAdded = {
  documents: VectorstoreDocument[];
  duplicates: VectorstoreDocument[];
  queued: boolean;
  message: string;
};

// ----------------------------------------------------------------------------
// Component Props Interfaces
// ----------------------------------------------------------------------------
export interface VectorstoreDetailViewProps {
  sessionContext: SessionContext;
  object: Vectorstore;
  onRequery: () => void;
  filtering?: Filtering;
}

export interface VectorstoreListViewProps {
  isLoading: boolean;
  ghostRows: number;
  sessionContext: SessionContext;
  objects: Vectorstore[];
  onRequery: () => void;
  sorting?: Sorting;
}
