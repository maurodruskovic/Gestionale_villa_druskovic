import React, { useState, useEffect } from "react";
import { supabase, getIsSupabaseConfigured } from "../lib/supabaseClient";
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  Lock, 
  Mail, 
  LogOut, 
  ShieldCheck, 
  RefreshCw,
  Github
} from "lucide-react";

interface SupabaseAuthWidgetProps {
  onUserChange?: (user: any) => void;
}

export default function SupabaseAuthWidget({ onUserChange }: SupabaseAuthWidgetProps) {
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Poll for auth session when login is initiated as a fallback for iframe/sandbox restrictions
  useEffect(() => {
    let intervalId: any;
    if (isPolling) {
      intervalId = setInterval(async () => {
        const activeConfigured = getIsSupabaseConfigured();
        if (activeConfigured) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setIsPolling(false);
            setMessage({ 
              type: "success", 
              text: "Accesso con GitHub completato con successo! Applicazione dei dati privati..." 
            });
            setSupabaseUser(session.user);
            if (onUserChange) onUserChange(session.user);
            setTimeout(() => {
              window.location.reload();
            }, 1200);
          }
        }
      }, 1200);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPolling, onUserChange]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        setIsPolling(false);
        setMessage({ 
          type: "success", 
          text: "Accesso con GitHub completato con successo! Applicazione dei dati privati..." 
        });
        const activeConfigured = getIsSupabaseConfigured();
        if (activeConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            const u = session?.user ?? null;
            setSupabaseUser(u);
            if (onUserChange) onUserChange(u);
            setTimeout(() => {
              window.location.reload();
            }, 1200);
          });
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [onUserChange]);

  const handleGitHubSignIn = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      if (data?.url) {
        const authWindow = window.open(data.url, "supabase_github_auth", "width=600,height=700");
        if (!authWindow) {
          setMessage({ 
            type: "error", 
            text: "Pop-up bloccato dal browser. Abilita i popup o verifica le impostazioni per completare l'accesso." 
          });
        } else {
          // Enable background local storage polling as absolute fallback
          setIsPolling(true);
        }
      } else {
        throw new Error("Impossibile recuperare l'indirizzo di autorizzazione GitHub.");
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: err.message || "Impossibile avviare l'autenticazione GitHub. Verifica che il provider sia abilitato su Supabase." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if Supabase client is properly configured with a real URL using the new clean helper
    const activeConfigured = getIsSupabaseConfigured();
    setIsConfigured(activeConfigured);

    if (activeConfigured) {
      // Get current session
      supabase.auth.getSession().then(({ data: { session } }) => {
        const u = session?.user ?? null;
        setSupabaseUser(u);
        if (onUserChange) onUserChange(u);
      });

      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user ?? null;
        setSupabaseUser(u);
        if (onUserChange) onUserChange(u);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [onUserChange]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        if (data.session) {
          setMessage({ type: "success", text: "Registrazione completata e accesso effettuato!" });
        } else {
          setMessage({ type: "success", text: "Registrazione completata! Verifica la tua email per confermare l'account." });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ type: "success", text: "Accesso effettuato con successo!" });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: err.message || "Si è verificato un errore durante l'autenticazione." });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setMessage({ type: "success", text: "Disconnesso correttamente." });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: "Errore durante la disconnessione." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">
              Integrazione Database Supabase
            </h3>
            <p className="text-xs text-slate-500 font-medium font-sans">
              Stato connessione e autenticazione RLS
            </p>
          </div>
        </div>

        {isConfigured ? (
          <span className="text-[10px] font-extrabold bg-emerald-50 border border-emerald-150 text-emerald-700 py-1 px-2.5 rounded-full flex items-center gap-1.5 animate-pulse">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            CONNESSO
          </span>
        ) : (
          <span className="text-[10px] font-extrabold bg-amber-50 border border-amber-150 text-amber-700 py-1 px-2.5 rounded-full flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
            ATTESA CONFIG
          </span>
        )}
      </div>

      {!isConfigured ? (
        <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-100 text-xs text-slate-600 space-y-3.5">
          <p className="font-semibold text-slate-800 leading-relaxed">
            Database in attesa di variabili d'ambiente.
          </p>
          <p className="leading-relaxed">
            Per abilitare la persistenza principale, configura le seguenti variabili nell'app o nel file <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px]">.env</code>:
          </p>
          <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-100 font-mono text-[10px] text-slate-600">
            <div>VITE_SUPABASE_URL = "la-tua-url-supabase"</div>
            <div>VITE_SUPABASE_PUBLISHABLE_KEY = "la-tua-anon-key-publishable"</div>
          </div>
          <p className="text-[11px] text-indigo-600 font-semibold leading-relaxed">
            Nota: I dati attuali continueranno ad essere salvati in locale e nel backup server fino a quando Supabase non sarà configurato.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {supabaseUser ? (
            // Authenticated State
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-sm">
                    {supabaseUser.email?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-indigo-950 text-xs leading-none mb-1">
                      Sessione attiva (Supabase Auth)
                    </h4>
                    <p className="text-xs text-indigo-800 font-semibold font-mono">
                      {supabaseUser.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-2 hover:bg-indigo-200 text-indigo-700 rounded-xl transition-all cursor-pointer"
                  title="Disconnetti sessione"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-500 font-medium flex items-center gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Row Level Security Attivo:</strong> i record creati saranno salvati e visibili solo al tuo utente (<code className="font-mono text-[10px]">{supabaseUser.id.substring(0, 8)}...</code>).
                </span>
              </div>
            </div>
          ) : (
            // Anonymous State
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    Stai navigando come ospite anonimo. I dati sono salvati in modalità pubblica su Supabase. Puoi accedere o registrarti per abilitare l'isolamento dei dati (RLS).
                  </p>
                </div>
                
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAuthForm(!showAuthForm);
                      setMessage(null);
                    }}
                    className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    {showAuthForm ? "Chiudi pannello di accesso" : "Accedi o Registrati con Supabase Auth →"}
                  </button>
                </div>
              </div>

              {showAuthForm && (
                <form onSubmit={handleAuth} className="space-y-3.5 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                  <h4 className="font-extrabold text-xs text-slate-800 tracking-tight">
                    {isSignUp ? "Crea un nuovo account" : "Accedi al tuo account privato"}
                  </h4>

                  {/* GitHub Auth Option */}
                  <div className="pt-1.5 space-y-3">
                    <button
                      type="button"
                      onClick={handleGitHubSignIn}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 bg-[#24292e] hover:bg-[#1d2124] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Github className="w-4 h-4" />
                      )}
                      <span>Accedi con GitHub</span>
                    </button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowConfigGuide(!showConfigGuide)}
                        className="text-[10px] text-slate-500 underline font-medium hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        {showConfigGuide ? "Nascondi guida configurazione Supabase" : "Problemi o prima configurazione? Clicca per la guida →"}
                      </button>
                    </div>

                    {showConfigGuide && (
                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 text-[11px] text-slate-600 space-y-2.5 animate-fadeIn">
                        <strong className="text-slate-800 text-xs block">Guida: Configurazione GitHub OAuth</strong>
                        <ol className="list-decimal pl-4.5 space-y-2 leading-relaxed">
                          <li>
                            <strong>Abilita GitHub in Supabase:</strong> Vai su <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline">Dashboard Supabase</a> → <em>Authentication</em> → <em>Providers</em> → <strong>GitHub</strong>, e seleziona "Enable".
                          </li>
                          <li>
                            <strong>Crea OAuth App su GitHub Settings:</strong>
                            <ul className="list-disc pl-4 mt-1 space-y-1">
                              <li>Vai su <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline">Developer Settings di GitHub</a> → <em>OAuth Apps</em> → <em>New OAuth App</em>.</li>
                              <li>Usa come <strong>Homepage URL</strong>: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px] text-slate-800 font-mono select-all font-bold">{window.location.origin}</code></li>
                              <li>Copia l'<strong>Authorization callback URL</strong> mostrato nel tuo pannello di Supabase (es. <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-[9px] text-amber-800 font-mono">https://[tuo-project-ref].supabase.co/auth/v1/callback</code>) e salvalo su GitHub.</li>
                              <li>Genera un <em>Client Secret</em> e copia sia il <em>Client ID</em> che il <em>Client Secret</em> su Supabase.</li>
                            </ul>
                          </li>
                          <li>
                            <strong>Aggiungi Redirect URL in Supabase Auth:</strong>
                            <ul className="list-disc pl-4 mt-1 space-y-1">
                              <li>In Supabase, vai in <em>Authentication</em> → <em>URL Configuration</em>.</li>
                              <li>Sotto <strong>Redirect URLs</strong>, fai clic su "Add URL" e aggiungi questo esatto indirizzo: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px] text-indigo-700 font-mono font-extrabold select-all">{window.location.origin}/*</code></li>
                            </ul>
                          </li>
                        </ol>
                      </div>
                    )}

                    <div className="flex items-center gap-3 py-1">
                      <div className="h-px bg-slate-100 flex-1"></div>
                      <span className="text-[9px] uppercase font-bold text-slate-400">oppure con email e password</span>
                      <div className="h-px bg-slate-100 flex-1"></div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        placeholder="Inserisci la tua email..."
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full text-xs font-sans font-medium pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        placeholder="Inserisci la password..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full text-xs font-sans font-medium pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      {isSignUp ? "Hai già un account? Accedi" : "Non hai un account? Registrati"}
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isSignUp ? "Registrati" : "Accedi"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {message && (
            <div className={`p-3.5 rounded-xl border text-xs font-medium leading-relaxed ${
              message.type === "success" 
                ? "bg-emerald-50 border-emerald-150 text-emerald-800"
                : "bg-rose-50 border-rose-150 text-rose-800"
            }`}>
              {message.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
