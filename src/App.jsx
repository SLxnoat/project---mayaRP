import { Component } from 'react';
import { ChatProvider } from './context/ChatContext';
import { BrainProvider } from './context/BrainContext';
import { VaultProvider } from './context/VaultContext';
import { HiddenAgentProvider } from './context/HiddenAgentContext';
import { UserProvider } from './context/UserContext';
import ChatInterface from './components/ChatInterface';

// A-02 fixed: ErrorBoundary prevents the entire app going blank on provider errors
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Maya RP Error Boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', height: '100vh', background: '#111827',
          alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif'
        }}>
          <div style={{
            background: '#1f2937', borderRadius: '16px', padding: '2rem',
            maxWidth: '480px', textAlign: 'center', border: '1px solid #374151'
          }}>
            <h1 style={{ color: '#f87171', fontSize: '1.5rem', marginBottom: '1rem' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#9ca3af', marginBottom: '1.5rem', wordBreak: 'break-word' }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#2563eb', color: 'white', border: 'none',
                padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Provider composition (dependencies satisfied):
// UserProvider (outermost - no dependencies)
//   -> VaultProvider (no dependencies on other providers)
//     -> ChatProvider (uses useSpeech, useVault, useUser - all available)
//       -> HiddenAgentProvider (uses useChat - provided by ChatProvider)
//         -> BrainProvider (uses useChat, useVault - both available)
//           -> ChatInterface

function App() {
  return (
    <ErrorBoundary>
      <UserProvider>
        <VaultProvider>
          <ChatProvider>
            <HiddenAgentProvider>
              <BrainProvider>
                <ChatInterface />
              </BrainProvider>
            </HiddenAgentProvider>
          </ChatProvider>
        </VaultProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}

export default App;
