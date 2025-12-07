# Enhanced Assets Storage System

This directory contains the implementation of the Enhanced Assets Storage System for CreativeOps, providing production-ready file management with advanced security, validation, and processing capabilities.

## 🏗️ Architecture Overview

The storage system is built with a modular architecture consisting of several key services:

```
┌─────────────────────────────────────────────────────────────┐
│                    Asset Manager Service                    │
│  (Orchestrates all operations, handles business logic)     │
└─────────────────┬───────────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐    ┌────▼────┐   ┌────▼────────┐
│Storage│    │Thumbnail│   │File         │
│Service│    │Service  │   │Validation   │
│       │    │         │   │Service      │
└───────┘    └─────────┘   └─────────────┘
```

## 📁 File Structure

```
src/lib/services/
├── storage.ts              # Core storage operations with Supabase
├── thumbnail.ts            # Automatic thumbnail generation
├── fileValidation.ts       # Comprehensive file validation & security
├── assetManager.ts         # High-level asset management
├── initStorage.ts          # Storage initialization & setup
├── demo.ts                 # Usage examples and demonstrations
├── __tests__/              # Comprehensive test suite
│   ├── storage.test.ts
│   ├── fileValidation.test.ts
│   ├── assetManager.test.ts
│   └── storage.integration.test.ts
└── README.md               # This file
```

## 🚀 Key Features

### 1. **Secure File Storage**
- Integration with Supabase Storage
- Private buckets with Row Level Security (RLS)
- Secure signed URLs with expiration
- Automatic file organization by project/folder structure

### 2. **Advanced File Validation**
- MIME type validation with magic number checking
- File extension security filtering
- Size limits and quota management
- Malware signature detection
- Content scanning for suspicious patterns

### 3. **Automatic Processing**
- Thumbnail generation for images and videos
- Metadata extraction (EXIF, dimensions, duration)
- Text extraction from documents for search indexing
- Checksum calculation for integrity verification

### 4. **Performance Optimization**
- Chunked upload support for large files
- Progress tracking and cancellation
- Lazy loading and caching strategies
- CDN integration ready

### 5. **Security Features**
- File type whitelisting
- Extension-based blocking
- Content scanning
- Audit logging
- Access control integration

## 🔧 Usage Examples

### Basic File Upload

```typescript
import { AssetManagerService } from '@/lib/services/assetManager'

const uploadAsset = async (file: File, projectId: string) => {
  const result = await AssetManagerService.uploadAsset({
    projectId,
    folderId: 'optional-folder-id',
    file,
    onProgress: (progress) => console.log(`Upload: ${progress}%`),
    generateThumbnail: true
  })

  if (result.success) {
    console.log('Asset uploaded:', result.asset)
  } else {
    console.error('Upload failed:', result.error)
  }
}
```

### File Validation

```typescript
import { FileValidationService } from '@/lib/services/fileValidation'

const validateFile = async (file: File) => {
  const result = await FileValidationService.validateFile(file)
  
  if (!result.isValid) {
    console.error('Validation errors:', result.errors)
    console.warn('Security flags:', result.securityFlags)
  }
  
  return result.isValid
}
```

### Generate Secure Download URL

```typescript
import { AssetManagerService } from '@/lib/services/assetManager'

const getDownloadUrl = async (assetId: string) => {
  const url = await AssetManagerService.getDownloadUrl(assetId, 3600) // 1 hour expiry
  return url
}
```

### Initialize Storage (Admin Only)

```typescript
import { initializeStorage } from '@/lib/services/initStorage'

// Run once during application setup
await initializeStorage()
```

## 🔒 Security Configuration

### Allowed File Types

The system supports the following file types by default:

**Images:** JPEG, PNG, GIF, WebP, SVG, BMP, TIFF  
**Videos:** MP4, WebM, MOV, AVI, MKV, WMV  
**Audio:** MP3, WAV, OGG, AAC, FLAC  
**Documents:** PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX  
**Text:** TXT, CSV, HTML, CSS, JS, TS, JSON, XML  
**Archives:** ZIP, RAR, 7Z, TAR  

### Blocked Extensions

For security, the following extensions are blocked:
`.exe`, `.bat`, `.cmd`, `.scr`, `.pif`, `.com`, `.msi`, `.dll`, `.sys`, `.vbs`, `.jar`, `.app`, `.deb`, `.rpm`, `.dmg`, `.pkg`, `.sh`, `.bash`, `.ps1`, `.psm1`

### File Size Limits

- Default maximum: 100MB per file
- Configurable per deployment
- Chunked upload support for large files

## 🗄️ Database Schema

The enhanced asset system requires the following database fields:

```sql
-- Enhanced assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS file_path TEXT NOT NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS preview_url TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ready';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS checksum TEXT;
```

## 🧪 Testing

The system includes comprehensive tests covering:

- **Unit Tests:** Individual service functionality
- **Integration Tests:** Service interactions
- **Security Tests:** Validation and security features
- **Performance Tests:** Upload and processing performance

Run tests with:
```bash
pnpm test:run src/lib/services/__tests__/
```

## 🚀 API Endpoints

### Storage Initialization
- `POST /api/storage/init` - Initialize storage buckets (Admin only)
- `GET /api/storage/init` - Check storage status

### Asset Management
- `POST /api/assets/upload` - Upload new assets
- `GET /api/assets/[id]/download` - Get secure download URLs
- `PUT /api/assets/[id]` - Update asset metadata
- `DELETE /api/assets/[id]` - Delete assets

## 🔧 Configuration

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Storage Policies

The system requires specific RLS policies for security. See `initStorage.ts` for the complete policy definitions.

## 📈 Performance Considerations

1. **Upload Optimization**
   - Files under 1MB: Direct upload
   - Files over 1MB: Chunked upload with progress tracking
   - Automatic retry with exponential backoff

2. **Thumbnail Generation**
   - Asynchronous processing
   - Multiple size variants
   - Format optimization (WebP when supported)

3. **Caching Strategy**
   - Signed URLs cached for performance
   - Metadata cached in database
   - CDN integration for global delivery

## 🔄 Migration from Basic System

To migrate from the basic asset system:

1. Run database migrations to add new columns
2. Initialize storage buckets with `POST /api/storage/init`
3. Update frontend components to use new services
4. Migrate existing files to new storage structure

## 🐛 Troubleshooting

### Common Issues

1. **Upload Failures**
   - Check file size limits
   - Verify MIME type is allowed
   - Ensure user has project access

2. **Thumbnail Generation Issues**
   - Verify file is a supported image/video format
   - Check browser compatibility for canvas operations
   - Ensure sufficient memory for large files

3. **Permission Errors**
   - Verify RLS policies are correctly configured
   - Check user project membership
   - Ensure service role key has proper permissions

### Debug Mode

Enable debug logging by setting:
```typescript
// In your component or service
console.log('Storage debug mode enabled')
```

## 🤝 Contributing

When contributing to the storage system:

1. Add tests for new functionality
2. Update this README for new features
3. Follow the existing code patterns
4. Ensure security best practices
5. Test with various file types and sizes

## 📄 License

This storage system is part of the CreativeOps project and follows the same license terms.