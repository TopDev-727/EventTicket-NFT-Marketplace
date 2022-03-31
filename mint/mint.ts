import * as web3 from "@solana/web3.js";
import { actions, Wallet, NodeWallet } from "@metaplex/js";
import base58 from "bs58";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { supabase } from "@/supabase/supabase-admin";
import crypto from "crypto-js";
import randCrypto from "crypto";
import { resourceUsage } from "process";
import { stringifyPubkeysAndBNsInObject } from "./utils/util";
import Bundlr from "@bundlr-network/client";
import { getFileFromSupabase } from "@/supabase/supabase-client";
import { SelectPicker } from "rsuite";
import { generateMetadata } from "./utils/metadata";
import Key from "@/types/Key";
import BigNumber from "bignumber.js";
import { checkTokenBalance } from "./utils/accounts";
import { Account } from "@metaplex-foundation/mpl-core"
import { Metadata, MetadataProgram, SetAndVerifyCollectionArgs, SetAndVerifyCollectionCollection, Edition } from "@metaplex-foundation/mpl-token-metadata";


//https://openquest.xyz/quest/create-burn-nft-solana

const encryptionKey = process.env.PRIVATE_KEY_ENCRYPTION_KEY!;
const verifiedSolSvcKey = process.env.VERIFIED_INK_SOL_SERVICE_KEY!;

// Function to create a keypair for each user and store in supabase
export async function generateKeypair(
  user_id: string
): Promise<{ success: boolean; data: Key | null; message: string }> {
  try {
    const keypair = await web3.Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    // Store the secret key that will be used later to regenerate the keypair object
    // using web3.Keypair.fromSecretKey(base58.decode(secretKey))
    const secretKey = base58.encode(keypair.secretKey);

    // Encrypt the private key with a salt and store in supabase
    const salt = randCrypto.randomBytes(32).toString("hex").slice(0, 32);
    const saltedEncryptionKey = encryptionKey + salt;
    const encryptedSecretKey = crypto.AES.encrypt(
      secretKey,
      saltedEncryptionKey
    ).toString();

    // Store the public key in supabase if it doesn't already exist
    const { data, error } = await supabase
      .from("keys")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) {
      return {
        success: false,
        data: null,
        message: error.message,
      };
    }

    if (!data) {
      // Store the values in supabase
      const res = await supabase.from("keys").insert({
        user_id: user_id,
        public_key: publicKey,
        secret_key: encryptedSecretKey,
        salt: salt,
      });

      if (res.error) {
        return {
          success: false,
          data: null,
          message: res.error.message,
        };
      } else {
        return {
          success: true,
          data: res.data[0],
          message: "",
        };
      }
    }

    return {
      success: true,
      data: data,
      message: "",
    };
  } catch (err) {
    console.log(err);
    return {
      success: false,
      data: null,
      message: "There was an error at generateKeyPair",
    };
  }
}

export async function getKeypair(user_id: string) {
  const { data, error } = await supabase
    .from("keys")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();
  if (error) {
    console.log(error);
    return error;
  }

  const decryptedSecretKey = crypto.AES.decrypt(
    data.secret_key,
    encryptionKey + data.salt
  ).toString(crypto.enc.Utf8);
  const keypair = await web3.Keypair.fromSecretKey(
    base58.decode(decryptedSecretKey)
  );

  // return {
  //   publicKey: data.public_key,
  //   decyptedPublicKey: keypair.publicKey.toBase58()
  // }

  return keypair;
}

export default generateKeypair;

// Function to upload image to arweave
// import Bundlr from '@bundlr-network/client';

