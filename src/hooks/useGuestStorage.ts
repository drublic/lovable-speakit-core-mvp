import { useState, useEffect } from "react";

export interface ReadingHistoryItem {
  id: string;
  title: string;
  source_type: string;
  source_url?: string;
  content_preview: string;
  read_at: string;
}

export interface BookmarkItem {
  id: string;
  history_id: string;
  position: number;
  total_words: number;
  updated_at: string;
}

const STORAGE_KEYS = {
  READING_HISTORY: "speakit_guest_history",
  BOOKMARKS: "speakit_guest_bookmarks",
};

export const useGuestStorage = () => {
  const [guestHistory, setGuestHistory] = useState<ReadingHistoryItem[]>([]);
  const [guestBookmarks, setGuestBookmarks] = useState<BookmarkItem[]>([]);

  useEffect(() => {
    // Load from localStorage on mount
    const loadedHistory = localStorage.getItem(STORAGE_KEYS.READING_HISTORY);
    const loadedBookmarks = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);

    if (loadedHistory) {
      setGuestHistory(JSON.parse(loadedHistory));
    }
    if (loadedBookmarks) {
      setGuestBookmarks(JSON.parse(loadedBookmarks));
    }
  }, []);

  const addToHistory = (item: Omit<ReadingHistoryItem, "id" | "read_at">) => {
    const newItem: ReadingHistoryItem = {
      ...item,
      id: crypto.randomUUID(),
      read_at: new Date().toISOString(),
    };
    const updated = [newItem, ...guestHistory].slice(0, 50); // Keep last 50
    setGuestHistory(updated);
    localStorage.setItem(STORAGE_KEYS.READING_HISTORY, JSON.stringify(updated));
  };

  const saveBookmark = (historyId: string, position: number, totalWords: number) => {
    const existingIndex = guestBookmarks.findIndex((b) => b.history_id === historyId);
    let updated: BookmarkItem[];

    if (existingIndex >= 0) {
      // Update existing bookmark
      updated = [...guestBookmarks];
      updated[existingIndex] = {
        ...updated[existingIndex],
        position,
        total_words: totalWords,
        updated_at: new Date().toISOString(),
      };
    } else {
      // Create new bookmark
      const newBookmark: BookmarkItem = {
        id: crypto.randomUUID(),
        history_id: historyId,
        position,
        total_words: totalWords,
        updated_at: new Date().toISOString(),
      };
      updated = [...guestBookmarks, newBookmark];
    }

    setGuestBookmarks(updated);
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(updated));
  };

  const getBookmark = (historyId: string): BookmarkItem | undefined => {
    return guestBookmarks.find((b) => b.history_id === historyId);
  };

  return {
    addToHistory,
    saveBookmark,
    getBookmark,
    guestHistory,
    guestBookmarks,
  };
};
