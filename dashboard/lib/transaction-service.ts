import { createPublicClient, http, formatUnits, defineChain } from 'viem';
import { sepolia } from 'viem/chains';

import { NETWORKS, CONTRACTS, DEPLOYMENT_BLOCKS } from './config';
import { parseAbiItem } from 'viem';

export interface TransactionEvent {
    buyer: string;
    receiver: string;
    amountSC: string;
    amountBC: string;
    blockNumber: bigint;
    transactionHash: string;
    timestamp?: Date;
    chainId: number;
    networkName: string;
}

const etcMainnet = defineChain({
    id: 61,
    name: 'Ethereum Classic',
    network: 'etc',
    nativeCurrency: {
        decimals: 18,
        name: 'Ethereum Classic',
        symbol: 'ETC',
    },
    rpcUrls: {
        default: {
            http: ['https://etc.rivet.link'],
        },
    },
    blockExplorers: {
        default: { name: 'Blockscout', url: 'https://blockscout.com/etc/mainnet' },
    },
    testnet: false,
});

const mordor = defineChain({
    id: 63,
    name: 'Mordor Testnet',
    network: 'mordor',
    nativeCurrency: {
        decimals: 18,
        name: 'Mordor Ether',
        symbol: 'METC',
    },
    rpcUrls: {
        default: {
            http: ['https://rpc.mordor.etccooperative.org'],
        },
    },
    blockExplorers: {
        default: { name: 'BlockScout', url: 'https://blockscout.com/etc/mordor' },
    },
    testnet: true,
});

export class TransactionService {
    private sepoliaClient;
    private etcClient;
    private mordorClient;

    constructor() {
        this.sepoliaClient = createPublicClient({
            chain: sepolia,
            transport: http(NETWORKS.sepolia.rpcUrl),
        });
        this.etcClient = createPublicClient({
            chain: etcMainnet,
            transport: http(NETWORKS['ethereum-classic'].rpcUrl),
        });
        this.mordorClient = createPublicClient({
            chain: mordor,
            transport: http(NETWORKS.mordor.rpcUrl),
        });
    }

    private formatAddress = (address: string): string => {
        const cleanAddress = address.replace('0x', '').slice(-40);
        return `0x${cleanAddress}`;
    };

    private async fetchEventsFromNetwork(
        client: any,
        contractAddress: string,
        networkKey: string,
        merchantAddress?: string
    ): Promise<TransactionEvent[]> {
        try {
            const currentBlock = await client.getBlockNumber();
            const startBlock = DEPLOYMENT_BLOCKS[networkKey] || BigInt(0);
            const maxBlockRange = BigInt(49999);
            let allEvents: any[] = [];

            let fromBlock = startBlock;
            while (fromBlock <= currentBlock) {
                const toBlock = fromBlock + maxBlockRange > currentBlock ? currentBlock : fromBlock + maxBlockRange;

                const purchaseEvents = await client.getLogs({
                    address: contractAddress as `0x${string}`,
                    event: parseAbiItem('event BoughtStableCoins(address indexed buyer, address indexed receiver, uint256 amountSC, uint256 amountBC)'),
                    args: merchantAddress ? {
                        receiver: merchantAddress
                    } as any : undefined,
                    fromBlock,
                    toBlock
                });
                allEvents = [...allEvents, ...purchaseEvents];
                
                fromBlock = toBlock + BigInt(1);
            }

            const network = NETWORKS[networkKey];
            return allEvents.map(event => {
                const rawData = event.data.slice(2);
                const amountSCHex = '0x' + rawData.slice(0, 64);
                const amountBCHex = '0x' + rawData.slice(64);

                return {
                    buyer: this.formatAddress(event.topics[1]),
                    receiver: this.formatAddress(event.topics[2]),
                    amountSC: formatUnits(BigInt(amountSCHex), 6),
                    amountBC: formatUnits(BigInt(amountBCHex), 18),
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash,
                    chainId: network.chainId,
                    networkName: network.name
                };
            });
        } catch (err) {
            console.error(`Error fetching events from ${networkKey}:`, err);
            return [];
        }
    }

    async fetchStableCoinPurchases(merchantAddress?: string): Promise<TransactionEvent[]> {
        try {
            const [sepoliaEvents, etcEvents, mordorEvents] = await Promise.all([
                this.fetchEventsFromNetwork(
                    this.sepoliaClient,
                    CONTRACTS.stablepay.address,
                    'sepolia',
                    merchantAddress
                ),
                this.fetchEventsFromNetwork(
                    this.etcClient,
                    CONTRACTS['stablepay-etc'].address,
                    'ethereum-classic',
                    merchantAddress
                ),
                this.fetchEventsFromNetwork(
                    this.mordorClient,
                    CONTRACTS['stablepay-mordor'].address,
                    'mordor',
                    merchantAddress
                )
            ]);

            const allEvents = [...sepoliaEvents, ...etcEvents, ...mordorEvents];
            console.log(`Total events found: ${allEvents.length} (Sepolia: ${sepoliaEvents.length}, ETC: ${etcEvents.length}, Mordor: ${mordorEvents.length})`);

            return allEvents;
        } catch (err) {
            console.error("Error fetching events:", err);
            console.log("Error message:", err instanceof Error ? err.message : String(err));
            throw err;
        }
    }

