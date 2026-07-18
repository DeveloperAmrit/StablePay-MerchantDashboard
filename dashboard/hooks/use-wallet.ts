import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { create } from 'zustand';

const ADDITIONAL_ADDRESSES_KEY = 'stablepay_additional_addresses';

interface AdditionalAddressesState {
    additionalAddresses: string[];
    addAddress: (address: string) => void;
    removeAddress: (address: string) => void;
    setAddresses: (addresses: string[]) => void;
}

const persistAddresses = (addresses: string[]) => {
    try {
        localStorage.setItem(ADDITIONAL_ADDRESSES_KEY, JSON.stringify(addresses));
    } catch (e) {
        console.warn('Failed to persist additional addresses:', e);
    }
};

const useAdditionalAddressesStore = create<AdditionalAddressesState>((set) => ({
    additionalAddresses: [],
    addAddress: (newAddress) => set((state) => {
        const normalized = newAddress.toLowerCase();
        if (state.additionalAddresses.some(a => a.toLowerCase() === normalized)) return state;
        const updated = [...state.additionalAddresses, normalized];
        persistAddresses(updated);
        return { additionalAddresses: updated };
    }),
    removeAddress: (addressToRemove) => set((state) => {
        const normalized = addressToRemove.toLowerCase();
        const updated = state.additionalAddresses.filter(a => a.toLowerCase() !== normalized);
        persistAddresses(updated);
        return { additionalAddresses: updated };
    }),
    setAddresses: (addresses) => set({ additionalAddresses: addresses }),
}));

export function useWallet() {
    const { address, isConnected } = useAccount();
    const { connect } = useConnect();
    const { disconnect } = useDisconnect();

    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const { additionalAddresses, addAddress, removeAddress, setAddresses } = useAdditionalAddressesStore();

    useEffect(() => {
        if (isConnected && address) {
            setWalletAddress(address);
        } else {
            setWalletAddress(null);
        }
    }, [isConnected, address]);

    // Load additional addresses from local storage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(ADDITIONAL_ADDRESSES_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const sanitized = Array.from(
                        new Set(
                            parsed.filter((a): a is string => typeof a === 'string').map(a => a.toLowerCase())
                        )
                    );
                    setAddresses(sanitized);
                }
            }
        } catch (e) {
            console.error('Failed to load additional addresses:', e);
        }
    }, [setAddresses]);

    const connectWallet = () => {
        connect({ connector: injected() });
    };

    const disconnectWallet = () => {
        disconnect();
    };

    const consideredAddresses = Array.from(
        new Map(
            [...(walletAddress ? [walletAddress] : []), ...additionalAddresses]
                .map(a => [a.toLowerCase(), a] as const)
        ).values()
    );

    return {
        walletAddress,
        isConnected,
        connectWallet,
        disconnectWallet,
        additionalAddresses,
        addAddress,
        removeAddress,
        consideredAddresses,
    };
}
