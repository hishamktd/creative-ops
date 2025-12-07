import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { AssetUploadZone } from "../AssetUploadZone";
import {
  createMockFile,
  createMockImageFile,
  createMockVideoFile,
} from "@/test/test-utils";

// Mock the storage service
const mockStorageService = {
  uploadFile: vi.fn(),
  validateFile: vi.fn(),
  generateThumbnail: vi.fn(),
};

vi.mock("@/lib/services/storage", () => ({
  StorageService: mockStorageService,
}));

// Mock the asset manager
const mockAssetManager = {
  createAsset: vi.fn(),
  updateAsset: vi.fn(),
};

vi.mock("@/lib/services/assetManager", () => ({
  AssetManager: mockAssetManager,
}));

describe("AssetUploadZone - Comprehensive Tests", () => {
  const defaultProps = {
    projectId: "project-1",
    onUploadComplete: vi.fn(),
    onUploadProgress: vi.fn(),
    onUploadError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockStorageService.validateFile.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {},
      securityFlags: [],
    });

    mockStorageService.uploadFile.mockResolvedValue({
      success: true,
      data: {
        path: "test/path",
        fullPath: "full/test/path",
        publicUrl: "https://example.com/test.jpg",
      },
    });

    mockAssetManager.createAsset.mockResolvedValue({
      id: "asset-1",
      name: "test.jpg",
      file_url: "https://example.com/test.jpg",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("File Validation", () => {
    it("should validate file types correctly", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} acceptedTypes={["image/*"]} />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const invalidFile = createMockFile("test.txt", "content", "text/plain");

      mockStorageService.validateFile.mockReturnValue({
        isValid: false,
        errors: ["File type not allowed"],
        warnings: [],
        metadata: {},
        securityFlags: [],
      });

      await user.upload(fileInput, invalidFile);

      expect(screen.getByText(/file type not allowed/i)).toBeInTheDocument();
      expect(defaultProps.onUploadError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("File type not allowed"),
        })
      );
    });

    it("should validate file size limits", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} maxFileSize={1024} />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const largeFile = createMockFile(
        "large.jpg",
        "x".repeat(2048),
        "image/jpeg"
      );

      mockStorageService.validateFile.mockReturnValue({
        isValid: false,
        errors: ["File size exceeds maximum limit"],
        warnings: [],
        metadata: {},
        securityFlags: [],
      });

      await user.upload(fileInput, largeFile);

      expect(
        screen.getByText(/file size exceeds maximum limit/i)
      ).toBeInTheDocument();
    });

    it("should show security warnings for potentially dangerous files", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const suspiciousFile = createMockFile(
        "script.js",
        'alert("xss")',
        "application/javascript"
      );

      mockStorageService.validateFile.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: ["JavaScript files may contain executable code"],
        metadata: {},
        securityFlags: ["EXECUTABLE_CONTENT"],
      });

      await user.upload(fileInput, suspiciousFile);

      expect(
        screen.getByText(/javascript files may contain executable code/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/security warning/i)).toBeInTheDocument();
    });
  });

  describe("Drag and Drop Functionality", () => {
    it("should handle drag enter and leave events", async () => {
      render(<AssetUploadZone {...defaultProps} />);

      const dropZone = screen.getByRole("button", { name: /drag.*drop/i });

      // Simulate drag enter
      fireEvent.dragEnter(dropZone, {
        dataTransfer: {
          types: ["Files"],
          files: [createMockImageFile()],
        },
      });

      expect(dropZone).toHaveClass("border-primary-500"); // Active drag state

      // Simulate drag leave
      fireEvent.dragLeave(dropZone);

      expect(dropZone).not.toHaveClass("border-primary-500");
    });

    it("should handle drop events with multiple files", async () => {
      render(<AssetUploadZone {...defaultProps} multiple />);

      const dropZone = screen.getByRole("button", { name: /drag.*drop/i });
      const files = [
        createMockImageFile("image1.jpg"),
        createMockImageFile("image2.png"),
        createMockVideoFile("video1.mp4"),
      ];

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files,
        },
      });

      await waitFor(() => {
        expect(mockStorageService.uploadFile).toHaveBeenCalledTimes(3);
      });
    });

    it("should prevent default drag behaviors", () => {
      render(<AssetUploadZone {...defaultProps} />);

      const dropZone = screen.getByRole("button", { name: /drag.*drop/i });

      const dragOverEvent = new Event("dragover", { bubbles: true });
      const preventDefaultSpy = vi.spyOn(dragOverEvent, "preventDefault");

      fireEvent(dropZone, dragOverEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe("Upload Progress Tracking", () => {
    it("should show progress for individual files", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const file = createMockImageFile();

      // Mock upload with progress callbacks
      mockStorageService.uploadFile.mockImplementation(({ onProgress }) => {
        // Simulate progress updates
        setTimeout(() => onProgress?.(25), 100);
        setTimeout(() => onProgress?.(50), 200);
        setTimeout(() => onProgress?.(75), 300);
        setTimeout(() => onProgress?.(100), 400);

        return Promise.resolve({
          success: true,
          data: {
            path: "test/path",
            publicUrl: "https://example.com/test.jpg",
          },
        });
      });

      await user.upload(fileInput, file);

      // Check for progress bar
      expect(screen.getByRole("progressbar")).toBeInTheDocument();

      // Wait for completion
      await waitFor(
        () => {
          expect(screen.getByText(/upload completed/i)).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    it("should show overall progress for multiple files", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} multiple />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const files = [
        createMockImageFile("image1.jpg"),
        createMockImageFile("image2.jpg"),
      ];

      await user.upload(fileInput, files);

      // Check for overall progress indicator
      expect(screen.getByText(/uploading 2 files/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText(/all uploads completed/i)).toBeInTheDocument();
      });
    });

    it("should allow cancelling uploads", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const file = createMockImageFile();

      // Mock long-running upload
      mockStorageService.uploadFile.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                success: true,
                data: {
                  path: "test/path",
                  publicUrl: "https://example.com/test.jpg",
                },
              }),
            5000
          );
        });
      });

      await user.upload(fileInput, file);

      // Find and click cancel button
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.getByText(/upload cancelled/i)).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should handle upload failures gracefully", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const file = createMockImageFile();

      mockStorageService.uploadFile.mockResolvedValue({
        success: false,
        error: "Network error occurred",
      });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
      });

      // Check for retry button
      expect(
        screen.getByRole("button", { name: /retry/i })
      ).toBeInTheDocument();
    });

    it("should retry failed uploads", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const file = createMockImageFile();

      // First attempt fails
      mockStorageService.uploadFile
        .mockResolvedValueOnce({
          success: false,
          error: "Temporary error",
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            path: "test/path",
            publicUrl: "https://example.com/test.jpg",
          },
        });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText(/temporary error/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(/upload completed/i)).toBeInTheDocument();
      });
    });

    it("should handle network connectivity issues", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const file = createMockImageFile();

      mockStorageService.uploadFile.mockRejectedValue(
        new Error("Network error")
      );

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      expect(defaultProps.onUploadError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Network error"),
        })
      );
    });
  });

  describe("Accessibility Features", () => {
    it("should have proper ARIA attributes", () => {
      render(<AssetUploadZone {...defaultProps} />);

      const dropZone = screen.getByRole("button", { name: /drag.*drop/i });
      const fileInput = screen.getByLabelText(/choose files/i);

      expect(dropZone).toHaveAttribute("aria-describedby");
      expect(fileInput).toHaveAttribute("aria-label");
      expect(fileInput).toHaveAttribute("accept");
    });

    it("should announce upload status to screen readers", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const file = createMockImageFile();

      await user.upload(fileInput, file);

      // Check for status region
      const statusRegion = screen.getByRole("status");
      expect(statusRegion).toBeInTheDocument();

      await waitFor(() => {
        expect(statusRegion).toHaveTextContent(/uploading/i);
      });
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} />);

      const dropZone = screen.getByRole("button", { name: /drag.*drop/i });

      // Focus the drop zone
      await user.tab();
      expect(dropZone).toHaveFocus();

      // Activate with Enter
      await user.keyboard("{Enter}");

      // File input should be triggered (in real browser would open file dialog)
      expect(dropZone).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Paste Functionality", () => {
    it("should handle paste events with image data", async () => {
      render(<AssetUploadZone {...defaultProps} />);

      const dropZone = screen.getByRole("button", { name: /drag.*drop/i });

      // Create mock clipboard data
      const clipboardData = {
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => createMockImageFile("pasted-image.png"),
          },
        ],
      };

      fireEvent.paste(dropZone, {
        clipboardData,
      });

      await waitFor(() => {
        expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
          expect.objectContaining({
            file: expect.objectContaining({
              name: "pasted-image.png",
              type: "image/png",
            }),
          })
        );
      });
    });

    it("should ignore paste events without file data", () => {
      render(<AssetUploadZone {...defaultProps} />);

      const dropZone = screen.getByRole("button", { name: /drag.*drop/i });

      fireEvent.paste(dropZone, {
        clipboardData: {
          items: [
            {
              kind: "string",
              type: "text/plain",
            },
          ],
        },
      });

      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe("Folder Integration", () => {
    it("should upload files to specified folder", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} folderId="folder-1" />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const file = createMockImageFile();

      await user.upload(fileInput, file);

      expect(mockAssetManager.createAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          folder_id: "folder-1",
        })
      );
    });

    it("should show current folder context", () => {
      render(
        <AssetUploadZone
          {...defaultProps}
          folderId="folder-1"
          folderName="My Folder"
        />
      );

      expect(screen.getByText(/uploading to.*my folder/i)).toBeInTheDocument();
    });
  });

  describe("Performance Optimization", () => {
    it("should handle large numbers of files efficiently", async () => {
      const user = userEvent.setup();
      render(<AssetUploadZone {...defaultProps} multiple />);

      const fileInput = screen.getByLabelText(/choose files/i);
      const files = Array.from({ length: 50 }, (_, i) =>
        createMockImageFile(`image-${i}.jpg`)
      );

      const startTime = performance.now();

      await user.upload(fileInput, files);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 50 files in reasonable time (< 1 second for setup)
      expect(duration).toBeLessThan(1000);

      // Should batch uploads appropriately
      expect(mockStorageService.uploadFile).toHaveBeenCalledTimes(50);
    });

    it("should implement upload queue management", async () => {
      const user = userEvent.setup();
      render(
        <AssetUploadZone {...defaultProps} multiple maxConcurrentUploads={3} />
      );

      const fileInput = screen.getByLabelText(/choose files/i);
      const files = Array.from({ length: 10 }, (_, i) =>
        createMockImageFile(`image-${i}.jpg`)
      );

      await user.upload(fileInput, files);

      // Should show queue status
      expect(screen.getByText(/3 uploading.*7 queued/i)).toBeInTheDocument();
    });
  });
});
