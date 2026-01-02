"use client";

import { useState } from "react";
import { AlertTriangle, Crown, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Language, t } from "@/lib/translations";

export interface BlockingFamily {
  familyId: string;
  familyName: string;
  memberCount: number;
  requiresAction: boolean;
}

interface LastAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockingFamilies: BlockingFamily[];
  language: Language;
  onPromoteMember: (familyId: string, familyName: string) => void;
  onDeleteFamily: (familyId: string, familyName: string) => void;
}

export function LastAdminModal({
  open,
  onOpenChange,
  blockingFamilies,
  language,
  onPromoteMember,
  onDeleteFamily,
}: LastAdminModalProps) {
  const [processingFamily, setProcessingFamily] = useState<string | null>(null);

  // Single family scenario - most common case
  const singleFamily = blockingFamilies.length === 1 ? blockingFamilies[0] : null;

  const handlePromote = async (familyId: string, familyName: string) => {
    setProcessingFamily(familyId);
    try {
      await onPromoteMember(familyId, familyName);
    } finally {
      setProcessingFamily(null);
    }
  };

  const handleDelete = async (familyId: string, familyName: string) => {
    setProcessingFamily(familyId);
    try {
      await onDeleteFamily(familyId, familyName);
    } finally {
      setProcessingFamily(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            {t("lastAdmin.title", language)}
          </DialogTitle>
          <DialogDescription>
            {t("lastAdmin.description", language)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {singleFamily ? (
            // Single family - show two clear options
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <Crown className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-medium">{singleFamily.familyName}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("lastAdmin.memberCount", language, {
                      count: singleFamily.memberCount.toString(),
                    })}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => handlePromote(singleFamily.familyId, singleFamily.familyName)}
                  disabled={processingFamily !== null}
                  className="w-full justify-start gap-3 h-auto py-4 bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white"
                >
                  <UserPlus className="w-5 h-5 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">{t("lastAdmin.promoteOption", language)}</div>
                    <div className="text-sm opacity-80">
                      {t("lastAdmin.promoteOptionDesc", language)}
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={() => handleDelete(singleFamily.familyId, singleFamily.familyName)}
                  disabled={processingFamily !== null}
                  variant="destructive"
                  className="w-full justify-start gap-3 h-auto py-4"
                >
                  <Trash2 className="w-5 h-5 flex-shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">{t("lastAdmin.deleteOption", language)}</div>
                    <div className="text-sm opacity-80">
                      {t("lastAdmin.deleteOptionDesc", language)}
                    </div>
                  </div>
                </Button>
              </div>
            </>
          ) : (
            // Multiple families - show list with actions
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("lastAdmin.multipleFamilies", language)}
              </p>
              {blockingFamilies.map((family) => (
                <div
                  key={family.familyId}
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{family.familyName}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("lastAdmin.memberCount", language, {
                          count: family.memberCount.toString(),
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handlePromote(family.familyId, family.familyName)}
                      disabled={processingFamily !== null}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      {t("lastAdmin.promote", language)}
                    </Button>
                    <Button
                      onClick={() => handleDelete(family.familyId, family.familyName)}
                      disabled={processingFamily !== null}
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t("lastAdmin.delete", language)}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-sm text-muted-foreground text-center pt-2">
            {t("lastAdmin.hint", language)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
