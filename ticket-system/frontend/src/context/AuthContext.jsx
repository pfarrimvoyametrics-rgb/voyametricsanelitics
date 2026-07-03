import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, guardarToken, lerToken, limparToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilizador, setUtilizador] = useState(null);
  const [aCarregar, setACarregar] = useState(true);

  // Ao montar, se houver token guardado, recupera a sessão.
  useEffect(() => {
    (async () => {
      if (!lerToken()) {
        setACarregar(false);
        return;
      }
      try {
        const { utilizador } = await api.me();
        setUtilizador(utilizador);
      } catch {
        limparToken();
      } finally {
        setACarregar(false);
      }
    })();
  }, []);

  const entrar = useCallback(async (email) => {
    const { token, utilizador } = await api.login(email);
    guardarToken(token);
    setUtilizador(utilizador);
    return utilizador;
  }, []);

  const sair = useCallback(() => {
    limparToken();
    setUtilizador(null);
  }, []);

  return (
    <AuthContext.Provider value={{ utilizador, aCarregar, entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
