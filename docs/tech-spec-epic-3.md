# Tech Spec: Epic 3 - Photo Sharing & Albums

**Epic ID:** Epic 3
**Priority:** High (MVP)
**Story Points:** 13
**Estimated Duration:** 2 weeks
**Dependencies:** Epic 7 (E2EE), Epic 1 (Authentication)

---

## 1. Epic Overview

Photo sharing and organization is a core family feature. Family members can upload photos with captions, organize them into custom folders, and engage with photos through likes and comments. All photos are encrypted end-to-end before upload, ensuring privacy while maintaining usability through efficient lazy loading and thumbnail generation.

**User Stories:**

- **US-3.1:** As a family member, I want to upload photos with captions so that I can share memories
  - **AC1:** Click upload button
  - **AC2:** Select photo from device
  - **AC3:** Add optional caption
  - **AC4:** Photo appears in selected folder
  - **AC5:** All family members can view
  - **AC6:** Photo encrypted before upload

- **US-3.2:** As a family member, I want to organize photos into folders so that I can find them easily
  - **AC1:** Create custom folders with names and icons
  - **AC2:** Move photos between folders
  - **AC3:** View photos filtered by folder
  - **AC4:** Delete empty folders

- **US-3.3:** As a family member, I want to like and comment on photos so that I can engage with shared memories
  - **AC1:** Click heart to like photo
  - **AC2:** See count and names of likers
  - **AC3:** Add text comments
  - **AC4:** Comments threaded under photo

- **US-3.4:** As a family member, I want photos to load quickly so that browsing is smooth
  - **AC1:** Thumbnail grid loads < 3 seconds
  - **AC2:** Lazy loading for large albums
  - **AC3:** Full-size image loads on click < 2 seconds

---

## 2. Architecture Components

### 2.1 Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Photos Screen** | `app/(dashboard)/photos/page.tsx` | Main photo browsing interface |
| **Photo Grid** | `components/photos/photo-grid.tsx` | Thumbnail grid view with lazy loading |
| **Photo Detail** | `components/photos/photo-detail.tsx` | Full-size photo with likes/comments |
| **Photo Upload** | `components/photos/photo-upload.tsx` | Upload dialog with caption input |
| **Folder Selector** | `components/photos/folder-selector.tsx` | Sidebar folder navigation |
| **Like Button** | `components/photos/like-button.tsx` | Heart icon with like count |
| **Comment List** | `components/photos/comment-list.tsx` | Threaded comment display |
| **Comment Form** | `components/photos/comment-form.tsx` | Add comment input |

### 2.2 Backend API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/photos` | GET | Fetch photos (paginated by folder) |
| `POST /api/photos/upload-url` | POST | Generate presigned upload URL |
| `POST /api/photos` | POST | Create photo metadata after upload |
| `DELETE /api/photos/:id` | DELETE | Delete photo and storage blob |
| `PATCH /api/photos/:id` | PATCH | Move photo to different folder |
| `POST /api/photos/:id/like` | POST | Toggle like on photo |
| `DELETE /api/photos/:id/like` | DELETE | Remove like from photo |
| `GET /api/photos/:id/comments` | GET | Fetch photo comments |
| `POST /api/photos/:id/comments` | POST | Add comment to photo |
| `DELETE /api/comments/:id` | DELETE | Delete own comment |
| `GET /api/folders` | GET | Fetch family's photo folders |
| `POST /api/folders` | POST | Create new folder |
| `PATCH /api/folders/:id` | PATCH | Rename folder |
| `DELETE /api/folders/:id` | DELETE | Delete empty folder |

### 2.3 Database Tables

```sql
-- Photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES photo_folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- Supabase Storage path: family_id/photo_id.enc
  encrypted_caption TEXT, -- AES-256-GCM ciphertext
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  likes JSONB DEFAULT '[]', -- Array of user_ids: ["uuid1", "uuid2"]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_folder_id ON photos(folder_id);
CREATE INDEX idx_photos_uploaded_at ON photos(uploaded_at DESC);
CREATE INDEX idx_photos_user_id ON photos(user_id);

-- Photo comments table
CREATE TABLE photo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_comment TEXT NOT NULL, -- AES-256-GCM ciphertext
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photo_comments_photo_id ON photo_comments(photo_id);
CREATE INDEX idx_photo_comments_timestamp ON photo_comments(timestamp DESC);

-- Photo folders table
CREATE TABLE photo_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(10), -- Emoji (e.g., "📷", "🎉", "🏖️")
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_default BOOLEAN DEFAULT FALSE -- "All Photos" folder
);

CREATE INDEX idx_photo_folders_family_id ON photo_folders(family_id);

-- Insert default folder on family creation
CREATE OR REPLACE FUNCTION create_default_photo_folder()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO photo_folders (family_id, name, icon, created_by, is_default)
  VALUES (NEW.id, 'All Photos', '📷', NEW.created_by, TRUE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_photo_folder
  AFTER INSERT ON families
  FOR EACH ROW
  EXECUTE FUNCTION create_default_photo_folder();
```

