import React, { createContext, useContext, useState, ReactNode } from 'react';

interface IdeState {
  openFiles: string[];
  activeFile: string | null;
  previewRefreshKey: number;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  refreshPreview: () => void;
}

const IdeContext = createContext<IdeState | null>(null);

export function IdeProvider({ children }: { children: ReactNode }) {
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

  const openFile = (path: string) => {
    if (!openFiles.includes(path)) {
      setOpenFiles(prev => [...prev, path]);
    }
    setActiveFile(path);
  };

  const closeFile = (path: string) => {
    setOpenFiles(prev => {
      const newFiles = prev.filter(f => f !== path);
      if (activeFile === path) {
        setActiveFile(newFiles.length > 0 ? newFiles[newFiles.length - 1] : null);
      }
      return newFiles;
    });
  };

  const refreshPreview = () => {
    setPreviewRefreshKey(prev => prev + 1);
  };

  return (
    <IdeContext.Provider value={{ 
      openFiles, 
      activeFile, 
      previewRefreshKey,
      openFile, 
      closeFile, 
      setActiveFile,
      refreshPreview
    }}>
      {children}
    </IdeContext.Provider>
  );
}

export const useIde = () => {
  const ctx = useContext(IdeContext);
  if (!ctx) throw new Error('useIde must be used within IdeProvider');
  return ctx;
};
