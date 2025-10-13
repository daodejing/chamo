# Tech Spec: Epic 4 - Family Calendar

**Epic ID:** Epic 4
**Priority:** High (MVP)
**Story Points:** 13
**Estimated Duration:** 2 weeks
**Dependencies:** Epic 1 (Authentication, OAuth state management)

---

## 1. Epic Overview

The family calendar enables coordination of family activities, appointments, and events. Users can create events, set reminders with browser notifications, and optionally sync with Google Calendar for two-way integration. All reminder logic respects user quiet hours preferences, ensuring notifications don't disturb family members during sleep.

**User Stories:**

- **US-4.1:** As a family member, I want to create calendar events so that everyone knows about family activities
  - **AC1:** Click date on calendar
  - **AC2:** Enter event title, description, time
  - **AC3:** Select all-day or timed event
  - **AC4:** Event appears on family calendar for all members

- **US-4.2:** As a family member, I want to set reminders so that I don't forget important events
  - **AC1:** Enable reminder when creating event
  - **AC2:** Choose minutes before event (15, 30, 60)
  - **AC3:** System sends browser notification at reminder time
  - **AC4:** Reminders respect quiet hours

- **US-4.3:** As a family member, I want to sync with Google Calendar so that I have one source of truth
  - **AC1:** Connect Google account via OAuth
  - **AC2:** Import Google events into app
  - **AC3:** Create events that sync to Google
  - **AC4:** Manual sync button + auto-sync option
  - **AC5:** Disconnect option clears sync

---

## 2. Architecture Components

### 2.1 Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Calendar Screen** | `app/(dashboard)/calendar/page.tsx` | Main calendar interface |
| **Calendar View** | `components/calendar/calendar-view.tsx` | Month/week/day view with events |
| **Event Form** | `components/calendar/event-form.tsx` | Create/edit event modal |
| **Event Detail** | `components/calendar/event-detail.tsx` | Event details popup |
| **Google Sync Panel** | `components/calendar/google-sync-panel.tsx` | OAuth and sync controls |
| **Reminder Settings** | `components/calendar/reminder-settings.tsx` | Reminder configuration |

### 2.2 Backend API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/calendar/events` | GET | Fetch events (date range filter) |
| `POST /api/calendar/events` | POST | Create new event |
| `PATCH /api/calendar/events/:id` | PATCH | Update event |
| `DELETE /api/calendar/events/:id` | DELETE | Delete event |
| `GET /api/google/auth` | GET | Initiate Google OAuth PKCE flow |
| `GET /api/google/callback` | GET | Handle OAuth callback |
| `POST /api/google/sync` | POST | Sync events with Google Calendar |
| `DELETE /api/google/disconnect` | DELETE | Disconnect Google Calendar |

### 2.3 Database Tables

```sql
-- Calendar events table
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
  color VARCHAR(7), -- Hex color (e.g., "#3B82F6")
  google_event_id VARCHAR(255) UNIQUE, -- For Google Calendar sync
  google_calendar_id VARCHAR(255), -- Which Google calendar it's in
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_family_id ON calendar_events(family_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(date);
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_google_event_id ON calendar_events(google_event_id);

-- Trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 2.4 Libraries & Services

| Library | Version | Purpose |
|---------|---------|---------|
| **date-fns** | 4.1.x | Date manipulation and formatting |
| **react-day-picker** | 9.x | Calendar UI component |
| **@googleapis/calendar** | Latest | Google Calendar API client |
| **Browser Notification API** | Native | Desktop notifications for reminders |

---

## 3. Implementation Details

### 3.1 Database Schema (Detailed)

#### Calendar Events Table with RLS

```sql
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their family's events
CREATE POLICY "Users can read family events"
  ON calendar_events FOR SELECT
  USING (
    family_id = (SELECT family_id FROM users WHERE id = auth.uid())
  );