### 2.4 Storage Architecture

**Supabase Storage:**
- Bucket: `family-photos` (private)
- Path structure: `{family_id}/{photo_id}.enc`
- All blobs are encrypted (see Epic 7)
- Presigned URLs for upload/download (1-hour expiry)

**Storage Policies:**
```sql
-- Enable RLS on storage bucket
CREATE POLICY "Users can upload photos to their family folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'family-photos' AND
    (storage.foldername(name))[1] = (
      SELECT family_id::text FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can download their family's photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'family-photos' AND
    (storage.foldername(name))[1] = (
      SELECT family_id::text FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'family-photos' AND
    (storage.foldername(name))[1] = (
      SELECT family_id::text FROM users WHERE id = auth.uid()
    )
  );
```

---

## 3. Implementation Details

### 3.1 Database Schema (Detailed)

#### Photos Table with RLS

```sql
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their family's photos
CREATE POLICY "Users can read family photos"
  ON photos FOR SELECT
  USING (
    folder_id IN (
      SELECT id FROM photo_folders WHERE family_id = (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can upload photos to their family folders
CREATE POLICY "Users can upload photos"
  ON photos FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    folder_id IN (
      SELECT id FROM photo_folders WHERE family_id = (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can update their own photos (move to different folder)
CREATE POLICY "Users can update own photos"
  ON photos FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own photos
CREATE POLICY "Users can delete own photos"
  ON photos FOR DELETE
  USING (user_id = auth.uid());
```

#### Photo Comments Table with RLS

```sql
ALTER TABLE photo_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read comments on their family's photos
CREATE POLICY "Users can read family photo comments"
  ON photo_comments FOR SELECT
  USING (
    photo_id IN (
      SELECT id FROM photos WHERE folder_id IN (
        SELECT id FROM photo_folders WHERE family_id = (
          SELECT family_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Policy: Users can add comments to their family's photos
CREATE POLICY "Users can comment on family photos"
  ON photo_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    photo_id IN (
      SELECT id FROM photos WHERE folder_id IN (
        SELECT id FROM photo_folders WHERE family_id = (
          SELECT family_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON photo_comments FOR DELETE
  USING (user_id = auth.uid());
```

#### Photo Folders Table with RLS

```sql
ALTER TABLE photo_folders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their family's folders
CREATE POLICY "Users can read family folders"
  ON photo_folders FOR SELECT
  USING (
    family_id = (SELECT family_id FROM users WHERE id = auth.uid())
  );

-- Policy: Users can create folders in their family
CREATE POLICY "Users can create folders"
  ON photo_folders FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    family_id = (SELECT family_id FROM users WHERE id = auth.uid())
  );

-- Policy: Users can update their own folders
CREATE POLICY "Users can update own folders"
  ON photo_folders FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own non-default folders
CREATE POLICY "Users can delete own folders"
  ON photo_folders FOR DELETE
  USING (created_by = auth.uid() AND is_default = FALSE);
```

### 3.2 API Contracts

#### POST /api/photos/upload-url

**Authentication:** Required (JWT)

**Request Schema (Zod):**
```typescript
import { z } from 'zod';

export const uploadUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024, 'File too large (max 50MB)'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/heic', 'image/webp'], {
    errorMap: () => ({ message: 'Unsupported file type' }),
  }),
  folderId: z.string().uuid('Invalid folder ID'),
});

export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;
```

**Response Schema:**
```typescript
type UploadUrlResponse = {
  uploadUrl: string; // Presigned URL for direct upload to Supabase Storage
  storagePath: string; // Path: family_id/photo_id.enc
  photoId: string; // Pre-generated UUID for photo metadata
};
```

**Error Responses:**
- 400: Invalid input (file too large, unsupported type)
- 401: Not authenticated
- 403: User not in folder's family
- 500: Failed to generate presigned URL

**Rate Limiting:** 20 uploads per hour per user

**Implementation Logic:**
1. Validate JWT and input
2. Verify user belongs to folder's family
3. Generate unique photo ID
4. Create storage path: `{family_id}/{photo_id}.enc`
5. Generate presigned upload URL (1-hour expiry)
6. Return URL and metadata