export async function uploadImageToArweave(nft_id: number, serial_no: number) {
  // TODO: Pull Image for Serial Number - possibly just generate image on the fly

  const { data: ownerData, error: ownerError } = await supabase
    .from("nft_owner")
    .select(`nft (screenshot_file_id)`)
    .match({ nft_id, serial_no })
    .single();

  if (ownerError) {
    return { arweave_id: null };
  }

  const screenshot = await fetch(
    `https://verified-api.vercel.app/api/screenshot/create/${nft_id}?serial_no=${serial_no}`
  );
  let dataurl = await screenshot.text();
  dataurl = dataurl.split(", ")[1];

  const buffer = Buffer.from(dataurl, "base64");

  const tags = [{ name: "Content-Type", value: "image/png" }];
  // call to upload to arweave
  const arweave = await uploadToArweave(buffer, tags);

  // TODO: Store arweave_id in a new supabase table that holds all uploads to arweave
  // TODO: Look into how we can tag arweave uploads with info to make retreival easier
  const arweave_id = `https://arweave.net/${arweave.data.id}?ext=png`;
  console.log(arweave_id);

  return { arweave_id };
}

// Function to create JSON files and upload to arweave

export async function uploadMetadataToArweave(
  nft_id: number,
  serial_no: number
) {
  const metadata = await generateMetadata(nft_id, serial_no);

  if (!metadata) {
    return { arweave_id: null };
  }

  const buffer = Buffer.from(JSON.stringify(metadata.data));

  const tags: any[] = [{ name: "Content-Type", value: "application/json" }];
  // call to upload to arweave
  const arweave = await uploadToArweave(buffer, tags);

  const arweave_id = `https://arweave.net/${arweave.data.id}`;
  console.log(arweave_id);

  return { arweave_id };
}

export async function updateMetadata(mint_key: web3.PublicKey) {
  // Update metadata - 43n7Z5UwFivwyAGSonriJwKM2H8e7cQZPQuNNRaVv6Eb
  const env = process.env.NEXT_PUBLIC_SOL_ENV!;

  const keypair = await web3.Keypair.fromSecretKey(
    base58.decode(verifiedSolSvcKey)
  );
  const wallet = new NodeWallet(keypair);
  const connection = new web3.Connection(
    env,
    "confirmed"
  );

  const collectionMint = env.includes("dev") ? new web3.PublicKey("4qjeoA4TVBBWuQzUsfaCxn2vryQyixFyJ5jXqhFT9pjz")
  : new web3.PublicKey("4qjeoA4TVBBWuQzUsfaCxn2vryQyixFyJ5jXqhFT9pjz"); // Replace with mainnet collection mint key

  if (!env.includes("dev")) {
    // Remove once we have a production collection mint key
    console.log("Not on devnet");
    return null
  }


  const collectionMasterEdition = await Edition.getPDA(collectionMint);
  const collectionMetadata = await Metadata.getPDA(collectionMint);


  const metadataAccount = await Metadata.getPDA(mint_key)

  const signVerifyMetadata =
  {
    metadata: metadataAccount,
    collectionAuthority: keypair.publicKey,             //new web3.PublicKey("CuJMiRLgcG35UwyM1a5ZGWHRYn1Q6vatHHqZFLsxVEVH"),
    collectionMint: collectionMint,                     //new web3.PublicKey("4qjeoA4TVBBWuQzUsfaCxn2vryQyixFyJ5jXqhFT9pjz"),
    updateAuthority: keypair.publicKey,                 //new web3.PublicKey("CuJMiRLgcG35UwyM1a5ZGWHRYn1Q6vatHHqZFLsxVEVH"),
    collectionMetadata: collectionMetadata,             //new web3.PublicKey("6dq64RSnCoJHGn89VzshxkzPyGJsW51JqgxVa8AUsXbg"),
    collectionMasterEdition: collectionMasterEdition    //new web3.PublicKey("Gkq55px9fua9CmafLdQW1Y9r1xgLT8Qei2zkVUMDBszH")
  }

  const tx = new SetAndVerifyCollectionCollection({ feePayer: keypair.publicKey }, signVerifyMetadata)

  const transaction = new web3.Transaction().add(
    tx
  )

  const signature = await web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [wallet.payer],
  );

  return signature;

}

