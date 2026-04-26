import { ChatProvider } from './context/ChatContext';
import { BrainProvider } from './context/BrainContext';
import { VaultProvider } from './context/VaultContext';
import { HiddenAgentProvider } from './context/HiddenAgentContext';
import { UserProvider } from './context/UserContext';
import ChatInterface from './components/ChatInterface';

// Provider composition (dependencies satisfied):
// UserProvider (outermost - no dependencies)
//   -> VaultProvider (no dependencies on other providers)
//     -> ChatProvider (uses useSpeech, useVault, useUser - all available)
//       -> HiddenAgentProvider (uses useChat - provided by ChatProvider)
//         -> BrainProvider (uses useChat, useVault - both available)
//           -> ChatInterface

function App() {
  return (
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
  );
}

export default App;
