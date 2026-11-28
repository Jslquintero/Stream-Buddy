import { createContext, useContext } from 'react';

const OutputOrigin = createContext(null);

export function OutputOriginProvider({ network, children }) {
  const origin = network?.address ? `http://${network.address}:${network.port}` : window.location.origin;
  return <OutputOrigin.Provider value={origin}>{children}</OutputOrigin.Provider>;
}

export function useOutputOrigin() {
  return useContext(OutputOrigin) ?? window.location.origin;
}
