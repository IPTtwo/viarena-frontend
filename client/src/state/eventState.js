import { seedEvents, seedRegistrations } from '../data/fixtures';
import { useStoredState } from './storage';

export function useEventState() {
  const [events, setEvents] = useStoredState('events', seedEvents);
  const [registrations, setRegistrations] = useStoredState('registrations', seedRegistrations);

  return { events, setEvents, registrations, setRegistrations };
}
