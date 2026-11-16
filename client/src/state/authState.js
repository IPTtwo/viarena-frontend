import { seedUsers } from '../data/fixtures';
import { useStoredState } from './storage';

export function useAuthState() {
  const [users, setUsers] = useStoredState('users', seedUsers);
  const [sessionId, setSessionId] = useStoredState('session', null);
  const [passwords, setPasswords] = useStoredState('passwords', {});
  const user = users.find((member) => member.id === sessionId) || null;

  return { users, setUsers, sessionId, setSessionId, passwords, setPasswords, user };
}
