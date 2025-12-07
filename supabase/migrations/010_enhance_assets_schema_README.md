# Enhanced Assets Schema Migration (010)

This migration enhances the existing assets system with advanced functionality for metadata management, tagging, search capabilities, and access tracking.

## Changes Made

### 1. Enhanced Assets Table
- Added `description` field for asset descriptions
- Added `status` field with enum ('processing', 'ready', 'error')
- Added `preview_url` field for preview images
- Added `access_count` field to track usage
- Added `last_accessed_at` field for access tracking
- Added `checksum` field for file integrity verification

### 2. New Tables Created

#### asset_metadata
- Stores file-specific metadata (dimensions, duration, camera info, etc.)
- Supports extracted text from OCR/PDF processing
- Flexible JSONB field for additional metadata

#### tags
- Global tag management system
- Color-coded tags with descriptions
- Tracks tag creators

#### asset_tags
- Many-to-many relationship between assets and tags
- Tracks who tagged what and when

#### asset_search_index
- Optimized full-text search capabilities
- Includes searchable content, file types, and denormalized tags
- Uses PostgreSQL's tsvector for efficient text search

### 3. Performance Indexes
- GIN indexes for full-text search
- Indexes on frequently queried fields (status, access_count, etc.)
- Composite indexes for common query patterns

### 4. Functions Created

#### search_assets()
- Full-text search with filtering by project, file type, and tags
- Returns ranked results with pagination support
- Respects user permissions via RLS

#### get_asset_with_metadata()
- Returns complete asset information with metadata and tags
- Single query for all asset-related data
- JSON aggregation for efficient data transfer

### 5. Triggers and Automation
- Automatic search index updates when assets/metadata/tags change
- Access count increment functionality
- Updated_at triggers for all new tables

### 6. Row Level Security (RLS)
- All new tables have appropriate RLS policies
- Maintains existing permission model
- Uses session variables for efficient role checking

### 7. Data Migration
- Existing assets are automatically indexed for search
- No data loss during migration
- Backward compatibility maintained

## Requirements Addressed

This migration addresses the following requirements from the spec:

- **Requirement 2.3**: Asset metadata and tagging system
- **Requirement 2.4**: Comprehensive file information storage
- **Requirement 4.1**: Full-text search capabilities
- **Requirement 4.2**: Advanced filtering and search
- **Requirement 4.3**: Content-based search with text extraction

## Testing

The migration includes:
- Verification queries to ensure all components are created
- Data integrity checks
- Performance index validation
- RLS policy verification

## Usage Examples

### Search Assets
```sql
SELECT * FROM search_assets(
  'design mockup',           -- search query
  ARRAY['project-uuid']::UUID[], -- project filter
  ARRAY['image/png'],        -- file type filter
  ARRAY['ui', 'mockup'],     -- tag filter
  20,                        -- limit
  0                          -- offset
);
```

### Get Asset with Full Metadata
```sql
SELECT * FROM get_asset_with_metadata('asset-uuid');
```

### Add Tags to Asset
```sql
-- Create tag
INSERT INTO tags (name, color, description) 
VALUES ('ui-design', '#3B82F6', 'UI Design Assets');

-- Tag asset
INSERT INTO asset_tags (asset_id, tag_id, tagged_by)
VALUES ('asset-uuid', 'tag-uuid', auth.uid());
```

## Performance Considerations

- Search queries use GIN indexes for optimal performance
- Denormalized tags in search index for faster filtering
- Automatic index maintenance via triggers
- Efficient JSON aggregation for metadata retrieval

## Security

- All tables protected by Row Level Security
- Permission inheritance from project membership
- Secure functions with SECURITY DEFINER where needed
- Audit trail for tag assignments and access tracking