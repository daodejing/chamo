import { useState, useRef, useEffect } from "react";
import { Send, Image as ImageIcon, Smile, Languages, Settings, Trash2, Clock, X, Hash, ChevronDown, Edit2, Check, Calendar } from "lucide-react";
import { CalendarView } from "./calendar-view";
import { PhotoGallery } from "./photo-gallery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Language, t } from "@/lib/translations";

interface Message {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  message: string;
  translation: string;
  timestamp: string;
  isMine: boolean;
  isEdited?: boolean;
}

interface ScheduledMessage {
  id: string;
  message: string;
  scheduledTime: Date;
  userId: string;
  userName: string;
  userAvatar: string;
}

interface Channel {
  id: string;
  name: string;
  description: string;
  icon: string;
  createdAt: string;
  createdBy: string;
}

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
}

interface PhotoFolder {
  id: string;
  name: string;
  icon: string;
  createdAt: string;
  createdBy: string;
  photoCount: number;
}

interface Photo {
  id: string;
  url: string;
  caption: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedByAvatar: string;
  uploadedAt: string;
  folderId: string;
  likes: string[];
  comments: PhotoComment[];
}

interface PhotoComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  comment: string;
  timestamp: string;
}

interface FamilyMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: "admin" | "member";
  joinedAt: string;
}

