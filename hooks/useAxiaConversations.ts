"use client";
import { useState, useCallback, useEffect, useRef } from "react";

export interface ConversationSummary {
  id: string;
  titre: string;
  updatedAt: string;
  createdAt: string;
}

export interface ConversationFull extends ConversationSummary {
  messages: any[];
}

// Gestion des conversations AXIA (façon ChatGPT) — partagée entre l'écran
// plein écran (/dashboard) et la bulle flottante, pour ne jamais diverger
// entre les deux surfaces.
export function useAxiaConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/axia/conversations");
    const data = await res.json();
    const list: ConversationSummary[] = data.conversations ?? [];
    setConversations(list);
    return list;
  }, []);

  useEffect(() => { refresh().finally(() => setLoadingList(false)); }, [refresh]);

  const creerConversation = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/axia/conversations", { method: "POST" });
    const data = await res.json();
    await refresh();
    setActiveIdState(data.conversation.id);
    return data.conversation.id as string;
  }, [refresh]);

  const chargerConversation = useCallback(async (id: string): Promise<ConversationFull | null> => {
    const res = await fetch(`/api/axia/conversations/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.conversation ?? null;
  }, []);

  // Débounce léger — évite un PATCH à chaque token pendant le streaming,
  // sauve ~600ms après la dernière mise à jour de la liste de messages.
  const sauvegarder = useCallback((id: string, messages: any[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await fetch(`/api/axia/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      refresh();
    }, 600);
  }, [refresh]);

  const renommer = useCallback(async (id: string, titre: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, titre } : c));
    await fetch(`/api/axia/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titre }),
    });
  }, []);

  const supprimer = useCallback(async (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    await fetch(`/api/axia/conversations/${id}`, { method: "DELETE" });
  }, []);

  const setActiveId = useCallback((id: string | null) => setActiveIdState(id), []);

  return {
    conversations, activeId, loadingList,
    refresh, creerConversation, chargerConversation, sauvegarder, renommer, supprimer, setActiveId,
  };
}
