import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Brain, 
  RotateCcw, 
  Send,
  User,
  Bot,
  CheckCircle2,
  Database,
  XCircle
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface MemoryEntry {
  question: string;
  answer: string;
  timestamp: number;
}

export function SessionStateDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationMemory, setConversationMemory] = useState<MemoryEntry[]>([]);
  const [isSimulatingResponse, setIsSimulatingResponse] = useState(false);

  // Simular respuesta del LLM con contexto de memoria
  const simulateResponse = async (userMessage: string) => {
    setIsSimulatingResponse(true);
    
    // Simular delay de LLM
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generar respuesta basada en memoria
    let response = '';
    if (conversationMemory.length === 0) {
      response = `Entiendo tu pregunta sobre "${userMessage}". Como es nuestra primera interacción, no tengo contexto previo.`;
    } else {
      const lastTopic = conversationMemory[conversationMemory.length - 1];
      response = `Basándome en nuestra conversación anterior sobre "${lastTopic.question}", puedo responder sobre "${userMessage}" con ese contexto.`;
    }
    
    const assistantMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    setConversationMemory(prev => [...prev, {
      question: userMessage,
      answer: response,
      timestamp: Date.now()
    }]);
    
    setIsSimulatingResponse(false);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    simulateResponse(input);
    setInput('');
  };

  const resetConversation = () => {
    setMessages([]);
    setConversationMemory([]);
  };

  const simulateRerun = () => {
    // Simular lo que pasa en Streamlit: los mensajes UI persisten
    // pero la memoria del chain se reinicia
    const savedMessages = [...messages];
    setConversationMemory([]); // La memoria interna se pierde
    setTimeout(() => {
      // Los mensajes UI vuelven (simulando session_state)
      setMessages(savedMessages);
    }, 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Demo de Session State</h2>
        <p className="text-muted-foreground">
          Observa cómo st.session_state preserva la memoria conversacional entre reruns
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <XCircle className="w-4 h-4" />
              Sin Session State (Problema)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              El <code className="bg-red-500/20 px-1 rounded text-red-300">ConversationBufferMemory</code> se 
              recrea en cada rerun. El historial visual permanece, pero la memoria interna se pierde.
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              Con Session State (Solución)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Guardar el chain en <code className="bg-green-500/20 px-1 rounded text-green-300">st.session_state</code> preserva 
              la memoria interna entre interacciones.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat Interface */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Chat Simulado
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={simulateRerun}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Simular Rerun
                </Button>
                <Button variant="destructive" size="sm" onClick={resetConversation}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Messages */}
            <div className="h-64 overflow-y-auto space-y-3 p-4 rounded-lg bg-muted/30">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Bot className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm">Inicia una conversación para ver el demo</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      msg.role === 'user' ? 'flex-row' : 'flex-row-reverse'
                    }`}
                  >
                    <div className={`p-2 rounded-full ${
                      msg.role === 'user' ? 'bg-blue-500/20' : 'bg-purple-500/20'
                    }`}>
                      {msg.role === 'user' ? (
                        <User className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Bot className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                    <div className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-blue-500/10 text-blue-100' 
                        : 'bg-purple-500/10 text-purple-100'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {isSimulatingResponse && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                  <span className="text-sm">El asistente está escribiendo...</span>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Escribe un mensaje..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isSimulatingResponse}
              />
              <Button onClick={handleSend} disabled={isSimulatingResponse || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Memory State */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="w-4 h-4" />
                Memoria del Chain
              </CardTitle>
              <Badge variant={conversationMemory.length > 0 ? 'default' : 'secondary'} 
                className={conversationMemory.length > 0 ? 'bg-green-500/20 text-green-300' : ''}>
                {conversationMemory.length} entradas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {conversationMemory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Memoria vacía</p>
                <p className="text-xs mt-1">La memoria se reinició</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {conversationMemory.map((entry, index) => (
                  <div 
                    key={index}
                    className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 animate-slide-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <p className="text-xs text-green-400 font-medium mb-1">Pregunta {index + 1}</p>
                    <p className="text-sm text-white mb-2">{entry.question}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{entry.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Explanation */}
      <Card className="border-purple-500/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <Database className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">¿Cómo funciona?</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-white">1. Sin session_state:</strong> Cada vez que Streamlit 
                  hace rerun (usuario envía mensaje), el <code>ConversationBufferMemory</code> se crea 
                  desde cero. El LLM pierde el contexto de conversaciones anteriores.
                </p>
                <p>
                  <strong className="text-white">2. Con session_state:</strong> Al guardar el chain 
                  completo en <code className="bg-purple-500/20 px-1 rounded text-purple-300">st.session_state.qa_chain</code>, 
                  la memoria interna persiste entre reruns.
                </p>
                <p>
                  <strong className="text-white">3. Simular Rerun:</strong> Haz clic en "Simular Rerun" 
                  para ver qué pasa: los mensajes UI permanecen (están en session_state), pero la memoria 
                  del chain se reinicia.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
