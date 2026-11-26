import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Field } from '../index';
import { api } from '../../services/api.js';
export function JoinEventCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { eventId } = await api(`/workspace/join/${encodeURIComponent(code.trim())}`);
      setError('');
      navigate(`/events/${eventId}`);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Card className="join-code-card">
      <form onSubmit={submit} className="inline-form">
        <Field label="Have an event code?">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter event code"
            aria-invalid={!!error}
          />
        </Field>
        <Button type="submit">Open event</Button>
      </form>
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
