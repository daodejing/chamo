"use client";

import { useState } from "react";
import { ArrowLeft, Globe, Shield, LogOut, Bell, Moon, Sun, Camera, Type, Users, UserMinus, Crown, Clock, Hash, Plus, Trash, Languages, Calendar as CalendarIcon, RefreshCw, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Language, t } from "@/lib/translations";
import { LanguageSelector } from "@/components/settings/language-selector";
import { TranslationLanguageSelector, type TranslationLanguage } from "@/components/settings/translation-language-selector";
import { formatDateTime } from "@/lib/utils/date-format";
import { AboutScreen } from "@/components/settings/about-screen";
import { Badge } from "@/components/ui/badge";
import { getCurrentVersion } from "@/lib/changelog";

interface FamilyMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: "admin" | "member";
  joinedAt: string;
}

interface Channel {
  id: string;
  name: string;
  description: string;
  icon: string;
  createdAt: string;
  createdBy: string;
}

interface SettingsScreenProps {
  userName: string;
  userEmail: string;
  userAvatar: string;
  familyName: string;
  familyAvatar: string;
  familyMembers: FamilyMember[];
  maxMembers: number;
  channels: Channel[];
  inviteCode: string;
  isDarkMode: boolean;
  fontSize: "small" | "medium" | "large";
  language: Language;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  googleConnected: boolean;
  googleEmail: string | null;
  lastSyncTime: Date | null;
  autoSync: boolean;
  onBack: () => void;
  onLogout: () => void;
  onThemeToggle: () => void;
  onFontSizeChange: (size: "small" | "medium" | "large") => void;
  onFamilyNameChange: (name: string) => void;
  onFamilyAvatarChange: (avatar: string) => void;
  onMaxMembersChange: (max: number) => void;
  onQuietHoursToggle: (enabled: boolean) => void;
  onQuietHoursStartChange: (time: string) => void;
  onQuietHoursEndChange: (time: string) => void;
  onRemoveMember: (memberId: string) => void;
  onCreateChannel: (channel: Channel) => void;
  onDeleteChannel: (channelId: string) => void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onSyncGoogle: () => void;
  onAutoSyncToggle: (enabled: boolean) => void;
  preferredTranslationLanguage?: TranslationLanguage;
  onPreferredTranslationLanguageChange?: (lang: TranslationLanguage) => void;
  // New props for persistent header integration
  hideHeader?: boolean;
  showAbout?: boolean;
  onAboutOpen?: () => void;
  onAboutClose?: () => void;
}