interface ChatScreenProps {
  chatName: string;
  chatAvatar: string;
  chatMembers: number;
  messages: Message[];
  channels: Channel[];
  currentChannelId: string;
  scheduledMessages: ScheduledMessage[];
  calendarEvents: CalendarEvent[];
  photos: Photo[];
  photoFolders: PhotoFolder[];
  familyMembers: FamilyMember[];
  currentUserId: string;
  currentUserName: string;
  language: Language;
  onSettingsClick: () => void;
  onChannelChange: (channelId: string) => void;
  onSendMessage: (message: string) => void;
  onScheduleMessage: (message: string, scheduledTime: Date) => void;
  onDeleteMessage: (messageId: string) => void;
  onEditMessage: (messageId: string, newText: string) => void;
  onCancelScheduledMessage: (messageId: string) => void;
  onAddEvent: (event: CalendarEvent) => void;
  onEditEvent: (eventId: string, event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
  onAddPhoto: (photo: Photo) => void;
  onDeletePhoto: (photoId: string) => void;
  onLikePhoto: (photoId: string, userId: string) => void;
  onAddPhotoComment: (photoId: string, comment: PhotoComment) => void;
  onCreateFolder: (folder: PhotoFolder) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onMovePhotoToFolder: (photoId: string, folderId: string) => void;
}

export function ChatScreen({ chatName, chatAvatar, chatMembers, messages, channels, currentChannelId, scheduledMessages, calendarEvents, photos, photoFolders, familyMembers, currentUserId, currentUserName, language, onSettingsClick, onChannelChange, onSendMessage, onScheduleMessage, onDeleteMessage, onEditMessage, onCancelScheduledMessage, onAddEvent, onEditEvent, onDeleteEvent, onAddPhoto, onDeletePhoto, onLikePhoto, onAddPhotoComment, onCreateFolder, onDeleteFolder, onRenameFolder, onMovePhotoToFolder }: ChatScreenProps) {
  const [newMessage, setNewMessage] = useState("");
  const [showTranslation, setShowTranslation] = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage("");
    }
  };

  const handleSchedule = () => {
    if (newMessage.trim() && scheduleDate && scheduleTime) {
      const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      
      // Validate that the scheduled time is in the future
      if (scheduledDateTime <= new Date()) {
        alert("予約時刻は現在時刻より後に設定してください");
        return;
      }
      
      onScheduleMessage(newMessage, scheduledDateTime);
      setNewMessage("");
      setScheduleDate("");
      setScheduleTime("");
      setIsScheduleDialogOpen(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Set default date and time when opening the schedule dialog
  const handleOpenScheduleDialog = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    
    setScheduleDate(tomorrow.toISOString().split('T')[0]);
    setScheduleTime("09:00");
    setIsScheduleDialogOpen(true);
  };

  const handleStartEdit = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId);
    setEditingText(currentText);
  };

  const handleSaveEdit = () => {
    if (editingMessageId && editingText.trim()) {
      onEditMessage(editingMessageId, editingText);
      setEditingMessageId(null);
      setEditingText("");
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const currentChannel = channels.find(c => c.id === currentChannelId);
  
  // Helper function to get channel display name
  const getChannelName = (channel: Channel) => {
    // If it's a translation key (starts with "channel."), translate it
    if (channel.name.startsWith("channel.")) {
      return t(channel.name as any, language);
    }
    // Otherwise, it's a custom user-created channel, return as-is
    return channel.name;
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={chatAvatar} />
            <AvatarFallback className="bg-gradient-to-br from-[#8B38BA] to-[#5518C1] text-white">
              {chatName.substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-card-foreground">{chatName}</h2>
            <p className="text-xs text-muted-foreground">{chatMembers} {t("chat.members", language)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => {
            setShowPhotos(!showPhotos);
            if (!showPhotos) setShowCalendar(false);
          }}
          className={`text-card-foreground ${showPhotos ? 'bg-accent' : ''}`}
        >
          <ImageIcon className="w-5 h-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => {
            setShowCalendar(!showCalendar);
            if (!showCalendar) setShowPhotos(false);
          }}
          className={`text-card-foreground ${showCalendar ? 'bg-accent' : ''}`}
        >
          <Calendar className="w-5 h-5" />
        </Button>
        {!showCalendar && !showPhotos && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-card-foreground">
                <Languages className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h3>{t("chat.translation", language)}</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-translation">{t("chat.showTranslation", language)}</Label>
                  <Switch
                    id="show-translation"
                    checked={showTranslation}
                    onCheckedChange={setShowTranslation}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-translate">{t("chat.autoTranslate", language)}</Label>
                  <Switch
                    id="auto-translate"
                    checked={autoTranslate}
                    onCheckedChange={setAutoTranslate}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("chat.autoTranslateDescription", language)}
                </p>
              </div>
            </PopoverContent>
          </Popover>
        )}
        <Button variant="ghost" size="icon" onClick={onSettingsClick} className="text-card-foreground">
          <Settings className="w-5 h-5" />
        </Button>
        </div>
      </div>

      {/* Channel Selector - Only show when not in calendar or photo view */}
      {!showCalendar && !showPhotos && (
        <div className="border-b bg-card/50 px-4 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-auto py-2 px-3 rounded-xl hover:bg-muted">
              <div className="flex items-center gap-2">
                <span className="text-lg">{currentChannel?.icon}</span>
                <div className="text-left">
                  <div className="flex items-center gap-1">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    <span>{currentChannel && getChannelName(currentChannel)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{currentChannel?.description}</p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            {channels.map((channel) => (
              <DropdownMenuItem
                key={channel.id}
                onClick={() => onChannelChange(channel.id)}
                className={`p-3 cursor-pointer ${
                  channel.id === currentChannelId ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-xl">{channel.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm">{getChannelName(channel)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{channel.description}</p>
                  </div>
                  {channel.id === currentChannelId && (
                    <Badge variant="secondary" className="text-xs">
                      {t("chat.selected", language)}
                    </Badge>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      )}

      {/* Calendar, Photos, or Chat Messages */}
      {showCalendar ? (
        <CalendarView
          events={calendarEvents}
          familyMembers={familyMembers}
          language={language}
          onAddEvent={onAddEvent}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
        />
      ) : showPhotos ? (
        <PhotoGallery
          photos={photos}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          familyMembers={familyMembers}
          photoFolders={photoFolders}
          language={language}
          onAddPhoto={onAddPhoto}
          onDeletePhoto={onDeletePhoto}
          onLikePhoto={onLikePhoto}
          onAddComment={onAddPhotoComment}
          onCreateFolder={onCreateFolder}
          onDeleteFolder={onDeleteFolder}
          onRenameFolder={onRenameFolder}
          onMovePhotoToFolder={onMovePhotoToFolder}
        />
      ) : (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 p-4 bg-background">
        <div className="space-y-4">
          {/* Scheduled Messages Banner */}
          {scheduledMessages.length > 0 && (
            <Card className="p-3 bg-blue-500/10 border-blue-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {t("chat.scheduledMessages", language, { count: scheduledMessages.length })}
                  </span>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20">
                      {language === "ja" ? "表示" : "View"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-3">
                      <h4>{t("chat.scheduledMessagesTitle", language)}</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {scheduledMessages.map((scheduled) => (
                          <div
                            key={scheduled.id}
                            className="p-3 rounded-xl border bg-card space-y-2"
                          >
                            <p className="text-sm">{scheduled.message}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {scheduled.scheduledTime.toLocaleString("ja-JP", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                              <Button
                                onClick={() => onCancelScheduledMessage(scheduled.id)}
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <X className="w-3 h-3 mr-1" />
                                {t("chat.cancel", language)}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </Card>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 group ${msg.isMine ? "flex-row-reverse" : ""}`}
            >
              {!msg.isMine && (
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={msg.userAvatar} />
                  <AvatarFallback className="bg-gradient-to-br from-[#8B38BA] to-[#5518C1] text-white text-xs">
                    {msg.userName.substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={`flex flex-col gap-1 max-w-[70%] ${msg.isMine ? "items-end" : ""}`}>
                {!msg.isMine && (
                  <span className="text-xs text-muted-foreground px-1">{msg.userName}</span>
                )}
                <div className="relative">
                  {editingMessageId === msg.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="rounded-xl bg-input-background text-foreground"
                        autoFocus
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSaveEdit();
                          }
                          if (e.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveEdit}
                          size="sm"
                          className="rounded-xl bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          {t("chat.save", language)}
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                        >
                          {t("chat.cancel", language)}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`rounded-[20px] px-4 py-3 shadow-md ${
                          msg.isMine
                            ? "bg-gradient-to-r from-[#B5179E] to-[#8B38BA] text-white"
                            : "bg-card border text-card-foreground"
                        }`}
                      >
                        <p className={msg.isMine ? "text-white" : "text-card-foreground"}>{msg.message}</p>
                        {showTranslation && msg.translation && (
                          <div
                            className={`mt-2 pt-2 border-t text-sm italic ${
                              msg.isMine
                                ? "border-white/20 text-white/80"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {msg.translation}
                          </div>
                        )}
                        {msg.isEdited && (
                          <p className={`text-xs mt-1 ${msg.isMine ? "text-white/60" : "text-muted-foreground"}`}>
                            {t("chat.edited", language)}
                          </p>
                        )}
                      </div>
                      {msg.isMine && (
                        <div className={`absolute top-1/2 -translate-y-1/2 -left-20 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                          <Button
                            onClick={() => handleStartEdit(msg.id, msg.message)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              if (confirm(t("chat.deleteConfirm", language))) {
                                onDeleteMessage(msg.id);
                              }
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <span className="text-xs text-muted-foreground px-1">{msg.timestamp}</span>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="flex-shrink-0 text-card-foreground">
            <ImageIcon className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="flex-shrink-0 text-card-foreground">
            <Smile className="w-5 h-5" />
          </Button>
          <Input
            placeholder={t("chat.messageInput", language)}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 rounded-[20px] bg-input-background text-foreground placeholder:text-muted-foreground"
          />
          
          {/* Schedule Message Dialog */}
          <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={handleOpenScheduleDialog}
                variant="ghost"
                size="icon"
                disabled={!newMessage.trim()}
                className="flex-shrink-0 text-card-foreground"
              >
                <Clock className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("chat.scheduleMessage", language)}</DialogTitle>
                <DialogDescription>
                  メッセ���ジを送信する日時を指定してください
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-muted">
                  <p className="text-sm">{newMessage}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-date">{t("chat.date", language)}</Label>
                    <Input
                      id="schedule-date"
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="rounded-xl"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-time">{t("chat.time", language)}</Label>
                    <Input
                      id="schedule-time"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsScheduleDialogOpen(false)}
                    variant="outline"
                    className="flex-1 rounded-xl"
                  >
                    キャンセル
                  </Button>
                  <Button
                    onClick={handleSchedule}
                    disabled={!scheduleDate || !scheduleTime}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white"
                  >
                    予約
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            onClick={handleSend}
            size="icon"
            className="flex-shrink-0 bg-gradient-to-r from-[#E7B2DF] to-[#CF68C0] hover:from-[#d9a0d1] hover:to-[#bd5aae] text-white rounded-full w-10 h-10 shadow-lg"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        {autoTranslate && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Languages className="w-3 h-3" />
            自動翻訳がオンになっています
          </p>
        )}
      </div>
        </>
      )}
    </div>
  );
}
