import { useState } from 'react';

import { useStore } from '../../../state/StoreProvider';

export function useRoleActions() {
  const { setOrganizerRole, notify } = useStore();
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState('');

  const apply = async () => {
    const { member, enable } = pending;

    try {
      if (reason.trim().length < 5)
        throw new Error('Enter an audit reason with at least 5 characters.');
      await setOrganizerRole(member.id, enable, reason.trim());
      notify(enable ? 'Organizer role assigned.' : 'Organizer role revoked.');
      setPending(null);
      setReason('');
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  return { pending, setPending, apply, reason, setReason };
}