```typescript
// app/api/photos/upload-url/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { uploadUrlSchema } from '@/lib/validators/photos';

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  // Verify auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse and validate input
  const body = await request.json();
  const result = uploadUrlSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
  }

  const { folderId, fileName, fileSize, mimeType } = result.data;

  // Verify folder belongs to user's family
  const { data: folder } = await supabase
    .from('photo_folders')
    .select('family_id')
    .eq('id', folderId)
    .single();

  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  const { data: userFamily } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (folder.family_id !== userFamily?.family_id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Generate photo ID and storage path
  const photoId = crypto.randomUUID();
  const storagePath = `${folder.family_id}/${photoId}.enc`;

  // Generate presigned upload URL
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('family-photos')
    .createSignedUploadUrl(storagePath);

  if (uploadError) {
    console.error('Failed to generate upload URL:', uploadError);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }

  return NextResponse.json({
    uploadUrl: uploadData.signedUrl,
    storagePath,
    photoId,
  });
}
```

---

#### POST /api/photos

**Authentication:** Required (JWT)

**Request Schema (Zod):**
```typescript
export const createPhotoSchema = z.object({
  photoId: z.string().uuid('Invalid photo ID'),
  folderId: z.string().uuid('Invalid folder ID'),
  storagePath: z.string().min(1, 'Storage path is required'),
  encryptedCaption: z.string().optional(), // Base64 ciphertext
});

export type CreatePhotoInput = z.infer<typeof createPhotoSchema>;
```

**Response Schema:**
```typescript
type CreatePhotoResponse = {
  photo: {
    id: string;
    folderId: string;
    userId: string;
    storagePath: string;
    encryptedCaption: string | null;
    uploadedAt: string;
    likes: string[]; // Empty array initially
    user: {
      name: string;
      avatar: string | null;
    };
  };
};
```

**Error Responses:**
- 400: Invalid input
- 401: Not authenticated
- 403: User not in folder's family
- 500: Server error

**Rate Limiting:** None (upload already rate-limited)

**Implementation Logic:**
1. Validate JWT and input
2. Verify user uploaded file to storage (check storage path exists)
3. Create photo metadata in database
4. Return photo record

---

#### GET /api/photos

**Authentication:** Required (JWT)

**Query Parameters (Zod):**
```typescript
export const photosQuerySchema = z.object({
  folderId: z.string().uuid('Invalid folder ID').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PhotosQuery = z.infer<typeof photosQuerySchema>;
```

**Response Schema:**
```typescript
type PhotosResponse = {
  photos: Array<{
    id: string;
    folderId: string;
    userId: string;
    storagePath: string;
    encryptedCaption: string | null;
    uploadedAt: string;
    likes: string[]; // Array of user IDs
    user: {
      id: string;
      name: string;
      avatar: string | null;
    };
    downloadUrl: string; // Presigned download URL (1-hour expiry)
  }>;
  hasMore: boolean;
  total: number;
};
```

**Error Responses:**
- 400: Invalid query parameters
- 401: Not authenticated
- 403: User not in folder's family
- 500: Server error

**Rate Limiting:** None (read-only, frequently called)

**Implementation Logic:**
1. Validate JWT and query params
2. If folderId provided, verify user has access to folder
3. Fetch photos with pagination (limit + 1 to check hasMore)
4. For each photo, generate presigned download URL
5. Return photos with hasMore flag

```typescript
// app/api/photos/route.ts
export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('photos')
    .select(`
      *,
      user:users(id, name, avatar)
    `, { count: 'exact' })
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit);

  if (folderId) {
    query = query.eq('folder_id', folderId);
  }

  const { data: photos, error, count } = await query;

  if (error) {
    console.error('Failed to fetch photos:', error);
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 });
  }

  // Generate presigned download URLs
  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const { data: urlData } = await supabase.storage
        .from('family-photos')
        .createSignedUrl(photo.storage_path, 3600); // 1-hour expiry

      return {
        ...photo,
        downloadUrl: urlData?.signedUrl || '',
      };
    })
  );

  return NextResponse.json({
    photos: photosWithUrls,
    hasMore: (count || 0) > offset + limit,
    total: count || 0,
  });
}
```

---

#### POST /api/photos/:id/like

**Authentication:** Required (JWT)

**Request Schema:** None (like is from current user)

**Response Schema:**
```typescript
type LikePhotoResponse = {
  photo: {
    id: string;
    likes: string[]; // Updated likes array
  };
};
```

**Error Responses:**
- 401: Not authenticated
- 404: Photo not found
- 500: Server error

**Rate Limiting:** None

**Implementation Logic:**
1. Validate JWT
2. Fetch photo record
3. Check if user already liked (JSONB array contains user ID)
4. If liked: remove user ID from array (unlike)
5. If not liked: add user ID to array (like)
6. Update photo record
7. Return updated likes array

