"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getDemoRecords } from "@/lib/crm/demo-data";
import type { CrmCollection, CrmRecord } from "@/lib/crm/config";

export type DataMode = "loading" | "demo" | "supabase" | "error";

type CollectionResponse = {
  data?: CrmRecord | CrmRecord[];
  error?: string;
  code?: string;
  hasMore?: boolean;
  nextCursor?: string | null;
};

export type CollectionQuery = {
  search?: string;
  status?: string;
  facets?: Record<string, string>;
};

type CollectionPage = {
  records: CrmRecord[];
  mode: "demo" | "supabase";
  hasMore: boolean;
  nextCursor: string | null;
};

class CrmApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "CrmApiError";
  }
}

function getStorageKey(collection: CrmCollection) {
  return `nexora-crm-demo-${collection}`;
}

function readDemoCollection(collection: CrmCollection) {
  const stored = window.localStorage.getItem(getStorageKey(collection));
  if (stored === null) {
    const initial = getDemoRecords(collection);
    window.localStorage.setItem(getStorageKey(collection), JSON.stringify(initial));
    return initial;
  }

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isCrmRecord)) {
    throw new Error(`Saved demo ${collection} data is invalid. Clear this workspace's local storage to reset it.`);
  }
  return parsed;
}

function isCrmRecord(value: unknown): value is CrmRecord {
  return typeof value === "object"
    && value !== null
    && "id" in value
    && typeof value.id === "string";
}

function isCollectionResponse(value: unknown): value is CollectionResponse {
  return typeof value === "object" && value !== null;
}

async function readResponse(response: Response): Promise<CollectionResponse> {
  const payload: unknown = await response.json();
  if (!isCollectionResponse(payload)) {
    throw new Error("The CRM server returned an invalid response.");
  }
  return payload;
}

async function fetchCollection(collection: CrmCollection, query: CollectionQuery, cursor?: string | null): Promise<CollectionPage> {
  const searchParams = new URLSearchParams({ limit: "50" });
  if (query.search) searchParams.set("q", query.search);
  if (query.status) searchParams.set("status", query.status);
  for (const [key, value] of Object.entries(query.facets ?? {})) {
    if (value) searchParams.set(`facet_${key}`, value);
  }
  if (cursor) searchParams.set("cursor", cursor);
  const response = await fetch(`/api/crm/${collection}?${searchParams}`, { cache: "no-store" });
  const payload = await readResponse(response);

  if (response.status === 503 && payload.code === "SUPABASE_NOT_CONFIGURED") {
    return { records: readDemoCollection(collection), mode: "demo" as const, hasMore: false, nextCursor: null };
  }
  if (!response.ok) throw new CrmApiError(payload.error ?? "Could not load CRM records.", payload.code);
  if (!Array.isArray(payload.data) || !payload.data.every(isCrmRecord)) {
    throw new Error("The CRM server returned an invalid record list.");
  }
  return {
    records: payload.data,
    mode: "supabase" as const,
    hasMore: payload.hasMore === true,
    nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : null,
  };
}

