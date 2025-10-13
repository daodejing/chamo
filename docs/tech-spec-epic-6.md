# Tech Spec: Epic 6 - Family & Channel Management

**Epic ID:** Epic 6
**Priority:** Medium (MVP)
**Story Points:** 5
**Estimated Duration:** 1 week
**Dependencies:** Epic 1 (Authentication, admin role checks)

---

## 1. Epic Overview

Family and channel management enables family admins to control access, organize conversations, and manage family structure. Admins can generate invite codes, remove members when needed, create custom channels for topic-specific discussions, and manage channel lifecycle. The default "General" channel is protected and cannot be deleted, ensuring families always have a primary communication space.

**User Stories:**

- **US-6.1:** As a family admin, I want to invite new members so that I can grow my family group
  - **AC1:** Generate new invite codes
  - **AC2:** Share codes via any method (copy to clipboard)
  - **AC3:** View list of pending invites (optional: revoke unused codes)

- **US-6.2:** As a family admin, I want to remove members so that I can manage who has access
  - **AC1:** View list of all members
  - **AC2:** Select member and remove (with confirmation)
  - **AC3:** Removed member loses access immediately
  - **AC4:** Messages/photos from removed member remain

- **US-6.3:** As a family admin, I want to create custom channels so that we can organize conversations
  - **AC1:** Create channel with name, description, icon
  - **AC2:** All members can see new channel
  - **AC3:** Delete custom channels (not "General")
  - **AC4:** Messages in deleted channels are archived (soft delete)

---

## 2. Architecture Components

### 2.1 Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Family Section** | `components/settings/family-section.tsx` | Family info, members, invite codes |
| **Member List** | `components/settings/member-list.tsx` | Display family members with actions |
| **Invite Code Generator** | `components/settings/invite-code-generator.tsx` | Generate and copy invite codes |
| **Channel Manager** | `components/settings/channel-manager.tsx` | Create, rename, delete channels |
| **Channel Form** | `components/settings/channel-form.tsx` | Create/edit channel modal |

### 2.2 Backend API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/family` | GET | Fetch family info and members |
| `PATCH /api/family` | PATCH | Update family name/avatar (admin only) |
| `POST /api/family/invite-code` | POST | Generate new invite code (admin only) |
| `DELETE /api/family/members/:id` | DELETE | Remove member (admin only) |
| `GET /api/channels` | GET | Fetch family channels |
| `POST /api/channels` | POST | Create channel (admin only) |
| `PATCH /api/channels/:id` | PATCH | Rename channel (admin only) |
| `DELETE /api/channels/:id` | DELETE | Delete channel (admin only) |

### 2.3 Database Schema

```sql
-- Families table (already defined in Epic 1, showing relevant fields)
CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  avatar TEXT,
  invite_code VARCHAR(50) UNIQUE NOT NULL,
  max_members INTEGER DEFAULT 10,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (relevant fields for member management)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member')),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... other fields
);

-- Channels table (already defined in Epic 2, showing relevant fields)
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(10), -- Emoji
  created_by UUID NOT NULL REFERENCES users(id),
  is_default BOOLEAN DEFAULT FALSE, -- "General" channel
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to create default "General" channel on family creation
-- (Already defined in Epic 2, but showing here for context)
CREATE OR REPLACE FUNCTION create_default_channel()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO channels (family_id, name, description, icon, created_by, is_default)
  VALUES (NEW.id, 'General', 'Main family chat', '💬', NEW.created_by, TRUE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_channel
  AFTER INSERT ON families
  FOR EACH ROW
  EXECUTE FUNCTION create_default_channel();
```

---

## 3. Implementation Details

### 3.1 Database Schema (Detailed)

#### RLS Policies for Admin Operations