```typescript
// app/api/photos/[id]/like/route.ts
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch photo
  const { data: photo, error: fetchError } = await supabase
    .from('photos')
    .select('likes')
    .eq('id', params.id)
    .single();

  if (fetchError || !photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  const likes = (photo.likes as string[]) || [];
  const hasLiked = likes.includes(user.id);

  // Toggle like
  const updatedLikes = hasLiked
    ? likes.filter((id) => id !== user.id)
    : [...likes, user.id];

  // Update photo
  const { data: updatedPhoto, error: updateError } = await supabase
    .from('photos')
    .update({ likes: updatedLikes })
    .eq('id', params.id)
    .select('id, likes')
    .single();

  if (updateError) {
    console.error('Failed to update likes:', updateError);
    return NextResponse.json({ error: 'Failed to update likes' }, { status: 500 });
  }

  return NextResponse.json({ photo: updatedPhoto });
}
```

---

#### POST /api/photos/:id/comments

**Authentication:** Required (JWT)

**Request Schema (Zod):**
```typescript
export const createCommentSchema = z.object({
  encryptedComment: z.string().min(1, 'Comment cannot be empty'),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
```

**Response Schema:**
```typescript
type CreateCommentResponse = {
  comment: {
    id: string;
    photoId: string;
    userId: string;
    encryptedComment: string;
    timestamp: string;
    user: {
      name: string;
      avatar: string | null;
    };
  };
};
```

**Error Responses:**
- 400: Invalid input
- 401: Not authenticated
- 404: Photo not found
- 500: Server error

**Rate Limiting:** 60 comments per hour per user

**Implementation Logic:**
1. Validate JWT and input (comment already encrypted by client)
2. Verify photo exists and user has access
3. Insert comment into database
4. Return comment record with user info

---

### 3.3 Component Implementation Guide

#### Component: Photo Upload

**File:** `components/photos/photo-upload.tsx`

**Props:**
```typescript
interface PhotoUploadProps {
  folderId: string;
  onUploadComplete: (photo: Photo) => void;
}
```

**State Management:**
```typescript
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [caption, setCaption] = useState('');
const [uploading, setUploading] = useState(false);
const [progress, setProgress] = useState(0);
```

**Key Functions:**
- `handleFileSelect(file)` - Validate file type and size
- `handleUpload()` - Encrypt, upload, create metadata
- `uploadToStorage(encryptedBlob, uploadUrl)` - Direct upload with progress

**Integration Points:**
- API: `/api/photos/upload-url`, `/api/photos`
- E2EE: `encryptFile()` (Epic 7)
- Storage: Direct upload to Supabase Storage

