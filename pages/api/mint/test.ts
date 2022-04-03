import createKeypair, { getKeypair, NFTMintMaster, updateMetadata, uploadImageToArweave, uploadMetadataToArweave } from "@/mint/mint";
import { generateMetadata } from "@/mint/utils/metadata";
import { web3 } from "@project-serum/anchor";
import { NextApiRequest, NextApiResponse } from "next";


export default async function mint(
    req: NextApiRequest,
    res: NextApiResponse
) {

    // const stuff = await createKeypair('348d305f-3156-44ec-98f6-5d052bea2aa8');
    // const stuff = await getKeypair('348d305f-3156-44ec-98f6-5d052bea2aa8');

    // const stuff = await uploadImageToArweave(142, 3);

    const stuff = await updateMetadata(new web3.PublicKey("2UtShXKkgQr9rejpPxcEuiW7m6jqc5URwgBwdKVKqqLh"));

    // const stuff = await uploadImageToArweave(142)

    // const stuff = await uploadMetadataToArweave(96);

    return res.status(200).json(stuff);
}