-- Policy: Users can create events in their family
CREATE POLICY "Users can create events"
  ON calendar_events FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    family_id = (SELECT family_id FROM users WHERE id = auth.uid())
  );

-- Policy: Users can update their own events
CREATE POLICY "Users can update own events"
  ON calendar_events FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own events
CREATE POLICY "Users can delete own events"
  ON calendar_events FOR DELETE
  USING (user_id = auth.uid());
```

### 3.2 API Contracts

#### GET /api/calendar/events

**Authentication:** Required (JWT)

**Query Parameters (Zod):**
```typescript
import { z } from 'zod';

export const eventsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

export type EventsQuery = z.infer<typeof eventsQuerySchema>;
```

**Response Schema:**
```typescript
type EventsResponse = {
  events: Array<{
    id: string;
    familyId: string;
    userId: string;
    title: string;
    description: string | null;
    date: string; // YYYY-MM-DD
    startTime: string | null; // HH:MM:SS
    endTime: string | null;
    allDay: boolean;
    reminder: boolean;
    reminderMinutes: number | null;
    color: string | null;
    googleEventId: string | null;
    createdAt: string;
    updatedAt: string;
    user: {
      name: string;
      avatar: string | null;
    };
  }>;
};
```

**Error Responses:**
- 400: Invalid query parameters
- 401: Not authenticated
- 500: Server error

**Rate Limiting:** None (read-only, frequently called)

**Implementation Logic:**
1. Validate JWT and query params
2. Fetch events within date range for user's family
3. Join with users table for creator info
4. Return events sorted by date + start_time

```typescript
// app/api/calendar/events/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { eventsQuerySchema } from '@/lib/validators/calendar';

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const result = eventsQuerySchema.safeParse({
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0].message },
      { status: 400 }
    );
  }

  const { startDate, endDate } = result.data;

  // Fetch family ID
  const { data: userFamily } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single();

  // Fetch events
  const { data: events, error } = await supabase
    .from('calendar_events')
    .select(`
      *,
      user:users(name, avatar)
    `)
    .eq('family_id', userFamily?.family_id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }

  return NextResponse.json({ events });
}
```

---

#### POST /api/calendar/events

**Authentication:** Required (JWT)

**Request Schema (Zod):**
```typescript
export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(1000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  allDay: z.boolean().default(false),
  reminder: z.boolean().default(false),
  reminderMinutes: z.enum(['15', '30', '60']).transform(Number).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
}).refine(
  (data) => {
    if (!data.allDay && !data.startTime) {
      return false;
    }
    return true;
  },
  { message: 'Start time required for timed events' }
);

