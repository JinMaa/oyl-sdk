import * as bitcoin from 'bitcoinjs-lib'
import ECPairFactory from 'ecpair'
import ecc from '@bitcoinerlab/secp256k1'
bitcoin.initEccLib(ecc)
import {
  AddressType,
  UnspentOutput,
  TxInput,
  IBlockchainInfoUTXO, Network, BitcoinPaymentType,
  ToSignInput,
} from '../shared/interface'
import BigNumber from 'bignumber.js'
import { maximumScriptBytes } from './constants'
import axios from 'axios'
import { getUnspentOutputs, getAddressType } from '../transactions'
import { Oyl } from '../oylib'
import { address as PsbtAddress } from 'bitcoinjs-lib'
import { Tap, Address, Tx, Signer } from '@cmdcode/tapscript'
import * as ecc2 from '@cmdcode/crypto-utils'
import { getUtxosForFees } from '../txbuilder/buildOrdTx'
import { isTaprootInput } from 'bitcoinjs-lib/src/psbt/bip371'

export interface IBISWalletIx {
  validity: any
  isBrc: boolean
  isSns: boolean
  name: any
  amount: any
  isValidTransfer: any
  operation: any
  ticker: any
  isJson: boolean
  content?: string
  inscription_name: any
  inscription_id: string
  inscription_number: number
  metadata: any
  owner_wallet_addr: string
  mime_type: string
  last_sale_price: any
  slug: any
  collection_name: any
  content_url: string
  bis_url: string

  wallet?: string
  media_length?: number
  genesis_ts?: number
  genesis_height?: number
  genesis_fee?: number
  output_value?: number
  satpoint?: string
  collection_slug?: string
  confirmations?: number
}

const RequiredPath = [
  "m/44'/0'/0'/0", // P2PKH (Legacy)
  "m/49'/0'/0'/0", // P2SH-P2WPKH (Nested SegWit)
  "m/84'/0'/0'/0", // P2WPKH (SegWit)
  "m/86'/0'/0'/0", // P2TR (Taproot)
]

export const ECPair = ECPairFactory(ecc)

export const assertHex = (pubKey: Buffer) =>
  pubKey.length === 32 ? pubKey : pubKey.slice(1, 33)

function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
  return bitcoin.crypto.taggedHash(
    'TapTweak',
    Buffer.concat(h ? [pubKey, h] : [pubKey])
  )
}

export function getNetwork(value: Network) {
  if (value === "mainnet") {
    return bitcoin.networks["bitcoin"]
  }

  return bitcoin.networks[value]
}

export function checkPaymentType(payment: bitcoin.PaymentCreator, network: Network) {
  return (script: Buffer) => {
    try {
      return payment({ output: script, network: getNetwork(network) })
    } catch (error) {
      return false
    }
  }
}

export function tweakSigner(
  signer: bitcoin.Signer,
  opts: any = {}
): bitcoin.Signer {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  let privateKey: Uint8Array | undefined = signer.privateKey!
  if (!privateKey) {
    throw new Error('Private key required')
  }
  if (signer.publicKey[0] === 3) {
    privateKey = ecc.privateNegate(privateKey)
  }

  const tweakedPrivateKey = ecc.privateAdd(
    privateKey,
    tapTweakHash(assertHex(signer.publicKey), opts.tweakHash)
  )
  if (!tweakedPrivateKey) {
    throw new Error('Invalid tweaked private key!')
  }

  return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
    network: opts.network,
  })
}

