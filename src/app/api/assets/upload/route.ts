import { NextRequest, NextResponse } from 'next/server'
import { AssetManagerService } from '@/lib/services/assetManager'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ErrorHandlingService, ErrorType, ErrorSeverity } from '@/lib/services/errorHandling'

export async function POST(request: NextRequest) {
  const context = {
    operation: 'asset_upload',
    userAgent: request.headers.get('user-agent') || undefined,
    timestamp: new Date().toISOString()
  }

  return await ErrorHandlingService.handleError(
    async () => {
      const supabase = createServerSupabaseClient()
      
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        throw ErrorHandlingService.createError(
          ErrorType.AUTHENTICATION,
          'AUTH_ERROR',
          authError.message,
          context,
          ErrorSeverity.HIGH
        )
      }

      if (!user) {
        throw ErrorHandlingService.createError(
          ErrorType.AUTHENTICATION,
          'UNAUTHORIZED',
          'Authentication required',
          context,
          ErrorSeverity.HIGH
        )
      }

      context.userId = user.id

      // Parse form data with error handling
      let formData: FormData
      try {
        formData = await request.formData()
      } catch (error) {
        throw ErrorHandlingService.createError(
          ErrorType.VALIDATION,
          'INVALID_FORM_DATA',
          'Failed to parse form data',
          context,
          ErrorSeverity.MEDIUM,
          error instanceof Error ? error.message : undefined
        )
      }

      const file = formData.get('file') as File
      const projectId = formData.get('projectId') as string
      const folderId = formData.get('folderId') as string | null
      const generateThumbnail = formData.get('generateThumbnail') === 'true'
      const resumeFrom = formData.get('resumeFrom') ? parseInt(formData.get('resumeFrom') as string) : undefined

      // Validate required fields
      if (!file) {
        throw ErrorHandlingService.createError(
          ErrorType.VALIDATION,
          'NO_FILE_PROVIDED',
          'No file provided',
          context,
          ErrorSeverity.MEDIUM
        )
      }

      if (!projectId) {
        throw ErrorHandlingService.createError(
          ErrorType.VALIDATION,
          'NO_PROJECT_ID',
          'Project ID is required',
          context,
          ErrorSeverity.MEDIUM
        )
      }

      // Add file context
      context.projectId = projectId
      context.fileName = file.name
      context.fileSize = file.size

      // Check file size limits early
      const maxFileSize = 100 * 1024 * 1024 // 100MB
      if (file.size > maxFileSize) {
        throw ErrorHandlingService.createError(
          ErrorType.QUOTA,
          'FILE_TOO_LARGE',
          `File size (${Math.round(file.size / (1024 * 1024))}MB) exceeds maximum allowed size (${Math.round(maxFileSize / (1024 * 1024))}MB)`,
          context,
          ErrorSeverity.MEDIUM
        )
      }

      // Check if user has access to the project
      let projectMember
      try {
        const { data, error } = await supabase
          .from('project_members')
          .select('role')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .single()

        if (error) {
          throw new Error(error.message)
        }

        projectMember = data
      } catch (error) {
        throw ErrorHandlingService.createError(
          ErrorType.STORAGE,
          'PROJECT_ACCESS_CHECK_FAILED',
          'Failed to verify project access',
          context,
          ErrorSeverity.HIGH,
          error instanceof Error ? error.message : undefined
        )
      }

      if (!projectMember) {
        throw ErrorHandlingService.createError(
          ErrorType.AUTHORIZATION,
          'PROJECT_ACCESS_DENIED',
          'Access denied to this project',
          context,
          ErrorSeverity.HIGH
        )
      }

      // Check storage quota
      try {
        const { data: storageUsage } = await supabase
          .from('assets')
          .select('file_size')
          .eq('project_id', projectId)

        if (storageUsage) {
          const totalUsage = storageUsage.reduce((sum, asset) => sum + (asset.file_size || 0), 0)
          const storageLimit = 1024 * 1024 * 1024 // 1GB per project
          
          if (totalUsage + file.size > storageLimit) {
            throw ErrorHandlingService.createError(
              ErrorType.QUOTA,
              'STORAGE_QUOTA_EXCEEDED',
              'Project storage quota exceeded',
              context,
              ErrorSeverity.HIGH
            )
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('STORAGE_QUOTA_EXCEEDED')) {
          throw error
        }
        // Log quota check failure but don't block upload
        console.warn('Failed to check storage quota:', error)
      }

      // Upload asset with enhanced error handling
      const result = await AssetManagerService.uploadAsset({
        projectId,
        folderId: folderId || undefined,
        file,
        generateThumbnail,
        resumeFrom
      })

      if (!result.success) {
        const errorType = result.error?.includes('validation') ? ErrorType.VALIDATION :
                         result.error?.includes('storage') ? ErrorType.STORAGE :
                         result.error?.includes('processing') ? ErrorType.PROCESSING :
                         ErrorType.UNKNOWN

        throw ErrorHandlingService.createError(
          errorType,
          'UPLOAD_FAILED',
          result.error || 'Upload failed',
          context,
          ErrorSeverity.HIGH
        )
      }

      return {
        success: true,
        asset: result.asset,
        validation: result.validation
      }
    },
    context
  ).then(result => {
    if (result.success) {
      return NextResponse.json(result.data)
    } else {
      const error = result.error!
      
      // Map error types to HTTP status codes
      const statusCode = error.type === ErrorType.AUTHENTICATION ? 401 :
                        error.type === ErrorType.AUTHORIZATION ? 403 :
                        error.type === ErrorType.VALIDATION ? 400 :
                        error.type === ErrorType.QUOTA ? 413 :
                        error.type === ErrorType.STORAGE ? 507 :
                        500

      return NextResponse.json({
        error: {
          id: error.id,
          type: error.type,
          code: error.code,
          message: error.userMessage,
          recoveryActions: error.recoveryActions,
          retryable: error.retryable
        }
      }, { status: statusCode })
    }
  })
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}