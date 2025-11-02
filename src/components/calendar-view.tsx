import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Clock, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Language, t } from "@/lib/translations";
import { formatMonthYear } from "@/lib/utils/date-format";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  userId: string;
  userName: string;
  color: string;
  allDay: boolean;
  reminder: boolean;
  reminderMinutes?: number;
}

interface FamilyMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: "admin" | "member";
  joinedAt: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  familyMembers: FamilyMember[];
  language: Language;
  onAddEvent: (event: CalendarEvent) => void;
  onEditEvent: (eventId: string, event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
}

const MEMBER_COLORS: { [key: string]: string } = {
  "1": "#8b5cf6", // Purple
  "2": "#3b82f6", // Blue
  "3": "#ec4899", // Pink
  "4": "#f59e0b", // Amber
};

export function CalendarView({ events, familyMembers, language, onAddEvent, onEditEvent, onDeleteEvent }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [selectedMember, setSelectedMember] = useState("1");
  const [allDay, setAllDay] = useState(false);
  const [reminder, setReminder] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(30);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getEventsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => event.date === dateStr);
  };

  const handleAddEvent = () => {
    if (!title || !selectedDate) return;

    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const member = familyMembers.find(m => m.id === selectedMember);

    const newEvent: CalendarEvent = {
      id: `event-${Date.now()}`,
      title,
      description,
      date: dateStr,
      startTime,
      endTime,
      userId: selectedMember,
      userName: member?.name || "",
      color: MEMBER_COLORS[selectedMember] || "#8b5cf6",
      allDay,
      reminder,
      reminderMinutes: reminder ? reminderMinutes : undefined,
    };

    onAddEvent(newEvent);
    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEditEvent = () => {
    if (!editingEvent || !title) return;

    const member = familyMembers.find(m => m.id === selectedMember);

    const updatedEvent: CalendarEvent = {
      ...editingEvent,
      title,
      description,
      startTime,
      endTime,
      userId: selectedMember,
      userName: member?.name || "",
      color: MEMBER_COLORS[selectedMember] || "#8b5cf6",
      allDay,
      reminder,
      reminderMinutes: reminder ? reminderMinutes : undefined,
    };

    onEditEvent(editingEvent.id, updatedEvent);
    resetForm();
    setEditingEvent(null);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStartTime("09:00");
    setEndTime("10:00");
    setSelectedMember("1");
    setAllDay(false);
    setReminder(false);
    setReminderMinutes(30);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description);
    setStartTime(event.startTime);
    setEndTime(event.endTime);
    setSelectedMember(event.userId);
    setAllDay(event.allDay);
    setReminder(event.reminder);
    setReminderMinutes(event.reminderMinutes || 30);
  };

  const openAddDialog = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
    resetForm();
    setIsAddDialogOpen(true);
  };

  const today = new Date();
  const isToday = (day: number) => {
    return currentDate.getFullYear() === today.getFullYear() &&
           currentDate.getMonth() === today.getMonth() &&
           day === today.getDate();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={previousMonth} className="text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg text-foreground">{formatMonthYear(currentDate, language)}</h2>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="text-foreground">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex gap-2 flex-wrap">
          {familyMembers.map(member => (
            <Badge key={member.id} variant="outline" className="text-xs">
              <div
                className="w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: MEMBER_COLORS[member.id] || "#8b5cf6" }}
              />
              {member.name}
            </Badge>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {[
              t("calendar.sunday", language),
              t("calendar.monday", language),
              t("calendar.tuesday", language),
              t("calendar.wednesday", language),
              t("calendar.thursday", language),
              t("calendar.friday", language),
              t("calendar.saturday", language)
            ].map((day) => (
              <div key={day} className="text-center text-xs text-muted-foreground p-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startingDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const dayEvents = getEventsForDate(day);

              return (
                <button
                  key={day}
                  onClick={() => openAddDialog(day)}
                  className={`aspect-square p-1 rounded-full border transition-colors relative ${
                    isToday(day)
                      ? "bg-primary/10 border-primary text-foreground"
                      : "hover:bg-muted border-border text-foreground"
                  }`}
                >
                  <div className="text-xs text-center mb-1 text-foreground font-medium">{day}</div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        className="w-full h-1 rounded"
                        style={{ backgroundColor: event.color }}
                      />
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[8px] text-center text-muted-foreground">
                        +{dayEvents.length - 2}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Events List for Selected Date */}
          {selectedDate && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base text-foreground">
                  {t("calendar.eventsFor", language, { month: (selectedDate.getMonth() + 1).toString(), day: selectedDate.getDate().toString() })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {getEventsForDate(selectedDate.getDate()).map(event => (
                    <div
                      key={event.id}
                      className="p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                      style={{ borderLeftWidth: "4px", borderLeftColor: event.color }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm text-foreground">{event.title}</p>
                            <Badge variant="secondary" className="text-xs">
                              {event.userName}
                            </Badge>
                            {event.id.startsWith("google-") && (
                              <Badge variant="outline" className="text-xs border-blue-500 text-blue-600 dark:text-blue-400">
                                Google
                              </Badge>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mb-1">
                              {event.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {event.allDay ? t("calendar.allDay", language) : `${event.startTime} - ${event.endTime}`}
                            </div>
                            {event.reminder && (
                              <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <Bell className="w-3 h-3" />
                                {event.reminderMinutes} {t("calendar.minutes", language)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            onClick={() => openEditDialog(event)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-foreground"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            onClick={() => {
                              if (confirm(t("calendar.deleteConfirm", language))) {
                                onDeleteEvent(event.id);
                              }
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {getEventsForDate(selectedDate.getDate()).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t("calendar.noEvents", language)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Add Event Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("calendar.addEvent", language)}</DialogTitle>
            <DialogDescription>
              {selectedDate && (language === "ja"
                ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`
                : `${selectedDate.getMonth() + 1}/${selectedDate.getDate()}`)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("calendar.title", language)}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("calendar.titlePlaceholder", language)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("calendar.description", language)}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("calendar.descriptionPlaceholder", language)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member">{t("calendar.assignee", language)}</Label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {familyMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="all-day">{t("calendar.allDay", language)}</Label>
              <Switch
                id="all-day"
                checked={allDay}
                onCheckedChange={setAllDay}
              />
            </div>
            {!allDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">{t("calendar.startTime", language)}</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">{t("calendar.endTime", language)}</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
            )}
            <div className="space-y-3 p-3 rounded-xl border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <Label htmlFor="reminder">{t("calendar.reminder", language)}</Label>
                </div>
                <Switch
                  id="reminder"
                  checked={reminder}
                  onCheckedChange={setReminder}
                />
              </div>
              {reminder && (
                <div className="space-y-2">
                  <Label htmlFor="reminder-time">{t("calendar.reminderTime", language)}</Label>
                  <Select
                    value={reminderMinutes.toString()}
                    onValueChange={(value) => setReminderMinutes(parseInt(value))}
                  >
                    <SelectTrigger id="reminder-time" className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">{t("calendar.5minutes", language)}</SelectItem>
                      <SelectItem value="10">{t("calendar.10minutes", language)}</SelectItem>
                      <SelectItem value="15">{t("calendar.15minutes", language)}</SelectItem>
                      <SelectItem value="30">{t("calendar.30minutes", language)}</SelectItem>
                      <SelectItem value="60">{t("calendar.1hour", language)}</SelectItem>
                      <SelectItem value="120">{t("calendar.2hours", language)}</SelectItem>
                      <SelectItem value="1440">{t("calendar.1day", language)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsAddDialogOpen(false)}
                variant="outline"
                className="flex-1 rounded-xl"
              >
                {t("chat.cancel", language)}
              </Button>
              <Button
                onClick={handleAddEvent}
                disabled={!title}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("calendar.add", language)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("calendar.editEvent", language)}</DialogTitle>
            <DialogDescription>
              {language === "ja" ? "予定の詳細を変更します" : "Edit event details"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">{t("calendar.title", language)}</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("calendar.titlePlaceholder", language)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t("calendar.description", language)}</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("calendar.descriptionPlaceholder", language)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-member">{t("calendar.assignee", language)}</Label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {familyMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-all-day">{t("calendar.allDay", language)}</Label>
              <Switch
                id="edit-all-day"
                checked={allDay}
                onCheckedChange={setAllDay}
              />
            </div>
            {!allDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start-time">{t("calendar.startTime", language)}</Label>
                  <Input
                    id="edit-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end-time">{t("calendar.endTime", language)}</Label>
                  <Input
                    id="edit-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
            )}
            <div className="space-y-3 p-3 rounded-xl border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <Label htmlFor="edit-reminder">{t("calendar.reminder", language)}</Label>
                </div>
                <Switch
                  id="edit-reminder"
                  checked={reminder}
                  onCheckedChange={setReminder}
                />
              </div>
              {reminder && (
                <div className="space-y-2">
                  <Label htmlFor="edit-reminder-time">{t("calendar.reminderTime", language)}</Label>
                  <Select
                    value={reminderMinutes.toString()}
                    onValueChange={(value) => setReminderMinutes(parseInt(value))}
                  >
                    <SelectTrigger id="edit-reminder-time" className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">{t("calendar.5minutes", language)}</SelectItem>
                      <SelectItem value="10">{t("calendar.10minutes", language)}</SelectItem>
                      <SelectItem value="15">{t("calendar.15minutes", language)}</SelectItem>
                      <SelectItem value="30">{t("calendar.30minutes", language)}</SelectItem>
                      <SelectItem value="60">{t("calendar.1hour", language)}</SelectItem>
                      <SelectItem value="120">{t("calendar.2hours", language)}</SelectItem>
                      <SelectItem value="1440">{t("calendar.1day", language)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setEditingEvent(null)}
                variant="outline"
                className="flex-1 rounded-xl"
              >
                {t("chat.cancel", language)}
              </Button>
              <Button
                onClick={handleEditEvent}
                disabled={!title}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white"
              >
                {t("chat.save", language)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
