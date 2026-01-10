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
  // Family info (optional - when user has no active family)
  familyName?: string;
  familyAvatar?: string;
  memberCount?: number;

  // Current view
  currentView: MainHeaderView;

  // Multi-family support
  memberships?: UserFamilyMembership[];
  activeFamilyId?: string | null;
  onSwitchFamily?: (familyId: string) => void;

  // Navigation callbacks
  onChatClick?: () => void;
  onSettingsClick?: () => void;
  onLogoutClick: () => void;
  onInviteClick?: () => void;

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
  memberships = [],
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

  const hasFamily = !!familyName;
  const isInChatView = currentView === "chat";
  const showChatControls = isInChatView && !showCalendar && !showPhotos && hasFamily;

  return (
    <div className="border-b bg-card px-4 py-3 flex items-center justify-between flex-shrink-0 z-40">
      {/* Left side: Family info or app branding */}
      <div className="flex items-center gap-3">
        {hasFamily ? (
          <>
            <Avatar className="w-10 h-10">
              <AvatarImage src={familyAvatar} />
              <AvatarFallback className="bg-gradient-to-br from-[#8B38BA] to-[#5518C1] text-white">
                {familyName.substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-card-foreground">{familyName}</h2>
              <p className="text-xs text-muted-foreground">
                {memberCount} {t(memberCount === 1 ? "chat.member" : "chat.members", language)}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-10 h-10 bg-gradient-to-br from-[#B5179E] to-[#5518C1] rounded-[12px] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-card-foreground font-medium">{t("login.title", language)}</h2>
            </div>
          </>
        )}
      </div>

      {/* Right side: Action buttons */}
      <div className="flex items-center gap-1">
        {/* Chat button - disabled when no family */}
        <Button
          variant="ghost"
          size="icon"
          onClick={hasFamily ? onChatClick : undefined}
          disabled={!hasFamily}
          className={`text-card-foreground ${isInChatView && hasFamily ? "bg-accent" : ""} ${!hasFamily ? "opacity-50" : ""}`}
        >
          <MessageCircle className="w-5 h-5" />
        </Button>

        {/* Gallery button - disabled when no family or not in chat */}
        <Button
          variant="ghost"
          size="icon"
          onClick={hasFamily && isInChatView ? onPhotosClick : undefined}
          disabled={!hasFamily || !isInChatView}
          className={`text-card-foreground ${showPhotos && isInChatView && hasFamily ? "bg-accent" : ""} ${!hasFamily || !isInChatView ? "opacity-50" : ""}`}
        >
          <ImageIcon className="w-5 h-5" />
        </Button>

        {/* Calendar button - disabled when no family or not in chat */}
        <Button
          variant="ghost"
          size="icon"
          onClick={hasFamily && isInChatView ? onCalendarClick : undefined}
          disabled={!hasFamily || !isInChatView}
          className={`text-card-foreground ${showCalendar && isInChatView && hasFamily ? "bg-accent" : ""} ${!hasFamily || !isInChatView ? "opacity-50" : ""}`}
        >
          <Calendar className="w-5 h-5" />
        </Button>

        {/* Languages popover - disabled when no family or not in chat */}
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

        {/* Family switcher - always visible, shows empty state when no memberships */}
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
                  onClick={() => onSwitchFamily?.(membership.familyId)}
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

        {/* Invite button - disabled when no family */}
        <Button
          variant="ghost"
          size="icon"
          onClick={hasFamily ? onInviteClick : undefined}
          disabled={!hasFamily}
          className={`text-card-foreground ${!hasFamily ? "opacity-50" : ""}`}
          aria-label={t("settings.invite", language)}
        >
          <UserPlus className="w-5 h-5" />
        </Button>

        {/* Settings button - always navigates to settings */}
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