export function satoshisToAmount(val: number) {
  const num = new BigNumber(val)
  return num.dividedBy(100000000).toFixed(8)
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function createSegwitSigner({
  mnemonic,
  segwitAddress,
  hdPathWithIndex,
}: {
  mnemonic: string
  segwitAddress: string
  hdPathWithIndex: string
}) {
  if (segwitAddress) {
    let payload: any
    const wallet = new Oyl()
    const segwitAddressType = getAddressType(segwitAddress)
    if (segwitAddressType == null) {
      throw Error('Unrecognized Address Type')
    }
    payload = await wallet.fromPhrase({
      mnemonic: mnemonic.trim(),
      hdPath: hdPathWithIndex,
      addrType: segwitAddressType,
    })
    const segwitKeyring = payload.keyring.keyring
    const segwitSigner = segwitKeyring.signTransaction.bind(segwitKeyring)
    return segwitSigner
  }
  return undefined
}

export async function createTaprootSigner({
  mnemonic,
  taprootAddress,
  hdPathWithIndex,
}: {
  mnemonic: string
  taprootAddress: string
  hdPathWithIndex: string
}) {
  const addressType = getAddressType(taprootAddress)
  if (addressType == null) {
    throw Error('Unrecognized Address Type')
  }
  const tapWallet = new Oyl()

  const tapPayload = await tapWallet.fromPhrase({
    mnemonic: mnemonic.trim(),
    hdPath: hdPathWithIndex,
    addrType: addressType,
  })

  const tapKeyring = tapPayload.keyring.keyring
  const taprootSigner = tapKeyring.signTransaction.bind(tapKeyring)
  return taprootSigner
}

export async function createSigner({
  mnemonic,
  fromAddress,
  hdPathWithIndex,
}: {
  mnemonic: string
  fromAddress: string
  hdPathWithIndex: string
}) {
  const addressType = getAddressType(fromAddress)
  if (addressType == null) {
    throw Error('Unrecognized Address Type')
  }
  const tapWallet = new Oyl()

  const tapPayload = await tapWallet.fromPhrase({
    mnemonic: mnemonic.trim(),
    hdPath: hdPathWithIndex,
    addrType: addressType,
  })

  const tapKeyring = tapPayload.keyring.keyring
  const taprootSigner = tapKeyring.signTransaction.bind(tapKeyring)
  return taprootSigner
}

export function amountToSatoshis(val: any) {
  const num = new BigNumber(val)
  return num.multipliedBy(100000000).toNumber()
}

export const validator = (
  pubkey: Buffer,
  msghash: Buffer,
  signature: Buffer
): boolean => ECPair.fromPublicKey(pubkey).verify(msghash, signature)

export function utxoToInput(utxo: UnspentOutput, publicKey: Buffer): TxInput {
  let data
  switch (utxo.addressType) {
    case AddressType.P2TR:
      data = {
        hash: utxo.txId,
        index: utxo.outputIndex,
        witnessUtxo: {
          value: utxo.satoshis,
          script: Buffer.from(utxo.scriptPk, 'hex'),
        },
        tapInternalKey: assertHex(publicKey),
      }
      return {
        data,
        utxo,
      }

    case AddressType.P2WPKH:
      data = {
        hash: utxo.txId,
        index: utxo.outputIndex,
        witnessUtxo: {
          value: utxo.satoshis,
          script: Buffer.from(utxo.scriptPk, 'hex'),
        },
      }
      return {
        data,
        utxo,
      }

    case AddressType.P2PKH:
      data = {
        hash: utxo.txId,
        index: utxo.outputIndex,
        witnessUtxo: {
          value: utxo.satoshis,
          script: Buffer.from(utxo.scriptPk, 'hex'),
        },
      }
      return {
        data,
        utxo,
      }

    case AddressType.P2SH_P2WPKH:
      const redeemData = bitcoin.payments.p2wpkh({ pubkey: publicKey })
      data = {
        hash: utxo.txId,
        index: utxo.outputIndex,
        witnessUtxo: {
          value: utxo.satoshis,
          script: Buffer.from(utxo.scriptPk, 'hex'),
        },
        redeemScript: redeemData.output,
      }
      return {
        data,
        utxo,
      }

    default:
      data = {
        hash: '',
        index: 0,
        witnessUtxo: {
          value: 0,
          script: Buffer.from(utxo.scriptPk, 'hex'),
        },
      }
      return {
        data,
        utxo,
      }
  }
}

export const getWitnessDataChunk = function (
  content: string,
  encodeType: BufferEncoding = 'utf8'
) {
  const buffered = Buffer.from(content, encodeType)
  const contentChunks: Buffer[] = []
  let chunks = 0

  while (chunks < buffered.byteLength) {
    const split = buffered.subarray(chunks, chunks + maximumScriptBytes)
    chunks += split.byteLength
    contentChunks.push(split)
  }

  return contentChunks
}

export const getUnspentsWithConfirmationsForAddress = async (
  address: string
) => {
  try {
    return await getUnspentOutputs(address).then(
      (unspents) =>
        unspents?.unspent_outputs.filter(
          (utxo: IBlockchainInfoUTXO) => utxo.confirmations >= 0
        ) as IBlockchainInfoUTXO[]
    )
  } catch (e: any) {
    throw new Error(e)
  }
}

export const getUTXOWorthGreatestValueForAddress = async (address: string) => {
  const unspents = await getUnspentsWithConfirmationsForAddress(address)
  return unspents.reduce(function (prev, current) {
    return prev.value > current.value ? prev : current
  })
}

export const getSatpointFromUtxo = (utxo: IBlockchainInfoUTXO) => {
  return `${utxo.tx_hash_big_endian}:${utxo.tx_output_n}:0`
}

export const getUnspentsForAddressInOrderByValue = async (address: string) => {
  const unspents = await getUnspentsWithConfirmationsForAddress(address)
  return unspents.sort((a, b) => b.value - a.value)
}

export const getInscriptionsByWalletBIS = async (
  walletAddress: string,
  offset: number = 0
) => {
  return (await axios
    .get(
      `https://api.bestinslot.xyz/v3/wallet/inscriptions?address=${walletAddress}&sort_by=inscr_num&order=asc&offset=${offset}&count=100`,
      {
        headers: {
          'X-Api-Key': 'abbfff3d-49fa-4f7f-883a-0a5fce48a9f1',
        },
      }
    )
    .then((res) => res.data?.data)) as IBISWalletIx[]
}

export const getUTXOsToCoverAmount = async (
  address: string,
  amountNeeded: number,
  inscriptionLocs?: string[],
  usedUtxos?: IBlockchainInfoUTXO[]
) => {
  const unspentsOrderedByValue = await getUnspentsForAddressInOrderByValue(
    address
  )
  const retrievedIxs = await getInscriptionsByWalletBIS(address)
  const bisInscriptionLocs = retrievedIxs.map(
    (utxo) => utxo.satpoint
  ) as string[]

  if (bisInscriptionLocs.length === 0) {
    inscriptionLocs = []
  } else {
    inscriptionLocs = bisInscriptionLocs
  }

  let sum = 0
  const result: IBlockchainInfoUTXO[] = []

  for await (let utxo of unspentsOrderedByValue) {
    const currentUTXO = utxo
    const utxoSatpoint = getSatpointFromUtxo(currentUTXO)
    if (
      (inscriptionLocs &&
        inscriptionLocs?.find((utxoLoc: any) => utxoLoc === utxoSatpoint)) ||
      currentUTXO.value <= 546
    ) {
      continue
    }

    if (
      (usedUtxos &&
        usedUtxos?.find(
          (utxoLoc: IBlockchainInfoUTXO) =>
            utxo.tx_hash_big_endian === utxoLoc.tx_hash_big_endian &&
            utxo.tx_output_n === utxoLoc.tx_output_n
        )) ||
      currentUTXO.value <= 546
    ) {
      console.log('SKIPPIN!!!!!!!')
      continue
    }

    sum += currentUTXO.value
    result.push(currentUTXO)
    if (sum > amountNeeded) {
      console.log('AMOUNT RETRIEVED: ', sum)
      return result
    }
  }

  return [] as IBlockchainInfoUTXO[]
}

export const getUTXOsToCoverAmountWithRemainder = async (
  address: string,
  amountNeeded: number,
  inscriptionLocs?: string[]
) => {
  const unspentsOrderedByValue = await getUnspentsForAddressInOrderByValue(
    address
  )
  const retrievedIxs = await getInscriptionsByWalletBIS(address)
  const bisInscriptionLocs = retrievedIxs.map(
    (utxo) => utxo.satpoint
  ) as string[]

  if (bisInscriptionLocs.length === 0) {
    inscriptionLocs = []
  } else {
    inscriptionLocs = bisInscriptionLocs
  }

  let sum = 0
  const result: IBlockchainInfoUTXO[] = []

  for await (let utxo of unspentsOrderedByValue) {
    const currentUTXO = utxo
    const utxoSatpoint = getSatpointFromUtxo(currentUTXO)
    if (
      (inscriptionLocs &&
        inscriptionLocs?.find((utxoLoc: any) => utxoLoc === utxoSatpoint)) ||
      currentUTXO.value <= 546
    ) {
      continue
    }

    sum += currentUTXO.value
    result.push(currentUTXO)
    if (sum > amountNeeded) {
      return result
    }
  }

  return result as IBlockchainInfoUTXO[]
}

export const getTheOtherUTXOsToCoverAmount = async (
  address: string,
  amountNeeded: number,
  inscriptionLocs?: string[]
) => {
  const unspentsOrderedByValue = await getUnspentOutputs(address)

  const retrievedIxs = await getInscriptionsByWalletBIS(address)
  const bisInscriptions = retrievedIxs.map((utxo) => utxo.satpoint) as string[]

  if (bisInscriptions.length === 0) {
    inscriptionLocs = []
  } else {
    inscriptionLocs = bisInscriptions
  }

  let sum = 0
  const result: IBlockchainInfoUTXO[] = []

  for (let i = 0; i < unspentsOrderedByValue.length; i++) {
    const currentUTXO = unspentsOrderedByValue.reverse()[i]
    const utxoSatpoint = getSatpointFromUtxo(currentUTXO)
    if (
      inscriptionLocs &&
      inscriptionLocs?.find((utxoLoc: any) => utxoLoc === utxoSatpoint)
    ) {
      continue
    }

    sum += currentUTXO.value
    result.push(currentUTXO)

    if (sum > amountNeeded) {
      return result
    }
  }

  return [] as IBlockchainInfoUTXO[]
}

export const getUTXOByAddressTxIDAndVOut = async (
  address: string,
  txId: string,
  vOut: number
) => {
  const unspents = await getUnspentsWithConfirmationsForAddress(address)
  return unspents.find(
    (utxo) => utxo.tx_hash_big_endian === txId && utxo.tx_output_n === vOut
  )
}

export function calculateAmountGathered(utxoArray: IBlockchainInfoUTXO[]) {
  return utxoArray?.reduce((prev, currentValue) => prev + currentValue.value, 0)
}

export const getScriptForAddress = async (address: string) => {
  const utxos = await getUnspentOutputs(address)
  const { script } = utxos.unspent_outputs[0]
  return script
}

export const formatOptionsToSignInputs = async ({
  _psbt,
  isRevealTx,
  pubkey,
  segwitPubkey,
  segwitAddress,
  taprootAddress,
}: {
  _psbt: bitcoin.Psbt
  isRevealTx: boolean
  pubkey: string
  segwitPubkey: string
  segwitAddress: string
  taprootAddress: string
}) => {
  let toSignInputs: ToSignInput[] = []
  const psbtNetwork = bitcoin.networks.bitcoin
  try {
    let index = 0
    for await (const v of _psbt.data.inputs) {
      let script: any = null
      let value = 0
      const isSigned = v.finalScriptSig || v.finalScriptWitness
      const lostInternalPubkey = !v.tapInternalKey
      if (v.witnessUtxo) {
        script = v.witnessUtxo.script
        value = v.witnessUtxo.value
      } else if (v.nonWitnessUtxo) {
        const tx = bitcoin.Transaction.fromBuffer(v.nonWitnessUtxo)
        const output = tx.outs[_psbt.txInputs[index].index]
        script = output.script
        value = output.value
      }
      if (!isSigned && lostInternalPubkey) {
        const address = PsbtAddress.fromOutputScript(script, psbtNetwork)

        if (taprootAddress === address) {
          const tapInternalKey = assertHex(Buffer.from(pubkey, 'hex'))
          const p2tr = bitcoin.payments.p2tr({
            internalPubkey: tapInternalKey,
            network: psbtNetwork,
          })
          if (
            v.witnessUtxo?.script.toString('hex') ==
            p2tr.output?.toString('hex')
          ) {
            v.tapInternalKey = tapInternalKey
          }
          if (v.tapInternalKey) {
            toSignInputs.push({
              index: index,
              publicKey: pubkey,
              sighashTypes: v.sighashType ? [v.sighashType] : undefined,
            })
          }
        }
      }
      if (script && !isSigned && !isTaprootInput(v)) {
        toSignInputs.push({
          index: index,
          publicKey: segwitPubkey,
          sighashTypes: v.sighashType ? [v.sighashType] : undefined,
        })
      }

      index++
    }

    return toSignInputs
  } catch (error) {
    console.log(error)
  }
}

export const signInputs = async (
  psbt: bitcoin.Psbt,
  toSignInputs: ToSignInput[],
  taprootPubkey: string,
  segwitPubKey: string,
  segwitSigner: any,
  taprootSigner: any
) => {
  try {
    const taprootInputs: ToSignInput[] = []
    const segwitInputs: ToSignInput[] = []
    toSignInputs.forEach(({ index, publicKey }) => {
      if (publicKey === taprootPubkey) {
        taprootInputs.push(toSignInputs[index])
      }
      if (segwitPubKey && segwitSigner) {
        if (publicKey === segwitPubKey) {
          segwitInputs.push(toSignInputs[index])
        }
      }
    })
    if (taprootInputs.length > 0) {
      await taprootSigner(psbt, taprootInputs)
    }
    if (segwitSigner && segwitInputs.length > 0) {
      await segwitSigner(psbt, segwitInputs)
    }
    return psbt
  } catch (error) {
    console.log(error)
  }
}

export const inscribe = async ({
  ticker,
  amount,
  inputAddress,
  outputAddress,
  mnemonic,
  taprootPublicKey,
  segwitPublicKey,
  segwitAddress,
  isDry,
  segwitHdPathWithIndex,
  taprootHdPathWithIndex,
  payFeesWithSegwit,
}: {
  ticker: string
  amount: number
  inputAddress: string
  outputAddress: string
  mnemonic: string
  taprootPublicKey: string
  segwitPublicKey: string
  segwitAddress: string
  isDry?: boolean
  segwitHdPathWithIndex?: string
  taprootHdPathWithIndex?: string
  payFeesWithSegwit: boolean
}) => {
  const fastestFee = await getRecommendedBTCFeesMempool()
  try {
    const secret =
      'd84d671cbd24a08db5ed43b93102484bd9bd8beb657e784451a226cf6a6e259b'

    const secKey = ecc2.keys.get_seckey(String(secret))
    const pubKey = ecc2.keys.get_pubkey(String(secret), true)
    const content = `{"p":"brc-20","op":"transfer","tick":"${ticker}","amt":"${amount}"}`

    const script = createInscriptionScript(pubKey, content)
    const tapleaf = Tap.encodeScript(script)
    const [tpubkey, cblock] = Tap.getPubKey(pubKey, { target: tapleaf })
    const inscriberAddress = Address.p2tr.fromPubKey(tpubkey)

    const wallet = new Oyl()
    const psbt = new bitcoin.Psbt()

    const taprootUtxos = await wallet.getUtxosArtifacts({
      address: inputAddress,
    })
    let segwitUtxos: any[] | undefined
    if (segwitAddress) {
      segwitUtxos = await wallet.getUtxosArtifacts({
        address: segwitAddress,
      })
    }

    const inputs = 1
    const revealVb = calculateTaprootTxSize(inputs, 0, 1)
    const revealSatsNeeded = Math.floor((revealVb + 10) * fastestFee)

    psbt.addOutput({
      value: revealSatsNeeded,
      address: inscriberAddress,
    })

    await getUtxosForFees({
      payFeesWithSegwit: payFeesWithSegwit,
      psbtTx: psbt,
      taprootUtxos: taprootUtxos,
      segwitUtxos: segwitUtxos,
      segwitAddress: segwitAddress,
      feeRate: fastestFee,
      taprootAddress: inputAddress,
      segwitPubKey: segwitPublicKey,
    })

    const toSignInputs: ToSignInput[] = await formatOptionsToSignInputs({
      _psbt: psbt,
      isRevealTx: false,
      pubkey: taprootPublicKey,
      segwitPubkey: segwitPublicKey,
      segwitAddress: segwitAddress,
      taprootAddress: inputAddress,
    })

    const taprootSigner = await createTaprootSigner({
      mnemonic: mnemonic,
      taprootAddress: inputAddress,
      hdPathWithIndex: taprootHdPathWithIndex,
    })

    const segwitSigner = await createSegwitSigner({
      mnemonic: mnemonic,
      segwitAddress: segwitAddress,
      hdPathWithIndex: segwitHdPathWithIndex,
    })

    const signedPsbt = await signInputs(
      psbt,
      toSignInputs,
      taprootPublicKey,
      segwitPublicKey,
      segwitSigner,
      taprootSigner
    )

    signedPsbt.finalizeAllInputs()

    const commitPsbtHash = signedPsbt.toHex()
    const commitTxnHex = signedPsbt.extractTransaction().toHex()
    console.log('commit hex', commitTxnHex)

    const commitTxPsbt: bitcoin.Psbt = bitcoin.Psbt.fromHex(commitPsbtHash)

    const commitTxHex = commitTxPsbt.extractTransaction().toHex()
    let commitTxId: string
    if (isDry) {
      commitTxId = commitTxPsbt.extractTransaction().getId()
      console.log('commit txId', commitTxId)
    } else {
      const { result } = await callBTCRPCEndpoint(
        'sendrawtransaction',
        commitTxHex
      )
      commitTxId = result
    }

    if (!isDry) {
      const txResult = await waitForTransaction(commitTxId)
      if (!txResult) {
        return { error: 'ERROR WAITING FOR COMMIT TX' }
      }
    }

    const txData = Tx.create({
      vin: [
        {
          txid: commitTxId,
          vout: 0,
          prevout: {
            value: revealSatsNeeded,
            scriptPubKey: ['OP_1', tpubkey],
          },
        },
      ],
      vout: [
        {
          value: 546,
          scriptPubKey: Address.toScriptPubKey(outputAddress),
        },
      ],
    })

    const sig = Signer.taproot.sign(secKey, txData, 0, {
      extension: tapleaf,
    })
    txData.vin[0].witness = [sig, script, cblock]

    if (!isDry) {
      return await callBTCRPCEndpoint(
        'sendrawtransaction',
        Tx.encode(txData).hex
      )
    } else {
      console.log({ result: Tx.util.getTxid(txData) })
      return { result: Tx.util.getTxid(txData) }
    }
  } catch (e: any) {
    return { error: e.message }
  }
}

const getRecommendedBTCFeesMempool = async () => {
  const gen_res = await axios
    .post(
      'https://mainnet.sandshrew.io/v1/6e3bc3c289591bb447c116fda149b094',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'esplora_fee-estimates',
        params: [],
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )
    .then((res) => res.data)
  return (await gen_res).result['1']
}

export const createInscriptionScript = (pubKey: any, content: any) => {
  const mimeType = 'text/plain;charset=utf-8'
  const textEncoder = new TextEncoder()
  const marker = textEncoder.encode('ord')
  return [
    pubKey,
    'OP_CHECKSIG',
    'OP_0',
    'OP_IF',
    marker,
    '01',
    textEncoder.encode(mimeType),
    'OP_0',
    textEncoder.encode(content),
    'OP_ENDIF',
  ]
}

const INSCRIPTION_PREPARE_SAT_AMOUNT = 4000

export const RPC_ADDR =
  'https://node.oyl.gg/v1/6e3bc3c289591bb447c116fda149b094'

export const callBTCRPCEndpoint = async (
  method: string,
  params: string | string[]
) => {
  const data = JSON.stringify({
    jsonrpc: '2.0',
    id: method,
    method: method,
    params: [params],
  })

  // @ts-ignore
  return await axios
    .post(RPC_ADDR, data, {
      headers: {
        'content-type': 'application/json',
      },
    })
    .then((res) => res.data)
    .catch((e) => {
      console.error(e.response)
      throw e
    })
}

export async function waitForTransaction(txId: string): Promise<boolean> {
  console.log('WAITING FOR TRANSACTION: ', txId)
  const timeout: number = 60000 // 1 minute in milliseconds

  const startTime: number = Date.now()

  while (true) {
    try {
      // Call the endpoint to check the transaction
      const response = await callBTCRPCEndpoint('esplora_tx', txId)

      // Check if the transaction is found
      if (response && response.result) {
        console.log('Transaction found in mempool:', txId)
        return true
      }

      // Check for timeout
      if (Date.now() - startTime > timeout) {
        console.log('Timeout reached, stopping search.')
        return false
      }

      // Wait for 5 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000))
    } catch (error) {
      // Check for timeout
      if (Date.now() - startTime > timeout) {
        console.log('Timeout reached, stopping search.')
        return false
      }

      // Wait for 5 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

export async function getOutputValueByVOutIndex(
  commitTxId: string,
  vOut: number
): Promise<number | null> {
  const timeout: number = 60000 // 1 minute in milliseconds
  const startTime: number = Date.now()

  while (true) {
    try {
      // Call to get the transaction details
      const txDetails = await callBTCRPCEndpoint('esplora_tx', commitTxId)

      if (
        txDetails &&
        txDetails.result &&
        txDetails.result.vout &&
        txDetails.result.vout.length > 0
      ) {
        // Retrieve the value of the first output
        return txDetails.result.vout[vOut].value
      }

      // Check for timeout
      if (Date.now() - startTime > timeout) {
        console.log('Timeout reached, stopping search.')
        return null
      }

      // Wait for 5 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000))
    } catch (error) {
      console.error('Error fetching transaction output value:', error)

      // Check for timeout
      if (Date.now() - startTime > timeout) {
        console.log('Timeout reached, stopping search.')
        return null
      }

      // Wait for 5 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

export function calculateTaprootTxSize(
  taprootInputCount: number,
  nonTaprootInputCount: number,
  outputCount: number
): number {
  const baseTxSize = 10 // Base transaction size without inputs/outputs

  // Size contributions from inputs
  const taprootInputSize = 57 // Average size of a Taproot input (can vary)
  const nonTaprootInputSize = 41 // Average size of a non-Taproot input (can vary)

  // Size contributions from outputs
  const outputSize = 34 // Average size of an output (can vary)

  // Calculate total input and output sizes
  const totalInputSize =
    taprootInputCount * taprootInputSize +
    nonTaprootInputCount * nonTaprootInputSize
  const totalOutputSize = outputCount * outputSize

  // Total transaction size
  return baseTxSize + totalInputSize + totalOutputSize
}

export async function getRawTxnHashFromTxnId(txnId: string) {
  const res = await axios.post(
    'https://mainnet.sandshrew.io/v1/6e3bc3c289591bb447c116fda149b094',
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'btc_getrawtransaction',
      params: [txnId],
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  )

  return res.data
}


export const isP2PKH = (script: Buffer, network: Network): BitcoinPaymentType => {
  const p2pkh = checkPaymentType(bitcoin.payments.p2pkh, network)(script)
  return {
    type: "p2pkh",
    payload: p2pkh
  }
}
export const isP2WPKH = (script: Buffer, network: Network): BitcoinPaymentType => {
  const p2wpkh = checkPaymentType(bitcoin.payments.p2wpkh, network)(script)
  return {
    type: "p2wpkh",
    payload: p2wpkh
  }
}
export const isP2WSHScript = (script: Buffer, network: Network): BitcoinPaymentType => {
  const p2wsh = checkPaymentType(bitcoin.payments.p2wsh, network)(script)
  return {
    type: "p2sh",
    payload: p2wsh
  }
}
export const isP2SHScript = (script: Buffer, network: Network): BitcoinPaymentType => {
  const p2sh = checkPaymentType(bitcoin.payments.p2sh, network)(script)
  return {
    type: "p2sh",
    payload: p2sh
  }
}
export const isP2TR = (script: Buffer, network: Network): BitcoinPaymentType => {
  const p2tr = checkPaymentType(bitcoin.payments.p2tr, network)(script)
  return {
    type: "p2tr",
    payload: p2tr
  }
}