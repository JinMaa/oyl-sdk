import { Provider } from '../provider/provider';
export declare function loadRpc(options: any): Promise<void>;
export declare function testMarketplaceBuy(): Promise<void>;
export declare function testAggregator(): Promise<void>;
export declare function viewPsbt(): Promise<void>;
export declare function convertPsbt(): Promise<void>;
export declare function callAPI(command: any, data: any, options?: {}): Promise<any>;
export declare const MEMPOOL_SPACE_API_V1_URL = "https://mempool.space/api/v1";
export declare const createInscriptionScript: (pubKey: any, content: any) => any[];
export declare const provider: Provider;
export declare function runCLI(): Promise<void | {
    fee: number;
} | {
    commitAndRevealTxFee: number;
    sendTxFee: number;
    total: number;
} | {
    txId: string;
    rawTxn: string;
}>;
