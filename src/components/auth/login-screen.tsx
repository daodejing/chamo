import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { MessageCircle, Fingerprint } from "lucide-react";
import { toast } from "sonner";

interface LoginScreenProps {
  onLogin: (email: string, inviteCode: string) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && inviteCode) {
      onLogin(email, inviteCode);
    }
  };

  const handleBiometricAuth = async () => {
    setIsAuthenticating(true);
    
    // Simulate biometric authentication
    // In a real app, this would use Web Authentication API or native biometric APIs
    try {
      // Show authenticating toast
      toast.loading("Face IDで認証中...", { id: "biometric-auth" });
      
      // Simulate authentication delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate successful authentication
      toast.success("認証成功！", { id: "biometric-auth" });
      
      // Auto-login with stored credentials (mock)
      onLogin("saved@email.com", "FAMILY-2025");
    } catch (error) {
      toast.error("認証に失敗しました", { id: "biometric-auth" });
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl rounded-[20px]">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#B5179E] to-[#5518C1] rounded-[20px] flex items-center justify-center shadow-lg">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <CardTitle>家族チャット</CardTitle>
            <CardDescription>
              {isSignUp ? "アカウントを作成" : "ログインして始める"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteCode">招待コード</Label>
              <Input
                id="inviteCode"
                type="text"
                placeholder="FAMILY-XXXX"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                className="rounded-xl"
              />
              <p className="text-sm text-muted-foreground">
                家族から共有された招待コードを入力してください
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-[#B5179E] to-[#8B38BA] hover:from-[#9c1487] hover:to-[#7a2fa5] text-white rounded-[20px] h-12 shadow-lg"
            >
              {isSignUp ? "サインアップ" : "ログイン"}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">または</span>
              </div>
            </div>

            {/* Biometric Login Button */}
            <Button
              type="button"
              onClick={handleBiometricAuth}
              disabled={isAuthenticating}
              variant="outline"
              className="w-full rounded-[20px] h-12 border-2 hover:bg-muted"
            >
              <Fingerprint className="w-5 h-5 mr-2" />
              {isAuthenticating ? "認証中..." : "Face IDでログイン"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isSignUp ? "すでにアカウントをお持ちですか？ログイン" : "アカウントをお持ちでない方はこちら"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
