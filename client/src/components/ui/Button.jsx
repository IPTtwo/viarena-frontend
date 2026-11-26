import React from 'react';
import { useStore } from '../../state/StoreProvider';
export function Button({ children, variant = 'primary', className = '', ...props }) {
  const store = useStore();
  return (
    <button
      className={`button ${variant} ${className}`}
      {...props}
      disabled={props.disabled || store?.pending}
    >
      {children}
    </button>
  );
}
