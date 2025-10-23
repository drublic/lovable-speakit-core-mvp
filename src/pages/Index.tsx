import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ContentInput } from "@/components/ContentInput";
import { TTSReader } from "@/components/TTSReader";
import { Volume2, LogOut, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [content, setContent] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [sourceType, setSourceType] = useState<"url" | "pdf">("url");
  const [sourceUrl, setSourceUrl] = useState<string | undefined>();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setContent("");
    setTitle("");
    toast({
      title: "Signed out",
      description: "You've been signed out successfully.",
    });
  };

  const handleContentExtracted = (
    extractedContent: string,
    extractedTitle: string,
    type: "url" | "pdf",
    url?: string
  ) => {
    setContent(extractedContent);
    setTitle(extractedTitle);
    setSourceType(type);
    setSourceUrl(url);
  };

  if (content) {
    return (
      <TTSReader
        content={content}
        title={title}
        sourceType={sourceType}
        sourceUrl={sourceUrl}
        userId={user?.id}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-lg">
              <Volume2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Speakit</h1>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="w-4 h-4" />
                  {user.email}
                </Button>
                <Button onClick={handleSignOut} variant="outline" size="sm" className="gap-2">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/auth")} variant="default" size="sm">
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold gradient-text">
              Listen to any article or document
            </h2>
            <p className="text-lg text-muted-foreground">
              Turn web pages and PDFs into natural-sounding speech with AI-powered summarization
            </p>
          </div>

          <ContentInput onContentExtracted={handleContentExtracted} />

          {!user && (
            <div className="text-center p-6 bg-muted/50 rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground mb-3">
                Sign in to save your reading history and bookmarks across devices
              </p>
              <Button onClick={() => navigate("/auth")} variant="default">
                Create Free Account
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
