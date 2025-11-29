"use client";

import { ArrowLeft, Info, Sparkles, Bug, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Language, t } from "@/lib/translations";
import { loadChangelog, type ChangelogVersion } from "@/lib/changelog";

interface AboutScreenProps {
  language: Language;
  onBack: () => void;
  hideHeader?: boolean;
}

export function AboutScreen({ language, onBack, hideHeader = false }: AboutScreenProps) {
  const changelog = loadChangelog();
  const currentVersion = changelog.versions[0];

  return (
    <div className={`${hideHeader ? 'h-full' : 'h-screen'} flex flex-col bg-background overflow-hidden`}>
      {/* Header - only show when not using external header */}
      {!hideHeader && (
        <div className="border-b bg-card px-4 py-3 flex items-center gap-3 flex-shrink-0 z-40">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-card-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-card-foreground">{t("about.title", language)}</h2>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 pb-8 max-w-full">
          {/* App Info Card */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#B5179E] to-[#8B38BA] flex items-center justify-center shadow-lg">
                  <span className="text-4xl">💬</span>
                </div>
              </div>
              <CardTitle className="text-2xl">Chamo</CardTitle>
              <CardDescription>{t("about.tagline", language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Version Info */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <span className="text-sm text-muted-foreground">{t("about.version", language)}</span>
                <Badge variant="secondary" className="font-mono">
                  v{currentVersion?.version ?? "1.0.0"}
                </Badge>
              </div>

              {/* Release Date */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <span className="text-sm text-muted-foreground">
                  {t("about.releaseDate", language)}
                </span>
                <span className="text-sm font-medium">
                  {formatDate(currentVersion?.date ?? new Date().toISOString().split("T")[0], language)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Changelog Card */}
          <Card className="rounded-[20px] shadow-lg overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                {t("about.changelog", language)}
              </CardTitle>
              <CardDescription>{t("about.changelogDescription", language)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {changelog.versions.map((version, index) => (
                  <AccordionItem key={version.version} value={version.version}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Badge variant={index === 0 ? "default" : "outline"} className="font-mono">
                          v{version.version}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(version.date, language)}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <VersionChanges version={version} language={language} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

interface VersionChangesProps {
  version: ChangelogVersion;
  language: Language;
}

function VersionChanges({ version, language }: VersionChangesProps) {
  const { features, fixes, improvements } = version.changes;
  const hasAnyChanges = features.length > 0 || fixes.length > 0 || improvements.length > 0;

  if (!hasAnyChanges) {
    return (
      <p className="text-sm text-muted-foreground italic">
        {t("about.noChanges", language)}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {features.length > 0 && (
        <ChangeCategory
          icon={<Sparkles className="w-4 h-4 text-emerald-500" />}
          title={t("about.features", language)}
          items={features}
        />
      )}
      {fixes.length > 0 && (
        <ChangeCategory
          icon={<Bug className="w-4 h-4 text-amber-500" />}
          title={t("about.fixes", language)}
          items={fixes}
        />
      )}
      {improvements.length > 0 && (
        <ChangeCategory
          icon={<Zap className="w-4 h-4 text-blue-500" />}
          title={t("about.improvements", language)}
          items={improvements}
        />
      )}
    </div>
  );
}

interface ChangeCategoryProps {
  icon: React.ReactNode;
  title: string;
  items: string[];
}

function ChangeCategory({ icon, title, items }: ChangeCategoryProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <ul className="space-y-1 pl-6">
        {items.map((item, index) => (
          <li key={index} className="text-sm text-muted-foreground list-disc">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Format date for display based on language
 */
function formatDate(dateString: string, language: Language): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