```sql
-- Families table: Only admins can update
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can update family"
  ON families FOR UPDATE
  USING (
    id IN (
      SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users table: Admins can delete members (except themselves)
CREATE POLICY "Admins can remove members"
  ON users FOR DELETE
  USING (
    id != auth.uid() AND
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Channels table: Admins can create/delete channels
CREATE POLICY "Admins can manage channels"
  ON channels FOR ALL
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Prevent deletion of default channel
CREATE OR REPLACE FUNCTION prevent_default_channel_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_default = TRUE THEN
    RAISE EXCEPTION 'Cannot delete default channel';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_default_channel_deletion
  BEFORE DELETE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION prevent_default_channel_deletion();
```

### 3.2 API Contracts

#### POST /api/family/invite-code

**Authentication:** Required (JWT, admin only)

**Request Schema:** None (generates new code)

**Response Schema:**
```typescript
type InviteCodeResponse = {
  inviteCode: string; // Format: FAMILY-XXXX:BASE64KEY
  expiresAt: string | null; // MVP: no expiry, Phase 2: 7 days
};
```

**Error Responses:**
- 401: Not authenticated
- 403: User is not admin
- 500: Server error

**Rate Limiting:** 10 invite codes per hour per admin

**Implementation Logic:**
1. Verify user is admin
2. Generate new invite code (8-character alphanumeric)
3. Retrieve family key (from families table or admin user record)
4. Format: `FAMILY-{code}:{base64_family_key}`
5. Update family record with new invite code
6. Return invite code with key embedded

```typescript
// app/api/family/invite-code/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateInviteCode } from '@/lib/auth/invite-codes';

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is admin
  const { data: userRecord } = await supabase
    .from('users')
    .select('role, family_id, encrypted_family_key')
    .eq('id', user.id)
    .single();

  if (userRecord?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only admins can generate invite codes' },
      { status: 403 }
    );
  }

  // Generate new invite code
  const newCode = generateInviteCode(); // Format: FAMILY-XXXXXXXX

  // Get family key (from user's encrypted_family_key field)
  const familyKey = userRecord.encrypted_family_key;

  // Update family record with new invite code
  const { error: updateError } = await supabase
    .from('families')
    .update({ invite_code: newCode })
    .eq('id', userRecord.family_id);

  if (updateError) {
    console.error('Failed to update invite code:', updateError);
    return NextResponse.json(
      { error: 'Failed to generate invite code' },
      { status: 500 }
    );
  }

  // Return full invite code with key
  const fullInviteCode = `${newCode}:${familyKey}`;

  return NextResponse.json({
    inviteCode: fullInviteCode,
    expiresAt: null, // No expiry in MVP
  });
}
```

---

#### DELETE /api/family/members/:id

**Authentication:** Required (JWT, admin only)

**Request Schema:** None (member ID in URL)

**Response Schema:**
```typescript
type RemoveMemberResponse = {
  success: true;
  removedMemberId: string;
};
```

**Error Responses:**
- 401: Not authenticated
- 403: User is not admin, or trying to remove self
- 404: Member not found
- 500: Server error

**Rate Limiting:** None

**Implementation Logic:**
1. Verify user is admin
2. Verify target member exists and is in same family
3. Prevent admin from removing themselves
4. Delete user record (CASCADE deletes messages/photos/events)
5. Return success

**Note:** Member's content (messages/photos) is NOT deleted (soft association via user_id). Phase 2: Add option for hard delete.

```typescript
// app/api/family/members/[id]/route.ts
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is admin
  const { data: adminRecord } = await supabase
    .from('users')
    .select('role, family_id')
    .eq('id', user.id)
    .single();

  if (adminRecord?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only admins can remove members' },
      { status: 403 }
    );
  }

  // Prevent self-removal
  if (user.id === params.id) {
    return NextResponse.json(
      { error: 'Cannot remove yourself. Transfer admin role first.' },
      { status: 403 }
    );
  }

  // Verify target member exists and is in same family
  const { data: targetMember } = await supabase
    .from('users')
    .select('id, family_id')
    .eq('id', params.id)
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (targetMember.family_id !== adminRecord.family_id) {
    return NextResponse.json(
      { error: 'Member not in your family' },
      { status: 403 }
    );
  }

  // Delete member (CASCADE deletes related records via foreign keys)
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', params.id);

  if (deleteError) {
    console.error('Failed to remove member:', deleteError);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    removedMemberId: params.id,
  });
}
```

