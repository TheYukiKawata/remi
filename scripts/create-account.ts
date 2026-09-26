import { createSponsorAuthorization } from "@mysten-incubation/memwal";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, fromHex, toBase64 } from "@mysten/sui/utils";

const RELAYER_URL = "https://relayer.memory.walrus.xyz";
const GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";
const CLOCK = "0x6";

type Deployment = { packageId: string; registryId: string };

const sui = new SuiGraphQLClient({ url: GRAPHQL_URL, network: "mainnet" });

async function fetchPackageId(): Promise<string> {
  const response = await fetch(`${RELAYER_URL}/config`);
  const config = (await response.json()) as { packageId: string };
  return config.packageId;
}

async function findRegistryId(packageId: string): Promise<string> {
  const { data } = await sui.query({
    query: `query ($type: String!) { objects(filter: { type: $type }, first: 1) { nodes { address } } }`,
    variables: { type: `${packageId}::account::AccountRegistry` },
  });
  const registryId = (data as any)?.objects?.nodes?.[0]?.address;
  if (!registryId) throw new Error(`No AccountRegistry found for package ${packageId}`);
  return registryId;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${RELAYER_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return (await response.json()) as T;
}

async function executeSponsored(owner: Ed25519Keypair, transaction: Transaction): Promise<string> {
  const sender = owner.toSuiAddress();
  transaction.setSender(sender);
  const kindBytes = await transaction.build({ client: sui, onlyTransactionKind: true });
  const authorization = await createSponsorAuthorization(sender, kindBytes, (message) =>
    owner.signPersonalMessage(message),
  );
  const sponsored = await postJson<{ bytes: string; digest: string }>("/sponsor", {
    transactionBlockKindBytes: toBase64(kindBytes),
    sender,
    ...authorization,
  });
  const { signature } = await owner.signTransaction(fromBase64(sponsored.bytes));
  const executed = await postJson<{ digest: string }>("/sponsor/execute", {
    digest: sponsored.digest,
    sender,
    signature,
  });
  await sui.waitForTransaction({ digest: executed.digest });
  return executed.digest;
}

async function findCreatedAccountId(digest: string): Promise<string> {
  const { data, errors } = await sui.query({
    query: `query ($digest: String!) {
      transaction(digest: $digest) {
        effects { objectChanges { nodes { address idCreated outputState { asMoveObject { contents { type { repr } } } } } } }
      }
    }`,
    variables: { digest },
  });
  if (errors?.length) throw new Error(JSON.stringify(errors));
  const changes = (data as any).transaction.effects.objectChanges.nodes as {
    address: string;
    idCreated: boolean;
    outputState?: { asMoveObject?: { contents?: { type?: { repr?: string } } } };
  }[];
  const account = changes.find(
    (change) => change.idCreated && change.outputState?.asMoveObject?.contents?.type?.repr?.endsWith("::account::MemWalAccount"),
  );
  if (!account) throw new Error(`No MemWalAccount created in ${digest}`);
  return account.address;
}

async function createAccount(owner: Ed25519Keypair, deployment: Deployment): Promise<string> {
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${deployment.packageId}::account::create_account`,
    arguments: [transaction.object(deployment.registryId), transaction.object(CLOCK)],
  });
  const digest = await executeSponsored(owner, transaction);
  console.log(`create_account: ${digest}`);
  return findCreatedAccountId(digest);
}

async function addDelegateKey(
  owner: Ed25519Keypair,
  deployment: Deployment,
  accountId: string,
  delegate: Ed25519Keypair,
  label: string,
): Promise<void> {
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${deployment.packageId}::account::add_delegate_key`,
    arguments: [
      transaction.object(accountId),
      transaction.object(deployment.registryId),
      transaction.pure.vector("u8", Array.from(delegate.getPublicKey().toRawBytes())),
      transaction.pure.string(label),
      transaction.object(CLOCK),
    ],
  });
  const digest = await executeSponsored(owner, transaction);
  console.log(`add_delegate_key: ${digest}`);
}

export async function setUpMemWalAccount(owner: Ed25519Keypair, delegate: Ed25519Keypair, label: string) {
  const packageId = await fetchPackageId();
  const deployment = { packageId, registryId: await findRegistryId(packageId) };
  const accountId = await createAccount(owner, deployment);
  await addDelegateKey(owner, deployment, accountId, delegate, label);
  return { accountId, owner: owner.toSuiAddress(), ...deployment };
}

function keypairFromSuiPrivateKey(suiPrivateKey: string): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(suiPrivateKey).secretKey);
}

if (import.meta.main) {
  const ownerKey = process.env.OWNER_SUI_PRIVATE_KEY;
  const delegateKey = process.env.MEMWAL_PRIVATE_KEY;
  if (!ownerKey || !delegateKey) {
    throw new Error("Set OWNER_SUI_PRIVATE_KEY (suiprivkey1...) and MEMWAL_PRIVATE_KEY (delegate key hex)");
  }
  const result = await setUpMemWalAccount(
    keypairFromSuiPrivateKey(ownerKey),
    Ed25519Keypair.fromSecretKey(fromHex(delegateKey)),
    "remi",
  );
  console.log(result);
}
