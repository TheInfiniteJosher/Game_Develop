import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateProject as useGeneratedCreateProject,
  useDeleteProject as useGeneratedDeleteProject,
  useUpdateProject as useGeneratedUpdateProject,
  useDuplicateProject as useGeneratedDuplicateProject,
  useWriteFile as useGeneratedWriteFile,
  useCreateFolder as useGeneratedCreateFolder,
  useRenameFile as useGeneratedRenameFile,
  useMoveFile as useGeneratedMoveFile,
  useDeleteFile as useGeneratedDeleteFile,
  useDuplicateFile as useGeneratedDuplicateFile,
  useRevertChange as useGeneratedRevertChange,
  useClearAiHistory as useGeneratedClearAiHistory,
} from "@workspace/api-client-react";

// Re-export queries (no cache invalidation wrapper needed)
export {
  useListProjects,
  useGetProject,
  useListFiles,
  useReadFile,
  useGetPreviewEntry,
  useGetAiHistory,
  useGetChangeHistory
} from "@workspace/api-client-react";

// Wrap mutations to add automatic cache invalidation
export function useCreateProject() {
  const queryClient = useQueryClient();
  return useGeneratedCreateProject({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects"] })
    }
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useGeneratedDeleteProject({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects"] })
    }
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useGeneratedUpdateProject({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.id}`] });
      }
    }
  });
}

export function useDuplicateProject() {
  const queryClient = useQueryClient();
  return useGeneratedDuplicateProject({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects"] })
    }
  });
}

export function useWriteFile() {
  const queryClient = useQueryClient();
  return useGeneratedWriteFile({
    mutation: {
      onSuccess: (_, variables) => {
        // Invalidate file list and changes history
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.id}/files`] });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.id}/changes`] });
      }
    }
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useGeneratedCreateFolder({
    mutation: {
      onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.id}/files`] })
    }
  });
}

export function useRenameFile() {
  const queryClient = useQueryClient();
  return useGeneratedRenameFile({
    mutation: {
      onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.id}/files`] })
    }
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  return useGeneratedDeleteFile({
    mutation: {
      onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.id}/files`] })
    }
  });
}

export function useRevertChange() {
  const queryClient = useQueryClient();
  return useGeneratedRevertChange({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.id}/changes`] });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.id}/files`] });
      }
    }
  });
}

export function useMoveFile() {
  const queryClient = useQueryClient();
  return useGeneratedMoveFile({
    mutation: {
      onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.id}/files`] })
    }
  });
}

export function useDuplicateFile() {
  const queryClient = useQueryClient();
  return useGeneratedDuplicateFile({
    mutation: {
      onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.id}/files`] })
    }
  });
}

export function useClearAiHistory() {
  const queryClient = useQueryClient();
  return useGeneratedClearAiHistory({
    mutation: {
      onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.id}/ai/history`] })
    }
  });
}

// useUploadZip - manually implemented since it uses multipart form
export function useUploadZip() {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  const mutate = async (
    { id, data }: { id: string; data: { file: File; overwrite?: boolean } },
    options?: { onSuccess?: () => void; onError?: (err: Error) => void }
  ) => {
    setIsPending(true);
    try {
      const formData = new FormData();
      formData.append("file", data.file);
      if (data.overwrite) formData.append("overwrite", "true");

      const res = await fetch(`/api/projects/${id}/upload-zip`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/files`] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      options?.onSuccess?.();
    } catch (err) {
      options?.onError?.(err as Error);
    } finally {
      setIsPending(false);
    }
  };

  return { mutate, isPending };
}

// useUploadFiles - manually implemented for multipart
export function useUploadFiles() {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  const mutate = async (
    { id, data }: { id: string; data: { files: File[]; paths: string[]; overwrite?: boolean } },
    options?: { onSuccess?: () => void; onError?: (err: Error) => void }
  ) => {
    setIsPending(true);
    try {
      const formData = new FormData();
      data.files.forEach((f) => formData.append("files", f));
      data.paths.forEach((p) => formData.append("paths", p));
      if (data.overwrite) formData.append("overwrite", "true");

      const res = await fetch(`/api/projects/${id}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/files`] });
      options?.onSuccess?.();
    } catch (err) {
      options?.onError?.(err as Error);
    } finally {
      setIsPending(false);
    }
  };

  return { mutate, isPending };
}
