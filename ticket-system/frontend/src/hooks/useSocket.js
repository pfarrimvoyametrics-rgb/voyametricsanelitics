import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { lerToken } from '../api/client';

/**
 * Liga ao servidor de tempo real com o JWT. Devolve a instância do socket
 * e o estado de ligação. Os componentes registam os seus próprios listeners.
 */
export function useSocket() {
  const socketRef = useRef(null);
  const [ligado, setLigado] = useState(false);

  useEffect(() => {
    const token = lerToken();
    if (!token) return;

    const socket = io('/', {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setLigado(true));
    socket.on('disconnect', () => setLigado(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { socket: socketRef, ligado };
}
