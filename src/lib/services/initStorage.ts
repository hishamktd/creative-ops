import { StorageService } from './storage'

/**
 * Initialize Supabase Storage for the enhanced assets system
 * This should be run once during application setup
 */
export async function initializeStorage(): Promise<void> {
  try {
    console.log('Initializing Supabase Storage...')
    
    // Initialize storage buckets
    await StorageService.initializeBuckets()
    
    console.log('✅ Supabase Storage initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize Supabase Storage:', error)
    throw error
  }
}

/**
 * Verify storage configuration
 */
export async function verifyStorageSetup(): Promise<boolean> {
  try {
    console.log('Verifying storage setup...')
    
    // Test file operations
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' })
    const testPath = 'test/verification.txt'
    
    // Test upload
    const uploadResult = await StorageService.uploadFile({
      bucket: 'assets',
      path: testPath,
      file: testFile
    })
    
    if (!uploadResult.success) {
      console.error('Upload test failed:', uploadResult.error)
      return false
    }
    
    // Test signed URL generation
    const signedUrl = await StorageService.getSignedUrl(testPath, 60)
    if (!signedUrl) {
      console.error('Signed URL generation failed')
      return false
    }
    
    // Test file listing
    const files = await StorageService.listFiles('test')
    if (!files) {
      console.error('File listing failed')
      return false
    }
    
    // Clean up test file
    await StorageService.deleteFile(testPath)
    
    console.log('✅ Storage verification completed successfully')
    return true
  } catch (error) {
    console.error('❌ Storage verification failed:', error)
    return false
  }
}

/**
 * Setup storage policies (to be run with admin privileges)
 */
export const STORAGE_POLICIES = {
  // RLS policies for the assets bucket
  policies: [
    {
      name: 'Users can upload assets to their projects',
      definition: `
        CREATE POLICY "Users can upload assets to their projects" ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = 'assets' AND
          auth.uid() IS NOT NULL AND
          (storage.foldername(name))[1] = 'projects' AND
          EXISTS (
            SELECT 1 FROM project_members pm
            JOIN projects p ON p.id = pm.project_id
            WHERE p.id = (storage.foldername(name))[2]::uuid
            AND pm.user_id = auth.uid()
          )
        );
      `
    },
    {
      name: 'Users can view assets from their projects',
      definition: `
        CREATE POLICY "Users can view assets from their projects" ON storage.objects
        FOR SELECT USING (
          bucket_id = 'assets' AND
          auth.uid() IS NOT NULL AND
          (storage.foldername(name))[1] = 'projects' AND
          EXISTS (
            SELECT 1 FROM project_members pm
            JOIN projects p ON p.id = pm.project_id
            WHERE p.id = (storage.foldername(name))[2]::uuid
            AND pm.user_id = auth.uid()
          )
        );
      `
    },
    {
      name: 'Users can update assets in their projects',
      definition: `
        CREATE POLICY "Users can update assets in their projects" ON storage.objects
        FOR UPDATE USING (
          bucket_id = 'assets' AND
          auth.uid() IS NOT NULL AND
          (storage.foldername(name))[1] = 'projects' AND
          EXISTS (
            SELECT 1 FROM project_members pm
            JOIN projects p ON p.id = pm.project_id
            WHERE p.id = (storage.foldername(name))[2]::uuid
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'member')
          )
        );
      `
    },
    {
      name: 'Users can delete assets from their projects',
      definition: `
        CREATE POLICY "Users can delete assets from their projects" ON storage.objects
        FOR DELETE USING (
          bucket_id = 'assets' AND
          auth.uid() IS NOT NULL AND
          (storage.foldername(name))[1] = 'projects' AND
          EXISTS (
            SELECT 1 FROM project_members pm
            JOIN projects p ON p.id = pm.project_id
            WHERE p.id = (storage.foldername(name))[2]::uuid
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'member')
          )
        );
      `
    }
  ],
  
  // Storage bucket configuration
  bucketConfig: {
    name: 'assets',
    public: false,
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/webm', 'video/mov', 'video/avi',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'text/csv', 'application/json',
      'audio/mpeg', 'audio/wav', 'audio/ogg'
    ],
    fileSizeLimit: 100 * 1024 * 1024, // 100MB
    transformations: {
      allowedTransformations: ['resize', 'crop', 'rotate'],
      maxWidth: 4000,
      maxHeight: 4000
    }
  }
}

/**
 * Generate SQL for setting up storage policies
 */
export function generateStoragePolicySQL(): string {
  return STORAGE_POLICIES.policies
    .map(policy => policy.definition.trim())
    .join('\n\n')
}