export function useCrmCollection(collection: CrmCollection, query: CollectionQuery = {}) {
  const queryKey = JSON.stringify(query);
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [mode, setMode] = useState<DataMode>("loading");
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const currentQueryKeyRef = useRef(queryKey);

  useEffect(() => {
    currentQueryKeyRef.current = queryKey;
  }, [queryKey]);

  const load = useCallback(async () => {
    setMode("loading");
    setError(null);
    setErrorCode(null);
    try {
      const result = await fetchCollection(collection, JSON.parse(queryKey) as CollectionQuery);
      setRecords(result.records);
      setMode(result.mode);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
      setLoadedQueryKey(queryKey);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Could not load CRM records.";
      setError(message);
      setErrorCode(loadError instanceof CrmApiError ? loadError.code ?? null : null);
      setMode("error");
    }
  }, [collection, queryKey]);

  useEffect(() => {
    let active = true;
    void fetchCollection(collection, JSON.parse(queryKey) as CollectionQuery).then((result) => {
      if (!active) return;
      setRecords(result.records);
      setMode(result.mode);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
      setError(null);
      setErrorCode(null);
      setLoadedQueryKey(queryKey);
    }).catch((loadError: unknown) => {
      if (!active) return;
      const message = loadError instanceof Error ? loadError.message : "Could not load CRM records.";
      setError(message);
      setErrorCode(loadError instanceof CrmApiError ? loadError.code ?? null : null);
      setMode("error");
      setLoadedQueryKey(queryKey);
    });
    return () => { active = false; };
  }, [collection, queryKey]);

  const currentMode = loadedQueryKey === queryKey ? mode : "loading";
  const currentError = loadedQueryKey === queryKey ? error : null;
  const currentHasMore = loadedQueryKey === queryKey && hasMore;

  const loadMore = useCallback(async () => {
    if (!currentHasMore || !nextCursor || loadingMoreRef.current || currentMode !== "supabase") return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);
    setErrorCode(null);
    try {
      const requestQueryKey = queryKey;
      const result = await fetchCollection(collection, JSON.parse(requestQueryKey) as CollectionQuery, nextCursor);
      if (currentQueryKeyRef.current !== requestQueryKey) return;
      setRecords((current) => [...current, ...result.records]);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      if (currentQueryKeyRef.current !== queryKey) return;
      const message = loadError instanceof Error ? loadError.message : "Could not load more CRM records.";
      setError(message);
      setErrorCode(loadError instanceof CrmApiError ? loadError.code ?? null : null);
      toast.error(message);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [collection, currentHasMore, currentMode, nextCursor, queryKey]);

  const save = useCallback(async (input: Record<string, unknown>, id?: string) => {
    setError(null);
    if (currentMode === "demo") {
      const nextRecords = id
        ? records.map((record) => record.id === id ? { ...record, ...input } : record)
        : [{ ...input, id: `demo-${collection}-${crypto.randomUUID()}`, created_at: new Date().toISOString() }, ...records];
      window.localStorage.setItem(getStorageKey(collection), JSON.stringify(nextRecords));
      setRecords(nextRecords);
      return;
    }
    if (currentMode !== "supabase") throw new Error("Wait for the CRM workspace to finish loading before saving.");

    const response = await fetch(`/api/crm/${collection}`, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id, record: input } : input),
    });
    const payload = await readResponse(response);
    if (!response.ok) throw new Error(payload.error ?? "Could not save this record.");
    if (!payload.data || Array.isArray(payload.data)) throw new Error("The CRM server did not return the saved record.");

    const savedRecord = payload.data;
    setRecords((current) => id
      ? current.map((record) => record.id === id ? savedRecord : record)
      : [savedRecord, ...current]);
    if (queryKey !== "{}") await load();
  }, [collection, currentMode, load, queryKey, records]);

  const importRecords = useCallback(async (inputs: Record<string, unknown>[]) => {
    if (inputs.length === 0) return 0;
    if (currentMode === "demo") {
      const imported: CrmRecord[] = inputs.map((input) => ({
        ...input,
        id: `demo-${collection}-${crypto.randomUUID()}`,
        created_at: new Date().toISOString(),
      }));
      const nextRecords = [...imported, ...records];
      window.localStorage.setItem(getStorageKey(collection), JSON.stringify(nextRecords));
      setRecords(nextRecords);
      return imported.length;
    }
    if (currentMode !== "supabase") throw new Error("Wait for the CRM workspace to finish loading before importing records.");

    let inserted = 0;
    for (let start = 0; start < inputs.length; start += 100) {
      const chunk = inputs.slice(start, start + 100);
      const response = await fetch(`/api/crm/${collection}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: chunk }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        const completed = inserted > 0 ? ` ${inserted} rows were imported before this batch failed.` : "";
        throw new Error(`${payload.error ?? "Could not import CRM records."}${completed}`);
      }
      if (!Array.isArray(payload.data) || !payload.data.every(isCrmRecord)) {
        throw new Error("The CRM server returned an invalid import response.");
      }
      inserted += payload.data.length;
    }
    await load();
    return inserted;
  }, [collection, currentMode, load, records]);

  const remove = useCallback(async (id: string) => {
    setError(null);
    if (currentMode === "demo") {
      const nextRecords = records.filter((record) => record.id !== id);
      window.localStorage.setItem(getStorageKey(collection), JSON.stringify(nextRecords));
      setRecords(nextRecords);
      return;
    }
    if (currentMode !== "supabase") throw new Error("Wait for the CRM workspace to finish loading before deleting records.");

    const response = await fetch(`/api/crm/${collection}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const payload = await readResponse(response);
    if (!response.ok) throw new Error(payload.error ?? "Could not delete this record.");
    setRecords((current) => current.filter((record) => record.id !== id));
  }, [collection, currentMode, records]);

  const runSave = useCallback(async (input: Record<string, unknown>, id?: string) => {
    try {
      await save(input, id);
      toast.success(id ? "Record updated." : "Record added.");
      return true;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Could not save this record.";
      setError(message);
      toast.error(message);
      return false;
    }
  }, [save]);

  const runRemove = useCallback(async (id: string) => {
    try {
      await remove(id);
      toast.success("Record deleted.");
      return true;
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : "Could not delete this record.";
      setError(message);
      toast.error(message);
      return false;
    }
  }, [remove]);

  return {
    records,
    mode: currentMode,
    error: currentError,
    errorCode: loadedQueryKey === queryKey ? errorCode : null,
    hasMore: currentHasMore,
    loadingMore,
    loadedCount: records.length,
    reload: load,
    loadMore,
    importRecords,
    save: runSave,
    remove: runRemove,
  };
}