**Implementation:**
```tsx
'use client';

import { useState } from 'react';
import { useFamilyKey } from '@/lib/hooks/use-family-key';
import { encryptFile, encryptMessage } from '@/lib/e2ee/encryption';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

export function PhotoUpload({ folderId, onUploadComplete }: PhotoUploadProps) {
  const { familyKey } = useFamilyKey();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Unsupported file type. Please upload JPEG, PNG, HEIC, or WebP.');
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 50MB.');
      return;
    }

    setSelectedFile(file);
    setOpen(true);
  };

  const handleUpload = async () => {
    if (!selectedFile || !familyKey) return;

    setUploading(true);
    setProgress(0);

    try {
      // Step 1: Get presigned upload URL
      const urlResponse = await fetch('/api/photos/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          folderId,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, storagePath, photoId } = await urlResponse.json();

      setProgress(20);

      // Step 2: Encrypt file
      const encryptedBlob = await encryptFile(selectedFile, familyKey);
      setProgress(40);

      // Step 3: Upload encrypted blob to storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: encryptedBlob,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload photo');
      }

      setProgress(70);

      // Step 4: Encrypt caption
      let encryptedCaption;
      if (caption.trim()) {
        encryptedCaption = await encryptMessage(caption, familyKey);
      }

      setProgress(80);

      // Step 5: Create photo metadata
      const metadataResponse = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId,
          folderId,
          storagePath,
          encryptedCaption,
        }),
      });

      if (!metadataResponse.ok) {
        throw new Error('Failed to save photo metadata');
      }

      const { photo } = await metadataResponse.json();

      setProgress(100);

      toast.success('Photo uploaded successfully!');
      onUploadComplete(photo);

      // Reset state
      setSelectedFile(null);
      setCaption('');
      setOpen(false);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <>
      <Button onClick={() => document.getElementById('photo-input')?.click()}>
        Upload Photo
      </Button>
      <input
        id="photo-input"
        type="file"
        accept="image/jpeg,image/png,image/heic,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Photo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedFile && (
              <div>
                <Label>Preview</Label>
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="caption">Caption (optional)</Label>
              <Input
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption..."
                disabled={uploading}
              />
            </div>

            {uploading && (
              <div>
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground mt-2">
                  Uploading... {progress}%
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

#### Component: Photo Grid

**File:** `components/photos/photo-grid.tsx`

**Props:**
```typescript
interface PhotoGridProps {
  folderId?: string;
}
```

**State Management:**
```typescript
const [photos, setPhotos] = useState<Photo[]>([]);
const [loading, setLoading] = useState(true);
const [hasMore, setHasMore] = useState(true);
const [decryptedPhotos, setDecryptedPhotos] = useState<Map<string, string>>(new Map());
```

**Key Functions:**
- `fetchPhotos(offset)` - Load photos from API
- `decryptPhotos(photos)` - Decrypt captions and photo blobs
- `handleScroll()` - Lazy load more photos on scroll

**Integration Points:**
- API: `/api/photos`
- E2EE: `decryptMessage()`, `decryptFile()` (Epic 7)
- Virtualization: `react-window` for performance

**Implementation:**
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useFamilyKey } from '@/lib/hooks/use-family-key';
import { decryptFile, decryptMessage } from '@/lib/e2ee/encryption';
import { PhotoDetail } from './photo-detail';

export function PhotoGrid({ folderId }: PhotoGridProps) {
  const { familyKey } = useFamilyKey();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [decryptedPhotos, setDecryptedPhotos] = useState<Map<string, string>>(new Map());
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    fetchPhotos();
  }, [folderId]);

  const fetchPhotos = async () => {
    try {
      const query = new URLSearchParams({
        limit: '50',
        offset: offset.toString(),
        ...(folderId && { folderId }),
      });

      const response = await fetch(`/api/photos?${query}`);
      const data = await response.json();

      setPhotos((prev) => [...prev, ...data.photos]);
      setHasMore(data.hasMore);
      setOffset((prev) => prev + 50);

      // Decrypt photos in background
      decryptPhotos(data.photos);
    } catch (error) {
      console.error('Failed to fetch photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const decryptPhotos = async (newPhotos: Photo[]) => {
    if (!familyKey) return;

    for (const photo of newPhotos) {
      try {
        // Download encrypted blob
        const response = await fetch(photo.downloadUrl);
        const encryptedBlob = await response.blob();

        // Decrypt blob
        const decryptedBlob = await decryptFile(encryptedBlob, familyKey);
        const objectUrl = URL.createObjectURL(decryptedBlob);

        setDecryptedPhotos((prev) => new Map(prev).set(photo.id, objectUrl));
      } catch (error) {
        console.error(`Failed to decrypt photo ${photo.id}:`, error);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {photos.map((photo) => {
          const decryptedUrl = decryptedPhotos.get(photo.id);

          return (
            <div
              key={photo.id}
              className="aspect-square cursor-pointer hover:opacity-80 transition"
              onClick={() => setSelectedPhoto(photo)}
            >
              {decryptedUrl ? (
                <img
                  src={decryptedUrl}
                  alt="Photo"
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <div className="w-full h-full bg-muted animate-pulse rounded" />
              )}
            </div>
          );
        })}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button onClick={fetchPhotos}>Load More</Button>
        </div>
      )}

      {selectedPhoto && (
        <PhotoDetail
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          decryptedUrl={decryptedPhotos.get(selectedPhoto.id)}
        />
      )}
    </div>
  );
}
```

---

### 3.4 Business Logic (lib/)

#### Module: Photo Utilities

**File:** `lib/photos/utils.ts`

**Exports:**
```typescript
export function validatePhotoFile(file: File): { valid: boolean; error?: string };
export function generatePhotoThumbnail(blob: Blob, maxSize: number): Promise<Blob>;
export async function getMIMETypeAfterDecryption(decryptedBlob: Blob): Promise<string>;
```

**Implementation:**
```typescript
/**
 * Validates photo file before upload.
 */
export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file type. Please upload JPEG, PNG, HEIC, or WebP.',
    };
  }

  if (file.size > 50 * 1024 * 1024) {
    return {
      valid: false,
      error: 'File too large. Maximum size is 50MB.',
    };
  }

  return { valid: true };
}

/**
 * Generates thumbnail from photo blob (client-side resize).
 * NOT USED IN MVP (thumbnails use same encrypted blob).
 * Included for Phase 2 optimization.
 */
export async function generatePhotoThumbnail(
  blob: Blob,
  maxSize: number = 300
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((thumbnailBlob) => {
        if (thumbnailBlob) {
          resolve(thumbnailBlob);
        } else {
          reject(new Error('Failed to generate thumbnail'));
        }
      }, 'image/jpeg', 0.8);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Detects MIME type after decryption (magic number detection).
 * Used by decryptFile() in Epic 7.
 */
export async function getMIMETypeAfterDecryption(decryptedBlob: Blob): Promise<string> {
  const arrayBuffer = await decryptedBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  // HEIC/HEIF
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'image/heic';
  }
  // WebP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }

  return 'image/jpeg'; // Default
}
```

---

## 4. Error Handling

### 4.1 Client-Side Errors

**File Upload Errors:**
- **Cause:** File too large, unsupported type, network failure
- **Handling:**
  ```typescript
  try {
    await handleUpload();
  } catch (error) {
    console.error('Upload failed:', error);
    toast.error('Failed to upload photo. Please check your connection and try again.');
  }
  ```

