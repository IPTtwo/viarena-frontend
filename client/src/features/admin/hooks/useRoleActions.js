import { useState } from 'react';

import { useStore } from '../../../state/StoreProvider';

export function useRoleActions() {
  const { setOrganizerRole, notify } = useStore();
  const [pending, updatePending] = useState(null);
  const [reason, setReason] = useState('');
  const setPending = (value) => {
    updatePending(value);
    setReason('');
  };

  const apply = async () => {
    const { member, enable } = pending;

    if (reason.trim().length < 5) throw new Error('Enter a reason with at least 5 characters.');
    await setOrganizerRole(member.id, enable, reason);
    notify(enable ? 'Organizer role assigned.' : 'Organizer role revoked.');
    setPending(null);
  };

  return { pending, setPending, apply, reason, setReason };
}
