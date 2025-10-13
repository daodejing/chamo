-- OurChat Initial Database Schema
-- Version: 1.0
-- Date: 2025-10-13

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- families table (must be created first due to foreign key constraints)
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  avatar TEXT,
  invite_code VARCHAR(50) UNIQUE NOT NULL, -- Format: CODE-XXXX-YYYY
  max_members INTEGER DEFAULT 10,
  created_by UUID NOT NULL, -- user_id (will reference users.id)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_families_invite_code ON families(invite_code);

-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar TEXT, -- URL or base64 data URI
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member')),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  encrypted_family_key TEXT NOT NULL, -- Family key encrypted with user's key
  preferences JSONB DEFAULT '{}', -- { theme, fontSize, uiLanguage, preferredLanguage, quietHours }
  google_calendar_token TEXT, -- Encrypted OAuth token
  google_calendar_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_family_id ON users(family_id);
CREATE INDEX idx_users_email ON users(email);

-- channels table
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- i18n key or custom name
  description TEXT,
  icon VARCHAR(10), -- Emoji
  created_by UUID NOT NULL REFERENCES users(id),
  is_default BOOLEAN DEFAULT FALSE, -- "General" channel
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_channels_family_id ON channels(family_id);

-- messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL, -- AES-256-GCM ciphertext
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);

-- scheduled_messages table
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_messages_scheduled_time ON scheduled_messages(scheduled_time);
CREATE INDEX idx_scheduled_messages_status ON scheduled_messages(status);

-- photo_folders table
CREATE TABLE photo_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(10), -- Emoji
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_default BOOLEAN DEFAULT FALSE -- "All Photos" folder
);

CREATE INDEX idx_photo_folders_family_id ON photo_folders(family_id);

-- photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES photo_folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- Supabase Storage path: family_id/photo_id.enc
  encrypted_caption TEXT, -- AES-256-GCM ciphertext
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  likes JSONB DEFAULT '[]', -- Array of user_ids
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_folder_id ON photos(folder_id);
CREATE INDEX idx_photos_uploaded_at ON photos(uploaded_at DESC);

-- photo_comments table
CREATE TABLE photo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_comment TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photo_comments_photo_id ON photo_comments(photo_id);

-- calendar_events table
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN DEFAULT FALSE,
  reminder BOOLEAN DEFAULT FALSE,
  reminder_minutes INTEGER, -- 15, 30, 60
  color VARCHAR(7), -- Hex color
  google_event_id VARCHAR(255), -- For sync
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_family_id ON calendar_events(family_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(date);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- families policies
CREATE POLICY "Users can read their own family"
  ON families FOR SELECT
  USING (id = (SELECT family_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can update their family"
  ON families FOR UPDATE
  USING (
    id = (SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- users policies
CREATE POLICY "Users can read their family members"
  ON users FOR SELECT
  USING (family_id = (SELECT family_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can delete family members"
  ON users FOR DELETE
  USING (
    family_id = (SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin')
    AND id != auth.uid() -- Cannot delete self
  );

-- channels policies
CREATE POLICY "Users can read their family channels"
  ON channels FOR SELECT
  USING (family_id = (SELECT family_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert channels"
  ON channels FOR INSERT
  WITH CHECK (
    family_id = (SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete custom channels"
  ON channels FOR DELETE
  USING (
    family_id = (SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin')
    AND is_default = FALSE
  );

-- messages policies
CREATE POLICY "Users can read their family's messages"
  ON messages FOR SELECT
  USING (
    channel_id IN (
      SELECT id FROM channels WHERE family_id = (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert messages in their family channels"
  ON messages FOR INSERT
  WITH CHECK (
    channel_id IN (
      SELECT id FROM channels WHERE family_id = (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  USING (user_id = auth.uid());

-- scheduled_messages policies
CREATE POLICY "Users can read their own scheduled messages"
  ON scheduled_messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own scheduled messages"
  ON scheduled_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND channel_id IN (
      SELECT id FROM channels WHERE family_id = (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own scheduled messages"
  ON scheduled_messages FOR DELETE
  USING (user_id = auth.uid() AND status = 'pending');

-- photo_folders policies
CREATE POLICY "Users can read their family photo folders"
  ON photo_folders FOR SELECT
  USING (family_id = (SELECT family_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create photo folders"
  ON photo_folders FOR INSERT
  WITH CHECK (
    family_id = (SELECT family_id FROM users WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can delete their own folders"
  ON photo_folders FOR DELETE
  USING (created_by = auth.uid() AND is_default = FALSE);

-- photos policies
CREATE POLICY "Users can read their family photos"
  ON photos FOR SELECT
  USING (
    folder_id IN (
      SELECT id FROM photo_folders WHERE family_id = (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can upload photos"
  ON photos FOR INSERT
  WITH CHECK (
    folder_id IN (
      SELECT id FROM photo_folders WHERE family_id = (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own photos"
  ON photos FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own photos"
  ON photos FOR DELETE
  USING (user_id = auth.uid());

-- photo_comments policies
CREATE POLICY "Users can read comments on their family photos"
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

CREATE POLICY "Users can insert comments on their family photos"
  ON photo_comments FOR INSERT
  WITH CHECK (
    photo_id IN (
      SELECT id FROM photos WHERE folder_id IN (
        SELECT id FROM photo_folders WHERE family_id = (
          SELECT family_id FROM users WHERE id = auth.uid()
        )
      )
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own comments"
  ON photo_comments FOR DELETE
  USING (user_id = auth.uid());

-- calendar_events policies
CREATE POLICY "Users can read their family calendar events"
  ON calendar_events FOR SELECT
  USING (family_id = (SELECT family_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create calendar events"
  ON calendar_events FOR INSERT
  WITH CHECK (
    family_id = (SELECT family_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own events"
  ON calendar_events FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own events"
  ON calendar_events FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at columns
CREATE TRIGGER update_families_updated_at
  BEFORE UPDATE ON families
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STORAGE BUCKETS (Supabase Storage)
-- ============================================================================

-- Note: Storage buckets are created via Supabase Dashboard or API
-- This is documented here for reference:
--
-- Bucket: photos
-- - Public: false
-- - File size limit: 10MB
-- - Allowed MIME types: image/jpeg, image/png, image/heic, image/webp
--
-- RLS Policies for storage.objects:
-- - Users can upload to their family folder
-- - Users can read from their family folder
-- - Users can delete their own uploads