    private async getBlockTimestamp(client: any, blockNumber: bigint): Promise<Date> {
        try {
            const block = await client.getBlock({ blockNumber });
            return new Date(Number(block.timestamp) * 1000);
        } catch (e) {
            console.error(`Failed to fetch block ${blockNumber}`, e);
            return new Date();
        }
    }

    private async attachTimestamps(client: any, events: TransactionEvent[]): Promise<TransactionEvent[]> {
        const uniqueBlocks = [...new Set(events.map(e => e.blockNumber))];
        const blockTimestamps = new Map<bigint, Date>();
        
        // Process in batches of 20 to avoid rate limits
        for (let i = 0; i < uniqueBlocks.length; i += 20) {
            const batch = uniqueBlocks.slice(i, i + 20);
            await Promise.all(batch.map(async (bn) => {
                const ts = await this.getBlockTimestamp(client, bn as bigint);
                blockTimestamps.set(bn as bigint, ts);
            }));
        }

        return events.map(e => ({
            ...e,
            timestamp: blockTimestamps.get(e.blockNumber)
        }));
    }

    private async fetchEventsFromNetworkReverse(
        client: any,
        contractAddress: string,
        networkKey: string,
        limit: number | 'all',
        merchantAddress?: string
    ): Promise<TransactionEvent[]> {
        try {
            const currentBlock = await client.getBlockNumber();
            const startBlock = DEPLOYMENT_BLOCKS[networkKey] || BigInt(0);
            const chunk = BigInt(50000);
            let collectedEvents: any[] = [];
            
            let toBlock = currentBlock;
            
            while (toBlock >= startBlock) {
                let fromBlock = toBlock - chunk;
                if (fromBlock < startBlock) fromBlock = startBlock;

                const purchaseEvents = await client.getLogs({
                    address: contractAddress as `0x${string}`,
                    event: parseAbiItem('event BoughtStableCoins(address indexed buyer, address indexed receiver, uint256 amountSC, uint256 amountBC)'),
                    args: merchantAddress ? {
                        receiver: merchantAddress
                    } as any : undefined,
                    fromBlock,
                    toBlock
                });
                
                collectedEvents.push(...purchaseEvents); 

                // If we found enough events, we can stop for this chain
                // (Note: we fetch 'limit' from EACH chain to ensure we don't miss recent ones)
                if (limit !== 'all' && collectedEvents.length >= limit) {
                    break;
                }
                
                if (fromBlock <= startBlock) break;
                toBlock = fromBlock - BigInt(1);
            }

            // Sort by block number descending locally
            collectedEvents.sort((a, b) => Number(b.blockNumber - a.blockNumber)); // Descending
            
            if (limit !== 'all') {
                collectedEvents = collectedEvents.slice(0, limit);
            }

            const network = NETWORKS[networkKey];
            const mappedEvents = collectedEvents.map(event => {
                const rawData = event.data.slice(2);
                const amountSCHex = '0x' + rawData.slice(0, 64);
                const amountBCHex = '0x' + rawData.slice(64);

                return {
                    buyer: this.formatAddress(event.topics[1]),
                    receiver: this.formatAddress(event.topics[2]),
                    amountSC: formatUnits(BigInt(amountSCHex), 6),
                    amountBC: formatUnits(BigInt(amountBCHex), 18),
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash,
                    chainId: network.chainId,
                    networkName: network.name
                };
            });

            return await this.attachTimestamps(client, mappedEvents);

        } catch (err) {
            console.error(`Error fetching events (reverse) from ${networkKey}:`, err);
            return [];
        }
    }

    async fetchTransactionsForExport(limit: number | 'all', merchantAddress?: string): Promise<TransactionEvent[]> {
        try {
            const fetchFn = (client: any, contract: any, network: string) => 
                this.fetchEventsFromNetworkReverse(client, contract.address, network, limit, merchantAddress);

            const [sepoliaEvents, etcEvents, mordorEvents] = await Promise.all([
                fetchFn(this.sepoliaClient, CONTRACTS.stablepay, 'sepolia'),
                fetchFn(this.etcClient, CONTRACTS['stablepay-etc'], 'ethereum-classic'),
                fetchFn(this.mordorClient, CONTRACTS['stablepay-mordor'], 'mordor')
            ]);

            const allEvents = [...sepoliaEvents, ...etcEvents, ...mordorEvents];
            
            // Sort by timestamp descending
            allEvents.sort((a, b) => {
                if (!a.timestamp || !b.timestamp) return 0;
                return b.timestamp!.getTime() - a.timestamp!.getTime();
            });

            // Apply global limit
            if (limit !== 'all') {
                return allEvents.slice(0, limit);
            }

            return allEvents;
        } catch (err) {
            console.error("Error fetching transactions for export:", err);
            throw err;
        }
    }
}

// Export singleton instance
export const transactionService = new TransactionService();