**File Decryption Errors:**
- **Cause:** Wrong key, corrupted blob, unsupported format
- **Handling:**
  ```typescript
  try {
    const decryptedBlob = await decryptFile(encryptedBlob, familyKey);
  } catch (error) {
    console.error('Decryption failed:', error);
    // Show placeholder image instead of crashing
    return '/images/photo-error-placeholder.png';
  }
  ```

**Storage Quota Errors:**
- **Cause:** User exceeds free tier storage (1GB)
- **Handling:**
  - Show error: "Storage full. Please contact admin to upgrade."
  - Admin sees storage usage in settings

### 4.2 API Errors

**Error Response Format:**
```typescript
type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};
```

**Common Errors:**
- `FILE_TOO_LARGE` (400) - Photo exceeds 50MB
- `UNSUPPORTED_TYPE` (400) - File type not supported
- `STORAGE_FULL` (403) - Family storage quota exceeded
- `PHOTO_NOT_FOUND` (404) - Photo does not exist
- `UPLOAD_FAILED` (500) - Storage service error

### 4.3 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Photo deleted while viewing** | Show "Photo no longer available", close detail view |
| **Folder deleted with photos in it** | Cascade delete photos (RLS policy enforces) |
| **User unliked photo twice (race condition)** | Check if user in likes array before removing |
| **Network interruption during upload** | Retry upload, show resume option |
| **Duplicate photo uploads** | Allow (no deduplication in MVP) |
| **HEIC photos on unsupported browsers** | Show error: "HEIC not supported. Please convert to JPEG or PNG." |

---

## 5. Testing Strategy

### 5.1 Unit Tests (Vitest)

**File:** `tests/unit/photos/validation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validatePhotoFile } from '@/lib/photos/utils';

describe('Photo Validation', () => {
  it('should accept valid JPEG file', () => {
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 }); // 5MB

    const result = validatePhotoFile(file);
    expect(result.valid).toBe(true);
  });

  it('should reject file larger than 50MB', () => {
    const file = new File([''], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 51 * 1024 * 1024 }); // 51MB

    const result = validatePhotoFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });

  it('should reject unsupported file types', () => {
    const file = new File([''], 'document.pdf', { type: 'application/pdf' });

    const result = validatePhotoFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unsupported file type');
  });
});
```

### 5.2 Integration Tests

**File:** `tests/integration/photos/upload-flow.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encryptFile } from '@/lib/e2ee/encryption';
import { generateFamilyKey } from '@/lib/e2ee/key-management';

describe('Photo Upload Flow Integration', () => {
  let supabase;
  let familyKey;
  let folderId;

  beforeAll(async () => {
    supabase = createSupabaseServerClient();
    const { familyKey: key } = await generateFamilyKey();
    familyKey = key;

    // Create test folder
    const { data: folder } = await supabase
      .from('photo_folders')
      .insert({ name: 'Test Folder', family_id: 'test-family' })
      .select()
      .single();
    folderId = folder.id;
  });

  it('should generate upload URL and upload photo', async () => {
    // Step 1: Get upload URL
    const response = await fetch('http://localhost:3000/api/photos/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        folderId,
      }),
    });

    expect(response.status).toBe(200);

    const { uploadUrl, storagePath, photoId } = await response.json();
    expect(uploadUrl).toBeTruthy();
    expect(storagePath).toMatch(/^[a-f0-9-]+\/[a-f0-9-]+\.enc$/);

    // Step 2: Encrypt and upload photo
    const fileContent = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
    const blob = new Blob([fileContent], { type: 'image/jpeg' });
    const encryptedBlob = await encryptFile(blob, familyKey);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: encryptedBlob,
      headers: { 'Content-Type': 'application/octet-stream' },
    });

    expect(uploadResponse.ok).toBe(true);

    // Step 3: Create photo metadata
    const metadataResponse = await fetch('http://localhost:3000/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photoId,
        folderId,
        storagePath,
      }),
    });

    expect(metadataResponse.status).toBe(200);

    const { photo } = await metadataResponse.json();
    expect(photo.id).toBe(photoId);
    expect(photo.storage_path).toBe(storagePath);
  });
});
```

### 5.3 E2E Tests (Playwright)