---

#### POST /api/channels

**Authentication:** Required (JWT, admin only)

**Request Schema (Zod):**
```typescript
import { z } from 'zod';

export const createChannelSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(50),
  description: z.string().max(255).optional(),
  icon: z.string().max(10, 'Icon must be a single emoji').optional(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
```

**Response Schema:**
```typescript
type CreateChannelResponse = {
  channel: {
    id: string;
    familyId: string;
    name: string;
    description: string | null;
    icon: string | null;
    createdBy: string;
    isDefault: boolean;
    createdAt: string;
  };
};
```

**Error Responses:**
- 400: Invalid input (name too long, invalid icon)
- 401: Not authenticated
- 403: User is not admin
- 500: Server error

**Rate Limiting:** 20 channels per day per family (prevent spam)

**Implementation Logic:**
1. Verify user is admin
2. Validate input (channel name, description, icon)
3. Insert channel record (is_default = FALSE)
4. Return created channel

```typescript
// app/api/channels/route.ts
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is admin
  const { data: userRecord } = await supabase
    .from('users')
    .select('role, family_id')
    .eq('id', user.id)
    .single();

  if (userRecord?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only admins can create channels' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const result = createChannelSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0].message },
      { status: 400 }
    );
  }

  const { name, description, icon } = result.data;

  // Create channel
  const { data: channel, error: insertError } = await supabase
    .from('channels')
    .insert({
      family_id: userRecord.family_id,
      name,
      description,
      icon,
      created_by: user.id,
      is_default: false,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to create channel:', insertError);
    return NextResponse.json(
      { error: 'Failed to create channel' },
      { status: 500 }
    );
  }

  return NextResponse.json({ channel });
}
```

---

#### DELETE /api/channels/:id

**Authentication:** Required (JWT, admin only)

**Request Schema:** None (channel ID in URL)

**Response Schema:**
```typescript
type DeleteChannelResponse = {
  success: true;
  deletedChannelId: string;
};
```

**Error Responses:**
- 401: Not authenticated
- 403: User is not admin, or trying to delete default channel
- 404: Channel not found
- 500: Server error

**Rate Limiting:** None

**Implementation Logic:**
1. Verify user is admin
2. Verify channel exists and is in admin's family
3. Check if channel is default (is_default = TRUE)
4. If default, return 403 error
5. Delete channel (CASCADE deletes messages)
6. Return success

**Note:** Messages in deleted channel are CASCADE deleted (hard delete). Phase 2: Implement soft delete (archive).

```typescript
// app/api/channels/[id]/route.ts
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is admin
  const { data: userRecord } = await supabase
    .from('users')
    .select('role, family_id')
    .eq('id', user.id)
    .single();

  if (userRecord?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only admins can delete channels' },
      { status: 403 }
    );
  }

  // Verify channel exists and is in admin's family
  const { data: channel } = await supabase
    .from('channels')
    .select('id, family_id, is_default')
    .eq('id', params.id)
    .single();

  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }

  if (channel.family_id !== userRecord.family_id) {
    return NextResponse.json(
      { error: 'Channel not in your family' },
      { status: 403 }
    );
  }

  if (channel.is_default) {
    return NextResponse.json(
      { error: 'Cannot delete default channel' },
      { status: 403 }
    );
  }

  // Delete channel (CASCADE deletes messages via foreign key)
  const { error: deleteError } = await supabase
    .from('channels')
    .delete()
    .eq('id', params.id);

  if (deleteError) {
    console.error('Failed to delete channel:', deleteError);
    return NextResponse.json(
      { error: 'Failed to delete channel' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    deletedChannelId: params.id,
  });
}
```

