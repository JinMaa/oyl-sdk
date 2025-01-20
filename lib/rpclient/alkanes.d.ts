export declare const stripHexPrefix: (s: string) => string;
export interface Rune {
    rune: {
        id: {
            block: string;
            tx: string;
        };
        name: string;
        spacedName: string;
        divisibility: number;
        spacers: number;
        symbol: string;
    };
    balance: string;
}
export interface Outpoint {
    runes: Rune[];
    outpoint: {
        txid: string;
        vout: number;
    };
    output: {
        value: string;
        script: string;
    };
    txindex: number;
    height: 2;
}
export interface AlkanesResponse {
    outpoints: Outpoint[];
    balanceSheet: [];
}
interface AlkaneSimulateRequest {
    alkanes: any[];
    transaction: string;
    block: string;
    height: string;
    txindex: number;
    target: {
        block: string;
        tx: string;
    };
    inputs: string[];
    pointer: number;
    refundPointer: number;
    vout: number;
}
interface AlkaneToken {
    name: string;
    symbol: string;
    totalSupply: number;
    cap: number;
    minted: number;
    mintActive: boolean;
    percentageMinted: number;
    mintAmount: number;
}
export declare class AlkanesRpc {
    alkanesUrl: string;
    constructor(url: string);
    _call(method: any, params?: any[], timeout?: number): Promise<any>;
    getAlkanesByHeight({ height, protocolTag, }: {
        height: number;
        protocolTag: string;
    }): Promise<AlkanesResponse>;
    getAlkanesByAddress({ address, protocolTag, name, }: {
        address: string;
        protocolTag?: string;
        name?: string;
    }): Promise<Outpoint[]>;
    trace(request: {
        vout: number;
        txid: string;
    }): Promise<any>;
    simulate(request: AlkaneSimulateRequest): Promise<any>;
    getAlkaneById({ block, tx, }: {
        block: string;
        tx: string;
    }): Promise<AlkaneToken>;
    getAlkanes({ limit, offset, }: {
        limit: number;
        offset?: number;
    }): Promise<AlkaneToken[]>;
    parseSimulateReturn(v: any): "invalid" | {
        string: string;
        bytes: string;
        le: string;
        be: string;
    };
}
export {};
