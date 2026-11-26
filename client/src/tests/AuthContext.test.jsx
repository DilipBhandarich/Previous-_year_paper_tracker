import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import axios from 'axios';

const TestComponent = () => {
  const { user, loading, login, logout } = useAuth();
  if (loading) return <div>Loading...</div>;
  return (
    <div>
      {user ? (
        <>
          <span data-testid="user-name">{user.name}</span>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={() => login('test@test.com', 'password')}>Login</button>
      )}
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should show loading initially', () => {
    localStorage.getItem.mockReturnValue(null);
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should login successfully', async () => {
    localStorage.getItem.mockReturnValue(null);
    axios.post.mockResolvedValueOnce({
      data: {
        token: 'test_token_123',
        user: { id: 1, name: 'Test User', email: 'test@test.com' }
      }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const loginBtn = screen.getByText('Login');
    await act(async () => {
      loginBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    });
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'test_token_123');
  });

  it('should logout successfully', async () => {
    localStorage.getItem.mockReturnValue('existing_token');
    axios.get.mockResolvedValueOnce({
      data: { id: 1, name: 'Test User', email: 'test@test.com' }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    });

    const logoutBtn = screen.getByText('Logout');
    await act(async () => {
      logoutBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
  });

  it('should handle auth check failure', async () => {
    localStorage.getItem.mockReturnValue('invalid_token');
    axios.get.mockRejectedValueOnce(new Error('Invalid token'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
  });
});
