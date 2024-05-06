import { Network, NetworkOptions } from './interface'

export const UTXO_DUST = 546

export const maximumScriptBytes = 520

export const MAXIMUM_FEE = 5000000

export const getBrc20Data = ({
  amount,
  tick,
}: {
  amount: number | string
  tick: string
}) => ({
  mediaContent: `{"p":"brc-20","op":"transfer","tick":"${tick}","amt":"${amount}"}`,
  mediaType: 'text/plain',
})

export const defaultNetworkOptions: Record<Network, NetworkOptions> = {
  mainnet: {
    baseUrl: 'https://mainnet.sandshrew.io',
    version: 'v1',
    projectId: process.env.SANDSHREW_PROJECT_ID,
    network: 'mainnet',
  },
  testnet: {
    baseUrl: 'https://testnet.sandshrew.io',
    version: 'v1',
    projectId: process.env.SANDSHREW_PROJECT_ID,
    network: 'testnet',
  },
  regtest: {
    baseUrl: 'http://localhost:3000',
    version: 'v1',
    projectId: 'regtest',
    network: 'regtest',
  },
  signet: {
    baseUrl: 'https://signet.sandshrew.io',
    version: 'v1',
    projectId: process.env.SANDSHREW_PROJECT_ID, 
    network: 'testnet',
  }
}
