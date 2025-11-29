"use client";

import { useRouter } from "next/navigation";
import { MessageCircle, Image as ImageIcon, Calendar, Languages, Settings, LogOut, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Language, t } from "@/lib/translations";

interface UserFamilyMembership {
  id: string;
  familyId: string;
  role: string;
  family: {
    id: string;
    name: string;
    avatar?: string | null;
    inviteCode: string;
    maxMembers: number;
  };
}

export type MainHeaderView = "chat" | "settings" | "about" | "family-settings" | "family-invitations";

interface MainHeaderProps {
  // Family info
  familyName: string;
  familyAvatar: string;
  memberCount: number;

  // Current view
  currentView: MainHeaderView;

  // Multi-family support
  memberships: UserFamilyMembership[];
  activeFamilyId?: string | null;
  onSwitchFamily: (familyId: string) => void;

  // Navigation callbacks
  onChatClick: () => void;
  onSettingsClick: () => void;
  onLogoutClick: () => void;
  onInviteClick: () => void;

  // Chat view state
  showPhotos?: boolean;
  showCalendar?: boolean;
  showTranslation?: boolean;
  autoTranslate?: boolean;
  onPhotosClick?: () => void;
  onCalendarClick?: () => void;
  onShowTranslationChange?: (value: boolean) => void;
  onAutoTranslateChange?: (value: boolean) => void;

  // Language
  language: Language;
}

export function MainHeader({
  familyName,
  familyAvatar,
  memberCount,
  currentView,
  memberships,
  activeFamilyId,
  onSwitchFamily,
  onChatClick,
  onSettingsClick,
  onLogoutClick,
  onInviteClick,
  showPhotos = false,
  showCalendar = false,
  showTranslation = true,
  autoTranslate = true,
  onPhotosClick,
  onCalendarClick,
  onShowTranslationChange,
  onAutoTranslateChange,
  language,
}: MainHeaderProps) {
  const router = useRouter();

  const isInChatView = currentView === "chat";
  const showChatControls = isInChatView && !showCalendar && !showPhotos;

  return (
    <div className="border-b bg-card px-4 py-3 flex items-center justify-between flex-shrink-0 z-40">
      {/* Left side: Family info */}
      <div className="flex items-center gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={familyAvatar} />
          <AvatarFallback className="bg-gradient-to-br from-[#8B38BA] to-[#5518C1] text-white">
            {familyName.substring(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-card-foreground">{familyName}</h2>
          <p className="text-xs text-muted-foreground">
            {memberCount} {t("chat.members", language)}
          </p>
        </div>
      </div>

      {/* Right side: Action buttons */}
      <div className="flex items-center gap-1">
        {/* Chat button - leftmost, always visible */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onChatClick}
          className={`text-card-foreground ${isInChatView ? "bg-accent" : ""}`}
        >
          <MessageCircle className="w-5 h-5" />
        </Button>

        {/* Gallery button - always visible, disabled when not in chat */}
        <Button
          variant="ghost"
          size="icon"
          onClick={isInChatView ? onPhotosClick : undefined}
          disabled={!isInChatView}
          className={`text-card-foreground ${showPhotos && isInChatView ? "bg-accent" : ""} ${!isInChatView ? "opacity-50" : ""}`}
        >
          <ImageIcon className="w-5 h-5" />
        </Button>

        {/* Calendar button - always visible, disabled when not in chat */}
        <Button
          variant="ghost"
          size="icon"
          onClick={isInChatView ? onCalendarClick : undefined}
          disabled={!isInChatView}
          className={`text-card-foreground ${showCalendar && isInChatView ? "bg-accent" : ""} ${!isInChatView ? "opacity-50" : ""}`}
        >
          <Calendar className="w-5 h-5" />
        </Button>

        {/* Languages popover - always visible, disabled when not in chat or when in gallery/calendar mode */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={!showChatControls}
              className={`text-card-foreground ${!showChatControls ? "opacity-50" : ""}`}
            >
              <Languages className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          {showChatControls && (
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h3>{t("chat.translation", language)}</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-translation">{t("chat.showTranslation", language)}</Label>
                  <Switch
                    id="show-translation"
                    checked={showTranslation}
                    onCheckedChange={onShowTranslationChange}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-translate">{t("chat.autoTranslate", language)}</Label>
                  <Switch
                    id="auto-translate"
                    checked={autoTranslate}
                    onCheckedChange={onAutoTranslateChange}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("chat.autoTranslateDescription", language)}
                </p>
              </div>
            </PopoverContent>
          )}
        </Popover>

        {/* Family switcher - always visible */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-card-foreground"
              aria-label={t("multiFamily.menuTitle", language)}
            >
              <Users className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("multiFamily.menuTitle", language)}
            </DropdownMenuLabel>
            {memberships.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {t("multiFamily.empty", language)}
              </div>
            )}
            {memberships.map((membership) => {
              const isActive = membership.familyId === activeFamilyId;
              const initials = membership.family.name
                .split(" ")
                .map((part) => part.charAt(0))
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <DropdownMenuItem
                  key={membership.id}
                  disabled={isActive}
                  onClick={() => onSwitchFamily(membership.familyId)}
                  className="flex items-center gap-3"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={membership.family.avatar ?? undefined} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{membership.family.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {membership.role.toLowerCase()}
                    </p>
                  </div>
                  {isActive && (
                    <Badge variant="secondary" className="text-xs">
                      {t("multiFamily.active", language)}
                    </Badge>
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/family-setup")}>
              <Settings className="w-4 h-4 mr-2" />
              {t("multiFamily.familySettings", language)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Invite button - always visible */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onInviteClick}
          className="text-card-foreground"
          aria-label={t("settings.invite", language)}
        >
          <UserPlus className="w-5 h-5" />
        </Button>

        {/* Settings button - highlight when in settings view */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          className={`text-card-foreground ${currentView === "settings" || currentView === "about" ? "bg-accent" : ""}`}
        >
          <Settings className="w-5 h-5" />
        </Button>

        {/* Logout button */}
        <Button variant="ghost" onClick={onLogoutClick} className="text-card-foreground">
          <LogOut className="w-4 h-4 mr-2" />
          {t("settings.logout", language)}
        </Button>
      </div>
    </div>
  );
}
