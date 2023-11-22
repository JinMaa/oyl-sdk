/// <reference types="node" />
import * as bitcoin from 'bitcoinjs-lib';
import { UnspentOutput, TxInput } from '../shared/interface';
export interface IBlockchainInfoUTXO {
    tx_hash_big_endian: string;
    tx_hash: string;
    tx_output_n: number;
    script: string;
    value: number;
    value_hex: string;
    confirmations: number;
    tx_index: number;
}
export interface IBISWalletIx {
    validity: any;
    isBrc: boolean;
    isSns: boolean;
    name: any;
    amount: any;
    isValidTransfer: any;
    operation: any;
    ticker: any;
    isJson: boolean;
    content?: string;
    inscription_name: any;
    inscription_id: string;
    inscription_number: number;
    metadata: any;
    owner_wallet_addr: string;
    mime_type: string;
    last_sale_price: any;
    slug: any;
    collection_name: any;
    content_url: string;
    bis_url: string;
    wallet?: string;
    media_length?: number;
    genesis_ts?: number;
    genesis_height?: number;
    genesis_fee?: number;
    output_value?: number;
    satpoint?: string;
    collection_slug?: string;
    confirmations?: number;
}
export declare const ECPair: import("ecpair").ECPairAPI;
export declare const assertHex: (pubKey: Buffer) => Buffer;
export declare function tweakSigner(signer: bitcoin.Signer, opts?: any): bitcoin.Signer;
export declare function satoshisToAmount(val: number): string;
export declare function delay(ms: number): Promise<unknown>;
export declare function amountToSatoshis(val: any): number;
export declare const validator: (pubkey: Buffer, msghash: Buffer, signature: Buffer) => boolean;
export declare function utxoToInput(utxo: UnspentOutput, publicKey: Buffer): TxInput;
export declare const getWitnessDataChunk: (content: string, encodeType?: BufferEncoding) => Buffer[];
export declare const getUnspentsWithConfirmationsForAddress: (address: string) => Promise<IBlockchainInfoUTXO[]>;
export declare const getUTXOWorthGreatestValueForAddress: (address: string) => Promise<IBlockchainInfoUTXO>;
export declare const getSatpointFromUtxo: (utxo: IBlockchainInfoUTXO) => string;
export declare const getUnspentsForAddressInOrderByValue: (address: string) => Promise<IBlockchainInfoUTXO[]>;
export declare const getInscriptionsByWalletBIS: (walletAddress: string, offset?: number) => Promise<IBISWalletIx[]>;
export declare const getUTXOsToCoverAmount: (address: string, amountNeeded: number, inscriptionLocs?: string[], usedUtxos?: IBlockchainInfoUTXO[]) => Promise<IBlockchainInfoUTXO[]>;
export declare const getUTXOsToCoverAmountWithRemainder: (address: string, amountNeeded: number, inscriptionLocs?: string[]) => Promise<IBlockchainInfoUTXO[]>;
export declare const getTheOtherUTXOsToCoverAmount: (address: string, amountNeeded: number, inscriptionLocs?: string[]) => Promise<IBlockchainInfoUTXO[]>;
export declare const getUTXOByAddressTxIDAndVOut: (address: string, txId: string, vOut: number) => Promise<IBlockchainInfoUTXO>;
export declare function calculateAmountGathered(utxoArray: IBlockchainInfoUTXO[]): number;
export declare const getScriptForAddress: (address: string) => Promise<any>;
