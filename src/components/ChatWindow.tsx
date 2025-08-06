import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatWindow({ className }: { className?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setLoading(true);
    // TODO: Replace with actual AI backend call
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: 'This is a placeholder response.' }]);
      setLoading(false);
    }, 800);
    setInput('');
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <Card className={`flex flex-col h-full min-h-0 shadow-lg border-l border-l-border bg-muted/60 text-foreground ${className ?? ''}`}>
      <CardContent className="flex flex-col h-full min-h-0 p-0">
        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1 min-h-0 max-h-full overflow-auto p-4 space-y-3" ref={scrollRef}>
                {messages.length === 0 && (
                  <div className="text-muted-foreground text-center mt-8">Start a conversation with the AI agent.</div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-primary/10 ml-auto text-right' : 'bg-muted/30 mr-auto text-left'}`}>
                    <span className="block text-xs mb-1 text-muted-foreground/70">{msg.role === 'user' ? 'You' : 'AI'}</span>
                    <span>{msg.content}</span>
                  </div>
                ))}
                {loading && (
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted/30 mr-auto text-left animate-pulse">
                    <span className="block text-xs mb-1 text-muted-foreground/70">AI</span>
                    <span>Thinking...</span>
                  </div>
                )}
        </ScrollArea>
          <form className="flex gap-2 p-4 border-t bg-background" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
            <Input
              className="flex-1"
              type="text"
              value={input}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={loading}
              autoFocus
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4"
              variant="default"
            >
              Send
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
