import { useToast } from '../../hooks/toast';

export function Toast() {
  const message = useToast();
  if (!message) return null;
  return (
    <div className="toast" role="status">
      <span className="toast-icon">✓</span> {message}
    </div>
  );
}
