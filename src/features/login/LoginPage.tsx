import { LoginAuthenticatedView } from './components/LoginAuthenticatedView';
import { LoginMainView } from './components/LoginMainView';
import { useLoginForm } from './hooks/useLoginForm';

export function LoginPage() {
  const { auth, protocol, setProtocol, loading, error, form, placeholderBaseUrl, onSubmit } = useLoginForm();

  if (auth.isAuthenticated) {
    return <LoginAuthenticatedView />;
  }

  return (
    <LoginMainView
      protocol={protocol}
      setProtocol={setProtocol}
      loading={loading}
      error={error}
      form={form}
      placeholderBaseUrl={placeholderBaseUrl}
      onSubmit={onSubmit}
    />
  );
}
