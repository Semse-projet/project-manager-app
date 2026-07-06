import { Brain, Github, Twitter, Linkedin, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative py-16 px-6 border-t border-border">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-t from-purple-950/10 to-transparent" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo & Description */}
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-xl font-bold text-white">SEMSEproject</span>
            </div>
            <p className="text-sm text-muted-foreground text-center md:text-left max-w-sm">
              Analogía de arquitectura RAG para construir chats semánticos sobre PDFs 
              con LangChain y Streamlit.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a 
              href="#problemas" 
              className="text-sm text-muted-foreground hover:text-white transition-colors"
            >
              Problemas
            </a>
            <a 
              href="#soluciones" 
              className="text-sm text-muted-foreground hover:text-white transition-colors"
            >
              Soluciones
            </a>
            <a 
              href="#comparacion" 
              className="text-sm text-muted-foreground hover:text-white transition-colors"
            >
              Código
            </a>
            <a 
              href="#arquitectura" 
              className="text-sm text-muted-foreground hover:text-white transition-colors"
            >
              Arquitectura
            </a>
          </div>

          {/* Social */}
          <div className="flex items-center gap-4">
            <a 
              href="#" 
              className="p-2 rounded-lg bg-muted hover:bg-purple-500/20 transition-colors group"
            >
              <Github className="w-5 h-5 text-muted-foreground group-hover:text-purple-400" />
            </a>
            <a 
              href="#" 
              className="p-2 rounded-lg bg-muted hover:bg-blue-500/20 transition-colors group"
            >
              <Twitter className="w-5 h-5 text-muted-foreground group-hover:text-blue-400" />
            </a>
            <a 
              href="#" 
              className="p-2 rounded-lg bg-muted hover:bg-pink-500/20 transition-colors group"
            >
              <Linkedin className="w-5 h-5 text-muted-foreground group-hover:text-pink-400" />
            </a>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Copyright */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Hecho con</span>
          <Heart className="w-4 h-4 text-red-400 fill-red-400" />
          <span>para la comunidad de desarrolladores RAG</span>
        </div>
      </div>
    </footer>
  );
}
