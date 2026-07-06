import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Copy, 
  CheckCircle2, 
  Terminal,
  AlertTriangle,
  CheckCircle,
  Zap
} from 'lucide-react';

const optimizedCode = `import os
import hashlib
import tempfile
from pathlib import Path

import streamlit as st
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory

# -----------------------------
# CONFIG UI
# -----------------------------
st.set_page_config(
    page_title="SEMSEproject - AI Knowledge",
    page_icon="🧠",
    layout="wide"
)

st.title("🔍 SEMSEproject: Chat Semántico")
st.markdown("---")

with st.sidebar:
    st.title("⚙️ Configuración SEMSE")

    api_key = st.text_input("OpenAI API Key", type="password")
    uploaded_file = st.file_uploader("Sube tu conocimiento (PDF)", type=["pdf"])

    if st.button("🧹 Reiniciar conversación"):
        for key in ["messages", "qa_chain", "doc_hash", "file_name"]:
            if key in st.session_state:
                del st.session_state[key]
        st.rerun()

# -----------------------------
# HELPERS CON CACHÉ ✅
# -----------------------------
def file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()

@st.cache_data(show_spinner=False)
def save_temp_pdf(file_bytes: bytes, original_name: str) -> str:
    """Guarda el PDF en un archivo temporal único."""
    safe_name = Path(original_name).stem.replace(" ", "_")
    digest = hashlib.sha256(file_bytes).hexdigest()[:12]

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=f"_{safe_name}_{digest}.pdf"
    ) as tmp:
        tmp.write(file_bytes)
        return tmp.name

@st.cache_data(show_spinner=False)
def load_and_split_pdf(pdf_path: str):
    """Carga el PDF y lo divide en chunks."""
    loader = PyPDFLoader(pdf_path)
    docs = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150
    )
    chunks = splitter.split_documents(docs)
    return chunks

@st.cache_resource(show_spinner=False)
def build_vectorstore(_chunks, api_key: str):
    """Construye el vector store una sola vez."""
    os.environ["OPENAI_API_KEY"] = api_key
    embeddings = OpenAIEmbeddings()
    vector_db = Chroma.from_documents(_chunks, embeddings)
    return vector_db

def build_qa_chain(vector_db, api_key: str):
    """Construye la cadena conversacional."""
    os.environ["OPENAI_API_KEY"] = api_key

    memory = ConversationBufferMemory(
        memory_key="chat_history",
        return_messages=True,
        output_key="answer"
    )

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0
    )

    retriever = vector_db.as_retriever(search_kwargs={"k": 4})

    qa_chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=retriever,
        memory=memory,
        return_source_documents=True
    )
    return qa_chain

# -----------------------------
# STATE INIT
# -----------------------------
if "messages" not in st.session_state:
    st.session_state.messages = []

# -----------------------------
# MAIN FLOW
# -----------------------------
if not api_key or not uploaded_file:
    st.info("💡 Ingresa tu API Key y sube un PDF para empezar.")
    st.stop()

pdf_bytes = uploaded_file.getvalue()
current_hash = file_hash(pdf_bytes)

# Si cambia el documento, reiniciamos chain y mensajes
if st.session_state.get("doc_hash") != current_hash:
    st.session_state.doc_hash = current_hash
    st.session_state.file_name = uploaded_file.name
    st.session_state.messages = []

    with st.spinner("🧠 Procesando y vectorizando..."):
        pdf_path = save_temp_pdf(pdf_bytes, uploaded_file.name)
        chunks = load_and_split_pdf(pdf_path)
        vector_db = build_vectorstore(chunks, api_key)
        st.session_state.qa_chain = build_qa_chain(vector_db, api_key)

st.success(f"Documento activo: {st.session_state.get('file_name', uploaded_file.name)}")

# -----------------------------
# CHAT UI
# -----------------------------
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

prompt = st.chat_input("Pregúntame algo sobre el documento...")

if prompt:
    st.session_state.messages.append({"role": "user", "content": prompt})

    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Pensando..."):
            response = st.session_state.qa_chain.invoke({"question": prompt})
            answer = response["answer"]
            source_docs = response.get("source_documents", [])

            st.markdown(answer)

            if source_docs:
                with st.expander("📚 Fragmentos usados"):
                    for i, doc in enumerate(source_docs[:3], start=1):
                        page = doc.metadata.get("page", "N/A")
                        st.markdown(f"**Fuente {i} · página {page}**")
                        st.write(doc.page_content[:800] + "...")

    st.session_state.messages.append({"role": "assistant", "content": answer})`;

const problematicCode = `# ❌ PROBLEMAS EN ESTA VERSIÓN

def process_pdf():
    # ❌ Se ejecuta en CADA rerun
    loader = PyPDFLoader("temp.pdf")  # ❌ Nombre fijo
    docs = loader.load()
    chunks = splitter.split_documents(docs)
    
    # ❌ Recrea embeddings cada vez
    embeddings = OpenAIEmbeddings()
    vector_db = Chroma.from_documents(chunks, embeddings)
    
    return vector_db

# ❌ Cada pregunta = reprocesar todo
# ❌ Memoria no persiste
# ❌ API key expuesta en UI
# ❌ Sin botón de reset`;

export function CodePlayground() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('optimized');

  const copyCode = () => {
    const code = activeTab === 'optimized' ? optimizedCode : problematicCode;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Playground de Código</h2>
        <p className="text-muted-foreground">
          Copia y usa el código optimizado en tu proyecto
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FeatureBadge icon={Zap} label="@st.cache_data" color="blue" />
        <FeatureBadge icon={Zap} label="@st.cache_resource" color="purple" />
        <FeatureBadge icon={CheckCircle} label="st.session_state" color="green" />
        <FeatureBadge icon={CheckCircle} label="Hash único" color="pink" />
      </div>

      {/* Code Tabs */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="optimized" className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Versión Optimizada
                </TabsTrigger>
                <TabsTrigger value="problematic" className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Problemas
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={copyCode}>
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs value={activeTab}>
            <TabsContent value="optimized" className="mt-0">
              <div className="relative">
                <pre className="text-sm font-mono text-muted-foreground overflow-x-auto p-4 rounded-lg bg-muted max-h-[500px] overflow-y-auto">
                  <code>{optimizedCode}</code>
                </pre>
              </div>
            </TabsContent>
            <TabsContent value="problematic" className="mt-0">
              <div className="relative">
                <pre className="text-sm font-mono text-red-300/80 overflow-x-auto p-4 rounded-lg bg-red-950/10 border border-red-500/20 max-h-[500px] overflow-y-auto">
                  <code>{problematicCode}</code>
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Key Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-green-500/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              Qué incluye la versión optimizada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Caché de datos con @st.cache_data
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Caché de recursos con @st.cache_resource
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Session state para memoria persistente
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Hash único por archivo
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Botón para reiniciar conversación
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Visualización de documento activo
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
              <Terminal className="w-4 h-4" />
              Requisitos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono text-muted-foreground">
              <code>{`pip install streamlit langchain langchain-openai langchain-community chromadb pypdf

# Variables de entorno
export OPENAI_API_KEY="sk-..."`}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureBadge({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    green: 'bg-green-500/10 text-green-400 border-green-500/30',
    pink: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  };

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg border ${colorClasses[color]}`}>
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
