"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getDemoRecords } from "@/lib/crm/demo-data";
import type { CrmCollection, CrmRecord } from "@/lib/crm/config";

export type DataMode = "loading" | "demo" | "supabase" | "error";

type CollectionResponse = {
  data?: CrmRecord | CrmRecord[];
  error?: string;
  code?: string;
};

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

async function fetchCollection(collection: CrmCollection) {
  const response = await fetch(`/api/crm/${collection}`, { cache: "no-store" });
  const payload = await readResponse(response);

  if (response.status === 503 && payload.code === "SUPABASE_NOT_CONFIGURED") {
    return { records: readDemoCollection(collection), mode: "demo" as const };
  }
  if (!response.ok) throw new Error(payload.error ?? "Could not load CRM records.");
  if (!Array.isArray(payload.data) || !payload.data.every(isCrmRecord)) {
    throw new Error("The CRM server returned an invalid record list.");
  }
  return { records: payload.data, mode: "supabase" as const };
}

export function useCrmCollection(collection: CrmCollection) {
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [mode, setMode] = useState<DataMode>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMode("loading");
    setError(null);
    try {
      const result = await fetchCollection(collection);
      setRecords(result.records);
      setMode(result.mode);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Could not load CRM records.";
      setError(message);
      setMode("error");
    }
  }, [collection]);

  useEffect(() => {
    let active = true;
    void fetchCollection(collection).then((result) => {
      if (!active) return;
      setRecords(result.records);
      setMode(result.mode);
      setError(null);
    }).catch((loadError: unknown) => {
      if (!active) return;
      const message = loadError instanceof Error ? loadError.message : "Could not load CRM records.";
      setError(message);
      setMode("error");
    });
    return () => { active = false; };
  }, [collection]);

  const save = useCallback(async (input: Record<string, unknown>, id?: string) => {
    setError(null);
    if (mode === "demo") {
      const nextRecords = id
        ? records.map((record) => record.id === id ? { ...record, ...input } : record)
        : [{ ...input, id: `demo-${collection}-${crypto.randomUUID()}`, created_at: new Date().toISOString() }, ...records];
      window.localStorage.setItem(getStorageKey(collection), JSON.stringify(nextRecords));
      setRecords(nextRecords);
      return;
    }
    if (mode !== "supabase") throw new Error("Wait for the CRM workspace to finish loading before saving.");

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
  }, [collection, mode, records]);

  const remove = useCallback(async (id: string) => {
    setError(null);
    if (mode === "demo") {
      const nextRecords = records.filter((record) => record.id !== id);
      window.localStorage.setItem(getStorageKey(collection), JSON.stringify(nextRecords));
      setRecords(nextRecords);
      return;
    }
    if (mode !== "supabase") throw new Error("Wait for the CRM workspace to finish loading before deleting records.");

    const response = await fetch(`/api/crm/${collection}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const payload = await readResponse(response);
    if (!response.ok) throw new Error(payload.error ?? "Could not delete this record.");
    setRecords((current) => current.filter((record) => record.id !== id));
  }, [collection, mode, records]);

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

  return { records, mode, error, reload: load, save: runSave, remove: runRemove };
}