export async function uploadToArweave(data: Buffer, tags: any) {
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const bundlr = new Bundlr(
    "https://node1.bundlr.network",
    "solana",
    verifiedSolSvcKey
  );
  // Get the cost for upload
  const price = await bundlr.utils.getPrice("solana", data.length);
  // Get your current balance
  let balance = await bundlr.getLoadedBalance();

  console.log(`Price = ${price}`);
  console.log(`Balance = ${balance}`);

  // If you don't have enough balance for the upload
  let attempt = 0;
  while (price.gt(balance)) {
    console.log("Not enough balance");
    attempt++ > 0 ? await delay(5000) : null;
    // Fund your account with the difference
    // We multiply by 1.1 to make sure we don't run out of funds
    // await bundlr.fund(price.minus(balance), 10)
    const multiple = new BigNumber(100);
    await bundlr.fund(price.multipliedBy(multiple));
    balance = await bundlr.getLoadedBalance();
  }

  // Create, sign and upload the transaction
  // const tags = [{name: "Content-Type", value: "image/png"}];
  const tx = bundlr.createTransaction(data, { tags });
  await tx.sign();
  const res = await tx.upload();
  return res;
}

function sleep(millis: any) {
  return new Promise((resolve) => setTimeout(resolve, millis));
}
// Function to mint master NFT - Current Cost ~$2 per NFT
// This should check to ensure we haven't already minted the NFT would be nice to
// have that be an on-chain check

export async function NFTMintMaster(
  nft_id: number,
  serial_no: number
): Promise<{ mint: string | null }> {
  // Confirm the NFT doesn't already exist
  const env = process.env.NEXT_PUBLIC_SOL_ENV!;

  try {
    const { data, error } = await supabase
      .from("nft_owner")
      .select("*")
      .eq("nft_id", nft_id)
      .eq("serial_no", serial_no)
      .maybeSingle();

    if (data.mint) {
      console.log("Already minted:", data.mint);
      return data.mint;
    }

    const user_id = data.owner_id;
    const keypair = await web3.Keypair.fromSecretKey(
      base58.decode(verifiedSolSvcKey)
    );
    const wallet = new NodeWallet(keypair);
    const connection = new web3.Connection(
      env == "devnet" ? web3.clusterApiUrl("devnet") : env,
      "confirmed"
    );

    const metadata = await uploadMetadataToArweave(nft_id, serial_no);
    const uri = metadata.arweave_id;

    if (uri) {
      const maxSupply = 1;

      const result = await actions.mintNFT({
        connection,
        wallet,
        uri,
        maxSupply,
      });

      const res = stringifyPubkeysAndBNsInObject(result);

      // Send NFT to owner

      // Get public key of owner
      const { data: public_key, error: ownerError } = await supabase
        .from("keys")
        .select("public_key")
        .eq("user_id", user_id)
        .single();

      // const mint_key = new web3.PublicKey("3i6pnWCYxbF9oT1HK16TC1wqb6PKoHQFvRzRJp62EcCX");
      const mint_key = new web3.PublicKey(res.mint);
      // Need to wait for the mint key to propagate
      await sleep(5000);

      const balance = await checkTokenBalance(
        connection,
        wallet.publicKey,
        mint_key
      );

      const source_pubkey = new web3.PublicKey(balance.value[0].pubkey);

      const destination_pubkey = new web3.PublicKey(public_key.public_key);

      const send_result = await actions.sendToken({
        connection,
        wallet,
        source: source_pubkey,
        destination: destination_pubkey,
        mint: mint_key,
        amount: 1,
      });

      const transfer_res = stringifyPubkeysAndBNsInObject(send_result);

      console.log("Minted a new master NFT:", res);
      console.log("Sent NFT to owner:", transfer_res);


      const sig = await updateMetadata(mint_key)

      console.log("Sig:", sig);

      const { data, error } = await supabase
        .from("nft_owner")
        .update({ mint: res.mint })
        .eq("nft_id", nft_id)
        .eq("serial_no", serial_no)
        .single();

      return res;
    } else return { mint: null };
  } catch (err) {
    console.log(err);
    return { mint: null };
  }
}