---

### 3.3 Component Implementation Guide

#### Component: Family Section

**File:** `components/settings/family-section.tsx`

**Props:** None (fetches from auth context)

**State Management:**
```typescript
const { user } = useAuth();
const [family, setFamily] = useState<Family | null>(null);
const [members, setMembers] = useState<User[]>([]);
const [loading, setLoading] = useState(true);
```

**Key Functions:**
- `fetchFamily()` - Load family info and members
- `handleGenerateInviteCode()` - Generate new code and copy
- `handleRemoveMember(userId)` - Remove member with confirmation
- `handleUpdateFamily(name, avatar)` - Update family name/avatar

**Integration Points:**
- API: `/api/family`, `/api/family/invite-code`, `/api/family/members/:id`
- Context: `useAuth()` for admin check

**Implementation:**
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Copy, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export function FamilySection() {
  const { user } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchFamily();
  }, []);

  const fetchFamily = async () => {
    try {
      const response = await fetch('/api/family');
      const data = await response.json();
      setFamily(data.family);
      setMembers(data.members);
    } catch (error) {
      console.error('Failed to fetch family:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInviteCode = async () => {
    if (!isAdmin) return;

    try {
      const response = await fetch('/api/family/invite-code', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate invite code');
      }

      const { inviteCode } = await response.json();

      // Copy to clipboard
      await navigator.clipboard.writeText(inviteCode);
      toast.success('Invite code copied to clipboard!');
    } catch (error) {
      console.error('Failed to generate invite code:', error);
      toast.error('Failed to generate invite code. Please try again.');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isAdmin) return;

    try {
      const response = await fetch(`/api/family/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove member');
      }

      toast.success('Member removed successfully');
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setRemovingMemberId(null);
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error(error.message || 'Failed to remove member. Please try again.');
    }
  };

  if (loading) {
    return <div>Loading family info...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{family?.name}</span>
            {isAdmin && (
              <Button onClick={handleGenerateInviteCode} size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Generate Invite Code
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {members.length} / {family?.maxMembers} members
          </p>

          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded"
              >
                <div className="flex items-center gap-3">
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      {member.name[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.role === 'admin' ? 'Admin' : 'Member'}
                    </p>
                  </div>
                </div>

                {isAdmin && member.id !== user?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemovingMemberId(member.id)}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Remove member confirmation dialog */}
      <AlertDialog
        open={!!removingMemberId}
        onOpenChange={() => setRemovingMemberId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Family Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member? They will lose access immediately.
              Their messages and photos will remain in the family.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removingMemberId && handleRemoveMember(removingMemberId)}
              className="bg-destructive text-destructive-foreground"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

---

#### Component: Channel Manager

**File:** `components/settings/channel-manager.tsx`

**Props:** None (fetches from auth context)

**State Management:**
```typescript
const [channels, setChannels] = useState<Channel[]>([]);
const [showCreateForm, setShowCreateForm] = useState(false);
const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);
```

**Key Functions:**
- `fetchChannels()` - Load family channels
- `handleCreateChannel(name, description, icon)` - Create new channel
- `handleDeleteChannel(channelId)` - Delete channel with confirmation

**Integration Points:**
- API: `/api/channels`
- Context: `useAuth()` for admin check

**Implementation:**
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ChannelForm } from './channel-form';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function ChannelManager() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const response = await fetch('/api/channels');
      const data = await response.json();
      setChannels(data.channels);
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async (name: string, description: string, icon: string) => {
    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, icon }),
      });

      if (!response.ok) {
        throw new Error('Failed to create channel');
      }

      const { channel } = await response.json();

      toast.success('Channel created successfully');
      setChannels((prev) => [...prev, channel]);
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create channel:', error);
      toast.error('Failed to create channel. Please try again.');
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      const response = await fetch(`/api/channels/${channelId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete channel');
      }

      toast.success('Channel deleted successfully');
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      setDeletingChannelId(null);
    } catch (error) {
      console.error('Failed to delete channel:', error);
      toast.error(error.message || 'Failed to delete channel. Please try again.');
    }
  };

  if (loading) {
    return <div>Loading channels...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Channels</span>
            {isAdmin && (
              <Button onClick={() => setShowCreateForm(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create Channel
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between p-3 border rounded"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{channel.icon || '💬'}</span>
                  <div>
                    <p className="font-medium">{channel.name}</p>
                    {channel.description && (
                      <p className="text-sm text-muted-foreground">
                        {channel.description}
                      </p>
                    )}
                    {channel.isDefault && (
                      <span className="text-xs text-muted-foreground">Default</span>
                    )}
                  </div>
                </div>

                {isAdmin && !channel.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingChannelId(channel.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create channel form */}
      {showCreateForm && (
        <ChannelForm
          onSubmit={handleCreateChannel}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Delete channel confirmation dialog */}
      <AlertDialog
        open={!!deletingChannelId}
        onOpenChange={() => setDeletingChannelId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Channel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this channel? All messages in this channel
              will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingChannelId && handleDeleteChannel(deletingChannelId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete Channel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

---

## 4. Error Handling

### 4.1 Client-Side Errors

**Permission Denied:**
- Non-admin tries to access admin functions
- Display toast: "Only admins can perform this action"

**Member Removal Errors:**
- Admin tries to remove self
- Display toast: "Cannot remove yourself. Transfer admin role first."

**Channel Deletion Errors:**
- Admin tries to delete default channel
- Display toast: "Cannot delete the General channel"

### 4.2 API Errors

**Common Errors:**
- `NOT_ADMIN` (403) - User is not admin
- `CANNOT_REMOVE_SELF` (403) - Admin cannot remove themselves
- `CANNOT_DELETE_DEFAULT_CHANNEL` (403) - Default channel protected
- `MEMBER_NOT_FOUND` (404) - Member does not exist
- `CHANNEL_NOT_FOUND` (404) - Channel does not exist

### 4.3 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Last admin removed** | Prevent: Admin cannot remove self (must transfer role first) |
| **Invite code regenerated while member joining** | New members use latest code (old codes invalid) |
| **Channel deleted while user viewing** | Redirect to default "General" channel |
| **Member removed while online** | Force logout immediately (WebSocket disconnect) |
| **Family reaches max_members** | Block new joins, admin must increase limit or remove members |

---

## 5. Testing Strategy

### 5.1 Unit Tests (Vitest)

**File:** `tests/unit/family/invite-codes.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { generateInviteCode, validateInviteCodeFormat } from '@/lib/auth/invite-codes';

describe('Invite Code Generation', () => {
  it('should generate unique invite codes', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode());
    }
    expect(codes.size).toBe(100); // All unique
  });

  it('should generate codes in correct format', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^FAMILY-[A-Z0-9]{8}$/);
  });
});
```

### 5.2 Integration Tests

**File:** `tests/integration/family/member-management.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Member Management Integration', () => {
  it('should remove member as admin', async () => {
    // Create test family with admin and member
    // Admin removes member
    // Verify member deleted from database
  });

  it('should prevent non-admin from removing members', async () => {
    // Member tries to remove another member
    // Verify 403 error
  });
});
```

### 5.3 E2E Tests (Playwright)

**File:** `tests/e2e/family/family-management.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Family Management Flow', () => {
  test('should generate invite code and copy to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/settings');

    // Click "Generate Invite Code"
    await page.click('button:text("Generate Invite Code")');

    // Verify success toast
    await expect(page.locator('text=Invite code copied to clipboard')).toBeVisible();

    // Verify clipboard contains invite code
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toMatch(/^FAMILY-[A-Z0-9]{8}:[A-Za-z0-9+/=]+$/);
  });

  test('should remove family member', async ({ page }) => {
    await page.goto('/settings');

    // Click remove button for member
    await page.click('button:has(svg[class*="UserMinus"])');

    // Confirm removal
    await page.click('button:text("Remove Member")');

    // Verify success toast
    await expect(page.locator('text=Member removed successfully')).toBeVisible();

    // Verify member no longer in list
    // (Assuming member name was "Test Member")
    await expect(page.locator('text=Test Member')).not.toBeVisible();
  });

  test('should create custom channel', async ({ page }) => {
    await page.goto('/settings');

    // Click "Create Channel"
    await page.click('button:text("Create Channel")');

    // Fill form
    await page.fill('[name="name"]', 'School Updates');
    await page.fill('[name="description"]', 'For school-related discussions');
    await page.fill('[name="icon"]', '🎓');

    // Submit
    await page.click('button:text("Create")');

    // Verify success toast
    await expect(page.locator('text=Channel created successfully')).toBeVisible();

    // Verify channel appears in list
    await expect(page.locator('text=School Updates')).toBeVisible();
  });

  test('should delete custom channel', async ({ page }) => {
    await page.goto('/settings');

    // Click delete button for custom channel
    await page.click('button:has(svg[class*="Trash2"])');

    // Confirm deletion
    await page.click('button:text("Delete Channel")');

    // Verify success toast
    await expect(page.locator('text=Channel deleted successfully')).toBeVisible();

    // Verify channel no longer in list
    await expect(page.locator('text=School Updates')).not.toBeVisible();
  });

  test('should prevent deletion of default channel', async ({ page }) => {
    await page.goto('/settings');

    // Verify delete button not visible for "General" channel
    const generalChannel = page.locator('text=General').locator('..');
    await expect(generalChannel.locator('button:has(svg[class*="Trash2"])')).not.toBeVisible();
  });
});
```

### 5.4 Acceptance Criteria Validation

| AC | Test Type | Validation Method |
|----|-----------|-------------------|
| **AC1.1-1.3:** Generate and share invite codes | E2E | Click generate, copy to clipboard, verify format |
| **AC2.1-2.4:** Remove members | E2E | View members, remove with confirmation, verify immediate access loss |
| **AC3.1-3.4:** Create and delete channels | E2E | Create channel, verify visibility, delete with confirmation |

---

## 6. Security Considerations

### 6.1 Admin Authorization

**RLS Policies:**
- All admin operations protected by database RLS
- Server-side verification (user.role === 'admin')
- Client-side UI gating (hide admin buttons for non-admins)

**Attack Vectors:**
- Non-admin tries to call admin API directly → 403 Forbidden (RLS blocks)
- Admin tries to escalate privileges → Not possible (role set on registration only)

### 6.2 Invite Code Security

**Invite Code Rotation:**
- Admin can generate new codes (invalidates old codes)
- Phase 2: Add expiry timestamps (7-day validity)

**Key Distribution:**
- Family key embedded in invite code
- If invite code leaked, entire family compromised (acceptable for MVP trust model)
- Phase 2: Implement key rotation after member removal

### 6.3 Data Retention

**Member Removal:**
- User record deleted (CASCADE deletes associated records)
- Messages/photos remain visible (foreign key user_id becomes orphaned)
- Phase 2: Add option for hard delete (remove all content)

**Channel Deletion:**
- Channel record deleted (CASCADE deletes messages)
- Hard delete (no archive in MVP)
- Phase 2: Soft delete with archive option

---

## 7. Performance Targets

| Operation | Target Latency | Acceptable Max |
|-----------|---------------|----------------|
| **Fetch family info** | < 200ms | < 500ms |
| **Generate invite code** | < 300ms | < 1s |
| **Remove member** | < 500ms | < 1.5s |
| **Create channel** | < 300ms | < 1s |
| **Delete channel** | < 500ms | < 1.5s |

**Optimization Strategies:**
- Cache family info and channels in client state
- Optimistic UI updates (show changes immediately, rollback on error)
- Debounce rapid operations (prevent double-clicks)

---

## 8. Implementation Checklist

### Week 1: Backend & Database
- [ ] Implement RLS policies for admin operations
- [ ] Implement POST /api/family/invite-code (generate new code)
- [ ] Implement DELETE /api/family/members/:id (remove member)
- [ ] Implement PATCH /api/family (update family name/avatar)
- [ ] Implement POST /api/channels (create channel)
- [ ] Implement PATCH /api/channels/:id (rename channel)
- [ ] Implement DELETE /api/channels/:id (delete channel)
- [ ] Implement database trigger (prevent default channel deletion)
- [ ] Write unit tests for API routes (95% coverage)

### Week 1: Frontend & Integration
- [ ] Implement FamilySection component (family info, members, invite codes)
- [ ] Implement MemberList component (display with remove button)
- [ ] Implement InviteCodeGenerator component (generate and copy)
- [ ] Implement ChannelManager component (create, delete channels)
- [ ] Implement ChannelForm component (create/edit modal)
- [ ] Implement admin checks in UI (hide buttons for non-admins)
- [ ] Test invite code generation and clipboard copy
- [ ] Test member removal (confirmation dialog, immediate effect)
- [ ] Test channel CRUD (create, rename, delete)
- [ ] Test default channel protection (cannot delete)
- [ ] Write integration tests (admin operation flows)
- [ ] Write E2E tests (Playwright scenarios)

### Week 1: Polish & Testing
- [ ] Implement confirmation dialogs for destructive actions
- [ ] Error handling and user-facing error messages
- [ ] Performance testing (operation latency)
- [ ] Accessibility testing (keyboard navigation, screen readers)

---

## 9. Dependencies & Risks

**Depends On:**
- Epic 1: Authentication (admin role checks)

**Depended On By:**
- None

**Risks:**

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Admin removes self accidentally** | Medium | Low | Prevent in UI and API, show clear warning |
| **Invite code leaked publicly** | High | Low | Educate users on secure sharing, implement expiry in Phase 2 |
| **Channel deletion with active users** | Low | Medium | Redirect users to default channel, show notification |
| **Family key compromised via invite code** | High | Very Low | Trust model acceptable for MVP, add key rotation in Phase 2 |

---

## 10. Acceptance Criteria

### US-6.1: Invite New Members

- [ ] Admin clicks "Generate Invite Code" button
- [ ] New invite code generated (format: FAMILY-XXXX:KEY)
- [ ] Invite code copied to clipboard automatically
- [ ] Success toast: "Invite code copied to clipboard!"
- [ ] Admin shares code via any method (SMS, email, messaging app)
- [ ] New member uses code to join family (Epic 1 flow)
- [ ] Regenerating code invalidates previous codes

### US-6.2: Remove Members

- [ ] Admin views list of all family members
- [ ] Admin clicks remove button next to member
- [ ] Confirmation dialog appears: "Are you sure you want to remove this member?"
- [ ] Admin confirms removal
- [ ] Member removed from database immediately
- [ ] Member loses access (forced logout)
- [ ] Success toast: "Member removed successfully"
- [ ] Member's messages and photos remain visible
- [ ] Admin cannot remove themselves (button disabled, API returns 403)

### US-6.3: Create Custom Channels

- [ ] Admin clicks "Create Channel" button
- [ ] Modal opens with form (name, description, icon)
- [ ] Admin fills form (name: "School Updates", icon: "🎓")
- [ ] Admin clicks "Create" button
- [ ] Channel appears in channel list immediately for all members
- [ ] All members can see and access new channel
- [ ] Admin can delete custom channels (with confirmation)
- [ ] Admin cannot delete default "General" channel (button hidden)
- [ ] Deleted channel messages are removed (CASCADE delete)

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | Claude (Tech Spec Generator) | Initial tech spec for Epic 6 |

---

**Status:** ✅ Ready for Implementation
