export interface SavedScript {
  id: string;
  name: string;
  code: string;
  date: number;
}

const STORAGE_KEY = 'neon_battlebots_scripts';

export const StorageService = {
  getScripts: (): SavedScript[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load scripts", e);
      return [];
    }
  },

  saveScript: (name: string, code: string): SavedScript[] => {
    const scripts = StorageService.getScripts();
    const newScript: SavedScript = {
      id: Date.now().toString(),
      name: name.trim() || 'Untitled Bot',
      code,
      date: Date.now()
    };
    
    // Check if name exists, update if so, otherwise add
    const existingIndex = scripts.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
    if (existingIndex >= 0) {
      scripts[existingIndex] = newScript;
    } else {
      scripts.push(newScript);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
    return scripts;
  },

  deleteScript: (id: string): SavedScript[] => {
    const scripts = StorageService.getScripts().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
    return scripts;
  }
};