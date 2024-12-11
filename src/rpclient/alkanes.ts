import fetch from 'node-fetch'

interface Rune {
  rune: {
    id: { block: string; tx: string }
    name: string
    spacedName: string
    divisibility: number
    spacers: number
    symbol: string
  }
  balance: string
}
interface Outpoint {
  runes: Rune[]
  outpoint: { txid: string; vout: number }
  output: { value: string; script: string }
  txindex: number
  height: 2
}
interface AlkanesResponse {
  outpoints: Outpoint[]
  balanceSheet: []
}
interface AlkaneSimulateRequest {
  alkanes: any[]
  transaction: string
  block: string
  height: string
  txindex: number
  target: {
    block: string
    tx: string
  }
  inputs: string[]
  pointer: number
  refundPointer: number
  vout: number
}

export class AlkanesRpc {
  public alkanesUrl: string

  constructor(url: string) {
    this.alkanesUrl = url
  }

  async _call(method, params = []) {
    const requestData = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: 1,
    }

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
      cache: 'no-cache',
    }

    try {
      const response = await fetch(this.alkanesUrl, requestOptions)
      const responseData = await response.json()

      if (responseData.error) {
        console.error('Alkanes JSON-RPC Error:', responseData.error)
        throw new Error(responseData.error)
      }

      return responseData.result
    } catch (error) {
      console.error('Request Error:', error)
      throw error
    }
  }

  async getAlkanesByHeight({
    blockHeight,
    protocolTag = '1',
  }: {
    blockHeight: number
    protocolTag: string
  }) {
    return (await this._call('alkanes_protorunesbyheight', [
      {
        blockHeight,
        protocolTag,
      },
    ])) as AlkanesResponse
  }

  async getAlkanesByAddress({
    address,
    protocolTag = '1',
  }: {
    address: string
    protocolTag?: string
  }): Promise<AlkanesResponse> {
    return await this._call('alkanes_protorunesbyaddress', [
      {
        address,
        protocolTag,
      },
    ])
  }

  async simulate(request: AlkaneSimulateRequest) {
    const ret = await this._call('alkanes_simulate', [request])
    const parsed = await this.parseSimulateReturn(ret.execution.data)
    ret.parsed = parsed
    return ret
  }
  async getAlkanesByOutpoint({
    txid,
    vout,
    protocolTag = '1',
  }: {
    txid: string
    vout: number
    protocolTag?: string
  }): Promise<any> {
    return await this._call('alkanes_protorunesbyoutpoint', [
      { txid: '0x' + txid, vout, protocolTag },
    ])
  }

  async parseSimulateReturn(v: any) {
    const stripHexPrefix = (v: string) => (v.startsWith('0x') ? v.slice(2) : v)
    const addHexPrefix = (v: string) => '0x' + stripHexPrefix(v)

    let decodedString: string
    try {
      decodedString = Buffer.from(stripHexPrefix(v), 'hex').toString('utf8')
      if (/[\uFFFD]/.test(decodedString)) {
        throw new Error('Invalid UTF-8 string')
      }
    } catch (err) {
      decodedString = addHexPrefix(v)
    }

    return {
      string: decodedString,
      bytes: addHexPrefix(v),
      le: BigInt(
        addHexPrefix(
          Buffer.from(
            Array.from(Buffer.from(stripHexPrefix(v), 'hex')).reverse()
          ).toString('hex')
        )
      ).toString(),
      be: BigInt(addHexPrefix(v)).toString(),
    }
  }
}
