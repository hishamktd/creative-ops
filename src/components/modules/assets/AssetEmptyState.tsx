'use client'

import React from 'react'

export interface AssetEmptyStateProps {
  onUploadClick: () => void
  title?: string
  description?: string
  showUploadButton?: boolean
  className?: string
}

export function AssetEmptyState({
  onUploadClick,
  title = "This folder is looking a bit empty!",
  description = "Drag and drop files here to get started, or use the upload button.",
  showUploadButton = true,
  className = ""
}: AssetEmptyStateProps) {
  return (
    <div className={`col-span-full mt-8 ${className}`}>
      <div className="text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-12 hover:border-primary/50 transition-colors">
        <div className="inline-flex items-center justify-center size-16 bg-primary/10 dark:bg-primary/20 rounded-full mb-4">
          <span className="material-symbols-outlined text-primary text-4xl">cloud_upload</span>
        </div>
        
        <h3 className="text-lg font-bold text-text-light-primary dark:text-dark-primary mb-1">
          {title}
        </h3>
        
        <p className="text-sm text-text-light-secondary dark:text-dark-secondary mb-6">
          {description}
        </p>

        {showUploadButton && (
          <button
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-semibold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined">upload</span>
            Upload Files
          </button>
        )}

        <div className="mt-6 text-xs text-text-light-secondary dark:text-dark-secondary space-y-1">
          <p>Supported formats: Images, Videos, Documents, Audio</p>
          <p>You can also paste images directly or drag files from your computer</p>
        </div>
      </div>
    </div>
  )
}