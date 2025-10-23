import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Play, Pause, Square, Volume2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TTSReaderProps {
  content: string;
  title: string;
  sourceType: "url" | "pdf";
  sourceUrl?: string;
  userId?: string;
}

export const TTSReader = ({ content, title, sourceType, sourceUrl, userId }: TTSReaderProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [speed, setSpeed] = useState([1.0]);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const words = content.split(/\s+/).filter(word => word.length > 0);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      // Select default voices (male and female)
      const femaleVoice = availableVoices.find(v => v.name.includes("Female") || v.name.includes("Samantha"));
      const maleVoice = availableVoices.find(v => v.name.includes("Male") || v.name.includes("Daniel"));
      setVoice(femaleVoice || maleVoice || availableVoices[0]);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Save to reading history if authenticated
    if (userId) {
      saveToHistory();
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [userId]);

  useEffect(() => {
    // Auto-scroll to highlighted word
    if (wordsRef.current) {
      const highlightedElement = wordsRef.current.querySelector(`[data-index="${currentWordIndex}"]`);
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentWordIndex]);

  const saveToHistory = async () => {
    try {
      await supabase.from("reading_history").insert({
        user_id: userId,
        title,
        source_type: sourceType,
        source_url: sourceUrl,
        content_preview: content.substring(0, 200),
      });
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  };

  const speakWord = (index: number) => {
    if (index >= words.length) {
      setIsPlaying(false);
      return;
    }

    const word = words[index];
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = speed[0];
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      setCurrentWordIndex(index + 1);
      if (isPlaying && index + 1 < words.length) {
        speakWord(index + 1);
      } else {
        setIsPlaying(false);
      }
    };

    window.speechSynthesis.speak(utterance);
    utteranceRef.current = utterance;
  };

  const handlePlay = () => {
    setIsPlaying(true);
    speakWord(currentWordIndex);
  };

  const handlePause = () => {
    setIsPlaying(false);
    window.speechSynthesis.cancel();
  };

  const handleStop = () => {
    setIsPlaying(false);
    window.speechSynthesis.cancel();
    setCurrentWordIndex(0);
  };

  const handleSummarize = async () => {
    setLoadingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-content", {
        body: { content },
      });

      if (error) throw error;

      setSummary(data.summary);
      toast({
        title: "Summary generated",
        description: "AI has summarized the content for you.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate summary",
        variant: "destructive",
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  const progress = (currentWordIndex / words.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">{title}</h1>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Controls */}
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap gap-4 items-center justify-center">
            <div className="flex gap-2">
              {!isPlaying ? (
                <Button onClick={handlePlay} size="lg" className="gap-2">
                  <Play className="w-5 h-5" />
                  Play
                </Button>
              ) : (
                <Button onClick={handlePause} size="lg" variant="secondary" className="gap-2">
                  <Pause className="w-5 h-5" />
                  Pause
                </Button>
              )}
              <Button onClick={handleStop} size="lg" variant="outline" className="gap-2">
                <Square className="w-4 h-4" />
                Stop
              </Button>
              <Button
                onClick={handleSummarize}
                size="lg"
                variant="outline"
                disabled={loadingSummary}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {loadingSummary ? "Generating..." : "Summarize"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Voice
              </label>
              <Select
                value={voice?.name}
                onValueChange={(name) => setVoice(voices.find((v) => v.name === name) || null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((v) => (
                    <SelectItem key={v.name} value={v.name}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Speed: {speed[0]}x</label>
              <Slider
                value={speed}
                onValueChange={setSpeed}
                min={0.5}
                max={2.0}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>
        </Card>

        {/* Summary */}
        {summary && (
          <Card className="p-6 bg-accent/5 border-accent/20">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              AI Summary
            </h3>
            <p className="text-muted-foreground leading-relaxed">{summary}</p>
          </Card>
        )}

        {/* Content */}
        <Card className="p-6 md:p-8">
          <div
            ref={wordsRef}
            className="text-lg leading-relaxed space-x-1 smooth-scroll max-h-[60vh] overflow-y-auto"
          >
            {words.map((word, index) => (
              <span
                key={index}
                data-index={index}
                className={`inline-block ${
                  index === currentWordIndex ? "word-highlight font-semibold scale-110" : ""
                } transition-all duration-200`}
              >
                {word}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