**File:** `tests/e2e/photos/photo-sharing.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Photo Sharing Flow', () => {
  test('should upload and view photo', async ({ page }) => {
    await page.goto('/photos');

    // Upload photo
    await page.click('button:text("Upload Photo")');
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/test-photo.jpg');
    await page.fill('[data-testid="photo-caption"]', 'Test photo caption');
    await page.click('button:text("Upload")');

    // Wait for upload to complete
    await expect(page.locator('text=Photo uploaded successfully')).toBeVisible();

    // Verify photo appears in grid
    await expect(page.locator('img[alt="Photo"]').first()).toBeVisible();

    // Click photo to view detail
    await page.locator('img[alt="Photo"]').first().click();

    // Verify caption is decrypted and displayed
    await expect(page.locator('text=Test photo caption')).toBeVisible();
  });

  test('should like photo', async ({ page }) => {
    await page.goto('/photos');

    // Open photo detail
    await page.locator('img[alt="Photo"]').first().click();

    // Like photo
    await page.click('button[aria-label="Like photo"]');

    // Verify like count updated
    await expect(page.locator('text=1 like')).toBeVisible();

    // Unlike photo
    await page.click('button[aria-label="Unlike photo"]');
    await expect(page.locator('text=0 likes')).toBeVisible();
  });

  test('should add comment to photo', async ({ page }) => {
    await page.goto('/photos');

    // Open photo detail
    await page.locator('img[alt="Photo"]').first().click();

    // Add comment
    await page.fill('[data-testid="comment-input"]', 'Beautiful photo!');
    await page.click('button:text("Post Comment")');

    // Verify comment appears
    await expect(page.locator('text=Beautiful photo!')).toBeVisible();
  });

  test('should organize photos into folders', async ({ page }) => {
    await page.goto('/photos');

    // Create new folder
    await page.click('button:text("New Folder")');
    await page.fill('[data-testid="folder-name"]', 'Vacation 2025');
    await page.fill('[data-testid="folder-icon"]', '🏖️');
    await page.click('button:text("Create")');

    // Verify folder appears in sidebar
    await expect(page.locator('text=Vacation 2025')).toBeVisible();

    // Upload photo to new folder
    await page.click('text=Vacation 2025');
    await page.click('button:text("Upload Photo")');
    // ... upload steps

    // Verify photo in correct folder
    await page.click('text=Vacation 2025');
    await expect(page.locator('img[alt="Photo"]')).toBeVisible();
  });
});
```

### 5.4 Acceptance Criteria Validation

| AC | Test Type | Validation Method |
|----|-----------|-------------------|
| **AC1.1-1.6:** Upload photo flow | E2E | Select file, add caption, verify upload success, check encryption |
| **AC2.1-2.4:** Folder operations | E2E | Create folder, move photo, delete folder |
| **AC3.1-3.4:** Likes and comments | E2E | Click like, add comment, verify count updates |
| **AC4.1-4.3:** Fast photo loading | Performance | Measure thumbnail grid load time (< 3s) |

---

## 6. Security Considerations

### 6.1 Photo Encryption

**All photos encrypted with AES-256-GCM (Epic 7):**
- Client encrypts before upload
- Storage contains encrypted blobs only
- Recipients download and decrypt locally

**Metadata Visible to Server:**
- Uploader ID, folder ID, timestamp (required for access control)
- Photo blob is ciphertext (server cannot view)

### 6.2 Storage Security

**Supabase Storage RLS:**
- Users can only upload to their family folder
- Users can only download their family's photos
- Presigned URLs have 1-hour expiry (limit leak window)

**Access Control:**
- RLS policies enforce family-level access on photos table
- Soft delete: Photos deleted from UI but recoverable (admin feature in Phase 2)

### 6.3 Caption Privacy

**Captions encrypted separately:**
- Stored as `encrypted_caption` (ciphertext)
- Decrypted client-side for display
- Server never sees plaintext captions

### 6.4 Rate Limiting

**Prevent abuse:**
- 20 uploads per hour per user
- 60 comments per hour per user
- No like rate limit (toggle operation, low cost)

---

## 7. Performance Targets

| Operation | Target Latency | Acceptable Max |
|-----------|---------------|----------------|
| **Thumbnail grid load (50 photos)** | < 2s | < 3s (NFR-2.3) |
| **Full-size photo load** | < 1s | < 2s |
| **Photo upload (10MB)** | < 3s | < 5s (NFR-2.2) |
| **Photo encryption (10MB)** | < 200ms | < 500ms |
| **Photo decryption (10MB)** | < 200ms | < 500ms |
| **Like photo** | < 100ms | < 300ms |
| **Post comment** | < 300ms | < 1s |

**Optimization Strategies:**
- Lazy loading: Load thumbnails on-demand (Intersection Observer API)
- Progressive rendering: Show placeholder while decrypting
- Parallel decryption: Decrypt visible photos concurrently (Promise.all)
- Cache decrypted blobs: Store in memory (Map) to avoid re-decryption
- Virtual scrolling: Use `react-window` for large photo grids (1000+ photos)

---

## 8. Implementation Checklist

