import { useState } from "react";
import { Upload, X, Download, Heart, MessageCircle, Calendar, User, Folder, Plus, MoreVertical, Edit2, Trash2, FolderOpen, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Language, t } from "@/lib/translations";
import { formatDate, formatTime } from "@/lib/utils/date-format";

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

interface PhotoGalleryProps {
  photos: Photo[];
  currentUserId: string;
  currentUserName: string;
  familyMembers: FamilyMember[];
  photoFolders: PhotoFolder[];
  language: Language;
  onAddPhoto: (photo: Photo) => void;
  onDeletePhoto: (photoId: string) => void;
  onLikePhoto: (photoId: string, userId: string) => void;
  onAddComment: (photoId: string, comment: PhotoComment) => void;
  onCreateFolder: (folder: PhotoFolder) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onMovePhotoToFolder: (photoId: string, folderId: string) => void;
}

export function PhotoGallery({
  photos,
  currentUserId,
  currentUserName,
  familyMembers,
  photoFolders,
  language,
  onAddPhoto,
  onDeletePhoto,
  onLikePhoto,
  onAddComment,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onMovePhotoToFolder,
}: PhotoGalleryProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [caption, setCaption] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [newComment, setNewComment] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState("all");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderIcon, setNewFolderIcon] = useState("📁");
  const [selectedFolderForUpload, setSelectedFolderForUpload] = useState("all");
  const [editingFolder, setEditingFolder] = useState<PhotoFolder | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  const handleUploadPhoto = () => {
    if (!photoUrl) return;

    const newPhoto: Photo = {
      id: `photo-${Date.now()}`,
      url: photoUrl,
      caption: caption || "",
      uploadedBy: currentUserId,
      uploadedByName: currentUserName,
      uploadedByAvatar: "",
      uploadedAt: new Date().toISOString(),
      folderId: selectedFolderForUpload,
      likes: [],
      comments: [],
    };

    onAddPhoto(newPhoto);
    setPhotoUrl("");
    setCaption("");
    setSelectedFolderForUpload("all");
    setIsUploadDialogOpen(false);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;

    const newFolder: PhotoFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderName,
      icon: newFolderIcon,
      createdAt: new Date().toISOString(),
      createdBy: currentUserId,
      photoCount: 0,
    };

    onCreateFolder(newFolder);
    setNewFolderName("");
    setNewFolderIcon("📁");
    setIsCreateFolderOpen(false);
  };

  const handleRenameFolder = () => {
    if (!editingFolder || !editFolderName.trim()) return;

    onRenameFolder(editingFolder.id, editFolderName);
    setEditingFolder(null);
    setEditFolderName("");
  };

  const handleLike = (photoId: string) => {
    onLikePhoto(photoId, currentUserId);
  };

  const handleAddComment = (photoId: string) => {
    if (!newComment.trim()) return;

    const comment: PhotoComment = {
      id: `comment-${Date.now()}`,
      userId: currentUserId,
      userName: currentUserName,
      userAvatar: "",
      comment: newComment,
      timestamp: formatTime(new Date(), language),
    };

    onAddComment(photoId, comment);
    setNewComment("");
  };

  const isLikedByUser = (photo: Photo) => {
    return photo.likes.includes(currentUserId);
  };

  // Filter photos by current folder
  const filteredPhotos = currentFolderId === "all" 
    ? photos 
    : photos.filter(p => p.folderId === currentFolderId);

  // Sort photos by date (newest first)
  const sortedPhotos = [...filteredPhotos].sort((a, b) => 
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  const currentFolder = photoFolders.find(f => f.id === currentFolderId);
  
  // Helper function to get folder display name
  const getFolderName = (folder: PhotoFolder) => {
    // If it's a translation key (starts with "folder."), translate it
    if (folder.name.startsWith("folder.") || folder.name.startsWith("channel.")) {
      return t(folder.name as any, language);
    }
    // Otherwise, it's a custom user-created folder, return as-is
    return folder.name;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg text-foreground">{language === "ja" ? "フォトアルバム" : "Photo Album"}</h2>
            <p className="text-xs text-muted-foreground">
              {currentFolder && getFolderName(currentFolder)} • {sortedPhotos.length} {language === "ja" ? "枚の写真" : "photos"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsCreateFolderOpen(true)}
              className="rounded-xl"
            >
              <FolderPlus className="w-5 h-5" />
            </Button>
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white">
                <Upload className="w-4 h-4 mr-2" />
                {language === "ja" ? "アップロード" : "Upload"}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === "ja" ? "写真をアップロード" : "Upload Photo"}</DialogTitle>
              <DialogDescription>
                {language === "ja" ? "家族のアルバムに写真を追加します" : "Add a photo to the family album"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="photo-url">{language === "ja" ? "写真URL" : "Photo URL"}</Label>
                <Input
                  id="photo-url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  {language === "ja" ? "Unsplashなどから写真のURLを貼り付けてください" : "Paste the photo URL from Unsplash or other sources"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="caption">{language === "ja" ? "キャプション" : "Caption"}</Label>
                <Textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={language === "ja" ? "写真の説明（任意）" : "Photo description (optional)"}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folder-select">{language === "ja" ? "保存先フォルダ" : "Save to Folder"}</Label>
                <Select value={selectedFolderForUpload} onValueChange={setSelectedFolderForUpload}>
                  <SelectTrigger id="folder-select" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {photoFolders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.icon} {getFolderName(folder)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {photoUrl && (
                <div className="rounded-xl overflow-hidden border">
                  <img
                    src={photoUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://via.placeholder.com/400x300?text=Invalid+URL";
                    }}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsUploadDialogOpen(false)}
                  variant="outline"
                  className="flex-1 rounded-xl"
                >
                  {t("chat.cancel", language)}
                </Button>
                <Button
                  onClick={handleUploadPhoto}
                  disabled={!photoUrl}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white"
                >
                  {language === "ja" ? "アップロード" : "Upload"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
          </div>
        </div>
        
        {/* Folders Navigation */}
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {photoFolders.map((folder) => (
              <div key={folder.id} className="flex-shrink-0">
                <DropdownMenu>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={currentFolderId === folder.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentFolderId(folder.id)}
                      className={`rounded-xl ${
                        currentFolderId === folder.id
                          ? "bg-gradient-to-r from-[#B5179E] to-[#8B38BA] text-white"
                          : ""
                      }`}
                    >
                      <span className="mr-1">{folder.icon}</span>
                      {getFolderName(folder)}
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {folder.photoCount}
                      </Badge>
                    </Button>
                    {folder.id !== "all" && (
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    )}
                  </div>
                  {folder.id !== "all" && (
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingFolder(folder);
                          setEditFolderName(folder.name);
                        }}
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        {t("photos.renameFolder", language)}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(t("photos.deleteFolderConfirm", language, { name: folder.name }))) {
                            onDeleteFolder(folder.id);
                            if (currentFolderId === folder.id) {
                              setCurrentFolderId("all");
                            }
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        削除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  )}
                </DropdownMenu>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateFolderOpen(true)}
              className="rounded-xl flex-shrink-0 border-dashed border-2 hover:border-primary hover:text-primary"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t("photos.createFolder", language)}
            </Button>
          </div>
        </ScrollArea>
      </div>

      {/* Photo Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {sortedPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-2">{t("photos.noPhotos", language)}</p>
              <p className="text-sm text-muted-foreground">
                {t("photos.uploadFirst", language)}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {sortedPhotos.map((photo) => (
                <Card
                  key={photo.id}
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <div className="aspect-square relative">
                    <img
                      src={photo.url}
                      alt={photo.caption}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "https://via.placeholder.com/400x400?text=Photo";
                      }}
                    />
                    {photo.likes.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="absolute top-2 right-2 bg-black/50 text-white border-none"
                      >
                        <Heart className="w-3 h-3 mr-1" />
                        {photo.likes.length}
                      </Badge>
                    )}
                  </div>
                  {photo.caption && (
                    <div className="p-2">
                      <p className="text-xs text-foreground line-clamp-2">{photo.caption}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Photo Detail Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedPhoto?.caption || (language === "ja" ? "写真の詳細" : "Photo Details")}</DialogTitle>
            <DialogDescription>
              {language === "ja" ? `${selectedPhoto?.uploadedByName}さんが投稿した写真` : `Photo uploaded by ${selectedPhoto?.uploadedByName}`}
            </DialogDescription>
          </DialogHeader>
          {selectedPhoto && (
            <div className="flex flex-col h-full">
              {/* Photo */}
              <div className="relative bg-black">
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.caption}
                  className="w-full max-h-96 object-contain"
                  onError={(e) => {
                    e.currentTarget.src = "https://via.placeholder.com/800x600?text=Photo";
                  }}
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="bg-black/50 hover:bg-black/70 text-white"
                      >
                        <FolderOpen className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {photoFolders.map((folder) => (
                        <DropdownMenuItem
                          key={folder.id}
                          onClick={() => {
                            onMovePhotoToFolder(selectedPhoto.id, folder.id);
                          }}
                        >
                          {folder.icon} {folder.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {selectedPhoto.uploadedBy === currentUserId && (
                    <Button
                      onClick={() => {
                        if (confirm(language === "ja" ? "この写真を削除しますか？" : "Delete this photo?")) {
                          onDeletePhoto(selectedPhoto.id);
                          setSelectedPhoto(null);
                        }
                      }}
                      variant="ghost"
                      size="icon"
                      className="bg-black/50 hover:bg-black/70 text-white"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="p-4 space-y-4">
                {/* User Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={selectedPhoto.uploadedByAvatar} />
                      <AvatarFallback className="bg-gradient-to-br from-[#8B38BA] to-[#5518C1] text-white text-xs">
                        {selectedPhoto.uploadedByName.substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm text-foreground">{selectedPhoto.uploadedByName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(selectedPhoto.uploadedAt, language, "medium")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleLike(selectedPhoto.id)}
                    className={isLikedByUser(selectedPhoto) ? "text-red-500" : ""}
                  >
                    <Heart
                      className="w-5 h-5"
                      fill={isLikedByUser(selectedPhoto) ? "currentColor" : "none"}
                    />
                  </Button>
                </div>

                {/* Caption */}
                {selectedPhoto.caption && (
                  <p className="text-sm text-foreground">{selectedPhoto.caption}</p>
                )}

                {/* Likes */}
                {selectedPhoto.likes.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Heart className="w-4 h-4" />
                    {selectedPhoto.likes.length} {language === "ja" ? "いいね" : "likes"}
                  </div>
                )}

                {/* Comments */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    {language === "ja" ? "コメント" : "Comments"} ({selectedPhoto.comments.length})
                  </p>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-3">
                      {selectedPhoto.comments.map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          <Avatar className="w-6 h-6 flex-shrink-0">
                            <AvatarImage src={comment.userAvatar} />
                            <AvatarFallback className="bg-gradient-to-br from-[#8B38BA] to-[#5518C1] text-white text-xs">
                              {comment.userName.substring(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-foreground font-medium">{comment.userName}</p>
                              <p className="text-xs text-muted-foreground">{comment.timestamp}</p>
                            </div>
                            <p className="text-sm text-foreground">{comment.comment}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Add Comment */}
                  <div className="flex gap-2">
                    <Input
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={language === "ja" ? "コメントを追加..." : "Add a comment..."}
                      className="rounded-xl"
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handleAddComment(selectedPhoto.id);
                        }
                      }}
                    />
                    <Button
                      onClick={() => handleAddComment(selectedPhoto.id)}
                      disabled={!newComment.trim()}
                      className="rounded-xl bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white"
                    >
                      送信
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ja" ? "新しいフォルダを作成" : "Create New Folder"}</DialogTitle>
            <DialogDescription>
              {language === "ja" ? "写真を整理するためのフォルダを作成します" : "Create a folder to organize photos"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">{t("photos.folderName", language)}</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={language === "ja" ? "例: 旅行、イベント、日常" : "e.g. Vacation, Events, Daily"}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-icon">{t("photos.folderIcon", language)}</Label>
              <Input
                id="folder-icon"
                value={newFolderIcon}
                onChange={(e) => setNewFolderIcon(e.target.value)}
                placeholder="📁"
                className="rounded-xl"
                maxLength={2}
              />
              <p className="text-xs text-muted-foreground">
                {language === "ja" ? "絵文字を1つ入力してください" : "Enter one emoji"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsCreateFolderOpen(false)}
                variant="outline"
                className="flex-1 rounded-xl"
              >
                {t("chat.cancel", language)}
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white"
              >
                {language === "ja" ? "作成" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={!!editingFolder} onOpenChange={(open) => !open && setEditingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("photos.renameFolder", language)}</DialogTitle>
            <DialogDescription>
              {editingFolder && (language === "ja" ? `${getFolderName(editingFolder)} の名前を変更します` : `Rename ${getFolderName(editingFolder)}`)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-folder-name">{t("photos.folderName", language)}</Label>
              <Input
                id="edit-folder-name"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                placeholder={language === "ja" ? "新しいフォルダ名" : "New folder name"}
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setEditingFolder(null)}
                variant="outline"
                className="flex-1 rounded-xl"
              >
                {t("chat.cancel", language)}
              </Button>
              <Button
                onClick={handleRenameFolder}
                disabled={!editFolderName.trim()}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white"
              >
                {language === "ja" ? "変更" : "Rename"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