export function SettingsScreen({ userName, userEmail, userAvatar, familyName, familyAvatar, familyMembers, maxMembers, channels, inviteCode, isDarkMode, fontSize, language, quietHoursEnabled, quietHoursStart, quietHoursEnd, googleConnected, googleEmail, lastSyncTime, autoSync, onBack, onLogout, onThemeToggle, onFontSizeChange, onFamilyNameChange, onFamilyAvatarChange, onMaxMembersChange, onQuietHoursToggle, onQuietHoursStartChange, onQuietHoursEndChange, onRemoveMember, onCreateChannel, onDeleteChannel, onConnectGoogle, onDisconnectGoogle, onSyncGoogle, onAutoSyncToggle, preferredTranslationLanguage = "en", onPreferredTranslationLanguageChange, hideHeader = false, showAbout: propShowAbout, onAboutOpen, onAboutClose }: SettingsScreenProps) {
  const [internalShowAbout, setInternalShowAbout] = useState(false);

  // Use prop if provided (for lifted state), otherwise use internal state
  const showAbout = propShowAbout ?? internalShowAbout;
  const handleAboutOpen = onAboutOpen ?? (() => setInternalShowAbout(true));
  const handleAboutClose = onAboutClose ?? (() => setInternalShowAbout(false));

  // Show About screen when active
  if (showAbout) {
    return <AboutScreen language={language} onBack={handleAboutClose} hideHeader={hideHeader} />;
  }

  // Helper function to get channel display name
  const getChannelName = (channel: Channel) => {
    // If it's a translation key (starts with "channel."), translate it
    if (channel.name.startsWith("channel.")) {
      return t(channel.name as any, language);
    }
    // Otherwise, it's a custom user-created channel, return as-is
    return channel.name;
  };
  
  const handleCreateChannel = () => {
    const name = prompt(t("settings.channelNamePrompt", language));
    if (!name) return;
    
    const description = prompt(t("settings.channelDescPrompt", language));
    const icon = prompt(t("settings.channelIconPrompt", language)) || "💬";
    
    const newChannel: Channel = {
      id: `channel-${Date.now()}`,
      name,
      description: description || "",
      icon,
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: "1",
    };
    
    onCreateChannel(newChannel);
  };

  return (
    <div className={`${hideHeader ? 'h-full' : 'h-screen'} flex flex-col bg-background overflow-hidden`}>
      {/* Header - only show when not using external header */}
      {!hideHeader && (
        <div className="border-b bg-card px-4 py-3 flex items-center gap-3 flex-shrink-0 z-40">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-card-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-card-foreground">{t("settings.title", language)}</h2>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4 pb-8 max-w-full">
          {/* Language Preferences Section */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                {t("settings.language", language)}
              </CardTitle>
              <CardDescription>{t("settings.languageDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* App Language Selector */}
              <div className="space-y-2">
                <Label>{t("settings.appLanguage", language)}</Label>
                <LanguageSelector />
                <p className="text-sm text-muted-foreground">
                  {t("settings.appLanguageHelp", language)}
                </p>
              </div>

              <Separator />

              {/* Translation Language Selector */}
              <div className="space-y-2">
                <Label>{t("settings.translateMessagesTo", language)}</Label>
                <TranslationLanguageSelector
                  defaultValue={preferredTranslationLanguage}
                  onLanguageChange={onPreferredTranslationLanguageChange}
                />
                <p className="text-sm text-muted-foreground">
                  {t("settings.translateMessagesToHelp", language)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Family Group Section */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t("settings.familyGroup", language)}
              </CardTitle>
              <CardDescription>{t("settings.familyGroupDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <button 
                  className="relative group cursor-pointer"
                  onClick={() => alert(language === "ja" ? "家族グループのアイコンを変更する機能が���こに実装されます" : "Family group icon change feature will be implemented here")}
                >
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={familyAvatar} />
                    <AvatarFallback className="bg-gradient-to-br from-[#8B38BA] to-[#5518C1] text-white">
                      {familyName.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </button>
                <div className="flex flex-col gap-2 flex-1">
                  <p className="text-sm text-muted-foreground">
                    {t("settings.changeIcon", language)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="familyName">{t("settings.groupName", language)}</Label>
                <Input 
                  id="familyName" 
                  value={familyName} 
                  onChange={(e) => onFamilyNameChange(e.target.value)}
                  className="rounded-xl" 
                  placeholder={t("settings.groupNamePlaceholder", language)}
                />
              </div>
              <Separator />
              <div className="space-y-3">
                <div>
                  <Label>{t("settings.memberManagement", language)}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.membersCount", language, { current: familyMembers.length.toString(), max: maxMembers.toString() })}
                  </p>
                </div>
                {familyMembers.length >= maxMembers && (
                  <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-2 rounded-xl text-sm">
                    {t("settings.memberLimitReached", language)}
                  </div>
                )}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {familyMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="bg-gradient-to-br from-[#8B38BA] to-[#5518C1] text-white text-sm">
                            {member.name.substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm">{member.name}</p>
                            {member.role === "admin" && (
                              <Crown className="w-3 h-3 text-amber-500" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      {member.role !== "admin" && (
                        <Button
                          onClick={() => {
                            if (confirm(`${member.name}をグループから削除しますか？`)) {
                              onRemoveMember(member.id);
                            }
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="maxMembers">{t("settings.maxMembers", language)}</Label>
                <Select 
                  value={maxMembers.toString()} 
                  onValueChange={(value) => onMaxMembersChange(parseInt(value))}
                >
                  <SelectTrigger id="maxMembers" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">{language === "ja" ? "5人まで" : "Up to 5"}</SelectItem>
                    <SelectItem value="10">{language === "ja" ? "10人まで" : "Up to 10"}</SelectItem>
                    <SelectItem value="15">{language === "ja" ? "15人まで" : "Up to 15"}</SelectItem>
                    <SelectItem value="20">{language === "ja" ? "20人まで" : "Up to 20"}</SelectItem>
                    <SelectItem value="30">{language === "ja" ? "30人まで" : "Up to 30"}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("settings.maxMembersDescription", language)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Channels Section */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5" />
                {t("settings.channelManagement", language)}
              </CardTitle>
              <CardDescription>{t("settings.channelDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{language === "ja" ? "チャンネル" : "Channels"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.channelsCount", language, { count: channels.length.toString() })}
                  </p>
                </div>
                <Button
                  onClick={handleCreateChannel}
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("settings.create", language)}
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{channel.icon}</span>
                      <div>
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3 text-muted-foreground" />
                          <p className="text-sm">{getChannelName(channel)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{channel.description}</p>
                      </div>
                    </div>
                    {channel.id !== "general" && (
                      <Button
                        onClick={() => {
                          if (confirm(t("settings.deleteChannelConfirm", language, { name: getChannelName(channel) }))) {
                            onDeleteChannel(channel.id);
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Google Calendar Integration */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                {t("settings.googleCalendar", language)}
              </CardTitle>
              <CardDescription>{t("settings.googleCalendarDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!googleConnected ? (
                <>
                  <div className="text-sm text-muted-foreground">
                    {t("settings.notConnected", language)}
                  </div>
                  <Button
                    onClick={onConnectGoogle}
                    className="w-full rounded-xl bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white"
                  >
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {t("settings.connectGoogle", language)}
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <div>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            {t("settings.connectedAs", language, { email: googleEmail || "" })}
                          </p>
                          {lastSyncTime && (
                            <p className="text-xs text-muted-foreground">
                          {t("settings.lastSync", language, {
                                time: formatDateTime(lastSyncTime, language, "medium", "short"),
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={onDisconnectGoogle}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {t("settings.disconnectGoogle", language)}
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t("settings.autoSync", language)}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.autoSyncDescription", language)}
                      </p>
                    </div>
                    <Switch checked={autoSync} onCheckedChange={onAutoSyncToggle} />
                  </div>
                  
                  <Button
                    onClick={onSyncGoogle}
                    variant="outline"
                    className="w-full rounded-xl"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t("settings.syncNow", language)}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Theme Section */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                {t("settings.theme", language)}
              </CardTitle>
              <CardDescription>{t("settings.themeDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("settings.darkMode", language)}</Label>
                  <p className="text-sm text-muted-foreground">
                    {isDarkMode ? t("settings.darkModeActive", language) : t("settings.lightModeActive", language)}
                  </p>
                </div>
                <Switch checked={isDarkMode} onCheckedChange={onThemeToggle} />
              </div>
            </CardContent>
          </Card>

          {/* Font Size Section */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="w-5 h-5" />
                {t("settings.fontSize", language)}
              </CardTitle>
              <CardDescription>{t("settings.fontSizeDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant={fontSize === "small" ? "default" : "outline"}
                  onClick={() => onFontSizeChange("small")}
                  className={`flex-1 rounded-xl ${
                    fontSize === "small" 
                      ? "bg-gradient-to-r from-[#B5179E] to-[#8B38BA] text-white" 
                      : ""
                  }`}
                >
                  {t("settings.fontSmall", language)}
                </Button>
                <Button
                  variant={fontSize === "medium" ? "default" : "outline"}
                  onClick={() => onFontSizeChange("medium")}
                  className={`flex-1 rounded-xl ${
                    fontSize === "medium" 
                      ? "bg-gradient-to-r from-[#B5179E] to-[#8B38BA] text-white" 
                      : ""
                  }`}
                >
                  {t("settings.fontMedium", language)}
                </Button>
                <Button
                  variant={fontSize === "large" ? "default" : "outline"}
                  onClick={() => onFontSizeChange("large")}
                  className={`flex-1 rounded-xl ${
                    fontSize === "large" 
                      ? "bg-gradient-to-r from-[#B5179E] to-[#8B38BA] text-white" 
                      : ""
                  }`}
                >
                  {t("settings.fontLarge", language)}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Profile Section */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle>{t("settings.profile", language)}</CardTitle>
              <CardDescription>{t("settings.profileDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <button 
                  className="relative group cursor-pointer"
                  onClick={() => alert(language === "ja" ? "写真を変更する機能がここに実装されます" : "Photo change feature will be implemented here")}
                >
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={userAvatar} />
                    <AvatarFallback className="bg-gradient-to-br from-[#8B38BA] to-[#5518C1] text-white">
                      {userName.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </button>
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    {t("settings.changeIcon", language)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{t("settings.name", language)}</Label>
                <Input 
                  id="name" 
                  defaultValue={userName} 
                  className="rounded-xl" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("settings.email", language)}</Label>
                <Input 
                  id="email" 
                  type="email" 
                  defaultValue={userEmail} 
                  disabled 
                  className="rounded-xl" 
                />
              </div>
            </CardContent>
          </Card>

          {/* Translation Settings */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                {t("settings.translationSettings", language)}
              </CardTitle>
              <CardDescription>{t("settings.translationDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language">{t("settings.targetLanguage", language)}</Label>
                <Select defaultValue="en">
                  <SelectTrigger id="language" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{language === "ja" ? "英語" : "English"}</SelectItem>
                    <SelectItem value="ja">{language === "ja" ? "日本語" : "Japanese"}</SelectItem>
                    <SelectItem value="es">{language === "ja" ? "スペイン語" : "Spanish"}</SelectItem>
                    <SelectItem value="fr">{language === "ja" ? "フランス語" : "French"}</SelectItem>
                    <SelectItem value="de">{language === "ja" ? "ドイツ語" : "German"}</SelectItem>
                    <SelectItem value="zh">{language === "ja" ? "中国語" : "Chinese"}</SelectItem>
                    <SelectItem value="ko">{language === "ja" ? "韓国語" : "Korean"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("settings.showTranslationDefault", language)}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.showTranslationDescription", language)}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("settings.autoTranslate", language)}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.autoTranslateDescription", language)}</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {t("settings.quietHours", language)}
              </CardTitle>
              <CardDescription>{t("settings.quietHoursDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("settings.enableQuietHours", language)}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.quietHoursInfo", language)}
                  </p>
                </div>
                <Switch 
                  checked={quietHoursEnabled} 
                  onCheckedChange={onQuietHoursToggle} 
                />
              </div>
              {quietHoursEnabled && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quietStart">{t("settings.startTime", language)}</Label>
                      <Input
                        id="quietStart"
                        type="time"
                        value={quietHoursStart}
                        onChange={(e) => onQuietHoursStartChange(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quietEnd">{t("settings.endTime", language)}</Label>
                      <Input
                        id="quietEnd"
                        type="time"
                        value={quietHoursEnd}
                        onChange={(e) => onQuietHoursEndChange(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-2 rounded-xl text-sm">
                    {t("settings.quietHoursActive", language, { start: quietHoursStart, end: quietHoursEnd })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {t("settings.notifications", language)}
              </CardTitle>
              <CardDescription>{t("settings.notificationsDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("settings.pushNotifications", language)}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.pushNotificationsDescription", language)}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("settings.sound", language)}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.soundDescription", language)}</p>
                </div>
                <Switch defaultChecked />
              </div>
              {quietHoursEnabled && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t("settings.muteQuietHours", language)}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.muteQuietHoursDescription", language)}
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t("settings.security", language)}
              </CardTitle>
              <CardDescription>{t("settings.securityDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("settings.inviteCode", language)}</Label>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={inviteCode}
                      readOnly
                      className="rounded-xl font-mono sm:flex-1"
                      onFocus={(event) => event.target.select()}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("settings.inviteCodeDescription", language)}
                </p>
              </div>
              <Separator />
              <Button variant="outline" className="w-full rounded-xl">
                {t("settings.setPasscode", language)}
              </Button>
              <Button variant="outline" className="w-full rounded-xl">
                {t("settings.setBiometrics", language)}
              </Button>
            </CardContent>
          </Card>

          {/* About */}
          <Card
            className="rounded-[20px] shadow-lg overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleAboutOpen}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                {t("about.title", language)}
              </CardTitle>
              <CardDescription>{t("about.tagline", language)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("about.version", language)}</span>
                <Badge variant="secondary" className="font-mono">
                  v{getCurrentVersion()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Logout */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardContent className="pt-6">
              <Button
                onClick={onLogout}
                variant="outline"
                className="w-full rounded-xl border-2 hover:bg-muted"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t("settings.logout", language)}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