### Week 1: Backend & Storage
- [ ] Create database tables (photos, photo_comments, photo_folders)
- [ ] Implement RLS policies for all tables
- [ ] Set up Supabase Storage bucket (family-photos)
- [ ] Implement storage RLS policies
- [ ] Implement POST /api/photos/upload-url (presigned URLs)
- [ ] Implement POST /api/photos (create metadata)
- [ ] Implement GET /api/photos (paginated fetch)
- [ ] Implement DELETE /api/photos/:id
- [ ] Implement POST /api/photos/:id/like (toggle like)
- [ ] Implement POST /api/photos/:id/comments
- [ ] Implement DELETE /api/comments/:id
- [ ] Implement GET /api/folders
- [ ] Implement POST /api/folders (create folder)
- [ ] Implement PATCH /api/folders/:id (rename)
- [ ] Implement DELETE /api/folders/:id
- [ ] Write unit tests for API routes (95% coverage)

### Week 2: Frontend & Integration
- [ ] Implement Photos Screen layout (folder sidebar + photo grid)
- [ ] Implement PhotoUpload component (file select, encrypt, upload)
- [ ] Implement PhotoGrid component (lazy loading, decryption)
- [ ] Implement PhotoDetail component (full-size view, likes, comments)
- [ ] Implement FolderSelector component (sidebar navigation)
- [ ] Implement LikeButton component (heart icon, toggle)
- [ ] Implement CommentList component (threaded display)
- [ ] Implement CommentForm component (add comment)
- [ ] Integrate E2EE encryption/decryption (Epic 7 functions)
- [ ] Implement lazy loading (Intersection Observer API)
- [ ] Implement cache for decrypted photos (Map)
- [ ] Test upload flow (encrypt → upload → metadata)
- [ ] Test download flow (fetch → decrypt → display)
- [ ] Write integration tests (upload, like, comment flows)
- [ ] Write E2E tests (Playwright scenarios)

### Week 2.5: Polish & Performance
- [ ] Optimize photo grid rendering (virtual scrolling)
- [ ] Implement upload progress indicator
- [ ] Implement error handling and retry logic
- [ ] Implement placeholder images during decryption
- [ ] Test on low-end devices (encryption performance)
- [ ] Performance testing (thumbnail load time benchmarks)
- [ ] Accessibility testing (keyboard navigation, alt text)

---

## 9. Dependencies & Risks

**Depends On:**
- Epic 7: E2EE file encryption/decryption functions
- Epic 1: Authentication (session management)

**Depended On By:**
- None

**Risks:**

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Supabase Storage quota exceeded (1GB free)** | High | Medium | Monitor usage, implement photo compression, upgrade to paid tier ($25/month for 100GB) |
| **File encryption performance on large photos** | Medium | Low | Benchmark on target devices, use Web Workers for background encryption |
| **HEIC photo format browser support** | Medium | Medium | Detect unsupported formats, show conversion instructions |
| **Photo decryption delays on slow devices** | Medium | Medium | Show progressive loading placeholders, optimize batch decryption |
| **Network interruption during upload** | Medium | Medium | Implement resume upload logic (multipart uploads in Phase 2) |

---

## 10. Acceptance Criteria

### US-3.1: Upload Photos with Captions

- [ ] User clicks "Upload Photo" button
- [ ] User selects photo from device (JPEG, PNG, HEIC, WebP)
- [ ] User adds optional caption
- [ ] Photo encrypts client-side (< 500ms for 10MB)
- [ ] Photo uploads to Supabase Storage (< 5s for 10MB)
- [ ] Photo appears in selected folder immediately
- [ ] All family members can view photo
- [ ] Network logs show encrypted blob only (no plaintext image)
- [ ] Database shows encrypted caption (ciphertext)

### US-3.2: Organize Photos into Folders

- [ ] User clicks "New Folder" button
- [ ] User enters folder name and selects icon (emoji)
- [ ] Folder appears in sidebar navigation
- [ ] User can move photos between folders (drag-and-drop or context menu)
- [ ] User can view photos filtered by folder
- [ ] User can delete empty folders (confirmation required)
- [ ] Default "All Photos" folder cannot be deleted

### US-3.3: Like and Comment on Photos

- [ ] User clicks heart icon to like photo
- [ ] Like count updates immediately (optimistic UI)
- [ ] User sees names of all likers (tooltip or list)
- [ ] User clicks heart again to unlike photo
- [ ] User adds text comment (encrypted before sending)
- [ ] Comment appears under photo immediately
- [ ] Comments display in chronological order
- [ ] User can delete own comments only

### US-3.4: Fast Photo Loading

- [ ] Thumbnail grid loads in < 3 seconds (50 photos)
- [ ] Thumbnails lazy load as user scrolls (Intersection Observer)
- [ ] Full-size photo loads in < 2 seconds on click
- [ ] Decryption happens in background (no blocking UI)
- [ ] Placeholder shown during decryption (shimmer effect)
- [ ] Decrypted photos cached in memory (no re-decryption)

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | Claude (Tech Spec Generator) | Initial tech spec for Epic 3 |

---

**Status:** ✅ Ready for Implementation