export type CreateEventInput = z.infer<typeof createEventSchema>;
```

**Response Schema:**
```typescript
type CreateEventResponse = {
  event: {
    id: string;
    familyId: string;
    userId: string;
    title: string;
    description: string | null;
    date: string;
    startTime: string | null;
    endTime: string | null;
    allDay: boolean;
    reminder: boolean;
    reminderMinutes: number | null;
    color: string | null;
    createdAt: string;
    updatedAt: string;
  };
};
```

**Error Responses:**
- 400: Invalid input (missing title, invalid date/time)
- 401: Not authenticated
- 500: Server error

**Rate Limiting:** 100 events per day per user

**Implementation Logic:**
1. Validate JWT and input
2. Get user's family ID
3. Insert event into database
4. If user has Google Calendar connected, sync to Google (async)
5. Return created event

**Google Calendar Sync Logic (if connected):**
```typescript
// After creating event in database
if (userHasGoogleCalendarConnected) {
  // Call Google Calendar API to create event
  const googleEvent = await createGoogleCalendarEvent({
    summary: title,
    description,
    start: allDay
      ? { date }
      : { dateTime: `${date}T${startTime}:00`, timeZone: 'UTC' },
    end: allDay
      ? { date }
      : { dateTime: `${date}T${endTime || startTime}:00`, timeZone: 'UTC' },
    reminders: reminder
      ? { useDefault: false, overrides: [{ method: 'popup', minutes: reminderMinutes }] }
      : undefined,
  });

  // Update event with Google event ID
  await supabase
    .from('calendar_events')
    .update({ google_event_id: googleEvent.id, google_calendar_id: googleEvent.calendarId })
    .eq('id', eventId);
}
```

---

#### POST /api/google/sync

**Authentication:** Required (JWT)

**Request Schema:** None (syncs all events)

**Response Schema:**
```typescript
type GoogleSyncResponse = {
  imported: number; // Number of Google events imported
  exported: number; // Number of app events exported to Google
  lastSyncTime: string; // ISO 8601 timestamp
};
```

**Error Responses:**
- 401: Not authenticated
- 403: Google Calendar not connected
- 429: Rate limit exceeded (Google API quota)
- 500: Sync failed

**Rate Limiting:** 10 syncs per hour per user

**Implementation Logic:**
1. Verify user has Google Calendar connected
2. Fetch OAuth tokens from user record (decrypt if needed)
3. Fetch Google Calendar events (7 days past to 30 days future)
4. Import Google events:
   - Check if `google_event_id` already exists in database
   - If not, create new event record
   - If exists, update if modified
5. Export app events (without `google_event_id`):
   - Create events in Google Calendar
   - Store `google_event_id` in database
6. Update user's last sync timestamp
7. Return sync stats

```typescript
// app/api/google/sync/route.ts
import { google } from 'googleapis';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch user's Google tokens
  const { data: userRecord } = await supabase
    .from('users')
    .select('google_calendar_token, google_calendar_connected')
    .eq('id', user.id)
    .single();

  if (!userRecord?.google_calendar_connected) {
    return NextResponse.json(
      { error: 'Google Calendar not connected' },
      { status: 403 }
    );
  }

  try {
    // Initialize Google Calendar API client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/google/callback'
    );

    oauth2Client.setCredentials(JSON.parse(userRecord.google_calendar_token));

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Fetch Google events
    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days future

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const googleEvents = response.data.items || [];

    let importedCount = 0;
    let exportedCount = 0;

    // Import Google events
    for (const googleEvent of googleEvents) {
      const existingEvent = await supabase
        .from('calendar_events')
        .select('id')
        .eq('google_event_id', googleEvent.id)
        .single();

      if (!existingEvent.data) {
        // Create new event
        await supabase.from('calendar_events').insert({
          family_id: (await supabase.from('users').select('family_id').eq('id', user.id).single()).data?.family_id,
          user_id: user.id,
          title: googleEvent.summary || 'Untitled Event',
          description: googleEvent.description,
          date: googleEvent.start?.date || googleEvent.start?.dateTime?.split('T')[0],
          start_time: googleEvent.start?.dateTime?.split('T')[1]?.slice(0, 5),
          end_time: googleEvent.end?.dateTime?.split('T')[1]?.slice(0, 5),
          all_day: !!googleEvent.start?.date,
          google_event_id: googleEvent.id,
        });
        importedCount++;
      }
    }

    // Export app events without google_event_id
    const { data: appEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .is('google_event_id', null)
      .eq('user_id', user.id);

    for (const appEvent of appEvents || []) {
      const googleEvent = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: appEvent.title,
          description: appEvent.description,
          start: appEvent.all_day
            ? { date: appEvent.date }
            : { dateTime: `${appEvent.date}T${appEvent.start_time}:00`, timeZone: 'UTC' },
          end: appEvent.all_day
            ? { date: appEvent.date }
            : { dateTime: `${appEvent.date}T${appEvent.end_time || appEvent.start_time}:00`, timeZone: 'UTC' },
        },
      });

      await supabase
        .from('calendar_events')
        .update({ google_event_id: googleEvent.data.id })
        .eq('id', appEvent.id);

      exportedCount++;
    }

    return NextResponse.json({
      imported: importedCount,
      exported: exportedCount,
      lastSyncTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Google sync failed:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
```

---

#### GET /api/google/auth

**Authentication:** Required (JWT)

**Query Parameters:** None

**Response Schema:**
```typescript
type GoogleAuthResponse = {
  authUrl: string; // Google OAuth URL with PKCE
};
```

**Error Responses:**
- 401: Not authenticated
- 500: Failed to generate auth URL

**Rate Limiting:** None

**Implementation Logic:**
1. Generate PKCE code verifier and challenge
2. Store code verifier in session/cookie (for callback)
3. Generate Google OAuth URL with scopes:
   - `https://www.googleapis.com/auth/calendar.events`
4. Return auth URL for client redirect

```typescript
// app/api/google/auth/route.ts
import { google } from 'googleapis';
import crypto from 'crypto';

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Store code verifier in encrypted cookie
  const response = NextResponse.json({
    authUrl: oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: user.id, // Pass user ID for callback verification
    }),
  });

  response.cookies.set('google_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  return response;
}
```

---

#### GET /api/google/callback

**Authentication:** Not required (OAuth callback)

**Query Parameters:**
- `code` (string) - OAuth authorization code
- `state` (string) - User ID (for verification)

**Response:** Redirect to `/calendar` with success/error message

**Implementation Logic:**
1. Verify state matches logged-in user
2. Retrieve code verifier from cookie
3. Exchange authorization code for tokens (with code verifier)
4. Encrypt and store refresh token in user record
5. Set `google_calendar_connected = true`
6. Redirect to calendar page with success toast

```typescript
// app/api/google/callback/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // User ID

  const supabase = createSupabaseServerClient();

  // Verify user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== state) {
    return NextResponse.redirect(new URL('/calendar?error=invalid_state', request.url));
  }

  // Get code verifier from cookie
  const codeVerifier = request.cookies.get('google_code_verifier')?.value;
  if (!codeVerifier) {
    return NextResponse.redirect(new URL('/calendar?error=missing_verifier', request.url));
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken({
      code,
      codeVerifier,
    });

    // Store tokens (encrypt refresh token)
    await supabase
      .from('users')
      .update({
        google_calendar_token: JSON.stringify(tokens),
        google_calendar_connected: true,
      })
      .eq('id', user.id);

    return NextResponse.redirect(new URL('/calendar?google_connected=true', request.url));
  } catch (error) {
    console.error('OAuth token exchange failed:', error);
    return NextResponse.redirect(new URL('/calendar?error=token_exchange_failed', request.url));
  }
}
```

---

### 3.3 Component Implementation Guide

#### Component: Calendar View

**File:** `components/calendar/calendar-view.tsx`

**Props:**
```typescript
interface CalendarViewProps {
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}
```

**State Management:**
```typescript
const [currentMonth, setCurrentMonth] = useState(new Date());
const [selectedDate, setSelectedDate] = useState<Date | null>(null);
```

**Key Functions:**
- `handleMonthChange(direction)` - Navigate months
- `getEventsForDate(date)` - Filter events by date
- `renderEventDot(event)` - Colored dot for event indicator

**Integration Points:**
- Library: `react-day-picker` for calendar UI
- Utility: `date-fns` for date manipulation

**Implementation:**
```tsx
'use client';

import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import 'react-day-picker/dist/style.css';

export function CalendarView({ events, onDateClick, onEventClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const eventsMap = events.reduce((acc, event) => {
    const dateKey = event.date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const handleDayClick = (date: Date) => {
    onDateClick(date);
  };

  const modifiers = {
    hasEvents: (date: Date) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      return !!eventsMap[dateKey];
    },
  };

  const modifiersStyles = {
    hasEvents: {
      fontWeight: 'bold',
      textDecoration: 'underline',
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
          >
            Next
          </Button>
        </div>
      </div>

      <DayPicker
        mode="single"
        month={currentMonth}
        onMonthChange={setCurrentMonth}
        onDayClick={handleDayClick}
        modifiers={modifiers}
        modifiersStyles={modifiersStyles}
        className="border rounded-lg p-4"
      />

      {/* Event list for selected date */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Events</h3>
        <div className="space-y-2">
          {Object.entries(eventsMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dayEvents]) => (
              <div key={date} className="border rounded p-3">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  {format(new Date(date), 'EEEE, MMMM d')}
                </p>
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer rounded"
                    onClick={() => onEventClick(event)}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: event.color || '#3B82F6' }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{event.title}</p>
                      {!event.allDay && event.startTime && (
                        <p className="text-sm text-muted-foreground">
                          {event.startTime.slice(0, 5)}
                          {event.endTime && ` - ${event.endTime.slice(0, 5)}`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
```

---

#### Component: Reminder Manager (Client-Side)

**File:** `lib/calendar/reminders.ts`

**Exports:**
```typescript
export function scheduleReminder(event: CalendarEvent): void;
export function cancelReminder(eventId: string): void;
export function requestNotificationPermission(): Promise<boolean>;
```

**Implementation:**
```typescript
/**
 * Browser notification manager for calendar reminders.
 */

const scheduledReminders = new Map<string, number>(); // eventId -> timeoutId

/**
 * Requests browser notification permission.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Schedules a browser notification for an event reminder.
 */
export function scheduleReminder(event: CalendarEvent, userPreferences: UserPreferences): void {
  if (!event.reminder || !event.reminderMinutes) return;

  // Calculate reminder time
  const eventDateTime = new Date(`${event.date}T${event.startTime || '00:00'}:00`);
  const reminderTime = new Date(eventDateTime.getTime() - event.reminderMinutes * 60 * 1000);

  const now = new Date();
  const delay = reminderTime.getTime() - now.getTime();

  if (delay < 0) {
    // Event already passed or reminder time passed
    return;
  }

  // Check if reminder time falls in quiet hours
  if (userPreferences.quietHoursEnabled) {
    const reminderHour = reminderTime.getHours();
    const reminderMinute = reminderTime.getMinutes();
    const reminderTotalMinutes = reminderHour * 60 + reminderMinute;

    const [startHour, startMin] = userPreferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = userPreferences.quietHoursEnd.split(':').map(Number);
    const start = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;

    const isQuietHours = (start <= end)
      ? (reminderTotalMinutes >= start && reminderTotalMinutes < end)
      : (reminderTotalMinutes >= start || reminderTotalMinutes < end);

    if (isQuietHours) {
      console.log(`Reminder skipped (quiet hours): ${event.title}`);
      return;
    }
  }

  // Schedule notification
  const timeoutId = window.setTimeout(() => {
    showNotification(event);
    scheduledReminders.delete(event.id);
  }, delay);

  scheduledReminders.set(event.id, timeoutId);
}

/**
 * Shows browser notification for event.
 */
function showNotification(event: CalendarEvent): void {
  if (Notification.permission !== 'granted') return;

  const notification = new Notification(event.title, {
    body: event.description || `Event starts in ${event.reminderMinutes} minutes`,
    icon: '/icons/calendar-icon.png',
    tag: event.id,
    requireInteraction: true,
  });

  notification.onclick = () => {
    window.focus();
    window.location.href = `/calendar?eventId=${event.id}`;
    notification.close();
  };
}

/**
 * Cancels a scheduled reminder.
 */
export function cancelReminder(eventId: string): void {
  const timeoutId = scheduledReminders.get(eventId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledReminders.delete(eventId);
  }
}

/**
 * Initializes reminders for all upcoming events on app load.
 */
export function initializeReminders(events: CalendarEvent[], userPreferences: UserPreferences): void {
  for (const event of events) {
    scheduleReminder(event, userPreferences);
  }
}
```

---

### 3.4 Business Logic (lib/)

#### Module: Google Calendar Integration

**File:** `lib/google/calendar-sync.ts`

**Exports:**
```typescript
export async function syncWithGoogleCalendar(userId: string): Promise<SyncResult>;
export async function createGoogleCalendarEvent(event: CalendarEvent, tokens: OAuth2Tokens): Promise<string>;
export async function updateGoogleCalendarEvent(eventId: string, event: CalendarEvent, tokens: OAuth2Tokens): Promise<void>;
export async function deleteGoogleCalendarEvent(eventId: string, tokens: OAuth2Tokens): Promise<void>;
```

**Implementation:**
```typescript
import { google } from 'googleapis';

export async function createGoogleCalendarEvent(
  event: CalendarEvent,
  tokens: OAuth2Tokens
): Promise<string> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials(tokens);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const googleEvent = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.title,
      description: event.description,
      start: event.allDay
        ? { date: event.date }
        : { dateTime: `${event.date}T${event.startTime}:00`, timeZone: 'UTC' },
      end: event.allDay
        ? { date: event.date }
        : {
            dateTime: `${event.date}T${event.endTime || event.startTime}:00`,
            timeZone: 'UTC',
          },
      reminders: event.reminder
        ? {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: event.reminderMinutes }],
          }
        : undefined,
      colorId: event.color ? getGoogleColorId(event.color) : undefined,
    },
  });

  return googleEvent.data.id!;
}

function getGoogleColorId(hexColor: string): string {
  // Map hex colors to Google Calendar color IDs (1-11)
  const colorMap: Record<string, string> = {
    '#3B82F6': '1', // Blue
    '#EF4444': '11', // Red
    '#10B981': '10', // Green
    '#F59E0B': '5', // Orange
    '#8B5CF6': '3', // Purple
  };
  return colorMap[hexColor] || '1';
}
```

---

## 4. Error Handling

### 4.1 Client-Side Errors

**Notification Permission Denied:**
- Show toast: "Calendar reminders require notification permission. Please enable in browser settings."

**Google OAuth Errors:**
- Redirect to calendar with error message in URL
- Display toast with error details

**Quiet Hours Reminder Skipped:**
- Log to console (no user-facing notification)
- Reminder will not fire during quiet hours

### 4.2 API Errors

**Common Errors:**
- `GOOGLE_NOT_CONNECTED` (403) - User must connect Google Calendar first
- `GOOGLE_SYNC_FAILED` (500) - Google API error
- `GOOGLE_QUOTA_EXCEEDED` (429) - Too many API calls
- `INVALID_DATE_RANGE` (400) - Start date after end date

### 4.3 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Event reminder during quiet hours** | Skip notification (log to console) |
| **Google Calendar sync conflict** | Last write wins (no merge resolution in MVP) |
| **OAuth token expired** | Auto-refresh with refresh token, re-prompt if refresh fails |
| **User disconnects Google mid-sync** | Cancel sync, don't modify local events |
| **Browser closed when reminder scheduled** | Re-schedule on app load (check upcoming events) |

---

## 5. Testing Strategy

### 5.1 Unit Tests (Vitest)

**File:** `tests/unit/calendar/reminders.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleReminder, cancelReminder } from '@/lib/calendar/reminders';

describe('Calendar Reminders', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.Notification = {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should schedule reminder for future event', () => {
    const event = {
      id: '1',
      title: 'Test Event',
      date: '2025-12-25',
      startTime: '10:00:00',
      reminder: true,
      reminderMinutes: 15,
    };

    const userPrefs = { quietHoursEnabled: false };

    scheduleReminder(event, userPrefs);

    // Advance time to reminder
    vi.advanceTimersByTime(15 * 60 * 1000);

    // Verify notification shown
    expect(global.Notification).toHaveBeenCalledWith(
      'Test Event',
      expect.objectContaining({ body: expect.any(String) })
    );
  });

  it('should skip reminder during quiet hours', () => {
    const event = {
      id: '2',
      title: 'Early Morning Event',
      date: '2025-12-25',
      startTime: '06:00:00',
      reminder: true,
      reminderMinutes: 30, // Reminder at 5:30 AM
    };

    const userPrefs = {
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    };

    const notificationSpy = vi.spyOn(global, 'Notification');

    scheduleReminder(event, userPrefs);

    // Advance time to reminder
    vi.advanceTimersByTime(30 * 60 * 1000);

    // Verify notification NOT shown
    expect(notificationSpy).not.toHaveBeenCalled();
  });
});
```

### 5.2 Integration Tests

**File:** `tests/integration/calendar/google-sync.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { createSupabaseServerClient } from '@/lib/supabase/server';

describe('Google Calendar Sync Integration', () => {
  it('should sync events with Google Calendar', async () => {
    // Mock Google API responses
    // Test full sync flow: import + export
    // Verify database state after sync
  });
});
```

### 5.3 E2E Tests (Playwright)

**File:** `tests/e2e/calendar/calendar-flow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Calendar Flow', () => {
  test('should create event and set reminder', async ({ page }) => {
    await page.goto('/calendar');

    // Click date
    await page.click('.rdp-day:has-text("25")');

    // Fill event form
    await page.fill('[name="title"]', 'Family Dinner');
    await page.fill('[name="description"]', 'At grandma\'s house');
    await page.fill('[name="startTime"]', '18:00');
    await page.fill('[name="endTime"]', '20:00');

    // Enable reminder
    await page.check('[name="reminder"]');
    await page.selectOption('[name="reminderMinutes"]', '30');

    // Save event
    await page.click('button:text("Create Event")');

    // Verify event appears
    await expect(page.locator('text=Family Dinner')).toBeVisible();
  });

  test('should connect Google Calendar', async ({ page, context }) => {
    await page.goto('/calendar');

    // Click "Connect Google Calendar"
    await page.click('button:text("Connect Google Calendar")');

    // Redirect to Google OAuth (in real test, use mock)
    // For now, assume successful connection
    await page.goto('/calendar?google_connected=true');

    // Verify success toast
    await expect(page.locator('text=Google Calendar connected')).toBeVisible();
  });
});
```

---

## 6. Security Considerations

### 6.1 OAuth Security

**Google OAuth PKCE Flow:**
- Use PKCE (code challenge/verifier) to prevent authorization code interception
- State parameter verified on callback to prevent CSRF
- Tokens encrypted at rest in database

**Token Storage:**
- Refresh token encrypted with application secret key
- Access token never exposed to client (server-side only)

### 6.2 Data Privacy

**Calendar Events NOT Encrypted:**
- Google Calendar sync requires plaintext event data
- Events visible to server (acceptable tradeoff for sync functionality)
- Phase 2: Add option for E2EE events (opt-out of Google sync)

### 6.3 Notification Security

**Browser Notification API:**
- Requires user permission (explicit consent)
- Notifications only triggered for authenticated user's events
- No sensitive data in notification body (just event title)

---

## 7. Performance Targets

| Operation | Target Latency | Acceptable Max |
|-----------|---------------|----------------|
| **Calendar render (month view)** | < 500ms | < 1s (NFR-2.4) |
| **Create event** | < 300ms | < 1s |
| **Update event** | < 300ms | < 1s |
| **Delete event** | < 200ms | < 500ms |
| **Google Calendar sync** | < 3s | < 10s |
| **Schedule reminder** | < 50ms | < 200ms |

**Optimization Strategies:**
- Cache events in client state (avoid repeated API calls)
- Debounce Google sync (don't sync on every create/update)
- Pre-fetch events for ±30 days (reduce perceived latency)
- Use Web Workers for complex date calculations

---

## 8. Implementation Checklist

### Week 1: Backend & Database
- [ ] Create calendar_events table with RLS policies
- [ ] Implement GET /api/calendar/events (date range query)
- [ ] Implement POST /api/calendar/events (create event)
- [ ] Implement PATCH /api/calendar/events/:id (update event)
- [ ] Implement DELETE /api/calendar/events/:id (delete event)
- [ ] Set up Google OAuth credentials (Google Cloud Console)
- [ ] Implement GET /api/google/auth (OAuth PKCE flow)
- [ ] Implement GET /api/google/callback (token exchange)
- [ ] Implement POST /api/google/sync (bidirectional sync)
- [ ] Implement DELETE /api/google/disconnect
- [ ] Write unit tests for API routes (95% coverage)

### Week 2: Frontend & Integration
- [ ] Implement Calendar Screen layout
- [ ] Implement CalendarView component (react-day-picker)
- [ ] Implement EventForm component (create/edit modal)
- [ ] Implement EventDetail component (popup with details)
- [ ] Implement GoogleSyncPanel component (OAuth + sync UI)
- [ ] Implement browser notification permission request
- [ ] Implement reminder scheduling logic (lib/calendar/reminders.ts)
- [ ] Integrate quiet hours check in reminder logic
- [ ] Test event CRUD operations
- [ ] Test Google OAuth flow (mock or real Google account)
- [ ] Test bidirectional sync (import + export)
- [ ] Test browser notifications (with permission)
- [ ] Write integration tests (sync flows)
- [ ] Write E2E tests (Playwright scenarios)

### Week 2.5: Polish & Performance
- [ ] Implement auto-sync option (background interval)
- [ ] Implement last sync timestamp display
- [ ] Optimize calendar rendering (memoization, virtual rendering)
- [ ] Error handling for Google API failures
- [ ] Performance testing (calendar load time)
- [ ] Accessibility testing (keyboard navigation, screen readers)

---

## 9. Dependencies & Risks

**Depends On:**
- Epic 1: Authentication (OAuth state management, user preferences storage)

**Depended On By:**
- None

**Risks:**

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Google API quota limits** | High | Medium | Implement intelligent sync (debounce, batch), cache events, upgrade to paid quota if needed |
| **OAuth token refresh failures** | Medium | Low | Implement robust error handling, re-prompt user if refresh fails |
| **Browser notification permission denied** | Low | High | Gracefully degrade, show instructions for enabling, don't block app |
| **Quiet hours logic errors** | Low | Low | Thorough unit tests for edge cases (overnight quiet hours) |
| **Google Calendar sync conflicts** | Medium | Medium | Last write wins (no merge resolution in MVP), document limitation |

---

## 10. Acceptance Criteria

### US-4.1: Create Calendar Events

- [ ] User clicks date on calendar
- [ ] Event form opens with date pre-filled
- [ ] User enters title (required), description (optional)
- [ ] User selects all-day or timed event (start/end time)
- [ ] User clicks "Create Event"
- [ ] Event appears on calendar immediately for all family members
- [ ] Event stored in database with user_id and family_id

### US-4.2: Set Reminders

- [ ] User enables reminder when creating/editing event
- [ ] User selects minutes before event (15, 30, 60)
- [ ] Browser notification permission requested (if not granted)
- [ ] At reminder time, browser notification appears
- [ ] Notification shows event title and description
- [ ] Clicking notification navigates to calendar event
- [ ] If reminder time falls in quiet hours, notification skipped
- [ ] Reminder logic respects user's quiet hours preferences

### US-4.3: Google Calendar Sync

- [ ] User clicks "Connect Google Calendar"
- [ ] Redirected to Google OAuth consent screen
- [ ] User grants calendar access
- [ ] Redirected back to app, "Connected" status shown
- [ ] User clicks "Sync Now" button
- [ ] Google events imported into app (within 7 days past to 30 days future)
- [ ] App events (without google_event_id) exported to Google
- [ ] Last sync time displayed
- [ ] User can toggle auto-sync (sync on app load)
- [ ] User clicks "Disconnect", Google Calendar integration cleared

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | Claude (Tech Spec Generator) | Initial tech spec for Epic 4 |

---

**Status:** ✅ Ready for Implementation
